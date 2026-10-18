#!/usr/bin/env python3
"""Repair a damaged scan by collating independent readings of it.

    python3 -m ipsissima_mcp.collate scan.pdf [--witness "Full text of ....html"] [--out DIR]

WHY. A scan's text layer is one OCR engine's reading of the page images, made once, often long
ago, and every word it got wrong is a word a quotation will fail against. Reading the page again
with a second engine does not fix that on its own -- the second reading has its own errors -- but
two independent readings rarely make the SAME error, so where they agree they are almost always
right, and where they disagree the disagreement is exactly the place to look. That is the
textual critic's collation of witnesses, and it was measured before it was built (17 Oct 2026, a
550-page damaged DLI scan): a fresh tesseract reading agreed with an independent ABBYY text on
98.9% of its tokens, the PDF's own text layer settled about 1,500 of their disagreements, a word
list about 260 more, and roughly 500 were left -- each one a few words, settled from a crop of
the printed line.

THE WITNESSES, all read from the user's own files:

  C  a fresh tesseract reading of each page image at 300 dpi, with word boxes. The BASE: it
     carries the geometry -- page, line, word -- that everything else is mapped onto.
  B  the PDF's own text layer (pymupdf rawdict). A second reading of the same images by
     whatever engine made the PDF, and the only witness that knows the type FACE: an italic
     or bold word in B is italic or bold in the result, mapped onto C's words by position.
  A  optional: any other OCR text of the same work the user has, such as archive.org's "Full
     text of" page (read through html_to_source.find_plain_text) or a .txt. No geometry; it is
     aligned to C by its words alone.

HOW THEY ARE MATCHED. Token streams, aligned by unique 4-gram anchors, the longest increasing
chain of them, a second chain inside long unanchored stretches (a block the two engines read in
a different order), and difflib in the gaps. B is aligned page by page; A, which has no pages,
over the whole work.

HOW A DISAGREEMENT IS SETTLED, in order:
  1. a MAJORITY -- two witnesses against one;
  2. ABSENCE -- where one reading is a clause and the other a fragment of it (a layer that lost
     the middle of a line at the page edge), the words win over the gap;
  3. the LEXICON -- the system word list plus every word the witnesses agree on somewhere in
     the document -- where one reading is clean and another, of about the same length, is not;
  4. otherwise it is a DISPUTE: the reading of the witness that has proved more reliable on
     this document stands, and the dispute is logged with its sheet, line and word boxes so it
     can be settled from the page image (`dispute_strips` stacks the crops, many to an image).
A sheet no other witness read (an image-only scan, no witness given) has nothing to vote with;
there the words tesseract was unsure of and no word list knows are the disputes. A word only
the layer saw goes where the layer put it; visible text set over a scan -- a publisher's access
stamp -- is kept as it is, for ingest's stamp-blanking to find.

WHAT COMES OUT is a copy of the PDF whose invisible text layer is the collated reading, word by
word at C's boxes. The rest of the pipeline -- pdf_to_source's headings, footnote zones,
furniture, page markers and the geometry sidecar -- then runs on that copy unchanged, which is
why the coordinates of every word still match the original scan exactly.

WHERE IT KEEPS ITS WORK: a cache folder per PDF (by content hash), never beside a Zotero
attachment -- see `cache_dir`. The OCR is kept there, so a second run costs seconds.
"""
from __future__ import annotations

import argparse
import bisect
import csv
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

DPI = 300
K = DPI / 72
#: Tesseract's automatic page segmentation: it finds columns and blocks itself, which a journal's
#: two-column page needs (psm 6, "one uniform block", reads straight across the gutter).
PSM = "3"
#: A page is a scan when images cover this much of it. Only those pages are read again: a born-
#: digital cover sheet or front page keeps its own text, which no OCR can improve on.
SCANNED_COVER = 0.6
#: How far, in tokens, a region may be widened on each side to find a place where every witness
#: agrees again.
EXTEND = 4
#: A region longer than this, in tokens, on both sides, is not voted word by word.
LONG_REGION = 40
#: Below this confidence, a word only tesseract read, that is no known word, is a dispute.
LONE_CONFIDENCE = 60
#: A difflib pass over a gap longer than this on both sides is not worth its quadratic time;
#: the gap is left unaligned, which only means no witness vouches for it.
GAP_LIMIT = 3000


# --------------------------------------------------------------------------- tools and places

def tesseract():
    """The tesseract executable, or None. Looked for beyond PATH: an app launched from the Dock
    -- Claude Desktop starting this server -- inherits a PATH without Homebrew's folders."""
    found = shutil.which("tesseract")
    if found:
        return found
    for p in ("/opt/homebrew/bin/tesseract", "/usr/local/bin/tesseract", "/usr/bin/tesseract",
              r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
        if os.path.exists(p):
            return p
    return None


def tesseract_version(exe):
    try:
        r = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=20)
        m = re.search(r"tesseract\s+v?(\S+)", (r.stdout or "") + (r.stderr or ""))
        return m.group(1) if m else "unknown"
    except (OSError, subprocess.SubprocessError):
        return None


def cache_root():
    if os.environ.get("IPSISSIMA_CACHE"):
        return Path(os.environ["IPSISSIMA_CACHE"]).expanduser()
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Caches" / "ipsissima"
    if os.name == "nt":
        return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "ipsissima" / "cache"
    return Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "ipsissima"


def file_hash(path):
    h = hashlib.sha1()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def cache_dir(pdf):
    """Where the collation of THIS file keeps its work: OCR, the collated PDF, the disputes.

    KEYED BY CONTENT, NOT PATH. The same attachment opened from Zotero's storage and from a copy
    in a working folder is one scan and is read once; a re-downloaded file with different bytes
    is a different scan and is read again. And never inside Zotero's storage folder, for the
    reason `server._page_images_dir` gives -- Ipsissima leaves that tree untouched."""
    pdf = Path(pdf)
    stem = re.sub(r"[^A-Za-z0-9]+", "-", pdf.stem)[:40].strip("-") or "scan"
    return cache_root() / "collation" / f"{stem}-{file_hash(pdf)[:12]}"


# --------------------------------------------------------------------------- tokens

TOK = re.compile(r"[A-Za-z0-9À-ɏ]+(?:['’][A-Za-z]+)*|\S")
LIGS = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st"}
QMAP = str.maketrans({"“": '"', "”": '"', "„": '"', "″": '"', "‘": "'", "’": "'", "′": "'",
                      "`": "'", "–": "—", "‒": "—"})


SUPERSCRIPTS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")


def pre(s):
    for a, b in LIGS.items():
        s = s.replace(a, b)
    s = s.translate(SUPERSCRIPTS)            # a note number one engine raised and one did not
    return "".join(ch for ch in s.replace("--", "—") if ch >= " " and ch != "\u00ad")


class Tok(tuple):
    """(text, space_before), and -- for a token of the text layer -- `at`, the layer's word it
    came from, so a word only the layer saw can be put where the layer put it, and `j`, its
    place in the layer's stream."""
    at = None
    j = None


def toks(word, at=None):
    """A printed word as tokens: letter-and-digit runs, and each mark on its own. The first
    token carries the space before the word, the rest are glued to it."""
    out = []
    for i, t in enumerate(TOK.findall(pre(word))):
        k = Tok((t, i == 0))
        k.at = at
        out.append(k)
    return out


def vk(t):
    """The comparison key: curly and straight quotes, and the dashes, are one. Case is not --
    small capitals read as lower case are a real error."""
    return t.translate(QMAP)


def ak(t):
    """The anchoring key: case folded too, so a capitalised word can still hold an alignment."""
    return vk(t).lower()


def key(seg):
    """A reading, spaces ignored: `in the` and `inthe` are one reading differently spaced."""
    return "".join(vk(t) for t, _ in seg)


def text_of(seg):
    out = ""
    for t, sp in seg:
        out += (" " if sp and out else "") + t
    return out


# --------------------------------------------------------------------------- the lexicon

#: A reading made only of quote marks, dashes, and the "?" a layer writes for a glyph it could
#: not encode -- or of nothing.
MARKS = re.compile(r"['\"`‘’“”‚„′″—–‒\-?]*")

WORD_LISTS = ("/usr/share/dict/words", "/usr/dict/words", "/usr/share/dict/web2")
WEIRD = set("~^°¢§«»|{}\\_¬•■®©¥€£<>@#=+*")
_DICT = [None]


def system_words():
    """The system word list, lower-cased, or an empty set where the platform has none (then
    the lexicon is what the witnesses agree on, which is most of a document's vocabulary)."""
    if _DICT[0] is None:
        words = set()
        for p in WORD_LISTS:
            if os.path.exists(p):
                with open(p, encoding="utf-8", errors="replace") as fh:
                    words |= {w.strip().lower() for w in fh if w.strip()}
                break
        _DICT[0] = words
    return _DICT[0]


class Lexicon:
    SUFFIXES = ("'s", "’s", "s", "es", "ed", "d", "ing", "ly", "er", "est", "ness", "ment")

    def __init__(self, agreed=()):
        self.words = system_words()
        self.agreed = Counter(agreed)

    def known(self, t):
        low = vk(t).lower()
        if low in self.agreed or low in self.words:
            return True
        for suf in self.SUFFIXES:
            if low.endswith(suf) and len(low) > len(suf) + 2:
                stem = low[:-len(suf)]
                if stem in self.words or stem in self.agreed:
                    return True
        return False

    def bad(self, seg):
        """How un-word-like a reading is. A word nobody knows costs 1 -- it may be a proper name
        the list lacks (`Plato` is not in macOS's); damage no word has costs 2: a stray symbol,
        digits run into letters (`1Plato`, a note number glued to its word; `tbe1`), and
        capitals and lower case mixed mid-word (`ANaLysis`, small capitals half read)."""
        b = 0
        for k, (t, _) in enumerate(seg):
            nxt = seg[k + 1] if k + 1 < len(seg) else None
            if t in ("!", "?", "|", "l") and nxt is not None and not nxt[1] and nxt[0].isdigit():
                b += 2                      # `!4`, `?59`: a note number or folio half read
                continue
            if any(c in WEIRD for c in t):
                b += 2
            elif re.search(r"\d", t) and re.search(r"[A-Za-z]", t) and not re.fullmatch(
                    r"\d+(?:st|nd|rd|th|d)|\d{2,}s", t):
                b += 2                      # `7s` for `is`, but `1970s` and `2nd` stand
            elif t.isalpha() and (re.search(r"[a-z][A-Z]|[A-Z]{2}[a-z]{2}", t)) and not (
                    re.fullmatch(r"(?:Mc|Mac)[A-Z][a-z]+", t)):
                b += 2                      # `INus`, `DirricuLties`: small capitals half read
            elif t.isalpha() and not self.known(t):
                b += 1
        return b


# --------------------------------------------------------------------------- alignment

def _lis(pairs):
    """The longest chain of (i, j) pairs increasing in both, pairs given sorted by i."""
    tails, tidx, prev = [], [], [None] * len(pairs)
    for k, (_i, j) in enumerate(pairs):
        p = bisect.bisect_left(tails, j)
        if p == len(tails):
            tails.append(j)
            tidx.append(k)
        else:
            tails[p] = j
            tidx[p] = k
        prev[k] = tidx[p - 1] if p else None
    chain, k = [], tidx[-1] if tidx else None
    while k is not None:
        chain.append(pairs[k])
        k = prev[k]
    return chain[::-1]


def align(x, y, n=4):
    """For each token of `x`, the index of the token of `y` it corresponds to, or -1.

    Unique n-grams of both sides are the anchors, the longest increasing chain of them is kept,
    and inside a long stretch the chain skipped -- typically a block one engine read in another
    order -- a second chain is looked for among the anchors not yet used. Between anchors,
    difflib matches what it can."""
    gx = [tuple(x[i:i + n]) for i in range(len(x) - n + 1)]
    gy = [tuple(y[i:i + n]) for i in range(len(y) - n + 1)]
    cx, cy = Counter(gx), Counter(gy)
    py = {g: j for j, g in enumerate(gy) if cy[g] == 1}
    pairs = [(i, py[g]) for i, g in enumerate(gx) if cx[g] == 1 and g in py]
    chain = _lis(pairs)
    eq = [-1] * len(x)
    used = set()

    def take(ch):
        for i, j in ch:
            for d in range(n):
                if eq[i + d] < 0 and (j + d) not in used:
                    eq[i + d] = j + d
                    used.add(j + d)

    take(chain)
    # The second chain, inside long unanchored stretches of x.
    i = 0
    while i < len(x):
        if eq[i] >= 0:
            i += 1
            continue
        s = i
        while i < len(x) and eq[i] < 0:
            i += 1
        if i - s >= 12:
            inner = [(a, b) for a, b in pairs if s <= a and a + n <= i and b not in used]
            ch = _lis(inner)
            if len(ch) >= 2:
                take(ch)
    # difflib in the gaps between consecutive anchors that run forward in y.
    anchors = [(a, b) for a, b in enumerate(eq) if b >= 0]
    pi, pj = -1, -1
    for a, b in anchors + [(len(x), len(y))]:
        if b > pj and a > pi + 1 and b > pj + 1 and (a - pi < GAP_LIMIT or b - pj < GAP_LIMIT):
            sm = difflib.SequenceMatcher(None, x[pi + 1:a], y[pj + 1:b], autojunk=False)
            for sa, sb, size in sm.get_matching_blocks():
                for d in range(size):
                    if eq[pi + 1 + sa + d] < 0:
                        eq[pi + 1 + sa + d] = pj + 1 + sb + d
        if b > pj:
            pi, pj = a, b
        else:                      # a jump back in y: the next gap starts here
            pi, pj = a, b
    return eq


# --------------------------------------------------------------------------- witness C: tesseract

def is_scanned(page):
    """Is this sheet a picture of a page? Images covering most of it, and upright."""
    area = abs(page.rect)
    if not area:
        return False
    cover = 0.0
    for info in page.get_image_info():
        r = page.rect & info["bbox"]
        cover += abs(r) if r.is_valid else 0
    return cover / area >= SCANNED_COVER


def run_ocr(pdf, sheets, cache, lang="eng", jobs=None, log=None):
    """Tesseract every sheet in `sheets` (0-based) at 300 dpi, into `cache/ocr/sNNNN.tsv`.

    Kept: a second run on the same file reads nothing again. The renders are temporary. The page
    is rendered here, one at a time -- MuPDF is not to be shared between threads -- and the
    engines run in parallel, one thread each."""
    import pymupdf
    exe = tesseract()
    ver = tesseract_version(exe)
    ocr = Path(cache) / "ocr"
    meta = ocr / "meta.json"
    want = dict(engine="tesseract", version=ver, dpi=DPI, psm=PSM, lang=lang)
    if meta.exists():
        try:
            if json.loads(meta.read_text()) != want:
                shutil.rmtree(ocr)
        except (ValueError, OSError):
            shutil.rmtree(ocr, ignore_errors=True)
    ocr.mkdir(parents=True, exist_ok=True)
    meta.write_text(json.dumps(want))
    todo = [s for s in sheets if not (ocr / f"s{s + 1:04d}.tsv").exists()]
    if not todo:
        return ocr, 0
    jobs = jobs or max(1, min(8, (os.cpu_count() or 2) - 1))
    env = dict(os.environ, OMP_THREAD_LIMIT="1")
    tmp = Path(tempfile.mkdtemp(prefix="ipsissima-ocr-"))

    def engine(s):
        png, base = tmp / f"s{s + 1:04d}.png", tmp / f"s{s + 1:04d}"
        r = subprocess.run([exe, str(png), str(base), "-l", lang, "--psm", PSM, "tsv"],
                           capture_output=True, text=True, env=env, timeout=600)
        png.unlink(missing_ok=True)
        out = Path(str(base) + ".tsv")
        if r.returncode != 0 or not out.exists():
            raise RuntimeError(f"tesseract failed on sheet {s + 1}: {(r.stderr or '')[-200:]}")
        shutil.move(str(out), str(ocr / out.name))

    t0 = time.time()
    try:
        with pymupdf.open(str(pdf)) as doc, ThreadPoolExecutor(jobs) as ex:
            futures = []
            for s in todo:
                # Back-pressure: never more than a few renders waiting on disk.
                while sum(1 for f in futures if not f.done()) > 2 * jobs:
                    time.sleep(0.05)
                doc[s].get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY).save(
                    str(tmp / f"s{s + 1:04d}.png"))
                futures.append(ex.submit(engine, s))
            for f in futures:
                f.result()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if log:
        log(f"tesseract read {len(todo)} sheet(s) in {time.time() - t0:.0f}s")
    return ocr, len(todo)


DESCENDERS = set("gjpqy,;()[]{}|/")


def read_tsv(path, sheet):
    """C's lines for one sheet: [{x0, y0, x1, y1, base, size, words: [{t, x0, y0, x1, y1,
    conf}]}], coordinates in PDF points, in tesseract's reading order."""
    lines = {}
    order = []
    with open(path, newline="", encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh, delimiter="\t", quoting=csv.QUOTE_NONE):
            if row.get("level") != "5" or not (row.get("text") or "").strip():
                continue
            k = (int(row["block_num"]), int(row["par_num"]), int(row["line_num"]))
            if k not in lines:
                lines[k] = []
                order.append(k)
            x0, y0 = int(row["left"]) / K, int(row["top"]) / K
            lines[k].append(dict(t=row["text"].strip(), x0=x0, y0=y0,
                                 x1=x0 + int(row["width"]) / K, y1=y0 + int(row["height"]) / K,
                                 conf=float(row["conf"]), sheet=sheet))
    out = []
    for k in order:
        ws = lines[k]
        # THE BASELINE AND THE SIZE, from the words that show them. A word with no descender
        # sits on the baseline; its height above it says the type size once it is known which
        # letters made it -- an ascender (b d f h k l), a capital or figure (0.92 of that), or
        # only x-height letters (0.70). Measured on born-digital pages rendered and read like a
        # scan (Machamer et al. 2000, Koopman 2010), and the ratios are what matter: a title in
        # capitals measured by its cap height as though by ascenders came out the size of the
        # body, and lost its heading. Every word of the line is then written at the one size, on
        # the one baseline -- a size wandering from word to word would read to pdf_to_source as
        # footnote markers and headings.
        flat = [w for w in ws if not (set(w["t"]) & DESCENDERS) and re.search(r"\w", w["t"])]
        base = (sorted(w["y1"] for w in flat)[len(flat) // 2] if flat
                else max(w["y1"] for w in ws))
        norm = []
        for w in flat:
            h = base - w["y0"]
            if re.search(r"[bdfhkl]", w["t"]):
                norm.append(h)
            elif re.search(r"[A-Z0-9]", w["t"]) and not re.search(r"[ti]", w["t"]):
                norm.append(h / 0.92)
            elif re.fullmatch(r"[aceomnrsuvwxz]+", w["t"]):
                norm.append(h / 0.70)
        height = max(w["y1"] for w in ws) - min(w["y0"] for w in ws)
        size = sorted(norm)[len(norm) // 2] / 0.85 if norm else height / 1.1
        out.append(dict(x0=min(w["x0"] for w in ws), y0=min(w["y0"] for w in ws),
                        x1=max(w["x1"] for w in ws), y1=max(w["y1"] for w in ws),
                        base=base, size=round(max(4.0, min(size, 72.0)), 1), words=ws,
                        sheet=sheet))
    return out


# --------------------------------------------------------------------------- witness B: the layer

def overlays(page):
    """Rectangles of VISIBLE text set over a scanned sheet: a publisher's access stamp, a
    repository's cover line. That text is not anybody's reading of the image -- it is exact,
    born-digital, and the stamp-blanking in ingest knows its every form -- so it is kept as it
    is, and the OCR of the same ink is dropped. Where most of a sheet's text is visible, it is
    an OCR layer set under the image rather than over it, and counts as the layer."""
    import pymupdf
    vis, rects, total = 0, [], 0
    for t in page.get_texttrace():
        n = sum(1 for ch in t["chars"] if chr(ch[0]).strip())
        total += n
        if t["type"] != 3 and t.get("opacity", 1) > 0 and n:
            vis += n
            rects.append(pymupdf.Rect(t["bbox"]))
    return rects if total and vis <= 0.25 * total else []


def _under(box, rects):
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    return any(r.x0 - 1 <= cx <= r.x1 + 1 and r.y0 - 1 <= cy <= r.y1 + 1 for r in rects)


def layer_words(page, skip=()):
    """B's words for one sheet, in the order the PDF stores them, with their boxes and faces;
    any lying in the `skip` rectangles (the visible overlays) left out."""
    try:
        from .pdf_to_source import BOLD_FONT, ITALIC_FONT
    except ImportError:
        from pdf_to_source import BOLD_FONT, ITALIC_FONT
    words = []
    for b in page.get_text("rawdict").get("blocks", []):
        for l in b.get("lines", []):
            for s in l.get("spans", []):
                font = s.get("font") or ""
                it = bool(s.get("flags", 0) & 2 or ITALIC_FONT.search(font))
                bo = bool(s.get("flags", 0) & 16 or BOLD_FONT.search(font))
                cur = None
                for ch in s.get("chars", []):
                    c = ch["c"]
                    if c.isspace() or c < " ":
                        if cur:
                            words.append(cur)
                        cur = None
                        continue
                    x0, y0, x1, y1 = ch["bbox"]
                    if cur is None:
                        cur = dict(t="", x0=x0, y0=y0, x1=x1, y1=y1, it=it, bo=bo,
                                   size=s.get("size", 0))
                    cur["t"] += c
                    cur["x0"], cur["y0"] = min(cur["x0"], x0), min(cur["y0"], y0)
                    cur["x1"], cur["y1"] = max(cur["x1"], x1), max(cur["y1"], y1)
                if cur:
                    words.append(cur)
    if skip:
        words = [w for w in words if not _under((w["x0"], w["y0"], w["x1"], w["y1"]), skip)]
    return words


def faces_by_position(cwords, bwords):
    """Italic and bold for each of C's words, from B's words lying inside its box. B's words are
    taken only from the band the C words occupy -- comparing every word with every word on the
    page cost fourteen seconds on a 28-page scan."""
    if not cwords:
        return []
    y0 = min(w["y0"] for w in cwords) - 2
    y1 = max(w["y1"] for w in cwords) + 2
    band = [b for b in bwords if b["y1"] > y0 and b["y0"] < y1]
    out = []
    for w in cwords:
        it = bo = tot = 0
        for b in band:
            ix = min(w["x1"], b["x1"]) - max(w["x0"], b["x0"])
            iy = min(w["y1"], b["y1"]) - max(w["y0"], b["y0"])
            bw = max(b["x1"] - b["x0"], 0.1)
            if ix > 0.5 * bw and iy > 0:
                n = len(b["t"])
                tot += n
                it += n if b["it"] else 0
                bo += n if b["bo"] else 0
        out.append((tot > 0 and it / tot > 0.5, tot > 0 and bo / tot > 0.5))
    return out


# --------------------------------------------------------------------------- witness A: other OCR

def read_witness(path):
    """Another OCR text of the same work, as plain text: a .txt, or an HTML page whose text
    is one <pre> (archive.org's "Full text of", read by html_to_source.find_plain_text) or,
    failing that, the page's text."""
    p = Path(path).expanduser()
    raw = p.read_text(encoding="utf-8", errors="replace")
    if p.suffix.lower() in (".html", ".htm"):
        from bs4 import BeautifulSoup
        try:
            from .html_to_source import find_plain_text
        except ImportError:
            from html_to_source import find_plain_text
        soup = BeautifulSoup(raw, "lxml")
        return find_plain_text(soup) or soup.get_text("\n")
    return raw


# --------------------------------------------------------------------------- the vote

class Witness:
    """A reading other than C's: its tokens, and for each of C's tokens the one it matches."""

    def __init__(self, name, tokens, eq):
        self.name, self.tokens, self.eq = name, tokens, eq

    def anchored(self, S, E):
        n = len(self.eq)
        return (S == 0 or self.eq[S - 1] >= 0) and (E == n or self.eq[E] >= 0)

    def reading(self, S, E):
        """This witness's reading of C's span [S, E), between the tokens it agrees on either
        side -- or None: no anchor there, anchors out of order, or a reading far too long to be
        the same words."""
        n = len(self.eq)
        if not self.anchored(S, E):
            return None
        left = self.eq[S - 1] if S > 0 else -1
        right = self.eq[E] if E < n else len(self.tokens)
        if right <= left:
            return None
        seg = self.tokens[left + 1:right]
        if len(seg) > 3 * (E - S) + 6:
            return None
        return list(seg)


def regions(eq):
    """C's spans a witness does not vouch for: runs it has no match for, and the places it has
    words C has not (an insertion between two agreed tokens)."""
    n, out, i = len(eq), [], 0
    while i < n:
        if eq[i] < 0:
            s = i
            while i < n and eq[i] < 0:
                i += 1
            out.append((s, i))
            continue
        if i + 1 < n and eq[i + 1] > eq[i] + 1:
            out.append((i + 1, i + 1))
        i += 1
    return out


def decide(reads, lexicon):
    """(chosen witness, why, supporters) for one region's readings: a majority, else the
    lexicon, else a dispute (chosen None, settled afterwards by reliability)."""
    groups = {}
    for w, seg in reads.items():
        groups.setdefault(key(seg), []).append(w)
    ranked = sorted(groups.values(), key=len, reverse=True)
    cleanest = lambda ws: min(ws, key=lambda w: (lexicon.bad(reads[w]), w != "C"))  # noqa: E731
    if len(groups) == 1:
        # The same letters, spaced differently: `inthe` against `in the`.
        return cleanest(list(reads)), "spacing", list(reads)
    if len(ranked[0]) >= 2 and len(ranked[0]) > len(ranked[1]):
        return cleanest(ranked[0]), "majority", ranked[0]
    # CAPITALS ALONE: the same letters, cased differently -- small capitals read as capitals by
    # one engine and as lower case by another (`INUS` and `inus`, Mackie 1965, twenty times
    # over). The fresh reading's casing stands unless it is the garbled one.
    if len({k.lower() for k in groups}) == 1:
        return cleanest(list(reads)), "case", list(reads)
    # QUOTE MARKS AND DASHES are not worth a reader's look. Which quote a page prints, or which
    # dash, does not survive quotation-matching anyway (the normaliser folds them), and a layer
    # that encodes a dash or a curly quote as "?" is not reading it at all: on Mackie (1965) such
    # pairs were 300 of 460 disputes. The fresh reading's mark stands; where it saw none and
    # another witness did, that one's.
    if all(MARKS.fullmatch(key(seg) or "") for seg in reads.values()):
        full = [w for w in reads if key(reads[w]) and "?" not in key(reads[w])]
        pick = "C" if "C" in full else (full[0] if full else "C")
        return pick, "marks", [pick]
    # ABSENCE IS NOT A READING. A layer that lost the middle of three printed lines (the
    # Gettier's page edge: "the conditions st though it is at the same tim that") reads two
    # letters where the page has a clause; a longer reading of the same span, mostly words, is
    # the page's words, not one opinion among two. Counted as a RATE, not a total: a long
    # reading has more unknown words than two letters have, and judged by totals a scan's whole
    # text once lost to the 22-word header that was all its layer held (Goffman 1952).
    content = {w: sum(1 for t, _ in seg if re.search(r"\w", t)) for w, seg in reads.items()}
    longest = max(reads, key=lambda w: (content[w], w == "C"))
    if (content[longest] >= 3
            and all(content[w] <= min(content[longest] - 3, content[longest] / 2) for w in reads
                    if key(reads[w]) != key(reads[longest]))
            and lexicon.bad(reads[longest]) <= content[longest] / 3):
        return longest, "absence", [w for w in reads if key(reads[w]) == key(reads[longest])]
    # THE LEXICON COMPARES LIKE WITH LIKE: readings of about the same length, where fewer
    # unknown words means a better reading and not merely a shorter one.
    lo, hi = min(content.values()), max(content.values())
    if hi - lo <= max(2, hi / 2):
        bads = sorted((min(lexicon.bad(reads[w]) for w in ws), i) for i, ws in enumerate(ranked))
        if bads[0][0] + 1 <= bads[1][0]:
            ws = ranked[bads[0][1]]
            return cleanest(ws), "lexicon", ws
    return None, "dispute", []


def vote(C, witnesses, lexicon, decided=None, ident=None):
    """Settle every disagreement between C and the other witnesses.

    Returns (events, wins): one event per region where some witness reads otherwise than C,
    with every reading, the verdict and the witness chosen; and each witness's tally of
    regions won and lost where no judgement was needed -- its measured reliability, which
    decides the disputes."""
    n = len(C)
    if not witnesses:
        return [], Counter()
    rival = witnesses[0]
    events = []
    for s, e in regions(rival.eq):
        S, E = s, e
        if not rival.anchored(S, E):
            continue
        # Widen, a few tokens at most, until each further witness agrees with C either side
        # too -- only so far as the witnesses already in still do. One that never anchors here
        # is left out of this region.
        held = [rival]
        for w in witnesses[1:]:
            found = None
            for grow in range(EXTEND + 1):
                for left in range(grow + 1):
                    S2, E2 = max(0, S - left), min(n, E + grow - left)
                    if all(v.anchored(S2, E2) for v in held + [w]):
                        found = (S2, E2)
                        break
                if found:
                    break
            if found:
                S, E = found
                held.append(w)
        reads = {"C": list(C[S:E])}
        for w in held:
            seg = w.reading(S, E)
            if seg is not None:
                reads[w.name] = seg
        if len(reads) < 2 or all(v == reads["C"] for v in reads.values()):
            continue
        ev = dict(s=S, e=E, reads=reads)
        if ident:
            ev["id"] = ident(S)
        if decided and ev.get("id") in decided:
            ev.update(chose="decided", why="decided", support=[],
                      decided=decided[ev["id"]])
        elif E - S > LONG_REGION and len(reads.get(rival.name, ())) > LONG_REGION:
            # Two long readings of one stretch are not a disagreement about words but about
            # the stretch -- a block the engines ordered differently, a column read across.
            # Laying one over the other's word boxes would scramble it; the page's own reading,
            # which owns the boxes, stands.
            ev.update(chose="C", why="kept", support=["C"])
        else:
            ev["chose"], ev["why"], ev["support"] = decide(reads, lexicon)
        events.append(ev)
    # Overlapping regions (a widened one swallowing the next) keep the first.
    kept, last = [], -1
    for ev in events:
        if ev["s"] >= last or ev["s"] == ev["e"] == last:
            kept.append(ev)
            last = max(last, ev["e"])
    events = kept
    wins = Counter()
    for ev in events:
        if ev["why"] in ("majority", "lexicon"):
            for w in ev["reads"]:
                wins[w] += 1 if w in ev["support"] else -1
    rank = sorted(["C"] + [w.name for w in witnesses], key=lambda w: (-wins[w], w != "C"))
    for ev in events:
        if ev["why"] == "dispute":
            # Words over no words: an engine that saw nothing where another saw a footnote
            # number has not disagreed about it.
            full = [w for w in rank if w in ev["reads"] and ev["reads"][w]]
            ev["chose"] = full[0] if full and len(full) < len(ev["reads"]) else next(
                w for w in rank if w in ev["reads"])
            ev["support"] = [w for w in ev["reads"]
                             if key(ev["reads"][w]) == key(ev["reads"][ev["chose"]])]
    return events, wins


def project(out, C, s, e, chosen, extra=None, free=lambda at: True):
    """Lay a chosen reading over C's tokens [s, e): matched tokens stay where they are, changed
    ones replace C's in place, and the rest -- words C has no token for -- go where the text
    layer put them when they came from it (into `extra`), else ride on the token before. So a
    correction stays on the printed line it belongs to, a drop capital the layer read stays at
    the head of its line, and a C word that disappears leaves an empty box."""
    chosen = list(chosen)

    def spare(seg, k):
        """Tokens with no C token of their own, beside C token k."""
        seg = [Tok((t[0], True)) if t[1] is None else t for t in seg]
        placed = [t for t in seg if extra is not None and getattr(t, "at", None) is not None
                  and free(t.at)]
        for t in placed:
            extra.append(t)
        rest = [t for t in seg if all(t is not q for q in placed)]
        if not rest:
            return
        if k >= 0:
            out[k] = out[k] + rest
        elif len(C):
            out[0] = rest + out[0]

    def fit(t, k):
        if t[1] is None:
            u = Tok((t[0], C[k][1]))
            u.at, u.j = t.at, t.j
            return u
        return t

    chosen = [Tok((t[0], True)) if t[1] is None and s == e else t for t in chosen]
    if s == e:                                  # pure insertion, before C[s]
        spare(chosen, s - 1)
        return
    for k in range(s, e):
        out[k] = []
    sm = difflib.SequenceMatcher(None, [ak(t) for t, _ in C[s:e]], [ak(t) for t, _ in chosen],
                                 autojunk=False)
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == "equal":
            for d in range(a1 - a0):
                out[s + a0 + d] = [fit(chosen[b0 + d], s + a0 + d)]
        elif op == "insert":
            spare(chosen[b0:b1], s + a0 - 1)
        elif op == "replace":                   # one for one, any surplus beside the last
            span, rep = a1 - a0, chosen[b0:b1]
            for d in range(min(span, len(rep))):
                out[s + a0 + d] = [fit(rep[d], s + a0 + d)]
            if len(rep) > span:
                spare(rep[span:], s + a0 + span - 1)


def typed(text):
    """A decision typed by whoever read the page image, as tokens. The first token's spacing is
    left open (None): a reader typing `1` for a misread note number means the number, not a
    space before it, so where it replaces a token it takes that token's spacing."""
    seg = []
    for word in text.split():
        seg += toks(word)
    if seg:
        first = Tok((seg[0][0], None))
        seg[0] = first
    return seg


# --------------------------------------------------------------------------- one run

NOT_A_SCAN = "no sheet of this PDF is a page image, so there is nothing to read again"


class Collation:
    """Everything one run worked out: C's lines and words with their collated text, the
    disputes, and what was measured."""

    def __init__(self):
        self.lines, self.words, self.events, self.disputes = [], [], [], []
        self.scanned, self.skipped = [], []
        self.overlays = {}
        self.layer = {}
        self.heights = {}
        self.stats = Counter()
        self.agreement = {}
        self.wins = Counter()
        self.missing = []
        self.cache = None
        self.seconds = 0.0

    def report(self):
        return dict(sheets_read=len(self.scanned), sheets_kept=self.skipped,
                    words=len(self.words), agreement=self.agreement, settled=dict(self.stats),
                    reliability=dict(self.wins), disputes=len(self.disputes),
                    missing_pages=self.missing, seconds=round(self.seconds, 1),
                    cache=str(self.cache) if self.cache else None)


def collate(pdf, witness=None, cache=None, lang="eng", jobs=None, log=None, decisions=None):
    """Collate a scan's witnesses. Returns a Collation, or None when there is nothing to read
    again (no scanned sheet, or no tesseract) -- with the reason as a second value."""
    import pymupdf
    t0 = time.time()
    pdf = Path(pdf)
    col = Collation()
    with pymupdf.open(str(pdf)) as doc:
        for i, page in enumerate(doc):
            if not is_scanned(page):
                continue
            if page.rotation:
                col.skipped.append(i + 1)        # turned sheets keep their own layer
                continue
            col.scanned.append(i)
            col.heights[i] = page.rect.height
        if not col.scanned:
            return None, NOT_A_SCAN
        if not tesseract():
            return None, ("tesseract is not installed, so the page images could not be read "
                          "again (brew install tesseract, or the system's package)")
        col.cache = Path(cache) if cache else cache_dir(pdf)
        col.cache.mkdir(parents=True, exist_ok=True)
        if decisions is None:
            decisions = load_decisions(col.cache)
        ocr, fresh = run_ocr(pdf, col.scanned, col.cache, lang=lang, jobs=jobs, log=log)
        bwords = {}
        for s in col.scanned:
            over = col.overlays[s] = overlays(doc[s])
            for li, line in enumerate(read_tsv(ocr / f"s{s + 1:04d}.tsv", s)):
                line["index"] = li
                if over:
                    line["words"] = [w for w in line["words"] if not _under(
                        (w["x0"], w["y0"], w["x1"], w["y1"]), over)]
                    if not line["words"]:
                        continue
                col.lines.append(line)
            bwords[s] = layer_words(doc[s], skip=over)
        col.layer = bwords
    # ---- C's tokens, with the word each belongs to
    C, owner = [], []
    for line in col.lines:
        faces = faces_by_position(line["words"], bwords.get(line["sheet"], []))
        for wi, (w, (it, bo)) in enumerate(zip(line["words"], faces)):
            w.update(it=it, bo=bo, line=line, index=wi)
            col.words.append(w)
            for t in toks(w["t"]):
                C.append(t)
                owner.append(len(col.words) - 1)
    ck = [ak(t) for t, _ in C]
    # ---- B, page by page
    Bt, eqB = [], [-1] * len(C)
    starts = {}
    for i, o in enumerate(owner):
        starts.setdefault(col.words[o]["sheet"], [i, i])[1] = i + 1
    for s in col.scanned:
        off = len(Bt)
        page_toks = [t for w in bwords[s] for t in toks(w["t"], at=w)]
        lo_hi = starts.get(s)
        if lo_hi and len(page_toks) < 0.2 * (lo_hi[1] - lo_hi[0]):
            # A LAYER THAT HOLDS ALMOST NOTHING OF THE PAGE -- a database's header line over an
            # image-only scan -- is no witness to it: the page counts as read once.
            bwords[s] = []
            continue
        for k, t in enumerate(page_toks):
            t.j = off + k
        Bt += page_toks
        if s not in starts or not page_toks:
            continue
        lo, hi = starts[s]
        for k, j in enumerate(align(ck[lo:hi], [ak(t) for t, _ in page_toks])):
            if j >= 0 and vk(C[lo + k][0]) == vk(page_toks[j][0]):
                eqB[lo + k] = off + j
    witnesses = []
    # ---- A, over the whole work
    if witness:
        At = [t for ln in read_witness(witness).split("\n") for w in ln.split() for t in toks(w)]
        eqA = [j if j >= 0 and vk(C[i][0]) == vk(At[j][0]) else -1
               for i, j in enumerate(align(ck, [ak(t) for t, _ in At]))]
        witnesses.append(Witness("A", At, eqA))
        col.agreement["C~A"] = round(sum(j >= 0 for j in eqA) / max(len(C), 1), 4)
    if Bt:
        witnesses.append(Witness("B", Bt, eqB))
        col.agreement["C~B"] = round(sum(j >= 0 for j in eqB) / max(len(C), 1), 4)
    # ---- the lexicon: the word list, and what any two witnesses agree on
    agreed = [C[i][0].lower() for w in witnesses for i, j in enumerate(w.eq)
              if j >= 0 and C[i][0].isalpha()]
    lexicon = Lexicon(agreed)

    def ident(S):
        w = col.words[owner[min(S, len(owner) - 1)]]
        return f"{w['sheet'] + 1}.{w['line']['index']}.{w['index']}"

    col.events, col.wins = vote(C, witnesses, lexicon, decided=decisions, ident=ident)
    out = [[t] for t in C]
    extra = []
    boxes = {}
    for w in col.words:
        boxes.setdefault(w["sheet"], []).append(w)
    sheet_of = {id(w): s for s, ws in bwords.items() for w in ws}

    def free(bw):
        """Did C see nothing where the layer has this word? Then it is the layer's to place."""
        area = max((bw["x1"] - bw["x0"]) * (bw["y1"] - bw["y0"]), 0.01)
        for w in boxes.get(sheet_of.get(id(bw)), []):
            ix = min(w["x1"], bw["x1"]) - max(w["x0"], bw["x0"])
            iy = min(w["y1"], bw["y1"]) - max(w["y0"], bw["y0"])
            if ix > 0 and iy > 0 and ix * iy > 0.3 * area:
                return False
        return True

    for ev in col.events:
        col.stats[ev["why"]] += 1
        chosen = typed(ev["decided"]) if ev["why"] == "decided" else ev["reads"][ev["chose"]]
        ev["text"] = text_of(chosen)
        if chosen != C[ev["s"]:ev["e"]]:
            project(out, C, ev["s"], ev["e"], chosen, extra, free)
    inv = {j: i for i, j in enumerate(eqB) if j >= 0}
    place_extra(col, extra, Bt, inv, owner)
    # ---- the collated text of each of C's words
    texts = [[] for _ in col.words]
    for i, o in enumerate(owner):
        texts[o] += out[i]
    for w, seg in zip(col.words, texts):
        w["out"] = text_of(seg).strip()
    # ---- the disputes, with what a reader of the page image needs
    found = []

    def dispute(S, E, ws, readings, chose, text, ident_):
        first = col.words[ws[0]]
        line = first["line"]
        h = col.heights.get(first["sheet"], 792)
        if (line["y1"] < 0.1 * h or line["y0"] > 0.9 * h) and len(line["words"]) <= 8:
            # A running head or a folio: the converter drops it as furniture, and its page
            # number is read for the page markers from the sheet itself. Not worth a look.
            col.stats["furniture, not asked"] += 1
            return
        found.append((S, dict(
            id=ident_, sheet=first["sheet"] + 1, kind=kind_of(readings),
            line=[round(v, 1) for v in (line["x0"], line["y0"], line["x1"], line["y1"])],
            boxes=[[round(col.words[o][k], 1) for k in ("x0", "y0", "x1", "y1")] for o in ws
                   if col.words[o]["line"] is line],
            readings=readings, chose=chose, text=text,
            before=text_of([t for k in range(max(0, S - 5), S) for t in out[k]]),
            after=text_of([t for k in range(E, min(len(C), E + 5)) for t in out[k]]))))

    for ev in col.events:
        if ev["why"] != "dispute":
            continue
        S, E = ev["s"], ev["e"]
        ws = sorted({owner[i] for i in range(S, E)} or {owner[min(S, len(owner) - 1)]})
        dispute(S, E, ws, {w: text_of(seg) for w, seg in ev["reads"].items()}, ev["chose"],
                ev["text"], ev["id"])
    # A SHEET NO OTHER WITNESS READ -- an image-only scan, with no witness given -- has nothing
    # to vote against, so what the one reading was unsure of is the dispute: a word tesseract
    # gave low confidence that is no word anyone knows.
    lone = {s for s in col.scanned if not bwords.get(s)} if not witness else set()
    if lone:
        first_tok = {}
        for i, o in enumerate(owner):
            first_tok.setdefault(o, i)
        for o, w in enumerate(col.words):
            if w["sheet"] not in lone or w["conf"] >= LONE_CONFIDENCE or not w["out"]:
                continue
            if lexicon.bad(toks(w["out"])) == 0:
                continue
            S = first_tok[o]
            E = S + len(toks(w["t"]))
            wid = f"{w['sheet'] + 1}.{w['line']['index']}.{w['index']}"
            if decisions and wid in decisions:
                w["out"] = decisions[wid]
                col.stats["decided"] += 1
                continue
            col.stats["unsure, alone"] += 1
            dispute(S, E, [o], {"C": w["t"]}, "C", w["out"], wid)
    for S, d in sorted(found, key=lambda x: x[0]):
        d["n"] = len(col.disputes) + 1
        col.disputes.append(d)
    col.missing = missing_pages(col)
    col.seconds = time.time() - t0
    save_disputes(col)
    return col, None


def kind_of(readings):
    """"word", or "formula" where EVERY reading is symbols and lone letters -- mathematics or
    logic, where each engine reads garbage and the page image is needed for a transcription,
    not a choice (Ramsey 1928: most of what is left). Every reading, not any: a letter-spaced
    layer reads `w o r d` for a word, and that is no formula (Hobsbawm 2012)."""
    def formulaic(r):
        ts = [t for t, _ in toks(r)]
        symbols = sum(1 for t in ts if re.fullmatch(r"[=+<>(){}\[\]|\\/^~*#°×÷±∑∫√_]", t))
        singles = sum(1 for t in ts if re.fullmatch(r"[B-HJ-Zb-z]", t))
        return bool(symbols) or singles / len(ts) >= 0.5
    said = [r for r in readings.values() if r and toks(r)]
    return "formula" if said and all(formulaic(r) for r in said) else "word"


def place_extra(col, extra, Bt=(), inv=None, owner=()):
    """Words only the text layer had, set into C's line at the layer's own position: a token
    of each layer word, gathered back into the word, as a word of its own.

    THE LINE IS THE ONE ITS NEIGHBOURS ARE ON. The layer read `V ARIOUS` as one line where the
    page has a drop capital two lines deep, and its box for the V sat across both of C's lines;
    the word beside it on the layer's own line, matched to C, says which line it belongs to.
    Geometry decides only where no neighbour was matched."""
    inv = inv or {}
    words = {}
    for t in extra:
        words.setdefault(id(t.at), (t.at, []))[1].append(t)
    by_sheet = {}
    for line in col.lines:
        by_sheet.setdefault(line["sheet"], []).append(line)
    for bw, ts in words.values():
        sheet = next((s for s, ws in col.layer.items() if any(w is bw for w in ws)), None)
        best = None
        h = max(bw["y1"] - bw["y0"], 1)
        j = getattr(ts[0], "j", None)
        if j is not None:
            for d in range(1, 8):
                for k in (j + d, j - d):
                    if k in inv and 0 <= k < len(Bt) and Bt[k].at is not None and abs(
                            Bt[k].at["y0"] - bw["y0"]) < 0.5 * h:
                        best = ((0, 0), col.words[owner[inv[k]]]["line"])
                        break
                if best:
                    break
        if best is None:
            for line in by_sheet.get(sheet, []):
                if line["y0"] - 2 <= bw["y1"] and bw["y0"] <= line["y1"] + 2:
                    d = (0 if line["x0"] <= bw["x0"] <= line["x1"] else min(
                        abs(bw["x0"] - line["x1"]), abs(line["x0"] - bw["x1"])))
                    v = abs(line["y0"] - bw["y0"]) + 0.5 * abs(line["base"] - bw["y1"])
                    if best is None or (v, d) < best[0]:
                        best = ((v, d), line)
        if best is None or best[0][1] > 4 * best[1]["size"]:
            continue                        # nowhere on C's lines: the layer's alone, left out
        line = best[1]
        text = text_of([(t[0], i > 0 and t[1]) for i, t in enumerate(ts)])
        w = dict(t=text, out=text, x0=bw["x0"], y0=bw["y0"], x1=bw["x1"], y1=bw["y1"],
                 conf=-1, sheet=sheet, it=bw["it"], bo=bw["bo"], line=line, index=-1)
        line["words"] = sorted(line["words"] + [w], key=lambda v: v["x0"])
        col.stats["placed from the layer"] += 1


# --------------------------------------------------------------------------- missing pages

def missing_pages(col):
    """Pages the scan lacks, found from the printed folios: where the number printed on the
    sheets jumps ahead of the sheet count and stays there, the pages between were never scanned
    (and where it falls back, a sheet was scanned twice or is an unnumbered plate)."""
    try:
        from .pdf_to_source import printed_numbers
    except ImportError:
        from pdf_to_source import printed_numbers
    by_sheet = {}
    for line in col.lines:
        by_sheet.setdefault(line["sheet"], []).append(
            dict(text=" ".join(w["out"] or w["t"] for w in line["words"]),
                 y0=line["y0"], x0=line["x0"]))
    order = sorted(by_sheet)
    sheets = [(sorted(by_sheet[s], key=lambda l: l["y0"]), col.heights.get(s, 792), 0)
              for s in order]
    found = printed_numbers(sheets)
    readings = sorted((order[i], n - order[i]) for i, n in found.items())
    runs = []
    for sheet, off in readings:
        if runs and runs[-1][2] == off:
            runs[-1][1] = sheet
            runs[-1][3] += 1
        else:
            runs.append([sheet, sheet, off, 1])
    runs = [r for r in runs if r[3] >= 2]          # one stray number is not a pagination
    out = []
    for a, b in zip(runs, runs[1:]):
        if b[2] == a[2]:
            continue
        gap = b[2] - a[2]
        out.append(dict(after_sheet=a[1] + 1, before_sheet=b[0] + 1,
                        after_page=a[1] + a[2], before_page=b[0] + b[2],
                        missing=gap if gap > 0 else 0, extra=-gap if gap < 0 else 0))
    return out


# --------------------------------------------------------------------------- the collated PDF

CLOSING = re.compile(r"[,.;:?!)\]’”%…]+\S*|['\"][,.;:?!)]*")
OPENING = re.compile(r"[(\[‘“]+")


def pieces(line):
    """The words of a line as they will be written: the collated text at C's boxes, with a mark
    printed apart from its word put back on it. Tesseract gives a thin-spaced `:1` or `‘` a box of
    its own, and written as its own word it reads back `following :1` and `‘ has` -- spacing no
    one would type when quoting, so a quotation would miss on it."""
    out = []
    for w in line["words"]:
        if not w["out"]:
            continue
        p = dict(text=w["out"], x0=w["x0"], x1=w["x1"], it=w["it"], bo=w["bo"])
        if out and CLOSING.fullmatch(p["text"]) and not OPENING.fullmatch(out[-1]["text"]):
            out[-1]["text"] += p["text"]
            out[-1]["x1"] = p["x1"]
            continue
        if out and OPENING.fullmatch(out[-1]["text"]):
            p["text"] = out[-1]["text"] + p["text"]
            p["x0"] = out[-1]["x0"]
            out[-1] = p
            continue
        out.append(p)
    return out


FONTS = {(False, False): "tiro", (True, False): "tiit", (False, True): "tibo",
         (True, True): "tibi"}


def level_lines(lines):
    """One baseline and one size for the fragments of one printed line, and the fragments joined.

    Tesseract cuts a line with wide gaps -- `(a) S knows that P   IFF   (i) P is true,`, or a
    running head `122            ANALYSIS` -- into blocks of its own, each with its own guess at
    baseline and size. Written as they are, they read back as separate lines a point apart, where
    the page has one; and a page number with its running head beside it is no longer "alone" and
    stays in the text (Gettier p. 122). So the fragments of a row are written as one line -- but
    never across a column gutter, which is a gap that most of the sheet's lines leave open."""
    by_sheet = {}
    for line in lines:
        by_sheet.setdefault(line["sheet"], []).append(line)
    for sheet_lines in by_sheet.values():
        group = sorted(sheet_lines, key=lambda l: l["base"])
        rows, row = [], []
        for line in group + [None]:
            if line is not None and row and abs(line["base"] - row[0]["base"]) <= 0.3 * min(
                    line["size"], row[0]["size"]) and not any(
                    line["x0"] < r["x1"] and r["x0"] < line["x1"] for r in row):
                row.append(line)
                continue
            if len(row) > 1:
                rows.append(row)
            row = [line] if line is not None else []
        for row in rows:
            bases = sorted(r["base"] for r in row)
            sizes = sorted(r["size"] for r in row)
            row.sort(key=lambda r: r["x0"])
            for r in row:
                r["base"], r["size"] = bases[len(bases) // 2], sizes[len(sizes) // 2]
            for a, b in zip(row, row[1:]):
                if not _gutter(sheet_lines, a["x1"], b["x0"]):
                    a["next"], b["joined"] = b, True


def _gutter(lines, x0, x1):
    """Is there a column gutter somewhere between x0 and x1: an upright strip that few of the
    sheet's lines cross, with many lines either side of it? Searched across the whole gap, not
    at its middle: a paragraph's first line is indented, so the gap from the left column to it
    reaches past the right column's edge (Goffman 1952)."""
    if x1 - x0 < 2:
        return False
    best = None
    x = x0 + 0.5
    while x < x1:
        crossing = sum(1 for l in lines if l["x0"] < x < l["x1"])
        if best is None or crossing < best[0]:
            best = (crossing, x)
        x += 1.0
    crossing, x = best
    left = sum(1 for l in lines if l["x1"] <= x)
    right = sum(1 for l in lines if l["x0"] >= x)
    return crossing < 0.15 * len(lines) and left >= 5 and right >= 5


def write_layer(src, dst, col):
    """A copy of the PDF whose scanned sheets carry the collated reading as their (invisible)
    text layer, each word at C's box: the image untouched, the old layer gone.

    ONE SIZE AND ONE BASELINE PER LINE, each word stretched sideways to its box. MuPDF reports a
    stretched word's size as the size times the square root of the stretch, so the word is set
    smaller by that much, and every word of a line reads back at the line's size -- which is
    what pdf_to_source's heading and footnote rules compare."""
    import pymupdf
    fonts = {k: pymupdf.Font(v) for k, v in FONTS.items()}
    fallback = pymupdf.Font("cjk")
    level_lines(col.lines)
    by_sheet = {}
    for line in col.lines:
        by_sheet.setdefault(line["sheet"], []).append(line)
    with pymupdf.open(str(src)) as doc:
        for s in col.scanned:
            page = doc[s]
            over = col.overlays.get(s)
            if over:
                # Only the old layer's lines go; the visible overlay stays, word for word. One
                # rectangle round all of them where that misses the overlay (an annotation per
                # line cost twelve seconds on a 28-page scan), else one per line.
                rects = [pymupdf.Rect(l["bbox"]) for b in page.get_text("dict").get("blocks", [])
                         for l in b.get("lines", []) if not _under(l["bbox"], over)]
                whole = pymupdf.Rect()
                for r in rects:
                    whole |= r
                if rects and not any(whole.intersects(o) for o in over):
                    rects = [whole]
                for r in rects:
                    page.add_redact_annot(r, fill=False, cross_out=False)
            else:
                page.add_redact_annot(page.rect, fill=False, cross_out=False)
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                                  graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
                                  text=pymupdf.PDF_REDACT_TEXT_REMOVE)
            names = {}
            # ONE SHAPE, ONE COMMIT, per page: page.insert_text commits every word, and each
            # commit re-reads the page's whole content stream -- quadratic, 75 of 138 seconds on
            # a twenty-page scan (Mackie 1965).
            shape = page.new_shape()

            def face_font(face, text):
                font = fonts[face]
                if not all(font.has_glyph(ord(c)) for c in text):
                    face, font = "fallback", fallback
                name = names.get(face)
                if name is None:
                    name = names[face] = f"IpsC{len(names)}"
                    page.insert_font(fontname=name, fontbuffer=font.buffer)
                return name, font

            def put(text, x0, x1, base, size, name, font, measure=None):
                # sx is the sideways stretch, and the word is set at size / sqrt(sx) so that it
                # reads back at `size`. A word squeezed hard would be set LARGE -- 0.25 doubles
                # it -- and its box would rise above the line: the line's top then sat above the
                # line before, and pdf_to_source put the two in the wrong order (Gettier p. 121).
                # So the squeeze stops at 0.83, never more than 1.1 times the size; the few words
                # narrower than that run a little past their box.
                unit = font.text_length(measure or text, fontsize=1) or 1
                sx = min(max((max(x1 - x0, 0.5) / unit / size) ** 2, 0.83),
                         1e6 if measure == " " else 4.0)
                pt = pymupdf.Point(x0, base)
                shape.insert_text(pt, text, fontname=name, fontsize=size / sx ** 0.5,
                                  render_mode=3, morph=(pt, pymupdf.Matrix(sx, 1)))

            for line in by_sheet.get(s, []):
                if line.get("joined"):
                    continue
                chain = [line]
                while chain[-1].get("next"):
                    chain.append(chain[-1]["next"])
                size, base = line["size"], line["base"]
                words = [w for frag in chain for w in pieces(frag)]
                for k, w in enumerate(words):
                    name, font = face_font((w["it"], w["bo"]), w["text"])
                    put(w["text"], w["x0"], w["x1"], base, size, name, font)
                    if k < len(words) - 1:
                        # The space to the next word is a glyph of its own, stretched across the
                        # whole gap: MuPDF ends a line at a gap wider than a space, and the
                        # page's wide gaps -- a running head, a table's columns -- are inside one
                        # printed line.
                        name, font = face_font((False, False), " ")
                        put(" ", w["x1"], max(words[k + 1]["x0"], w["x1"] + 0.5), base, size,
                            name, font, measure=" ")
            shape.commit()
        doc.save(str(dst), garbage=3, deflate=True)
    return dst


# --------------------------------------------------------------------------- disputes on disk

def save_disputes(col):
    (col.cache / "disputes.json").write_text(json.dumps(dict(
        report=col.report(), disputes=col.disputes), indent=1, ensure_ascii=False),
        encoding="utf-8")


def load_disputes(cache):
    p = Path(cache) / "disputes.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def load_decisions(cache):
    p = Path(cache) / "decisions.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def record_decisions(cache, decided):
    """Keep what a reader settled, by dispute id, so a later run of the same scan applies it
    before anything else: the decision outlives the Markdown it was first applied to."""
    have = load_decisions(cache)
    have.update(decided)
    (Path(cache) / "decisions.json").write_text(json.dumps(have, indent=1, ensure_ascii=False),
                                                encoding="utf-8")
    return have


# --------------------------------------------------------------------------- the dispute strips

def dispute_strips(pdf, disputes, out_dir, per_image=8, dpi=200, width_px=1400):
    """Stack the printed lines the disputes sit on, many to an image, each numbered and with the
    disputed words boxed in red -- the page_images idea, for reading a hundred small questions
    without rendering a hundred pages. Returns the PNG paths, in dispute order."""
    import pymupdf
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    with pymupdf.open(str(pdf)) as doc:
        for start in range(0, len(disputes), per_image):
            batch = disputes[start:start + per_image]
            crops = []
            for d in batch:
                page = doc[d["sheet"] - 1]
                x0, y0, x1, y1 = d["line"]
                clip = pymupdf.Rect(x0 - 6, y0 - 4, x1 + 6, y1 + 4) & page.rect
                crops.append((d, clip, page.get_pixmap(dpi=300, clip=clip,
                                                       colorspace=pymupdf.csGRAY)))
            label = 34.0
            wide = max(c.width for _, c, _ in crops) + label
            gap = 14.0
            tall = sum(c.height + gap for _, c, _ in crops)
            sheet = pymupdf.open()
            pg = sheet.new_page(width=wide, height=tall)
            y = 0.0
            for d, clip, pix in crops:
                r = pymupdf.Rect(label, y, label + clip.width, y + clip.height)
                pg.insert_image(r, pixmap=pix)
                for b in d["boxes"]:
                    pg.draw_rect(pymupdf.Rect(label + b[0] - clip.x0 - 1, y + b[1] - clip.y0 - 1,
                                              label + b[2] - clip.x0 + 1, y + b[3] - clip.y0 + 1),
                                 color=(0.85, 0, 0), width=0.8)
                pg.insert_text((2, y + min(clip.height, 14) - 2), f"#{d['n']}", fontsize=9,
                               color=(0.85, 0, 0))
                y += clip.height + gap
            zoom = min(dpi / 72, width_px / wide)
            f = out_dir / f"disputes-{batch[0]['n']:04d}-{batch[-1]['n']:04d}.png"
            pg.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(str(f))
            sheet.close()
            paths.append(f)
    return paths


# --------------------------------------------------------------------------- settling disputes

def _pattern(seg, literal):
    """A regex for tokens as the converter may have written them: spaces, line joins, hyphens
    and Markdown emphasis between them, quotes either way. In the context either side
    (`literal` false) a mark is optional -- the converter may have moved or merged it -- and
    in the reading itself every mark counts."""
    parts = []
    for t, _sp in seg:
        p = re.escape(t)
        p = re.sub(r"\\?['’]", "['’‘]", p)
        p = re.sub(r'\\?["“”]', '["“”]', p)
        if not literal and not re.search(r"\w", t):
            p = f"(?:{p})?"
        parts.append(p)
    return SEP.join(parts)


SEP = r"[\s*_\-\u00ad]*"


def locate(md, dispute, words=5):
    """Where a dispute's current reading stands in the converted Markdown: (start, end) of the
    reading, found between its neighbours, or None when that is not exactly one place."""
    before = typed(dispute["before"])[-words:]
    after = typed(dispute["after"])[:words]
    mid = typed(dispute["text"])
    pat = (_pattern(before, False) + SEP + "(" + _pattern(mid, True) + ")" + SEP
           + _pattern(after, False))
    hits = [m for m in re.finditer(pat, md)]
    if len(hits) != 1:
        return None
    return hits[0].span(1)


def settle(md, disputes, decisions):
    """Apply a reader's decisions -- {n or id: "A" | "B" | "C" | typed text} -- to the converted
    Markdown. Returns (md, applied, refused, by_id) where by_id records the decisions as text,
    for `record_decisions`."""
    by_n = {str(d["n"]): d for d in disputes}
    by_id = {d["id"]: d for d in disputes}
    applied, refused, record = [], [], {}
    for k, v in decisions.items():
        d = by_n.get(str(k)) or by_id.get(str(k))
        if d is None:
            refused.append(dict(dispute=k, why="no such dispute"))
            continue
        text = d["readings"].get(v) if v in ("A", "B", "C") else v
        if text is None:
            refused.append(dict(dispute=k, why=f"dispute {k} has no reading {v}"))
            continue
        record[d["id"]] = text
        if text == d["text"]:
            applied.append(dict(dispute=d["n"], text=text, change="none (already so)"))
            continue
        span = locate(md, d) or locate(md, d, words=9) or locate(md, d, words=2)
        if span is None:
            refused.append(dict(dispute=d["n"], why="its reading could not be found in the text "
                                "exactly once (the converter may have moved it, as it moves "
                                "notes). The decision is recorded and a fresh extract_text of "
                                "this PDF applies it; or repair it now with repair_source",
                                current=d["text"], wanted=text, before=d["before"],
                                after=d["after"]))
            continue
        a, b = span
        md = md[:a] + text + md[b:]
        applied.append(dict(dispute=d["n"], was=d["text"], now=text))
    return md, applied, refused, record


# --------------------------------------------------------------------------- the entry point

def collated_pdf(pdf, witness=None, lang="eng", log=None):
    """Collate and write the collated copy: (path, Collation) or (None, reason). The copy lives
    in the cache beside the OCR, named for the witnesses that made it."""
    col, why = collate(pdf, witness=witness, lang=lang, log=log)
    if col is None:
        return None, why
    tag = "cba" if witness else "cb"
    dst = col.cache / f"collated-{tag}.pdf"
    write_layer(pdf, dst, col)
    return dst, col


def notes_for(col, pdf):
    """The lines extract_text puts in the source's header, and in its reply."""
    r = col.report()
    agree = ", ".join(f"{k} {v:.1%}" for k, v in r["agreement"].items())
    st = r["settled"]
    settled = ", ".join(f"{st[k]} by {k}" for k in ("majority", "lexicon", "spacing", "decided")
                        if st.get(k))
    notes = [f"collated route: the page images read again by tesseract and voted against "
             f"{'the text layer and the witness given' if 'C~A' in r['agreement'] else 'the text layer'}"
             f" ({r['sheets_read']} sheet(s), {r['words']} words; token agreement {agree or 'n/a'}; "
             f"{settled or 'nothing to settle'}; {r['seconds']:.0f}s)"]
    alone = st.get("unsure, alone", 0)
    formulas = sum(1 for d in col.disputes if d.get("kind") == "formula")
    if len(col.disputes) > alone:
        notes.append(f"! {len(col.disputes) - alone} disagreement(s) no vote could settle -- the "
                     f"more reliable witness's reading stands in each; settle them from the page "
                     f"images with collation_disputes, then settle_disputes"
                     + (f" ({formulas} in formulas or symbols, where neither reading may be "
                        f"right: transcribe those only where the map needs them)"
                        if formulas else ""))
    if alone:
        notes.append(f"! {alone} word(s) on sheets no other witness read (no text layer, no "
                     f"witness given) that the OCR was unsure of and no word list knows -- "
                     f"check them the same way, with collation_disputes")
    for m in col.missing:
        if m["missing"]:
            notes.append(f"! {m['missing']} page(s) missing from the scan between sheets "
                         f"{m['after_sheet']} and {m['before_sheet']} (printed pp. "
                         f"{m['after_page'] + 1}-{m['before_page'] - 1}); the page markers "
                         f"number the sheets, so check pinpoints after the gap")
        elif m["extra"]:
            notes.append(f"! the printed numbering falls back by {m['extra']} between sheets "
                         f"{m['after_sheet']} and {m['before_sheet']} -- a sheet scanned "
                         f"twice, or an unnumbered plate")
    if col.skipped:
        notes.append(f"  sheets kept with their own layer (turned): {col.skipped}")
    return notes


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pdf")
    ap.add_argument("--witness", help="another OCR text of the same work (.txt or .html)")
    ap.add_argument("--lang", default="eng")
    ap.add_argument("--strips", type=int, default=0,
                    help="render the first N disputes as stacked line crops")
    a = ap.parse_args(argv)
    dst, col = collated_pdf(a.pdf, witness=a.witness, lang=a.lang,
                            log=lambda m: print(m, file=sys.stderr))
    if dst is None:
        print(col)
        return 1
    print(json.dumps(col.report(), indent=1))
    print("collated PDF:", dst)
    if a.strips and col.disputes:
        for p in dispute_strips(a.pdf, col.disputes[:a.strips], col.cache / "strips"):
            print("strip:", p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
