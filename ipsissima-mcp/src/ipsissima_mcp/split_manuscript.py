#!/usr/bin/env python3
"""Split a one-file book manuscript into per-chapter files plus a project file.

    python3 -m ipsissima_mcp.split_manuscript BOOK.md \
        --out DIR [--title "..."] [--dry-run]

WHAT THIS IS FOR. A book author's manuscript is usually one very long markdown file, and the
provenance tooling wants one file per chapter: `chapter` is the unit that places a claim, and the
exposition view bands by it. This turns the former into the latter, and writes the project file
that records the reading order — which is the one thing the split destroys and nothing else can
recover.

**IT ADDS NO WORDS.** Every line of prose is copied through untouched. Three things move or are
cleaned, each reported and each defensible:

  * FOOTNOTE DEFINITIONS ARE REDISTRIBUTED. Pandoc-style `[^n]:` definitions collect at the end
    of the file — all 191 of them, in the book this was built for. Split naively and every
    chapter keeps its `[^n]` markers while the definitions land in one orphan file. Each
    definition follows the file that references it. A footnote referenced from two chapters is
    reported, not silently duplicated.
  * LATEX LABEL RESIDUE IS STRIPPED FROM HEADINGS. A manuscript converted out of LyX carries
    `\\[chap:Ethics-for-complex-systems\\]` inside its heading text. That is a cross-reference
    label, not prose, and it would otherwise end up in filenames and in `section:` metadata.
    Stripped from HEADINGS only; cross-reference links in the body are left alone.
  * BOOK-LEVEL FRONT MATTER stays with the project file rather than being copied into every
    chapter.

HOW PARTS ARE TOLD FROM CHAPTERS when both are `#`. A heading naming a part (`Introduction to
Part II`) opens a part; a heading beginning with a number is a chapter; anything else is front or
back matter and is listed unparted. **Chapters before the first part marker are gathered into an
implicit opening part**, because a book with a "Part II" has a Part I whether or not it says so.

EVERY ASSUMPTION IS PRINTED, and the project file is meant to be edited. The sequential rule puts
a chapter in the most recently opened part, which is right until it is not — a book-level
conclusion sitting after the last part will be filed inside it, and only the author knows.
"""
import argparse
import os
import re
import sys

H1 = re.compile(r"^#\s+(.*?)\s*$")
LABEL = re.compile(r"\\?\[(?:chap|sec|fig|tab|eq):[^\]]*\\?\]")
FOOTNOTE_DEF = re.compile(r"^\[\^([^\]]+)\]:")
FOOTNOTE_REF = re.compile(r"\[\^([^\]]+)\]")
PART = re.compile(r"\bpart\s+([IVXLC]+|\d+)\b", re.I)
NUMBERED = re.compile(r"^(\d+)\s+(.*)$")


def slug(text, limit=48):
    s = LABEL.sub("", text)
    s = re.sub(r"[^\w\s-]", "", s.lower())
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s[:limit].rstrip("-") or "section"


def frontmatter(lines):
    """The YAML block at the top, if any, and the line it ends on."""
    if not lines or lines[0].strip() != "---":
        return {}, 0
    for i in range(1, len(lines)):
        if lines[i].strip() in ("---", "..."):
            meta = {}
            for ln in lines[1:i]:
                mo = re.match(r'^([\w-]+)\s*:\s*["\']?(.+?)["\']?\s*$', ln)
                if mo:
                    meta.setdefault(mo.group(1), mo.group(2))
            return meta, i + 1
    return {}, 0


def classify(title):
    """part | chapter | matter, and the number if there is one."""
    clean = LABEL.sub("", title).strip()
    mo = PART.search(clean)
    if mo and not NUMBERED.match(clean):
        return "part", mo.group(1), clean
    mo = NUMBERED.match(clean)
    if mo:
        return "chapter", mo.group(1), clean
    return "matter", None, clean


def split(path):
    lines = open(path, encoding="utf-8").read().splitlines()
    meta, start = frontmatter(lines)

    # Footnote definitions live in a block at the end; lift them out before splitting.
    defs, body = {}, []
    i = start
    while i < len(lines):
        mo = FOOTNOTE_DEF.match(lines[i])
        if mo:
            block = [lines[i]]
            i += 1
            while i < len(lines) and not FOOTNOTE_DEF.match(lines[i]) and not H1.match(lines[i]):
                block.append(lines[i])
                i += 1
            defs[mo.group(1)] = [l for l in block]
            continue
        body.append(lines[i])
        i += 1

    # PROSE BEFORE THE FIRST HEADING IS STILL PROSE. This used to start collecting only at the
    # first `#`, so anything between the front matter and it vanished -- 534 words of the
    # opening pages of the book this was built for, including a titled Preface. It went
    # unnoticed until the words in was compared against the words out, which is the only check
    # that would have found it.
    sections, cur = [], None
    for line in body:
        mo = H1.match(line)
        if mo:
            kind, num, clean = classify(mo.group(1))
            cur = dict(kind=kind, number=num, title=clean, raw=mo.group(1),
                       lines=["# " + clean])
            sections.append(cur)
            continue
        if cur is None:
            if not line.strip():
                continue
            cur = dict(kind="matter", number=None, title="Front matter", raw="",
                       lines=[], preamble=True)
            sections.append(cur)
        cur["lines"].append(line)
    return meta, sections, defs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book")
    ap.add_argument("--out", required=True)
    ap.add_argument("--title")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    meta, sections, defs = split(a.book)
    title = a.title or meta.get("title") or os.path.splitext(os.path.basename(a.book))[0]

    # Assign each section to a part. Chapters before the first marker form an implicit part.
    parts, current, unparted, used = [], None, [], {}
    for s in sections:
        if s["kind"] == "part":
            mo = PART.search(s["title"])
            current = dict(name=f"Part {mo.group(1).upper()}" if mo else s["title"],
                           chapters=[])
            parts.append(current)
            s["part"] = current          # the opener is a section OF the part it opens
        elif s["kind"] == "chapter":
            if current is None:
                current = dict(name="Part I", chapters=[], implicit=True)
                parts.append(current)
            s["part"] = current
        else:
            s["part"] = None
            unparted.append(s["title"])

    # Give every section its own footnote definitions, in reference order.
    shared = {}
    for s in sections:
        text = "\n".join(s["lines"])
        # The extra guard that used to sit here matched a string this code built itself, so it
        # was true for every footnote and the list came out empty -- 191 definitions reported as
        # referenced by nothing, which is exactly the kind of quiet zero worth disbelieving.
        s["notes"] = [r for r in dict.fromkeys(FOOTNOTE_REF.findall(text)) if r in defs]
        for r in s["notes"]:
            used.setdefault(r, []).append(s["title"])
    for r, owners in used.items():
        if len(owners) > 1:
            shared[r] = owners

    width = len(str(len(sections)))
    for n, s in enumerate(sections, 1):
        s["file"] = f"{str(n).zfill(width)}-{slug(s['title'])}.md"

    print(f"== {os.path.basename(a.book)}")
    print(f"   {len(sections)} top-level sections, {len(parts)} part(s), "
          f"{len(defs)} footnote definition(s)")
    for p in parts:
        tag = "  (implicit — no marker in the text)" if p.get("implicit") else ""
        print(f"\n   {p['name']}{tag}")
        for s in sections:
            if s.get("part") is p:
                mark = " (part opener)" if s["kind"] == "part" else ""
                print(f"      {s['file']:<46} {len(s['notes']):>3} notes{mark}")
    if unparted:
        print(f"\n   outside any part: {', '.join(unparted)}")
    stripped = sum(1 for s in sections if LABEL.search(s["raw"]))
    if stripped:
        print(f"\n   ! {stripped} heading(s) carried a LaTeX label, stripped from the title")
    if shared:
        print(f"   ! {len(shared)} footnote(s) referenced from more than one section: "
              + ", ".join(f"[^{r}]" for r in list(shared)[:6]))
        print("     copied into each, since neither file can be read without it")
    orphan = set(defs) - set(used)
    if orphan:
        print(f"   ! {len(orphan)} footnote definition(s) referenced by nothing: "
              + ", ".join(f"[^{r}]" for r in list(orphan)[:6]))

    if a.dry_run:
        print("\n   --dry-run: nothing written")
        return

    os.makedirs(a.out, exist_ok=True)
    for s in sections:
        out = list(s["lines"])
        while out and not out[-1].strip():
            out.pop()
        if s["notes"]:
            out += ["", ""]
            for r in s["notes"]:
                out += defs[r]
        with open(os.path.join(a.out, s["file"]), "w", encoding="utf-8") as fh:
            fh.write("\n".join(out).rstrip() + "\n")

    yml = [f'title: "{title}"']
    if meta.get("author"):
        yml.append(f'author: "{meta["author"]}"')
    yml += ["",
            "# Reading order. Paths are relative to this file, so moving the folder does not",
            "# break them. Generated by split_manuscript.py — edit freely; the sequential rule",
            "# files each chapter under the most recently opened part, which only you can check.",
            "chapters:"]
    # IN DOCUMENT ORDER, interleaving parts and unparted sections. Emitting all the unparted
    # ones first put the Afterword third in the list, ahead of Part I -- and reading order is
    # the one thing this file exists to record.
    seen_parts = set()
    for s in sections:
        p = s.get("part")
        if p is None:
            yml.append(f'  - {s["file"]}')
            continue
        if id(p) in seen_parts:
            continue
        seen_parts.add(id(p))
        yml.append(f'  - part: "{p["name"]}"')
        yml.append("    chapters:")
        for t in sections:
            if t.get("part") is p:
                yml.append(f'      - {t["file"]}')
    # NEVER OVERWRITE AN EXISTING PROJECT FILE. It is the one artefact here the author is
    # expected to edit -- the part names and boundaries this script guesses at are exactly what
    # only they can settle -- and a re-run to pick up a manuscript change would otherwise
    # silently discard those corrections.
    proj = os.path.join(a.out, "argdown-project.yml")
    if os.path.exists(proj):
        print(f"\n   wrote {len(sections)} files. KEPT the existing argdown-project.yml "
              f"(delete it to regenerate)")
    else:
        with open(proj, "w", encoding="utf-8") as fh:
            fh.write("\n".join(yml) + "\n")
        print(f"\n   wrote {len(sections)} files + argdown-project.yml to {a.out}")


if __name__ == "__main__":
    main()
