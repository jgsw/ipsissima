#!/usr/bin/env python3
"""The profile says what the code reads, and the code reads what the profile says.

    python3 ipsissima-mcp/tests/test_profile.py

`docs/PROFILE.md` specifies the Ipsissima profile for Argdown and `profile.json` is its registry.
Both are copies of facts that live in code -- the checker's known keys, the reading-policy
values, the warrant vocabulary, the fidelity ladder and its patterns, the mechanism's fields, the
source front matter the page reads -- and a copy nothing holds to its original drifts
(docs/values/INVENTORY.md, E10). So every list here is compared with the code that uses it, in
both directions where the code has the whole list, and the document must name every key the
registry holds.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PKG = HERE.parent / "src" / "ipsissima_mcp"
REPO = HERE.parents[1]
sys.path.insert(0, str(PKG))

import argdown_provenance as prov  # noqa: E402
import check_argdown as ca  # noqa: E402

fails = 0


def check(name, ok, detail=""):
    global fails
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok or not detail else f"\n          {detail}"))


P = json.loads((PKG / "profile.json").read_text(encoding="utf-8"))
DOC = (REPO / "docs" / "PROFILE.md").read_text(encoding="utf-8")
MECH_PY = (PKG / "mechanism.py").read_text(encoding="utf-8")
MECH_JS = (REPO / "app" / "src" / "argdown-mechanism.js").read_text(encoding="utf-8")
LIVE_JS = (REPO / "app" / "src" / "argdown-live-map.js").read_text(encoding="utf-8")
PAGE = (REPO / "app" / "argdown-viewer.template.html").read_text(encoding="utf-8")
CONVENTIONS = (PKG / "docs" / "ipsissima-conventions.md").read_text(encoding="utf-8")

print("the registry against the checker")
node_keys = set(P["claim_data"]) | set(P["pcs_data"]) | set(P["heading_data"])
known = set(prov.PROVENANCE_FIELDS) | set(ca.EXTRA_DATA_KEYS)
# Mutation: add a key to EXTRA_DATA_KEYS, or drop one from the registry -> fails.
check("the node keys are exactly the keys the checker reads", node_keys == known,
      f"only in the profile: {sorted(node_keys - known)}; only in the checker: {sorted(known - node_keys)}")
policy = {k: sorted(str(v).lower() for v in vals) for k, vals in prov.POLICY_VALUES.items()}
reg_policy = {k: sorted(str(v).lower() for v in (d.get("values") or ["true", "false"])) for k, d in P["reading_policy"].items()}
check("the reading policy's keys and values are the checker's", {k: sorted(set(v)) for k, v in policy.items()} ==
      {k: sorted(set(v)) for k, v in reg_policy.items()}, f"{policy} vs {reg_policy}")
check("the warrant vocabulary is the checker's", P["warrants"] == list(prov.WARRANTS), f"{P['warrants']} vs {list(prov.WARRANTS)}")
check("the fidelity ladder is the checker's, in order", tuple(P["fidelity"]) == tuple(prov.FIDELITY_LEVELS))

print("\nthe registry against the page")
js_ladder = re.search(r'var FIDELITY = (\[[^\]]*\]);', MECH_JS).group(1)
check("the Mechanism view's ladder is the registry's", json.loads(js_ladder) == P["fidelity"])
css = dict(re.findall(r'\.alm-f-(\w+) \.alm-box\{stroke-dasharray:([\d. ]+)[;}]', LIVE_JS))
check("the patterns are the Reasons map's borders", all(css.get(f) == P["fidelity_pattern"][f] for f in P["fidelity"] if f != "quotation"),
      f"{css}")
kinds = set(re.findall(r'\{ key: "(\w+)", label:', PAGE)) | set(re.findall(r'credit: "(\w+)"', PAGE))
kinds |= set(re.findall(r'frontMatterValue\([^,]+, "(\w+)"\)', PAGE))
# Mutation: drop `voice` from the registry -> fails.
check("every source front-matter key the page reads is in the registry", kinds <= set(P["source_frontmatter"]),
      f"missing: {sorted(kinds - set(P['source_frontmatter']))}")
graph = (REPO / "app" / "argdown-graph.mjs").read_text(encoding="utf-8")
fm_js = set(re.findall(r'frontMatter\[?\.?"?([\w-]+)"?\]?', graph)) | set(re.findall(r'frontMatter\.(\w+)', graph)) \
        | set(re.findall(r'frontMatter\["([\w-]+)"\]', graph)) | set(re.findall(r'fm\.(\w+)', graph))
fm_js = {k for k in fm_js if k not in ("", "frontMatter")}
if "-v" in sys.argv:
    print("   map front matter the page reads:", sorted(fm_js))
check("every map front-matter key the page reads is in the registry", fm_js <= set(P["map_frontmatter"]),
      f"missing: {sorted(fm_js - set(P['map_frontmatter']))}")

print("\nthe registry against the mechanism")
read = set(re.findall(r'c\.get\("(\w+)"\)', MECH_PY)) - {"arguments"}
check("the causes fields are exactly those mechanism.py reads", read == set(P["causes"]),
      f"only read: {sorted(read - set(P['causes']))}; only listed: {sorted(set(P['causes']) - read)}")
basis = re.search(r"_TIER_OF_BASIS = \{(.*?)\}", MECH_PY, re.S).group(1)
import mechanism  # noqa: E402
# Mutation: add a sign to mechanism.SIGNS without the registry -> fails.
check("the signs are mechanism.py's", P["causes"]["sign"]["values"] == list(mechanism.SIGNS),
      f"{P['causes']['sign']['values']} vs {list(mechanism.SIGNS)}")
check("the bases are mechanism.py's", sorted(re.findall(r'"(\w+)":', basis)) == sorted(P["causes"]["basis"]["values"]))
state_keys = set(P["mechanism"]["states"]["keys"])
js_state = set(re.findall(r'\bs\.(label|actor|role|measured|appraisal|note)\b', MECH_JS))
if re.search(r'\)\.part_of\b', MECH_JS):
    js_state.add("part_of")
# A state's levels are read through levelsOf() since profile 1.4.
if re.search(r'function levelsOf\(state\b.{0,300}?obj\(state\)\.levels\b', MECH_JS, re.S):
    js_state.add("levels")
# Roles are read through rolesOf() since profile 1.1, where `role` may be a list.
if re.search(r'function rolesOf\(state\)[^}]*\.role\b', MECH_JS, re.S):
    js_state.add("role")
# Mutation: stop the page showing a state's note -> fails: a key the profile defines must reach a reader.
check("every state key the profile defines is read by the page", state_keys <= js_state, f"unread: {sorted(state_keys - js_state)}")

print("\nthe registry against the method")
conv_tags = set(re.findall(r"^\| `#(\w+)`", CONVENTIONS, re.M))
check("the tags are the conventions' tags", conv_tags == set(P["tags"]),
      f"only in conventions: {sorted(conv_tags - set(P['tags']))}; only in profile: {sorted(set(P['tags']) - conv_tags)}")

print("\nthe document against the registry")
listed = set(P["map_frontmatter"]) | set(P["reading_policy"]) | node_keys | set(P["causes"]) | \
         set(P["source_frontmatter"]) | set(P["mechanism"]) | {"#" + t for t in P["tags"]} | set(P["fidelity"]) | set(P["warrants"])
unnamed = sorted(k for k in listed if f"`{k}" not in DOC)
# Mutation: delete a row from PROFILE.md -> that key is named here.
check("PROFILE.md names every key, tag and value the registry holds", not unnamed, f"unnamed: {unnamed}")
check("and carries the registry's version", f"**Version {P['version']} " in DOC)
check("the checker reports that version", ca.PROFILE_VERSION == P["version"], str(ca.PROFILE_VERSION))

print("\nthe licence travels with both files")
# CC BY 4.0, ruled 26 Sep 2026 (docs/LICENCE-AUDIT.md §12). The registry lives in a GPL package,
# so its own licence must be stated in the file itself. Mutation: drop either statement -> fails.
check("the registry states its licence inside itself", P.get("licence") == "CC-BY-4.0" and P.get("copyright"))
check("and the document states the same", "CC BY 4.0" in DOC and "creativecommons.org/licenses/by/4.0" in DOC)

print()
if fails:
    sys.exit(f"{fails} check(s) failed")
print("the profile holds to the code")
