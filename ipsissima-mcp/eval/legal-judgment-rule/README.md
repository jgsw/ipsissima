# The legal-judgment rule, and Miller reconstructed under it

On 30 August 2026 the extraction prompt gained four sentences about legal judgments, and
`ipsissima-conventions.md` gained the `#obiter` tag. **`miller-arm-B.argdown` is the Miller
judgment reconstructed from scratch under them**, from the same converted source as
`samples/Miller 2019 - Prorogation of Parliament/`, without reference to the map already there.
Both are kept so the rule can be measured rather than believed.

## What the rule says

Work back from the **disposal** — the order the court actually made — rather than from the most
interesting proposition in the judgment. The steps the court expressly or impliedly treated as
necessary to reach that order are its *ratio*; everything else it said is `#obiter` and belongs on
the map, tagged, rather than left out. And do not try to state *the* ratio as a claim: which rule
a case stands for is settled by later courts.

That last clause is the one worth defending. Holland and Webb are blunt that "even 'crystal-clear'
judgments occasionally contain more than one ratio" and that "in some cases no one can find the
ratio", and Cross's own formula — the ratio is "any rule of law expressly or impliedly treated by
the judge as a necessary step in reaching his conclusion" — is a description of a *route*, not a
sentence to be extracted. A map that records the route lets a reader read the ratio off it. A map
that asserted one would be doing the later courts' work, badly.

## The question it was built to answer

The existing map has `<The prorogation was void>` taking the court's power to consider the
prorogation as an input to the nullity of the Order in Council. That reads oddly: it makes a
jurisdictional precondition a premise of an intermediate step about the effect of unlawful advice.

**Working back from the disposal settles it.** At [69] the court reaches the article 9 point
first — "This court is not, therefore, precluded by article 9 … from considering the validity of
the prorogation itself" — and only then turns to the chain, "start at the beginning, with the
advice that led to it." So privilege licenses the move from a void prorogation to the declaration
that Parliament was never prorogued. It licenses nothing about the advice, which needs no
privilege ruling at all. The two are also different preconditions: justiciability of the *advice*
is settled at [52]; privilege over the *prorogation* at [69]. The old map ran them together.

In arm B the route declares its inputs, so the reading is visible rather than inferred:

```
(1) [The court may rule on the validity of the prorogation]
(2) [The advice was unlawful]
(3) [Advice outside the powers of the Prime Minister is null]
-- {uses: [2, 3]} --          <- privilege deliberately NOT an input here
(4) [The Order in Council was null]
(5) [The prorogation was carried out under the Order]
-- {uses: [4, 5]} --
(6) [The prorogation was null]
-- {uses: [1, 6]} --          <- and it enters here
(7) [Parliament has not been prorogued]
```

The checker reports both steps as `declared-inputs-differ`, which is the point: the reading
departs from what the layout implies, and a reader is told so rather than left to notice.

## What the comparison shows

`compare_reconstructions.py`, both maps against the same source:

| | before | after | |
|---|---|---|---|
| claims and arguments titled | 92 | 67 | |
| premise-conclusion structures | 17 | 11 | |
| relation kinds used (of 4) | 3 | **4** | after |
| has an undercut / a contradiction | yes / no | **yes / yes** | after |
| **source quotations declared** | 17 | **58** | after |
| warrants given | 0 | **4** | after |
| tags used | authority, conceded, reported | + **obiter** | after |
| checker findings | 0 | 9 (all `?`) | before |

**The gain is provenance.** Three and a half times as many claims carry a verified quotation, on a
map with a quarter fewer nodes — 58 of 58 exact.

**The loss is coverage, and it is a judgement rather than a defect.** Paragraphs 1–26 of the
judgment are narrative: what prorogation is, how the case arose. Under the method document's
Step 0 they are not argument and are not reconstructed. The old map carries them. Whether a
reconstruction of a judgment should is a real question, and this pair is the way to argue it.

**The nine `?` findings are all expected**, and each is worth reading once:

- `inert` ×4 — the `#obiter` claims reach no contention. That is what obiter *means*; wiring them
  in would be false. The check is right to raise it and the answer is no.
- `declared-inputs-differ` ×2 — the two deliberate departures above.
- `splice` ×2 — recorded in the claims' own notes.
- `thin-step` ×1 — the disposal follows from the declaration alone.

## One defect the tooling caught

The first draft of arm B had **no undercut in it at all**, against five in the old map, and
`compare_reconstructions.py` said so. Miller contains two textbook undercuts: the court denies
neither Lord Roskill's dictum nor the analogy with dissolution, only that they bear [36]; and it
denies neither that hypotheticals are extreme nor that practical constraints exist, only that
they dispose of the sovereignty point [43]. Both had been drawn as attacks on a premise, which
has the court calling propositions false that it never questioned. Reconstructing each submission
as an argument and undercutting it fixed the map and is why arm B now uses all four relation
kinds. **That error was the reconstructor's, not the rule's** — and it was found by a tool rather
than by reading, which is the case for keeping the tool.

## Reproducing

```bash
python3 ipsissima-mcp/eval/compare_reconstructions.py \
    "samples/Miller 2019 - Prorogation of Parliament/miller-2019-uksc-41.argdown" \
    ipsissima-mcp/eval/legal-judgment-rule/miller-arm-B.argdown \
    --source-root-a "samples/Miller 2019 - Prorogation of Parliament" \
    --source-root-b "samples/Miller 2019 - Prorogation of Parliament" \
    --label-a before --label-b after
```

Arm B's `chapter:` paths are relative to the Miller sample folder, so it is checked with
`--source-root` pointing there rather than at this directory.
