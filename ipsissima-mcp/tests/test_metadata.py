#!/usr/bin/env python3
"""Tests that a metadata block Argdown would silently drop is a fault, at its line.

    python3 ipsissima-mcp/tests/test_metadata.py

Found 2 Nov 2026, upgrading the samples to profile 1.26: a claim in the Wilson 2023 sample was
given `design:` twice inside one `causes:`. Argdown's in-process parser throws a YAMLException
over it, drops it, and builds the map from whatever it had read so far -- 87 nodes of 141, two
sections gone -- and the checker printed "parses OK" and exited 0. The fixture,
fixtures/metadata/duplicate-key.argdown, plants the same fault in a five-claim map; each other
fault here is planted in a copy of it, and the copy with the fault removed is the control.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CHECK = REPO / "ipsissima-mcp" / "src" / "ipsissima_mcp" / "check_argdown.py"
FIXTURE = REPO / "fixtures" / "metadata" / "duplicate-key.argdown"
DUP = "on: chance, design: illustration}}"

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok else f"\n          got {got!r} want {want!r}"))


def run(path):
    r = subprocess.run([sys.executable, str(CHECK), str(path), "--format", "json", "--no-fix"],
                       capture_output=True, text=True)
    return r.returncode, json.loads(r.stdout)


def planted(old, new):
    text = FIXTURE.read_text(encoding="utf-8")
    assert old in text, old
    p = Path(tempfile.mkdtemp()) / FIXTURE.name
    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    return p


def parse_faults(d):
    return [f for f in d.get("findings", []) if f.get("check") == "parse"]


line_of = next(n for n, l in enumerate(FIXTURE.read_text(encoding="utf-8").split("\n"), 1) if DUP in l)

print("a key written twice in a claim's metadata")
code, d = run(FIXTURE)
found = parse_faults(d)
check("the checker fails", (code != 0, d.get("ok")), (True, False))
check("  with one parse fault", len(found), 1)
f = found[0] if found else {}
check("  at the block's line", f.get("line"), line_of)
check("  naming the key", "duplicated mapping key `design`" in f.get("message", ""), True)
check("  and the claim", "[Copier overused]" in f.get("message", ""), True)
check("  and saying what to do", "keep one `design:`" in f.get("fix", ""), True)
check("  and it does not count the half it read as the map", d.get("shape", {}).get("nodes"), None)

print("the control: the same map with the key once")
code, d = run(planted(DUP, "on: chance}}"))
check("no parse fault", parse_faults(d), [])
check("  and every claim is read", d.get("shape", {}).get("nodes"), 5)

print("the front matter")
code, d = run(planted("frames: none\n", "frames: none\ntitle: \"again\"\n"))
found = parse_faults(d)
check("a top-level key written twice is a fault",
      [("duplicated mapping key `title`" in x["message"], "front matter" in x["message"]) for x in found
       if "front matter" in x["message"]], [(True, True)])
check("  at its own line", [x["line"] for x in found if "front matter" in x["message"]], [6])

print("the other silent drop: a missing comma")
code, d = run(planted(DUP, "on: chance design: illustration}}"))
found = parse_faults(d)
check("is a fault at its line, for its claim",
      [(x["line"], "[Copier overused]" in x["message"]) for x in found], [(line_of, True)])

sys.exit(1 if fails else 0)
