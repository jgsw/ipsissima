# The instructions as they stood before the rewrite

These are `docs/extraction-prompt.md` and `docs/SKILL.md` exactly as they were on 27 Aug 2026,
immediately before they were rewritten against `docs/argdown-cheatsheet.md` and
`docs/reconstruction-cheatsheet.md`.

**They are kept for measurement, not for use.** The rewrite is a claim — that telling a model the
whole language and the whole method produces better maps, first time, for fewer tokens — and a
claim of that kind is worth testing rather than believing. Running the same source through both
sets of instructions is the test, and it needs both sets to exist.

What the comparison should show, if the claim is right:

| | expected |
|---|---|
| syntax constructs used | **wider** — the old instructions never mention undercut or contradiction, and no map in the corpus contains one |
| check-and-fix rounds | **fewer** — the old instructions assume the syntax is known |
| tokens to a valid map | **lower**, unless the wider construct set costs more than the retries saved |
| titles | spaced prose rather than kebab-case, which the old §6 asked for explicitly |

The old files are also evidence in their own right. `test_cheatsheet.mjs` finds broken Argdown
examples in both — instructions that teach a mistake to the model reading them.

Do not edit these. If they need to change, the rewrite is what changes.
