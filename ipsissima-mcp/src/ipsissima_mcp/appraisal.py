"""The appraisal: the reconstructor's own reading of a text, as a report beside its map (profile 1.28).

James's rulings of 19 Nov 2026. After a blind trial (4 Trials/appraisal-trial/RESULTS.md) the appraisal
was first kept as #appraisal claims in a sibling file (1.27). In use that did not work: the layer was
hidden until asked for, drawn far from the claims it appraised, and hard to read. So an appraisal is now
what the trial found valuable -- an argued, ranked REPORT -- in Markdown beside the map,
`<map stem>.appraisal.md`, shown in Ipsissima's Appraisal pane with its references as links into the map:

    ‹Claim title›            a claim or argument of the map, by its title (in the Mechanism view, the
                             step it states)
    [words](#state:ID)       a state of the map's mechanism, by its id
    [words](#table:FRAME)    one of the map's frames, by its id
    (p. 431), pp. 12-14      a page of the text, opened in the Manuscript pane

Checked here, as a map's quotations are:
    report_findings()   its quotations, found in the source and on the page cited
    report_links()      every ‹title›, state and table it links to, found in the map
"""
from __future__ import annotations

import os
import re

try:
    from ipsissima_mcp import argdown_provenance as prov
except ImportError:                      # run as a script beside check_argdown.py
    import argdown_provenance as prov

REPORT_SUFFIX = ".appraisal.md"


def map_path_for_report(report_path) -> str:
    """`x/Name.appraisal.md` -> `x/Name.argdown`."""
    return re.sub(r"\.appraisal\.md$", ".argdown", str(report_path), flags=re.I)


# ---------------------------------------------------------------- the report ---- #
# THE REPORT GETS THE MAP'S QUOTATION CHECK (APPRAISAL-PLAN.md §6). In the trial nobody misquoted,
# but writers working from the text put their own wording in quotation marks ten times in six essays,
# where a reader would take it for the author's; and the integrated route's report quoted nothing at
# all. So: every span of four or more words in double quotation marks is looked for in the source,
# and its page checked where the report gives one beside it.

def _norm(s):
    s = (s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
          .replace("—", "-").replace("–", "-").replace("­", ""))
    s = re.sub(r"(\w)-\s+(\w)", r"\1\2", s)
    s = re.sub(r"\[[^\]]*\]|\.\.\.|…", " ", s)
    s = re.sub(r"[*_]", "", s)
    s = re.sub(r"[^\w' -]", " ", s)
    return re.sub(r"\s+", " ", s).strip().lower()


_PAGE = re.compile(r"<!-- p\.(\d+) begins here -->")


def _source_pages(src):
    """Normalised text of a converted source, and (offset, page) marks. Endnotes (after a
    `# Notes` heading) are page 0: the converter moves them to the end, so their page is unknown."""
    src = re.sub(r"\n#+ *Notes\s*\n", "\n<!-- p.0 begins here -->\n# Notes\n", src, count=1)
    text, marks = "", []
    parts = _PAGE.split(src)
    for i, part in enumerate(parts):
        if i % 2 == 1:
            marks.append((len(text), int(part)))
        else:
            text += " " + _norm(re.sub(r"<!--.*?-->", " ", part, flags=re.S))
    return text, marks


def _page_at(marks, off):
    p = None
    for o, n in marks:
        if o <= off:
            p = n
    return p


def _find(text, q):
    """Offsets of a quotation in the source: exact, or piece by piece across ellipses."""
    nq = _norm(q)
    hits, i = [], text.find(nq)
    while i >= 0:
        hits.append((i, i + len(nq)))
        i = text.find(nq, i + 1)
    if hits or not re.search(r"\.\.\.|…", q):
        return hits
    parts = [_norm(x) for x in re.split(r"\.\.\.|…", q) if len(_norm(x).split()) >= 2]
    at, start = 0, None
    for x in parts:
        at = text.find(x, at)
        if at < 0:
            return []
        start = at if start is None else start
        at += len(x)
    return [(start, at)] if parts else []


_CITE_AFTER = re.compile(r"^[^.\n\"“]{0,25}?\(\s*(?:n\.\s*\d+,\s*)?pp?\.\s*(\d+)(?:\s*[-–]\s*(\d+))?")
_CITE_BEFORE = re.compile(r"\b(?:on|at)\s+pp?\.\s*(\d+)(?:\s*[-–]\s*(\d+))?[^.\n]{0,80}$", re.I)


def _range(lo, hi):
    lo = int(lo)
    if hi is None:
        return lo, lo
    if int(hi) < lo:
        hi = str(lo)[: len(str(lo)) - len(hi)] + hi
    return lo, int(hi)


def report_findings(report_text, sources):
    """Check a report's quotations against the converted source texts `sources` ({path: text}).

    Returns (findings, summary). A quotation is a span of four or more words in double quotation
    marks, paired within its paragraph. Its page is the `(p. N)` right after it, or an "on p. N"
    earlier in its sentence; a quotation with neither is looked for but not page-checked.
    """
    pages = {p: _source_pages(t) for p, t in sources.items()}
    findings, n, found, checked, right = [], 0, 0, 0, 0
    for para in re.finditer(r"[^\n]+(?:\n(?!\n)[^\n]+)*", report_text):
        ptext, pstart = para.group(0), para.start()
        for m in re.finditer(r"[\"“]([^\"“”]*?)[\"”]", ptext):
            q = m.group(1)
            if len(_norm(q).split()) < 4:
                continue
            n += 1
            line = report_text.count("\n", 0, pstart + m.start()) + 1
            hits = []
            for p, (text, marks) in pages.items():
                hits += [(p, a, b, marks) for a, b in _find(text, q)]
            if not hits:
                findings.append(("?", "report-quotation",
                                 f"“{q[:90]}” is in quotation marks but not in the text. If these are your "
                                 f"own words, take the quotation marks off, or a reader will take them for "
                                 f"the author's; if they are the author's, copy them exactly.", line))
                continue
            found += 1
            after = _CITE_AFTER.match(ptext[m.end():])
            before = None if after else _CITE_BEFORE.search(ptext[max(0, m.start() - 200): m.start()])
            cite = after or before
            if not cite:
                continue
            lo, hi = _range(cite.group(1), cite.group(2))
            checked += 1
            ok = any(any(pg == 0 or (pg is not None and lo <= pg <= hi)
                         for pg in (_page_at(mk, a), _page_at(mk, b))) for _, a, b, mk in hits)
            if ok:
                right += 1
            else:
                on = sorted({_page_at(mk, a) for _, a, _, mk in hits} - {None})
                findings.append(("!", "report-page",
                                 f"“{q[:90]}” is cited to p. {lo}{'' if hi == lo else '-' + str(hi)} but is on "
                                 f"p. {', '.join(map(str, on))}.", line))
    return findings, dict(quotations=n, found=found, page_checked=checked, page_right=right)


# ---------------------------------------------------------------- the report's links ---- #

# A title may run across a line of the Markdown source; spaces are collapsed before it is looked up.
CLAIM_LINK = re.compile(r"\u2039([^\u2039\u203a]{1,240})\u203a")
FRAG_LINK = re.compile(r"\]\(#(state|table):([^)\s]+)\)")


def report_links(report_text, doc, frontmatter):
    """Every link in a report, against the map it appraises. [(sev, check, message, line)].

    A ‹title› the map does not have is a fault: the report was written against another version of
    the map, or names a claim by its words rather than its title. So is a state or a table the map
    does not declare."""
    titles = set((doc or {}).get("statements") or {}) | set((doc or {}).get("arguments") or {})
    mech = (frontmatter or {}).get("mechanism") or {}
    states = set(((mech.get("states") or {}) if isinstance(mech, dict) else {}) or {})
    frames = (frontmatter or {}).get("frames") or {}
    frame_ids = set(frames) if isinstance(frames, dict) else set()
    out = []
    for m in CLAIM_LINK.finditer(report_text):
        t = re.sub(r"\s+", " ", m.group(1)).strip()
        if t not in titles:
            near = sorted(titles, key=lambda x: _distance(x.lower(), t.lower()))[:1]
            out.append(("!", "report-link",
                        f"‹{t}› is not a title in the map. A report names a claim by its title, exactly"
                        + (f"; the nearest is ‹{near[0]}›" if near else "") + ".",
                        report_text.count("\n", 0, m.start()) + 1))
    for m in FRAG_LINK.finditer(report_text):
        kind, ident = m.group(1), m.group(2)
        ok = ident in (states if kind == "state" else frame_ids)
        if not ok:
            have = sorted(states if kind == "state" else frame_ids)
            out.append(("!", "report-link",
                        f"#{kind}:{ident} names no {'state of the mechanism' if kind == 'state' else 'frame'} "
                        f"in the map" + (f" (it has: {', '.join(have[:12])})" if have else "") + ".",
                        report_text.count("\n", 0, m.start()) + 1))
    return out


def _distance(a, b):
    """A cheap edit distance, for the nearest title."""
    import difflib
    return 1 - difflib.SequenceMatcher(None, a, b).ratio()
