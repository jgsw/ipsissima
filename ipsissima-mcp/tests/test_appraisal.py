#!/usr/bin/env python3
"""The appraisal beside the map (profile 1.27, ruled by James 19 Nov 2026).

What is held here, each because getting it wrong would quietly mislead:
  1. THE JOIN AGREES IN BOTH LANGUAGES. The page joins a map and its sibling in JavaScript
     (argdown-graph.mjs joinAppraisal) and the checker in Python (appraisal.join). If they
     disagreed, the checker would pass a sibling the page draws differently.
  2. THE SIBLING'S RULES: a claim defined there must be #appraisal; a map claim may be named but
     never given new words; a title in neither file is a fault; findings come back on the
     SIBLING's own lines, and the map's own findings are not reported.
  3. `appraises:` is checked on every appraisal claim, in a sibling or in a map.
  4. THE REPORT CHECK: a quotation not in the text is queried; one cited to the wrong page is a
     fault; one with a right page passes; an ellipsis quotation is found piece by piece.
  5. THE APPRAISAL ROUTES in argdown_plan: no map -> a question with three routes and costs; a
     map -> the from-map route and no question.
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

GOOD = """===
map: "small.argdown"
by: "a test"
===

[Reason]
    <- [Doubt]: The reason is doubtful. #appraisal {fidelity: "imputation", warrant: "appraisal: a test", appraises: {role: criticism, aim: argument}}
"""

BAD = """===
map: "small.argdown"
===

[Untagged]: Not tagged. {fidelity: "imputation", warrant: "x"}
    -> [Main]

[Main]: New words for the map's claim. #appraisal

[Vanished]
    <- [At nothing]: x. #appraisal {fidelity: "imputation", warrant: "x", appraises: {role: criticism, aim: argument}}

[Odd]: x. #appraisal {fidelity: "imputation", warrant: "x", appraises: {role: complaint, aim: vibes}}
    -> [Reason]

[Unkeyed]: x. #appraisal {fidelity: "imputation", warrant: "x"}
    -> [Reason]
"""


# ------------------------------------------------------------------------- 1. ------ #
print("the join agrees in Python and JavaScript")
cases = [(MAP, GOOD), (MAP, "# Own heading {isGroup: true}\n\n[X]: y. #appraisal\n"), ("[A]: a.", "\n\n[B]: b.\n\n")]
node = shutil.which("node")
graph_mjs = REPO / "app" / "argdown-graph.mjs"
if node and graph_mjs.exists():
    for i, (m, s) in enumerate(cases):
        py_text, py_line, _front, _sl = ap.join(m, s)
        js = subprocess.run([node, "--input-type=module", "-e",
                             f"import {{ joinAppraisal }} from {json.dumps(graph_mjs.as_uri())};"
                             f"const r = joinAppraisal({json.dumps(m)}, {json.dumps(s)});"
                             f"process.stdout.write(JSON.stringify([r.text, r.bodyLine]));"],
                            capture_output=True, text=True)
        check(f"case {i + 1}: same text and same body line", json.loads(js.stdout or "null"), [py_text, py_line])
else:
    print("   skip (no node, or no app/ beside the package)")
t, bl, front, sl = ap.join(MAP, GOOD)
check("the sibling's front matter is set aside", "map:" in t, False)
check("the sibling's body is under its own heading", "# Appraisal {isGroup: true}" in t, True)
check("the body line points at the sibling's first line", t.split("\n")[bl - 1], "[Reason]")
check("the sibling line is that line in the sibling", GOOD.split("\n")[sl - 1], "[Reason]")
check("paths: map to sibling", ap.appraisal_path_for("/x/Name.argdown"), "/x/Name.appraisal.argdown")
check("paths: sibling to map, by name", ap.map_path_for("/x/Name.appraisal.argdown", "[A]: a."), "/x/Name.argdown")


# ------------------------------------------------------------------------- 2-3. ---- #
def run_check(folder, name):
    r = subprocess.run([sys.executable, str(PKG / "check_argdown.py"), str(folder / name),
                        "--format", "json", "--no-census"], capture_output=True, text=True)
    return json.loads(r.stdout)


print("\nthe sibling's rules, on its own lines")
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    (td / "small.argdown").write_text(MAP, encoding="utf-8")
    (td / "small.appraisal.argdown").write_text(GOOD, encoding="utf-8")
    (td / "bad.appraisal.argdown").write_text(BAD, encoding="utf-8")
    good = run_check(td, "small.appraisal.argdown")
    check("a well-formed sibling is ok", good["ok"], True)
    check("and reports nothing", good["findings"], [])
    check("under its own name", good["file"], "small.appraisal.argdown")
    bad = run_check(td, "bad.appraisal.argdown")
    got = {(f["check"], f.get("title")): f.get("line") for f in bad["findings"]}
    check("not ok", bad["ok"], False)
    check("an untagged claim defined in the sibling, at its line",
          got.get(("appraisal-sibling", "Untagged")), BAD.split("\n").index("[Untagged]: Not tagged. {fidelity: \"imputation\", warrant: \"x\"}") + 1)
    check("new words for a map claim, at their line",
          got.get(("appraisal-sibling", "Main")), BAD.split("\n").index("[Main]: New words for the map's claim. #appraisal") + 1)
    check("a title in neither file, at its line", got.get(("appraisal-target", "Vanished")), BAD.split("\n").index("[Vanished]") + 1)
    msgs = [f["message"] for f in bad["findings"] if f["check"] == "appraises"]
    check("a role outside the vocabulary is a fault", any("`role` must be one of" in m for m in msgs), True)
    check("an aim outside the vocabulary is a fault", any("`aim` must be one of" in m for m in msgs), True)
    check("a claim with no appraises: is queried", any(f["check"] == "appraises" and f["severity"] == "?" and
                                                       f.get("title") == "Unkeyed" for f in bad["findings"]), True)
    check("the map's own findings are not the sibling's",
          [f for f in bad["findings"] if f.get("line") is not None and f["line"] < 4], [])

    print("\nappraises: on an in-map appraisal claim too")
    (td / "inmap.argdown").write_text(MAP + "\n[Worry]: x. #appraisal {fidelity: \"imputation\", warrant: \"x\"}\n    -> [Reason]\n",
                                      encoding="utf-8")
    inmap = run_check(td, "inmap.argdown")
    check("queried, not a fault", [(f["check"], f["severity"]) for f in inmap["findings"] if f["check"] == "appraises"],
          [("appraises", "?")])

    print("\na sibling with no map beside it")
    (td / "orphan.appraisal.argdown").write_text("[X]: y. #appraisal\n", encoding="utf-8")
    orphan = run_check(td, "orphan.appraisal.argdown")
    check("is refused, saying which map it wanted", ("orphan.argdown" in orphan["findings"][0]["message"], orphan["ok"]),
          (True, False))


# ------------------------------------------------------------------------- 4. ------ #
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


# ------------------------------------------------------------------------- 5. ------ #
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
        check("a map: its sibling is named", p["appraisal"]["sibling"], [str(td / "paper.appraisal.argdown")])
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
