"""The appraisal: the reconstructor's own reading of a text, kept beside the map (profile 1.27).

Ruled by James, 19 Nov 2026, on the appraisal plan ("Appraisal on request/APPRAISAL-PLAN.md" in the
OneDrive work folder) and the blind trial behind it (4 Trials/appraisal-trial/RESULTS.md):

- **A sibling file.** `<map stem>.appraisal.argdown` sits beside the map and holds only `#appraisal`
  claims and arguments, and relations from them to the map's titles. The map stays a checked record
  of the text; several appraisals can sit on one map; an appraisal claim aimed at a title the map no
  longer has is caught. The in-map form (an `#appraisal` section inside the map) stays legal.
- **The division.** Each criticism, strengthening and reply is a claim in the file, attached to what
  it targets, with `appraises: {role, aim, question, literature, from_memory}`. The ranking, the
  argued verdicts and "where a critique should aim" go in a separate report, which is checked here
  for its quotations (`report_findings`), because the trial's integrated route let the report drift
  from the text.

Three things live here:
    join()              the map and its sibling as one Argdown text (twin of argdown-graph.mjs's
                        joinAppraisal; tests hold them to the same output)
    sibling_findings()  the sibling's own rules, read off the joined document's export
    appraises_findings()  the `appraises:` key on every #appraisal claim, sibling or in-map
    report_findings()   a report's quotations, found in the source and on the page cited
"""
from __future__ import annotations

import os
import re

try:
    from ipsissima_mcp import argdown_provenance as prov
except ImportError:                      # run as a script beside check_argdown.py
    import argdown_provenance as prov

SUFFIX = ".appraisal.argdown"
ROLES = ("criticism", "strengthening", "reply")
AIMS = ("argument", "mechanism", "comparison", "framing")
APPRAISES_KEYS = ("role", "aim", "question", "literature", "from_memory")


# ---------------------------------------------------------------- the sibling file ---- #

def is_appraisal_path(path) -> bool:
    return str(path or "").lower().endswith(SUFFIX)


def appraisal_path_for(map_path) -> str:
    """`x/Name.argdown` -> `x/Name.appraisal.argdown`."""
    return re.sub(r"\.(argdown|ad)$", "", str(map_path), flags=re.I) + SUFFIX


_FRONT = re.compile(r"^\s*===[ \t]*\r?\n([\s\S]*?)\r?\n===[ \t]*(?:\r?\n|$)")


def split_front_matter(text):
    """(front matter text or None, body)."""
    t = (text or "").lstrip("﻿")
    m = _FRONT.match(t)
    return (m.group(1), t[m.end():]) if m else (None, t)


def map_path_for(sibling_path, sibling_text=None) -> str:
    """The map a sibling appraises: its front matter's `map:` if it names one (relative to the
    sibling's folder), else the sibling's own name without `.appraisal`."""
    front, _ = split_front_matter(sibling_text if sibling_text is not None else
                                  open(sibling_path, encoding="utf-8").read())
    if front:
        m = re.search(r"^map:\s*['\"]?(.+?)['\"]?\s*$", front, re.M)
        if m:
            return os.path.join(os.path.dirname(os.path.abspath(sibling_path)), m.group(1))
    return re.sub(r"\.appraisal\.argdown$", ".argdown", str(sibling_path), flags=re.I)


def join(map_text, sibling_text):
    """The map and its appraisal as one text: (text, body_line, front, sibling_body_line).

    `body_line` is the 1-based line in the joined text where the sibling's body begins, and
    `sibling_body_line` the line in the sibling file where that body begins, so a finding on the
    joined text maps back by `line - body_line + sibling_body_line`. The twin of
    joinAppraisal() in app/argdown-graph.mjs.
    """
    mp = re.sub(r"\s+$", "", map_text or "")
    front, body_raw = split_front_matter(sibling_text)
    lead = len(body_raw) - len(body_raw.lstrip())
    consumed = (sibling_text or "").lstrip("﻿")
    consumed = consumed[: len(consumed) - len(body_raw) + lead]
    sibling_body_line = consumed.count("\n") + 1
    body = body_raw.strip()
    heading = "" if re.match(r"#\s", body) else "# Appraisal {isGroup: true}\n\n"
    head = mp + "\n\n" + heading
    text = head + body + "\n"
    body_line = head.count("\n") + 1
    return text, body_line, front, sibling_body_line


def _merged_data(node):
    data = {}
    for m in (node.get("members") or []) + [node]:
        for k, v in (m.get("data") or {}).items():
            data.setdefault(k, v)
    return data


def _members(node):
    return node.get("members") or []


def sibling_findings(doc, body_line):
    """The sibling's rules, on the export of the JOINED text. Returns [(severity, check, message,
    title, joined_line)]; the caller maps lines back to the sibling.

      - a claim or argument DEFINED in the sibling (given words there) must be #appraisal;
      - the sibling must not give new words to a claim the map defines;
      - every title the sibling names must be defined somewhere: a title in neither the map nor the
        appraisal is one the map no longer has (or never had), so the appraisal is aimed at nothing.
    """
    out = []
    appraisal = prov.appraisal_titles(doc)
    for kind in ("statements", "arguments"):
        for title, node in (doc.get(kind) or {}).items():
            mem = _members(node)
            in_sib = [m for m in mem if (m.get("startLine") or 0) >= body_line]
            if not in_sib:
                continue
            defined_here = [m for m in in_sib if (m.get("text") or "").strip() and not m.get("isReference")]
            defined_map = [m for m in mem if (m.get("startLine") or 0) < body_line
                           and (m.get("text") or "").strip() and not m.get("isReference")]
            if kind == "arguments":
                defined_here = [m for m in in_sib if not m.get("isReference")]
                defined_map = [m for m in mem if (m.get("startLine") or 0) < body_line and not m.get("isReference")]
            line = in_sib[0].get("startLine")
            if defined_here and defined_map:
                out.append(("!", "appraisal-sibling",
                            f"the appraisal gives new words to the map's {'argument' if kind == 'arguments' else 'claim'} "
                            f"‹{title}›. An appraisal file may name the map's titles, never redefine them: aim "
                            f"a claim of your own at it instead.", title, defined_here[0].get("startLine") or line))
            elif defined_here and title not in appraisal:
                out.append(("!", "appraisal-sibling",
                            f"‹{title}› is defined in the appraisal file but not tagged #appraisal. Everything "
                            f"an appraisal file defines is the reconstructor's own: tag it #appraisal.",
                            title, defined_here[0].get("startLine") or line))
            elif not defined_here and not defined_map and kind == "statements" and not any(
                    (m.get("text") or "").strip() for m in mem):
                out.append(("!", "appraisal-target",
                            f"‹{title}› is named in the appraisal but defined nowhere: not in the map, not in "
                            f"the appraisal. If the map has been remade, the claim this was aimed at has been "
                            f"renamed or dropped; find it and use its present title.", title, line))
    return out


def appraises_findings(doc):
    """`appraises:` on every #appraisal claim, in the map or its sibling. [(sev, check, msg, title)]."""
    out = []
    for kind in ("statements", "arguments"):
        for title, node in (doc.get(kind) or {}).items():
            if prov.APPRAISAL_TAG not in prov.node_tags(node):
                continue
            ap = _merged_data(node).get("appraises")
            if ap is None:
                out.append(("?", "appraises",
                            f"‹{title}› is an appraisal claim with no `appraises:`. Say what it is and what it "
                            f"is aimed at: appraises: {{role: criticism|strengthening|reply, "
                            f"aim: argument|mechanism|comparison|framing}}.", title))
                continue
            if not isinstance(ap, dict):
                out.append(("!", "appraises", f"‹{title}›: `appraises:` must be a map of keys, "
                                              f"not {type(ap).__name__}.", title))
                continue
            for k in ap:
                if k not in APPRAISES_KEYS:
                    out.append(("!", "appraises", f"‹{title}›: `appraises:` has no key `{k}`; it takes "
                                                  f"{', '.join(APPRAISES_KEYS)}.", title))
            if ap.get("role") not in ROLES:
                out.append(("!", "appraises", f"‹{title}›: `role` must be one of {', '.join(ROLES)}, "
                                              f"not {ap.get('role')!r}.", title))
            if ap.get("aim") is not None and ap.get("aim") not in AIMS:
                out.append(("!", "appraises", f"‹{title}›: `aim` must be one of {', '.join(AIMS)}, "
                                              f"not {ap.get('aim')!r}.", title))
            lit = ap.get("literature")
            if lit is not None and not isinstance(lit, list):
                out.append(("!", "appraises", f"‹{title}›: `literature` is a list of references.", title))
            elif lit and ap.get("from_memory") is not True and not all(
                    re.match(r"^zotero:[A-Z0-9]{8}$", str(x)) for x in lit):
                out.append(("?", "appraises",
                            f"‹{title}› cites literature without `from_memory: true` or a Zotero key "
                            f"(`zotero:ABCD1234`). A reference recalled rather than looked up must say so.",
                            title))
    return out


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
