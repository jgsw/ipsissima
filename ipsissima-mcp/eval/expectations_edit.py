#!/usr/bin/env python3
"""Turn a draft expectations file into a reviewed one: corrections and ledger entries applied,
written back in one canonical form.

    python3 ipsissima-mcp/eval/expectations_edit.py FILE.toml PATCH.json [OUTPUT.md]

THE PATCH is what reading the paper found, as JSON (written by whoever read it):

    {"headings": [...],            # the headings the paper prints, replacing the draft's
     "notes": 6, "abstract": [0, 0],
     "drop_survive": ["first words of a sentence ..."],   # a drafted sentence that is not right
     "add_survive": ["..."],
     "defects": [{"what": "...", "notes": 2}, ...],       # appended to the ledger
     "note": "how the paper was read",
     "drop": ["notes"]}           # a key the reader could not establish, left out

With the approved OUTPUT.md given, `heading_defect`, `notes_defect` and `abstract_defect` (each a
description) write the ledger entry for whatever the output gets wrong against the patch: the
headings it misses and the ones it adds, as lists, or the count it gives. What is wrong is
measured, never typed: the description is the reader's, the lists are the comparison's.

Anything the patch does not name stays as drafted. The file is stamped `reviewed` with today's
date, and `status = "draft"` goes: a reviewed file is one a person has read against the paper.
"""
import datetime
import json
import sys
import tomllib
from pathlib import Path

ORDER = ["pdf", "title", "reviewed", "note", "headings", "abstract", "notes", "survive"]


def q(s):
    return json.dumps(s, ensure_ascii=False)


def dump(spec):
    out = []
    for k in ORDER:
        if k not in spec:
            continue
        v = spec[k]
        if isinstance(v, list) and v and isinstance(v[0], str):
            out += [f"{k} = ["] + [f"  {q(x)}," for x in v] + ["]"]
        elif isinstance(v, list):
            out.append(f"{k} = [{', '.join(str(x) for x in v)}]")
        elif isinstance(v, str):
            out.append(f"{k} = {q(v)}")
        else:
            out.append(f"{k} = {v}")
    for d in spec.get("defect", []):
        out += ["", "[[defect]]"] + [f"{k} = {v if isinstance(v, int) else q(v)}" for k, v in d.items()]
    return "\n".join(out) + "\n"


def measured(spec, patch, md):
    """Ledger entries for what the approved output gets wrong, against the patched spec."""
    import difflib
    from expectations import facts, heading_keys
    f = facts(md)
    out = []
    if patch.get("heading_defect"):
        want, wk, got, gk = heading_keys(spec, f["heads"])
        sm = difflib.SequenceMatcher(None, wk, gk, autojunk=False)
        mw, mg = set(), set()
        for a, b, n in sm.get_matching_blocks():
            mw.update(range(a, a + n))
            mg.update(range(b, b + n))
        d = {"what": patch["heading_defect"]}
        miss = [h for i, h in enumerate(want) if i not in mw]
        extra = list(dict.fromkeys(h for j, h in enumerate(got) if j not in mg))
        if miss:
            d["missing_heading"] = miss
        if extra:
            d["extra_heading"] = extra
        if miss or extra:
            out.append(d)
    if patch.get("notes_defect") and "notes" in spec and f["notes"] != spec["notes"]:
        out.append({"what": patch["notes_defect"], "notes": f["notes"]})
    if patch.get("abstract_defect") and "abstract" in spec and not (
            spec["abstract"][0] <= f["abstract"] <= spec["abstract"][1]):
        out.append({"what": patch["abstract_defect"], "abstract": f["abstract"]})
    return out


def apply(path, patch, md=None):
    spec = tomllib.loads(Path(path).read_text(encoding="utf-8"))
    for k in ("title", "headings", "notes", "abstract", "note"):
        if k in patch:
            spec[k] = patch[k]
    drops = patch.get("drop_survive", [])
    spec["survive"] = [s for s in spec.get("survive", []) if not any(s.startswith(d) for d in drops)]
    spec["survive"] += patch.get("add_survive", [])
    for k in patch.get("drop", []):
        spec.pop(k, None)
    spec["defect"] = spec.get("defect", []) + patch.get("defects", [])
    if md is not None:
        spec["defect"] += measured(spec, patch, md)
    spec.pop("status", None)
    spec.pop("drafted", None)
    spec["reviewed"] = datetime.date.today().isoformat()
    Path(path).write_text(dump(spec), encoding="utf-8")
    return spec


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    apply(sys.argv[1], json.loads(Path(sys.argv[2]).read_text(encoding="utf-8")),
          Path(sys.argv[3]).read_text(encoding="utf-8") if len(sys.argv) > 3 else None)
