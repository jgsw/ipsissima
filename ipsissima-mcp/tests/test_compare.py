#!/usr/bin/env python3
"""Tests for compare_argdown -- two readings of one text, disagreeing in the open.

    python3 tests/test_compare.py

One file asserts one reading (Formation, 14 Sep 2026), so plurality lives BETWEEN files, and
the comparator is the machinery that shows it. These tests build one small source and two
deliberately divergent readings of it, and check the three things the tool promises: the
comparison anchors on the shared text (paragraphs, via verified quotations), the three
divergence kinds are found where they were planted, and claims no quotation places are
counted rather than silently dropped. Plus the refusal: two maps citing no chapter in common
are not readings of the same source, and the tool says so instead of comparing them.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"))
import compare_argdown as cmp                                     # noqa: E402

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" +
          ("" if ok else f"\n          got  {got!r}\n          want {want!r}"))


root = Path(tempfile.mkdtemp(prefix="ipsissima_compare_"))
(root / "source").mkdir()

# Six paragraphs; the fixture plants its divergences at 2 and 3.
(root / "source" / "essay.md").write_text("""\
The argument of this essay is that memory functions as a promise made to the future self.

Each act of recollection carries an obligation forward, binding the rememberer to what they
once witnessed.

Some will say that recollection is merely causal, a trace with no normative force at all.

There is much else to say about the phenomenology of remembering, none of it at issue here.

A promise unkept corrodes the keeper, and an unkept memory corrodes no less.

The sceptic replies that traces fade whether or not anyone is bound by them.
""", encoding="utf-8")

# Reading A: the promissory reading. Asserts paragraph 2 in the author's voice, marks
# paragraph 3 as a crux, and reads paragraphs 1 and 5 that B never touches.
(root / "reading-a.argdown").write_text("""\
===
title: Reading A -- the promissory reading
reconstruction:
    aim: fit
    unit: meaning
    mode: coherence
    strength: ordinary
defaults:
    chapter: "source/essay.md"
===

[Memory is promissory]: Memory binds the rememberer as a promise binds its maker. {fidelity: "compression", source: "\\"memory functions as a promise made to the future self\\""}

[Recollection binds]: Recollection "carries an obligation forward, binding the rememberer" to what was witnessed. {fidelity: "paraphrase"}
    +> [Memory is promissory]

[Causal trace reading]: Recollection may be "merely causal, a trace with no normative force" at all. #crux {fidelity: "compression", note: "Follows the promissory reading; the causal reading of this passage is live."}
    -> [Memory is promissory]

[Corrosion]: "A promise unkept corrodes the keeper", and an unkept memory corrodes no less. {fidelity: "quotation"}
    +> [Memory is promissory]
""", encoding="utf-8")

# Reading B: the sceptical reading. Takes paragraph 2 as a view the author merely sets out
# (#reported, and at interpretive distance), reads paragraph 3 without noting any choice,
# and reads paragraph 6 that A never touches. Its apex carries no quotation at all.
(root / "reading-b.argdown").write_text("""\
===
title: Reading B -- the sceptical reading
reconstruction:
    aim: fit
    unit: meaning
    mode: truth
    strength: ordinary
defaults:
    chapter: "source/essay.md"
===

[Memory as mere trace]: The essay finally concedes that memory is a trace without binding force.

[Obligation passage]: The binding view is set out to be undermined. #reported {fidelity: "interpretation", warrant: "coherence", source: "\\"carries an obligation forward, binding the rememberer\\""}
    +> [Memory as mere trace]

[Causal passage]: Recollection is "merely causal, a trace with no normative force" at all. {fidelity: "compression"}
    +> [Memory as mere trace]

[Fading traces]: Traces "fade whether or not anyone is bound" by them. {fidelity: "compression"}
    +> [Memory as mere trace]
""", encoding="utf-8")

# A map of a different text entirely, for the refusal case.
(root / "other.argdown").write_text("""\
===
defaults:
    chapter: "source/other.md"
===

[Elsewhere]: A claim about some other text.
""", encoding="utf-8")


print("the comparison")
result, _a, _b = cmp.compare(str(root / "reading-a.argdown"),
                             str(root / "reading-b.argdown"), str(root))

check("the maps share the source", result["same_source"], True)
check("  and the shared chapter is named", result["chapters"]["shared"], ["source/essay.md"])

check("apexes are read from each map",
      (result["apex"]["a"], result["apex"]["b"]),
      (["Memory is promissory"], ["Memory as mere trace"]))

check("the declared readings are compared, and mode differs",
      result["policies"]["differ"], ["mode"])

shared_paras = sorted(p["paragraph"] for p in result["shared_passages"])
check("shared ground is paragraphs 2 and 3", shared_paras, [2, 3])
check("passages only A reads", sorted(p[1] for p in result["only_a"]), [1, 5])
check("passages only B reads", sorted(p[1] for p in result["only_b"]), [6])

kinds = {(d["kind"], d["paragraph"]) for d in result["divergences"]}
check("the crux divergence is found at paragraph 3", ("crux", 3) in kinds, True)
check("the voice divergence is found at paragraph 2", ("voice", 2) in kinds, True)
check("the distance divergence is found at paragraph 2", ("distance", 2) in kinds, True)
check("no divergence is invented elsewhere",
      sorted({d["paragraph"] for d in result["divergences"]}), [2, 3])

check("every A claim is placed by a quotation", result["unplaced"]["a"], 0)
check("B's quoteless apex is counted, not dropped", result["unplaced"]["b"], 1)

prose = cmp.render(result)
for needle in ("CRUX", "VOICE", "DISTANCE", "No verdict"):
    check(f"the prose report carries {needle!r}", needle in prose, True)

print("\nthe refusal")
refused, _a2, _b2 = cmp.compare(str(root / "reading-a.argdown"),
                                str(root / "other.argdown"), str(root))
check("maps of different texts are not compared", refused["same_source"], False)
check("  and the prose says there is nothing to anchor on",
      "not readings of the same source" in cmp.render(refused), True)

print("\nthe command line")
here = Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"
run = subprocess.run([sys.executable, str(here / "compare_argdown.py"),
                      str(root / "reading-a.argdown"), str(root / "reading-b.argdown"),
                      "--source-root", str(root), "--format", "json"],
                     capture_output=True, text=True)
check("the CLI exits 0 on a real comparison", run.returncode, 0)
check("  and its json parses back",
      json.loads(run.stdout or "{}").get("same_source"), True)

print()
print("all passed" if not fails else f"{fails} FAILED")
sys.exit(1 if fails else 0)
