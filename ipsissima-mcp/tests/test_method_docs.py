#!/usr/bin/env python3
"""The method the model is served holds to the registry, and its examples hold to the checker.

    python3 ipsissima-mcp/tests/test_method_docs.py

WHY THIS EXISTS (the review of 22 Oct 2026, "Extraction materials review" in the private record).
The eight documents `argdown_method` serves are copies of facts that live in `profile.json` and in
the checker, kept by hand, and they had drifted:

- the tabulation document's own worked example used `true` as a frame id, which the checker
  rejects and the same document forbids two pages later;
- the question layer's shape, `question: {id, move}`, and its four moves were in no served document,
  so following the prompt as written was a fault;
- `inconsistent:` was documented only in a reference the server calls superseded;
- the syntax document's metadata example used `source:` for a page, beside a key nothing reads.

A copy nothing holds to its original drifts (INVENTORY E10), and an example that teaches a mistake
teaches it to every map written afterwards. So two halves:

1. every key a reconstruction may write -- on a claim, on an inference line, in the map's front
   matter, in the mechanism block, on a step, on a frame, on a question -- is named in at least one
   served document, with the values the checker insists on;
2. every Argdown example in a served document, and every front-matter YAML example, is run through
   the checker, and none of them may carry a notation fault (`!`) or a key nothing reads.

`app/test_cheatsheet.mjs` holds the same examples to the parser; this holds them to the checker,
which is stricter: the `true` example parsed perfectly and still failed.
"""
import json
import re
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
PKG = REPO / "ipsissima-mcp" / "src" / "ipsissima_mcp"
DOCS = PKG / "docs"
CHECK = PKG / "check_argdown.py"
sys.path.insert(0, str(PKG))

import check_argdown as ca  # noqa: E402

fails = 0


def check(name, ok, detail=""):
    global fails
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok or not detail else f"\n          {detail}"))


P = json.loads((PKG / "profile.json").read_text(encoding="utf-8"))
SERVER = (PKG / "server.py").read_text(encoding="utf-8")

# THE SERVED DOCUMENTS, read off the server's own table rather than listed here a second time.
# Read as text, not imported: importing the server needs the MCP SDK, and this test must not.
_table = re.search(r"^METHOD_DOCS = \{(.*?)^\}", SERVER, re.S | re.M).group(1)
SERVED = sorted(set(re.findall(r'\("([\w-]+\.md)",', _table)))
TEXT = {f: (DOCS / f).read_text(encoding="utf-8") for f in SERVED}

print(f"the served method: {len(SERVED)} documents")
check("the server serves the documents it names", all((DOCS / f).exists() for f in SERVED), str(SERVED))

# ---------------------------------------------------------------------- 1. -------- #
print("\nevery key a reconstruction writes is taught somewhere it is served")


def named_in(text):
    """Every identifier the documents NAME: inside a `code span`, or written as `key:` inside a
    fenced example. Prose that happens to use the word does not count -- "the extent of" is not
    teaching `extent:`."""
    names = set()
    for span in re.findall(r"`([^`\n]+)`", text):
        names |= set(re.findall(r"[A-Za-z_][\w-]*", span))
    for block in re.findall(r"```[a-z]*\n(.*?)```", text, re.S):
        names |= set(re.findall(r"([A-Za-z_][\w-]*):", block))
    return names


# The server's instructions and the digest reach the model on every run, so what they name is taught.
ALWAYS = "\n".join(re.findall(r'^(?:INSTRUCTIONS|CONVENTIONS_DIGEST\w*) = .*?"""(.*?)"""', SERVER, re.S | re.M))
NAMED = named_in(ALWAYS)
for t in TEXT.values():
    NAMED |= named_in(t)

# Written by the tooling, never by a reconstruction: `lineSource` records how a placement was
# arrived at. Each exemption says why; a key added to the registry is taught or exempted here.
TOOL_WRITTEN = {"lineSource": "the tooling records how `line` was arrived at"}

groups = {
    "a claim": [k for k in P["claim_data"] if k not in TOOL_WRITTEN],
    "an inference line": list(P["pcs_data"]),
    "the map's front matter": list(P["map_frontmatter"]),
    "the reading policy": list(P["reading_policy"]),
    "the mechanism block": list(P["mechanism"]),
    "a state": list(P["mechanism"]["states"]["keys"]),
    "a step (`causes:`)": list(P["causes"]),
    "a constitution (`constitutes:`)": [k for k in P["constitutes"] if k != "summary"],
    "a frame": list(ca.FRAME_KEYS),
    "the source's front matter, by the reconstructor": ["voice"],
}
for where, keys in groups.items():
    missing = sorted(k for k in keys if k not in NAMED)
    # Mutation: rename `inconsistent:` wherever the served method names it -> a claim's keys fail.
    check(f"every key of {where} is named", not missing, f"never named: {missing}")

values = {
    "the question moves (`question: {id, move}`)": list(ca.QUESTION_MOVES),
    "the kinds of frame": list(ca.FRAME_KINDS),
    "the fidelity levels": list(P["fidelity"]),
    "the tags": ["#" + t for t in P["tags"]],
}
ALL = "\n".join(TEXT.values())
for what, vals in values.items():
    missing = sorted(v for v in vals if v.lstrip("#") not in NAMED and v not in ALL)
    # Mutation: rename "dissolves" wherever the served method names it -> fails.
    check(f"{what}: every one is named", not missing, f"never named: {missing}")

# THE DIGEST rides on every extract_text reply, and said "the only metadata keys anything reads"
# while leaving out seven of them. It is now built from the registry; hold it there.
digest = re.search(r'CONVENTIONS_DIGEST = (?:f?""").*?"""', SERVER, re.S)
check("the conventions digest builds its key list from the registry, not by hand",
      "_DIGEST_KEYS" in SERVER and "profile.json" in SERVER[:SERVER.find("CONVENTIONS_DIGEST")] + SERVER)

# ---------------------------------------------------------------------- 2. -------- #
print("\nevery example in the served method holds to the checker")

# The checks that judge NOTATION. An example is a fragment, so the ones that judge a whole map
# against a text (provenance coverage, a missing chapter, a disconnected claim) are not asked of it,
# and `invalid-step` is the syntax document's deliberate countermodel (affirming the consequent).
NOTATION = {"parse", "frames", "questions", "mechanism", "warrant", "statement-undercut",
            "symbol-shortcode", "contention-declaration", "fidelity"}

# A front-matter YAML example is checked inside the smallest map that can carry it.
_SHELL = "===\n{fm}\n===\n\n[Example claim]: An example claim.\n    <+ [Example reason]: An example reason.\n"


def blocks(text):
    for m in re.finditer(r"^([ \t]*)```(argdown|yaml)\n(.*?)^\1```", text, re.S | re.M):
        yield text[:m.start()].count("\n") + 1, m.group(2), textwrap.dedent(m.group(3))


def front_matter_examples(text):
    """The document's own YAML front-matter examples, in order: a fragment later in the document
    is read against the declarations the document has already taught (the mechanism notation
    declares its states in one example and marks steps on them in the next)."""
    return [b for _, kind, b in blocks(text) if kind == "yaml"
            and (lambda top: top and top <= set(P["map_frontmatter"]))(set(re.findall(r"^([\w-]+):", b, re.M)))]


def examples(text):
    context = "\n".join(x.rstrip() for x in front_matter_examples(text))
    for line, kind, body in blocks(text):
        if kind == "argdown":
            # Only an example that carries metadata or front matter says anything the parser
            # test does not already hold. A fragment with no front matter of its own is read
            # against the document's declarations.
            if "===" in body:
                yield line, body
            elif "{" in body:
                yield line, ("===\n" + context + "\n===\n\n" if context else "") + body
        elif body in front_matter_examples(text):
            yield line, _SHELL.format(fm=body.rstrip())


with tempfile.TemporaryDirectory() as tmp:
    for f in SERVED:
        bad, n = [], 0
        for line, src in examples(TEXT[f]):
            n += 1
            p = Path(tmp) / f"ex-{n}.argdown"
            p.write_text(src, encoding="utf-8")
            r = subprocess.run([sys.executable, str(CHECK), str(p), "--format", "json", "--no-fix"],
                               capture_output=True, text=True)
            try:
                found = json.loads(r.stdout).get("findings", [])
            except json.JSONDecodeError:
                bad.append(f"line {line}: the checker did not answer ({r.stderr[-200:]})")
                continue
            for x in found:
                if (x.get("severity") == "!" and x.get("check") in NOTATION) or x.get("check") == "unknown-field":
                    bad.append(f"line {line}: {x.get('check')} {x.get('severity')} {x.get('message')}")
        # Mutation: restore `true:` as a frame id in tabulation-pass.md -> fails here.
        check(f"{f}: {n} example(s) with metadata, none teaching a fault", not bad, "\n          ".join(bad[:8]))

print()
if fails:
    sys.exit(f"{fails} check(s) failed")
print("the served method holds to the registry and the checker")
