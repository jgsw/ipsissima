#!/usr/bin/env python3
"""Compare PDF-to-text converters on the sample papers, against a real labelled test set.

    python3 ipsissima-mcp/eval/eval_converter.py [--marker-mode fast|balanced]

WHERE THE GROUND TRUTH COMES FROM, AND WHY IT IS UNUSUALLY GOOD. Every reconstruction folder's
`convert_source.py` carries a `repairs=` list: each entry is a place where the PDF's own text
layer was WRONG, the correction, and the reason -- and the header of each converted file records
that every repair restoring lost words was read off the page image rendered at 3.6x rather than
inferred. That is a hand-labelled, human-verified corpus of exactly the failures a converter has
to survive, built for a different purpose and free to reuse here.

So this is not a similarity score against an arbitrary baseline. For each repair it asks a
three-way question with a definite answer:

    corrected    the converter produced the right text with no help
    uncorrected  it reproduced the text layer's error
    neither      it produced something else again -- inspect it

UNLIKE THE RECONSTRUCTION HARNESS, THERE IS A FACT OF THE MATTER HERE. What a page says is not
an interpretation. The reconstruction harness has no gold standard and says so at length; this
one does, because "does the output match the printed page" has an answer.

GRANULARITY IS MEASURED TOO, AND IT IS NOT A DETAIL. The paragraph locator's finest unit is the
LINE, so a converter that emits each paragraph as one long line caps how precisely any claim can
ever be placed -- and that ceiling is set at conversion time. A converter can win on text
fidelity and still be the wrong choice for this pipeline.
"""

import argparse
import ast
import glob
import os
import re
import subprocess
import sys
import time
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
SAMPLES = os.path.join(ROOT, "Argdown samples")
MARKER_BIN = os.path.expanduser("~/venvs/marker/bin/marker_single")

# The Williams converter's own residual-corruption detector, reused verbatim.
CORRUPTION = r"<[a-z£]>|\barc\b|\(j\)|[ﬁﬂﬀﬃﬄ]"
MIN_PARA = 120          # the locator's own threshold for a line worth scoring


def norm(t):
    t = unicodedata.normalize("NFKC", t)
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-")):
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t)


def read_config(folder):
    """The pdf path and the repairs list, read from the paper's own convert_source.py.

    Parsed with `ast`, not imported: importing runs the conversion at module scope in some of
    these files, and the point here is to read the labels, not to reconvert.
    """
    path = os.path.join(folder, "convert_source.py")
    if not os.path.exists(path):
        return None, []
    tree = ast.parse(open(path, encoding="utf-8").read())
    pdf, repairs = None, []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        for kw in node.keywords:
            if kw.arg == "pdf":
                try:
                    v = ast.literal_eval(kw.value.args[0]) if isinstance(kw.value, ast.Call) \
                        else ast.literal_eval(kw.value)
                    pdf = v if isinstance(v, str) else None
                except Exception:
                    pass
            if kw.arg == "repairs":
                try:
                    repairs = [tuple(r) for r in ast.literal_eval(kw.value)]
                except Exception:
                    pass
    return pdf, repairs


def score_repairs(text, repairs):
    """For each hand-made repair: did this converter need it, or get there by itself?"""
    hay = norm(text)
    out = []
    for r in repairs:
        wrong, right = norm(str(r[1])), norm(str(r[2]))
        verdict = ("corrected" if right in hay else
                   "uncorrected" if wrong in hay else "neither")
        out.append((verdict, right[:58], str(r[3])[:60] if len(r) > 3 else ""))
    return out


def granularity(text):
    """What the paragraph locator could do with this file.

    `positions` is the number of lines long enough for the locator to score at all; a converter
    that emits one line per paragraph and one per printed line differ by an order of magnitude
    here, and the difference is invisible in a word count.
    """
    lines = [l for l in text.splitlines() if len(l.strip()) >= MIN_PARA]
    return dict(lines=len(text.splitlines()), positions=len(lines),
                longest=max((len(l) for l in lines), default=0))


def ocr_backend():
    """Which OCR backend pymupdf4llm can reach, or None.

    THIS CHECK EXISTS BECAUSE ITS ABSENCE PRODUCED A WRONG PUBLISHED FINDING. pymupdf4llm was
    first measured on this machine with no OCR backend installed. On the Gettier -- a scan whose
    text layer is unusable -- it returned 345 words, the JSTOR cover page and none of the
    article, and that was written up as a catastrophic failure of the library. It was nothing of
    the kind: `rapidocr` later arrived as a transitive dependency of a library being evaluated
    for other reasons, and the same call on the same file returned 1,358 words and the best
    repair score of anything tested.

    A missing optional dependency is indistinguishable from a bad tool unless something looks.
    So the harness now looks, and says so in the results rather than scoring a zero in silence.
    """
    try:
        import rapidocr           # noqa: F401
        return "rapidocr"
    except ImportError:
        pass
    try:
        import pytesseract        # noqa: F401
        return "pytesseract"
    except ImportError:
        return None


def run_pymupdf4llm(pdf):
    """The lightweight arm: pymupdf's own markdown writer, no model server.

    Measured best-in-class on the sample corpus once an OCR backend is present -- 5 of 8 on the
    Gettier's labelled repairs against marker's 2 -- and it escalates by itself, triggering OCR
    on a damaged scan and not on a clean layer. That is route-by-damage implemented inside the
    library, which is why the pipeline no longer needs it as an architecture.
    """
    try:
        import pymupdf4llm
    except ImportError as e:
        return None, 0.0, str(e)
    if ocr_backend() is None:
        return None, 0.0, ("NO OCR BACKEND -- install rapidocr. Without one this returns the "
                           "cover page of a scanned paper and nothing else, which looks exactly "
                           "like the library failing.")
    t = time.time()
    try:
        out = pymupdf4llm.to_markdown(pdf, show_progress=False)
    except Exception as e:
        return None, time.time() - t, f"{type(e).__name__}: {e}"[:150]
    return out, time.time() - t, None


def run_docling(pdf):
    """IBM's Docling: MIT-licensed, CPU-capable, strong on multi-column academic layouts.

    Included because marker is GPL-3.0 plus a RAIL-M weight licence with commercial
    restrictions, which is a real consideration for something meant to be shared, and because
    Docling is the one mainstream alternative that needs no model server.
    """
    t = time.time()
    try:
        from docling.document_converter import DocumentConverter
        out = DocumentConverter().convert(pdf).document.export_to_markdown()
    except Exception as e:
        return None, time.time() - t, f"{type(e).__name__}: {e}"[:150]
    return out, time.time() - t, None


def run_marker(pdf, outdir, mode):
    os.makedirs(outdir, exist_ok=True)
    cmd = [MARKER_BIN, pdf, "--output_dir", outdir, "--output_format", "markdown",
           "--disable_image_extraction"]
    if mode:
        cmd += ["--mode", mode]
    t = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True)
    el = time.time() - t
    md = glob.glob(os.path.join(outdir, "**", "*.md"), recursive=True)
    if not md:
        tail = (r.stderr or r.stdout).strip().splitlines()
        return None, el, " / ".join(tail[-2:])[:150] if tail else "no output"
    return open(md[0], encoding="utf-8").read(), el, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--marker-mode", default=None, choices=["fast", "balanced"])
    ap.add_argument("--scratch", default="/tmp/converter-eval")
    ap.add_argument("--skip-docling", action="store_true")
    ap.add_argument("--skip-marker", action="store_true",
                    help="pymupdf4llm only -- marker takes minutes per paper")
    a = ap.parse_args()

    for folder in sorted(glob.glob(os.path.join(SAMPLES, "*/"))):
        name = os.path.basename(folder.rstrip("/"))
        pdf, repairs = read_config(folder)
        committed = glob.glob(os.path.join(folder, "source", "*.md"))
        if not pdf or not os.path.exists(pdf):
            local = glob.glob(os.path.join(folder, "source", "*.pdf"))
            pdf = local[0] if local else None
        if not pdf or not committed:
            print(f"\n== {name[:56]}\n   skipped (no PDF on disk)")
            continue

        base = open(committed[0], encoding="utf-8").read()
        print(f"\n== {name[:56]}")
        print(f"   {len(repairs)} hand-made repair(s) recorded for this paper")

        gran_b = granularity(base)
        print(f"\n   {'':26}{'words':>8}{'positions':>11}{'longest line':>14}{'time':>8}")
        print(f"   {'committed source':<26}{len(base.split()):>8}"
              f"{gran_b['positions']:>11}{gran_b['longest']:>14}{'-':>8}")

        arms = {}
        if not a.skip_marker:
            label = "marker " + (a.marker_mode or "default")
            arms[label] = run_marker(
                pdf, os.path.join(a.scratch, name[:24].replace(" ", "_"),
                                  a.marker_mode or "default"), a.marker_mode)
        arms["pymupdf4llm"] = run_pymupdf4llm(pdf)
        if not a.skip_docling:
            arms["docling"] = run_docling(pdf)

        for label, (out, el, err) in arms.items():
            if out is None:
                print(f"   {label:<26}{'FAILED':>8}   {err}")
                continue
            g = granularity(out)
            print(f"   {label:<26}{len(out.split()):>8}"
                  f"{g['positions']:>11}{g['longest']:>14}{el:>7.1f}s")

        if not repairs:
            continue
        print(f"\n   THE LABELLED SET ({len(repairs)} repairs the text layer needed)")
        header = "".join(f"{l[:13]:>15}" for l in arms)
        print(f"      {'what must appear':<44}{header}")
        for i, r in enumerate(repairs):
            row = ""
            for label, (out, _, _) in arms.items():
                if out is None:
                    row += f"{'-':>15}"
                    continue
                v = score_repairs(out, [r])[0][0]
                row += f"{ {'corrected':'ok','uncorrected':'MISS','neither':'??'}[v]:>15}"
            print(f"      {norm(str(r[2]))[:42]:<44}{row}")
        print("      (ok = produced the right text unaided; MISS = reproduced the text layer's")
        print("       error; ?? = produced something else again, worth looking at)")


if __name__ == "__main__":
    main()
