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

print("a frame called `true`")
# The served method's own example once used `true` as a frame id. The front matter reads it as the
# boolean ("True"), Argdown hands the claim's `about: {true: yes}` over as the word ("true"), and the
# hint for exactly this case tested only the first spelling, so it never fired (review of 22 Oct
# 2026). Mutation: test `k in ("True", "False")` again -> the hint is gone.
(td / "true.argdown").write_text(
    "===\ntitle: A boolean id\nframes:\n    case: {kind: case, pinpoint: p. 1, values: {I: Case I}}\n"
    "    true: {kind: dimension, pinpoint: p. 1, values: [yes, no]}\n===\n\n"
    "[A]: A claim.\n    <+ [B]: A reason. {about: {case: I, true: yes}}\n", encoding="utf-8")
found, _ = run(td / "true.argdown")
check("the fault names the boolean", any("read as a boolean" in (f.get("fix") or "") for f in found), True)

print("what the text says of a cell instead of a value (profile 1.23)")
# A statement is not silence: "no small state can be an unlimited revisionist" (impossible), "the text
# leaves it unclear" (indeterminate), and a reason the text says does not tell its accounts apart.
# Mutations: drop the RESERVED_VALUES branch -> the first is a fault; drop the account exception ->
# the undecided reason is a fault; accept a reserved value on a case -> the misuse passes.
rd = Path(tempfile.mkdtemp())
(rd / "said.argdown").write_text(
    "===\ntitle: Said, not silent\nframes:\n"
    "    state: {kind: case, pinpoint: p. 1, values: {small: Small states, great: Great powers}}\n"
    "    aims:  {kind: dimension, pinpoint: p. 1, values: [limited, unlimited]}\n"
    "    acts:  {kind: verdict, pinpoint: p. 2, values: [balance, bandwagon]}\n"
    "    rival: {kind: account, pinpoint: p. 3, values: {a: {claim: Price}, b: {claim: Habit}}}\n===\n\n"
    "[Small states are never unlimited]: No small state can seek unlimited aims.\n"
    "    {about: {state: small, aims: impossible}}\n"
    "    <+ [Great powers are unclear]: What great powers do abroad is unclear. {about: {state: great, acts: indeterminate}}\n\n"
    "[Price]: Price decides.\n    <- [Habit]: Habit decides.\n"
    "    <+ [Both fit]: The survey fits both stories. {about: {rival: indeterminate}}\n", encoding="utf-8")
found, shape = run(rd / "said.argdown")
check("`impossible` and `indeterminate` fill cells, and an undecided reason is counted, with no fault",
      ([f["message"] for f in found if f["severity"] == "!"], (shape or {}).get("said"), (shape or {}).get("undecided")),
      ([], 2, 1))
(rd / "misuse.argdown").write_text(
    "===\ntitle: Misused\nframes:\n"
    "    state: {kind: case, pinpoint: p. 1, values: {small: Small states}}\n"
    "    aims:  {kind: dimension, pinpoint: p. 1, values: [limited, unlimited]}\n"
    "    rival: {kind: account, pinpoint: p. 3, values: {a: {claim: Price}, b: {claim: Habit}}}\n===\n\n"
    "[Price]: Price decides. {about: {state: impossible, aims: limited}}\n"
    "    <- [Habit]: Habit decides. {about: {rival: impossible}}\n", encoding="utf-8")
found, _ = run(rd / "misuse.argdown")
check("  but a case cannot be `impossible`, and an account frame takes `indeterminate` only",
      sorted(f["message"].split(":")[0] for f in found if f["severity"] == "!"),
      sorted(["`state", "`about"]))

print("the text's words in a frame or a question, verified (ruled 22 Oct 2026)")
# B11's first duty by the rule claims already follow: words in double quotation marks INSIDE a
# label or a question's text claim to be the text's and are checked; words without them are the
# reconstructor's and claim nothing. Mutations: make framing_quotes return early -> the misquotes
# pass silently; check unquoted labels too -> "Gettier's cases" becomes a fault.
sd = Path(tempfile.mkdtemp())
(sd / "source").mkdir()
(sd / "source" / "g.md").write_text("Is Justified True Belief Knowledge?\n\nS knows that P IFF (i) P is "
                                    "true, (ii) S believes that P, and (iii) S is justified in "
                                    "believing that P.\n", encoding="utf-8")
def labelled(label, qtext):
    (sd / "m.argdown").write_text(
        "===\ntitle: Quoted labels\ndefaults:\n    chapter: \"source/g.md\"\n"
        f"questions:\n    q1: {{text: {qtext}, pinpoint: p. 1}}\n"
        "frames:\n    case: {kind: case, label: \"Gettier's cases\", pinpoint: p. 1, values: {I: Case I}}\n"
        f"    holds: {{kind: dimension, label: {label}, pinpoint: p. 1, values: [yes, no]}}\n===\n\n"
        "[A]: A claim. {question: {id: q1, move: answers}}\n"
        "    <+ [B]: A reason. {about: {case: I, holds: yes}}\n", encoding="utf-8")
    r = subprocess.run([sys.executable, str(CHECK), str(sd / "m.argdown"), "--format", "json",
                        "--source-root", str(sd)], capture_output=True, text=True)
    d = json.loads(r.stdout)
    bad = [f["message"] for f in d.get("findings", []) if "does not verify" in f.get("message", "")
           and f.get("check") in ("frames", "questions")]
    return bad, (d.get("shape", {}).get("frames") or {}).get("quoted")
bad, quoted = labelled('"\\"(i) P is true\\""', '"\\"Is Justified True Belief Knowledge?\\""')
check("quoted words that are the text's verify, and are counted", (bad, quoted), ([], 1))
bad, _ = labelled('"\\"(i) P is certainly true\\""', '"\\"Is justified belief knowledge?\\""')
check("  misquoted, in a label and in a question, they are faults",
      sorted(m.split(":")[0] for m in bad), ["frame `holds`'s label", "question `q1`"])
bad, _ = labelled('"P is certainly true"', '"Is justified belief knowledge?"')
check("  without inner quotation marks the words are the reconstructor's, and claim nothing", bad, [])

print()
if fails:
    print(f"{fails} FAILED")
    sys.exit(1)
print("all frames checks passed")
