#!/usr/bin/env python3
"""Tests for the tabulation pass's notation: `frames:` in the front matter, `about:` on claims.

    python3 ipsissima-mcp/tests/test_frames.py

A trial (20 Oct 2026; docs/tabulation-pass.md). Two planted fixtures in fixtures/frames/, written
in the fixture-maker's own words with their answers known beforehand: a definition with a
counterexample and an empty cell, and options against ranked criteria with two declared accounts.
Each fault is planted in a copy, so the checker is seen to name it and to be silent on the clean
file.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CHECK = REPO / "ipsissima-mcp" / "src" / "ipsissima_mcp" / "check_argdown.py"
FIX = REPO / "fixtures" / "frames"

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok else f"\n          got {got!r} want {want!r}"))


def run(path):
    r = subprocess.run([sys.executable, str(CHECK), str(path), "--format", "json"],
                       capture_output=True, text=True)
    d = json.loads(r.stdout)
    return [f for f in d.get("findings", []) if f.get("check") == "frames"], d.get("shape", {}).get("frames")


def planted(src, old, new):
    text = (FIX / src).read_text(encoding="utf-8")
    assert old in text, old
    td = tempfile.mkdtemp()
    p = Path(td) / src
    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    return p


print("the definition and its counterexample")
found, shape = run(FIX / "definition.argdown")
check("the clean file draws no fault", [f["message"] for f in found if f["severity"] == "!"], [])
t = (shape or {}).get("tables", [{}])[0]
check("  and its census sizes the case table: 3 cases x 3 columns, 8 cells stated",
      (t.get("rows"), t.get("columns"), t.get("filled"), t.get("cells")), (3, ["informed", "right", "good"], 8, 9))
# YAML 1.1 would read `yes` as True; Argdown reads it as a word. Mutation: yaml.safe_load -> 8 faults.
check("  yes and no are read as words, as Argdown reads them",
      any("is not one of" in f["message"] for f in found), False)

found, _ = run(planted("definition.argdown", "{about: {case: B, right: yes}}", "{about: {case: B, right: maybe}}"))
check("a value the frame does not declare is a fault",
      any("`right: maybe` is not one of" in f["message"] for f in found), True)
found, _ = run(planted("definition.argdown", "{about: {case: B, right: yes}}", "{about: {case: D, right: yes}}"))
check("so is a case the frame does not declare", any("`case: D` is not one of" in f["message"] for f in found), True)
found, _ = run(planted("definition.argdown", "{about: {case: B, right: yes}}", "{about: {right: yes}}"))
check("a value with no case is asked about, not failed",
      [(f["severity"], "no case" in f["message"]) for f in found], [("?", True)])
found, _ = run(planted("definition.argdown", "{about: {case: B, right: yes}}", "{about: {case: B, luck: yes}}"))
check("a frame nobody declared is a fault", any("no frame `luck`" in f["message"] for f in found), True)
found, _ = run(planted("definition.argdown", "kind: verdict,", "kind: outcome,"))
check("a kind that is not one of the four is a fault", any("`kind: outcome`" in f["message"] for f in found), True)
found, _ = run(planted("definition.argdown", "when: {informed: yes, right: yes}", "when: {informed: yes, lucky: yes}"))
check("a rule's condition must be a declared dimension", any("`lucky` is not a declared dimension" in f["message"] for f in found), True)
found, _ = run(planted("definition.argdown", 'claim: "The definition"', 'claim: "A definition"'))
check("and the claim that states the rule must exist", any("names no claim titled" in f["message"] for f in found), True)
found, _ = run(planted("definition.argdown", "{about: {case: B, good: no}}", "{about: [{case: B, good: no}, {case: B, good: yes}]}"))
check("two values in one cell are asked about: does the text say both?",
      any("has 2 values for `good`" in f["message"] and f["severity"] == "?" for f in found), True)

print("options, criteria and two accounts")
found, shape = run(FIX / "options.argdown")
check("the clean file draws no fault", [f["message"] for f in found if f["severity"] == "!"], [])
check("  and asks about the case no claim places", [("lottery" in f["message"]) for f in found if f["severity"] == "?"], [True])
check("  its census names the accounts", (shape or {}).get("accounts"), [{"frame": "why", "accounts": ["hours", "online"]}])
found, _ = run(planted("options.argdown", 'online: {claim: "Reading moved online"}', 'online: {claim: "Reading went online"}'))
check("an account must name a claim that exists", any("no claim is titled" in f["message"] for f in found), True)
found, _ = run(planted("options.argdown", "{about: {option: grant, cost: low}}", "{about: {option: grant, why: hours}}"))
check("an account frame is never a coordinate", any("names the account frame" in f["message"] for f in found), True)
found, _ = run(planted("options.argdown", "pinpoint: \"planted\", ordered: true, values: [low, high]",
                       "pinpoint: \"planted\", ordered: true, values: [low, high], colour: red"))
check("a key a frame cannot carry is named", any("`colour` is not a key" in f["message"] for f in found), True)

print("front matter the small parser must survive")
# A flow mapping wrapped onto a second line, then a block `values:` header under an account frame:
# the hand front-matter parser read the wrapped tail as a top-level `values` string and crashed on
# the header (Bates, tabulation trial, 20 Oct 2026). Mutation: drop the `section is None and lead > 0`
# guard and the isinstance guard in argdown_provenance._parse_frontmatter -> a traceback.
p = planted("options.argdown", 'cost:  {kind: dimension, label: "cost to the council", pinpoint: "planted", ordered: true, values: [low, high]}',
            'cost:  {kind: dimension, label: "cost to the council", pinpoint: "planted", ordered: true,\n           values: [low, high]}')
r = subprocess.run([sys.executable, str(CHECK), str(p), "--format", "json"], capture_output=True, text=True)
try:
    placed = json.loads(r.stdout).get("shape", {}).get("frames", {}).get("placed")
except ValueError:
    placed = None
check("a wrapped flow mapping beside a block `values:` does not crash the checker",
      ("Traceback" in r.stderr, placed), (False, 4))

print("frames: none (profile 1.21)")
# A RESULT, NOT A FAULT: the text compares nothing, and the map says so (James's ruling of 22 Oct 2026,
# tabulation read with every reconstruction). A claim placed in a comparison is then a fault.
# Mutations: drop the `none` branch -> "must map ids to frames"; drop the placement fault -> silent.
td = Path(tempfile.mkdtemp())
(td / "none.argdown").write_text("===\ntitle: Nothing compared\nframes: none\n===\n\n"
                                 "// frames: none -- one argument, nothing set side by side\n\n"
                                 "[A]: A claim.\n    <+ [B]: A reason.\n", encoding="utf-8")
(td / "placed.argdown").write_text("===\ntitle: Placed anyway\nframes: none\n===\n\n"
                                   "[A]: A claim.\n    <+ [B]: A reason. {about: {case: I}}\n", encoding="utf-8")
found, shape = run(td / "none.argdown")
check("`frames: none` draws no fault, and the census records it", ([f["message"] for f in found], (shape or {}).get("none")), ([], True))
found, _ = run(td / "placed.argdown")
check("  an `about:` under `frames: none` is a fault",
      [f["severity"] for f in found if "frames: none" in f["message"]], ["!"])

print()
if fails:
    print(f"{fails} FAILED")
    sys.exit(1)
print("all frames checks passed")
