# Akhlaghi, "Transformative experience and the right to revelatory autonomy" (2023)

> Akhlaghi, F. (2023) 'Transformative experience and the right to revelatory autonomy',
> *Analysis*, 83(1), pp. 3–12. <https://doi.org/10.1093/analys/anac084>
>
> © the author. Published under a **[Creative Commons Attribution 4.0 International
> licence](https://creativecommons.org/licenses/by/4.0/)**.

**The text in `source/` is the author's and stays under CC-BY 4.0.** The reconstruction is not:
the `.argdown` is a reading of the argument by someone else, and every claim is marked for how
far it stands from the author's words. Do not attribute its judgements to him.

## Why this one is here

It was the test paper for a controlled comparison of two sets of reconstruction instructions —
the ones this project shipped before 27 Aug 2026, and the ones written against the syntax and
method cheat sheets. Two agents with no knowledge of each other reconstructed this paper, one
under each set. **This map is the second arm.** The first is kept beside the old instructions in
`ipsissima-mcp/eval/baseline-instructions/`, so the comparison can be re-read rather than taken
on trust.

The paper was chosen because it exercises the capability under test. Its §2 contains a genuine
**undercut** — an objection that grants a premise and denies that it settles the question:

> "Second, **even if we knew** what the future person's interests are and whether their present
> interests would be fulfilled, *whose* interests would morally matter…"

Drawn as an attack on a premise that would be a misreport. No map in the corpus built under the
old instructions contains an undercut at all.

## The argument

A conditional answer reached by eliminating alternatives. Four candidate answers to *when may we
interfere to prevent another's transformative choice?* are each killed by the same epistemic
barrier — we cannot know, before the choice, what the chooser will become. The failures are
converted into adequacy conditions, and the right to revelatory autonomy is offered as the answer
that meets them.

To rebuild the source: extract the publisher's HTML snapshot with `html_to_source.py`, then lay
the PDF's pagination over it with `paginate.py`. Neither file is in this repository — the
licence covers the text, not the publisher's typesetting.
