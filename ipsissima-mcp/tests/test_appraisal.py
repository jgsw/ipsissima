#!/usr/bin/env python3
"""The appraisal as a report beside the map (profile 1.28, ruled by James 19 Nov 2026).

What is held here, each because getting it wrong would quietly mislead:
  1. THE REPORT'S QUOTATIONS: a quotation not in the text is queried; one cited to the wrong page is
     a fault; one with a right page passes; an ellipsis quotation is found piece by piece.
  2. THE REPORT'S LINKS: every ‹title›, state and table it links to must be in the map beside it,
     and a title that is not comes back with the nearest one the map has.
  3. THE APPRAISAL ROUTES in argdown_plan: no map -> a question with three routes and costs; a map
     -> the from-map route, the report's name, and no question; and a map in the folder above a
     plain folder is not taken for this text's.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPO = HERE.parents[1]
PKG = ROOT / "src" / "ipsissima_mcp"
sys.path.insert(0, str(ROOT / "src"))

from ipsissima_mcp import appraisal as ap                                 # noqa: E402

FAILED = []


def check(label, got, want):
    ok = got == want
    print(f"   {'ok  ' if ok else 'FAIL'} {label}")
    if not ok:
        print(f"        wanted {want!r}\n        got    {got!r}")
        FAILED.append(label)


MAP = """===
title: A small map
===

# The case {isGroup: true}

[Main]: The main claim. {fidelity: "compression", pinpoint: "p. 2"}
    <+ [Reason]: A reason for it. {fidelity: "compression", pinpoint: "p. 2"}
"""

# ------------------------------------------------------------------------- 1. ------ #
print("\nthe report's quotations")
SRC = ("<!-- p.10 begins here -->\nThe first page says that striking correlations call for explanation here.\n"
       "<!-- p.11 begins here -->\nThe second page says the remaining miracle is small and the realist loses little.\n"
       "\n# Notes\n\n[^1]: A note that says nothing in particular about pages.\n")
REPORT = ('He says "striking correlations call for explanation" (p. 10).\n\n'
          'He says "the remaining miracle is small" (p. 10).\n\n'
          'Voicing him: "I have no reason to doubt my beliefs at all".\n\n'
          'Joined: "the remaining miracle … the realist loses little" (p. 11).\n\n'
          'From a note: "says nothing in particular about pages" (p. 12).\n')
found, summary = ap.report_findings(REPORT, {"s.md": SRC})
kinds = sorted((sev, chk, line) for sev, chk, _m, line in found)
check("one wrong page, one quotation not in the text", kinds,
      [("!", "report-page", 3), ("?", "report-quotation", 5)])
# The endnote's quotation is checked and passes: notes are moved to the end, so their page is unknown.
check("five quotations, four found, four page-checked, three right",
      summary, dict(quotations=5, found=4, page_checked=4, page_right=3))


# ------------------------------------------------------------------------- 2. ------ #
print("\nthe report's links, against the map beside it")
FRAMED = MAP.replace("title: A small map", "title: A small map\nframes:\n    cases:\n        kind: case\n        label: The cases\n        values: [one, two]")
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    (td / "small.argdown").write_text(FRAMED, encoding="utf-8")
    (td / "small.appraisal.md").write_text(
        "The case rests on \u2039Reason\u203a, and \u2039Main\u203a follows.\n\n"
        "\u2039Mian\u203a is misspelt. See [the cases](#table:cases) and [nothing](#table:nowhere), "
        "and [a state](#state:none).\n", encoding="utf-8")
    r = subprocess.run([sys.executable, str(PKG / "check_argdown.py"), str(td / "small.appraisal.md"),
                        "--format", "json"], capture_output=True, text=True)
    out = json.loads(r.stdout)
    bad = [f for f in out["findings"] if f["check"] == "report-link"]
    check("three broken links, each a fault", [f["severity"] for f in bad], ["!", "!", "!"])
    check("the misspelt title, with the nearest the map has", any("\u2039Mian\u203a" in f["message"] and "\u2039Main\u203a" in f["message"] for f in bad), True)
    check("a table the map does not declare", any("#table:nowhere" in f["message"] for f in bad), True)
    check("a state of a map with no mechanism", any("#state:none" in f["message"] for f in bad), True)
    check("the good links pass, and are counted", out["links"], dict(claims=3, other=3, broken=3))
    check("on the report's own lines", sorted({f["line"] for f in bad}), [3])

doc = {"statements": {"Two words here": {}}, "arguments": {}}
check("a title broken across a line of the source is found", ap.report_links("See \u2039Two words\nhere\u203a.", doc, {}), [])

# ------------------------------------------------------------------------- 3. ------ #
print("\nthe appraisal routes")
try:
    from ipsissima_mcp import server
except ImportError as e:                           # the MCP SDK is not installed
    server = None
    print(f"   skip ({e})")
if server:
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        (td / "paper.md").write_text("# A paper\n\n" + "Words of the paper. " * 2000, encoding="utf-8")
        p = server.argdown_plan([str(td / "paper.md")], intent="appraise")
        check("no map: three routes", [r["id"] for r in p["appraisal"]["routes"]], ["text", "pooled", "map"])
        check("no map: the user is asked which", any(q["id"] == "appraisal-route" for q in p["questions"]), True)
        (td / "paper.argdown").write_text(MAP, encoding="utf-8")
        p = server.argdown_plan([str(td / "paper.md")], intent="appraise")
        check("a map: appraise from it", [r["id"] for r in p["appraisal"]["routes"]], ["from-map"])
        check("a map: nothing to ask", any(q["id"] == "appraisal-route" for q in p.get("questions") or []), False)
        check("a map: its report is named", p["appraisal"]["report"], [str(td / "paper.appraisal.md")])
        a = server.argdown_audit(str(td / "paper.argdown"))
        check("the audit runs on a map", a["ok"], True)
    # THE FOLDER ABOVE COUNTS ONLY FROM `source/` (CI, 19 Nov 2026: a stray map in /tmp was offered).
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        (td / "stray.argdown").write_text(MAP, encoding="utf-8")
        (td / "work").mkdir()
        (td / "work" / "paper.md").write_text("# A paper\n\n" + "Words. " * 500, encoding="utf-8")
        p = server.argdown_plan([str(td / "work" / "paper.md")], intent="appraise")
        check("a map in the folder above a plain folder is not this text's", p["appraisal"]["maps"], [])
        (td / "made" / "source").mkdir(parents=True)
        (td / "made" / "source" / "paper.md").write_text("# A paper\n\n" + "Words. " * 500, encoding="utf-8")
        (td / "made" / "paper.argdown").write_text(MAP, encoding="utf-8")
        p = server.argdown_plan([str(td / "made" / "source" / "paper.md")], intent="appraise")
        check("the map beside source/ is", p["appraisal"]["maps"], [str(td / "made" / "paper.argdown")])

print()
if FAILED:
    print(f"{len(FAILED)} FAILED: {FAILED}")
    sys.exit(1)
print("all appraisal checks pass")
