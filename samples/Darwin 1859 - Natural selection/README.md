# Darwin, natural selection (*Origin of Species*, Penguin edn., p. 168)

> Darwin, C. (1859) *On the Origin of Species*, 1st edn, London: John Murray, p. 168.
>
> **Public domain.** Darwin died in 1882 and the first edition is out of copyright everywhere.
> The passage in `source/` is transcribed from the text, not from anyone's typesetting of it, so
> nothing here is under a publisher's rights. The reconstruction is this project's, under the
> repository's own licence.

Open **`darwin-natural-selection (map).html`**.

A passage of about 260 words, supplied by the author with their own two elisions. 12 claims and
3 arguments with premise-conclusion structures, ending in 2 contentions. Every claim carries a
`source:` span, all 12 verify verbatim against the transcribed passage, and all 12 are placed
in it.

**This one is here to answer a question: what does reconstruction do for a SHORT argument?** The
other folders reconstruct whole articles. This is two paragraphs, and it is short enough that a
reader can hold the whole thing in their head — which is exactly the case where a map has to earn
its place rather than simply making a long thing navigable.

## The form

Darwin announces it himself, which is rare: *"If ... and I think this cannot be disputed; if ...
and this certainly cannot be disputed; then ..."*. Two conditions and a conclusion — and the
conclusion is not the one that shape leads you to expect. He does not conclude that useful
variations occur. He concludes that it would be *"a most extraordinary fact"* if none ever had,
and then conditionalises again.

Three arguments, serial, the last step of the second branching into two ends:

- **`<The occurrence of useful variations>`** — the two undisputed conditions, the advantage of
  diversity, and the analogy with variation under domestication, giving that modal conclusion.
- **`<The preservation and inheritance of useful variations>`** — Darwin's own two-step,
  numbered: preservation in the struggle first, then transmission by inheritance.
- **`<Divergence of character>`** — an intermediate conclusion, then the apex.

The passage ends by doing two things that do not rest on each other, so the map has **two
contentions**: `[Small differences between varieties grow into the differences between species]`
and `[The principle of preservation is what Darwin calls natural selection]`. Both rest on the
preservation argument. Neither rests on the other.

**Everything here is LINKED, and that is the map's main claim about the passage.** Variation
without struggle preserves nothing; struggle without variation has nothing to preserve; neither
yields divergence without the complexity of relations that makes diversity pay. So the premises
sit in premise-conclusion structures rather than as lists of siblings — sibling `+` relations
would assert that knocking one out leaves the rest standing, which is false of every step of
this argument. The contrasting case is an argument whose premises really are independent, where
each of two cases refutes the target on its own; there siblings are right and the map should say
so. Nothing in this passage is like that.

Premises do **double duty**, and that is the thing a map shows and a linear reading does not.
`[A severe struggle for life]` is a premise of all three arguments; `[Diversity is advantageous]`
of two; and `[Individuals with useful variations leave similarly characterised offspring]` is the
conclusion of the second argument and then a premise of the third. On the page, `[Diversity is
advantageous]` is never a sentence at all — it is a participial clause inside the long
conditional. The struggle appears twice in different words, as an antecedent and then as *the
incessant struggle of all species to increase in numbers*; the map treats those as one claim,
and the note on the divergence premise says why.

## Why there are no objections, and no tags

The rebuilt map has **no objections and no tags at all**. That is a decision, not an omission.

The passage is a summary. It reports no rival view, concedes nothing to a critic and answers no
one; every claim in it is Darwin's own and asserted, which is exactly what an untagged claim
means. The tags mark whose a claim is — `#reported`, `#conceded`, `#contested` and the rest in
the profile (`docs/PROFILE.md` §3). An earlier version of this map tagged four claims
`#dispute`, which is not one of them, and those four objections were nobody's in particular: they
were the standard places the argument is pressed, written by the reconstructor and cited to no
critic.

There is a second, mechanical reason not to put them back. The file sets `defaults: chapter:` to
the passage, so an uncited objection inherits that chapter and gets **placed inside Darwin's
passage** by the position tooling. The map would then locate, in a text that does not contain
them, four claims the text does not make. Supplying an objection to give the map some dialectic
would be inventing one, and the apparatus would file the invention under Darwin.

**The one thing the reconstruction does add is marked as such.** The first stage ends at *"it
would be a most extraordinary fact if no variation ever had occurred useful to each being's own
welfare"*, and the second stage opens *"But **if** variations useful to any organic being **do**
occur"*. The categorical is never asserted. `[Useful variations do occur]` detaches that
antecedent, because the rest of the passage — the *Therefore*, the *Thus*, the naming — proceeds
on it; it is marked `interpretation` with `warrant: "coherence"`, the warrant that says a reading
was chosen because it makes the surrounding text hang together. The hedge is not lost by the
detachment: it survives whole in the claim that supports this one. Both contentions descend from
this node.

The checker finds 10 of the 12 claims supporting a contention and the other 2 being the
contentions; nothing objects, nothing is inert, nothing is disconnected.

## What is NOT verified, and why that is on the face of the map

The passage was supplied as text, transcribed from the Penguin volume. **No copy of that volume
is held here**, so:

- the **wording** is the author's transcription, not a reading of the book;
- the **pinpoint** — p. 168 — is likewise the author's. Every claim carries `pinpoint: "p. 168"`,
  and the warning that it is unverified is carried in the `.argdown` file's own comment header
  and again in the header of the source file, so it travels with the manuscript rather than
  living only in this README;
- the **two elisions are the author's** and are left as `[...]`. Filling them in would need the
  volume, and a plausible reconstruction of elided Darwin is precisely the quiet fabrication the
  fidelity markers exist to prevent. Each elision lands on a claim and each of those claims says
  so: `<Divergence of character>` because Darwin's *Therefore* falls immediately after one, and
  `[The principle of preservation is what Darwin calls natural selection]` because the referent
  of *This principle of preservation* sits on the far side of the other.

What *can* be checked from here is the reconstruction against the passage, and that is checked.
All 12 claims carry a `source:` span and all 12 verify exact — 7 of them are `quotation`s, in
Darwin's own words; the other 5 are paraphrase or interpretation with the words they were drawn
from quoted beside them. Of the 12 verbatim spans, 5 run to the end of their own sentence and 7
stop inside one, and nothing sits against any of them — no dropped qualifier, no continuation
that corrects them. Across all 15 elements the fidelity marks are 7 `quotation`, 4 `paraphrase`,
2 `compression` and 2 `interpretation`, both interpretations warranted.

## What changes when the argument is short

Three things, and they are the reason this folder exists.

**1. The position tooling can only see as far as the source file's granularity.** Its finest unit
is the line. The other converters here write one line per paragraph, which is right for a journal
article with forty of them. This passage has two. Written that way, all twelve quoted claims
would land on one of two lines and the Order view would have two columns. So `make_source.py`
breaks the passage at **its own joints** — Darwin's semicolons and his *then* / *Therefore* /
*Thus* hinges — inserting line breaks and altering nothing else. The result is 264 words on nine
lines, plus the two elision markers, and all 12 claims place by exact quotation. That is the
general lesson: **for a short text, granularity is a conversion decision, and it is made before
the reconstruction, not after.**

**2. The exposition statistic has nothing to measure here, and that is worth knowing.** The
checker reports 14 support edges, **all 14 within one chapter, 0 anticipated and 0 prepared** —
because it counts exposition order in *chapters*, and a passage is one chapter. The Order view
still draws a real spread, since the viewer places claims by line and point 1 gave it nine lines
to work with. But the summary statistic that tells you a text's policy — does it announce its
claims and argue afterwards, or build up to them? — needs more than one file before it can say
anything, and two paragraphs do not have a policy for it to find. Earlier versions of this README
quoted a claim-distance figure here; that metric is gone, and no number replaced it.

What is still visible, by reading the source lines rather than the statistic: the mechanism is
named **last**, on the ninth and final text line and after an elision — *"This principle of
preservation, I have called, for the sake of brevity, Natural Selection"* — although the argument
that earns the name closes on the sixth line, and the divergence conclusion that argument makes
possible is already stated on the eighth.

**3. The map stops being a navigation aid and becomes an argument about the argument.** Nobody
needs help finding their way around 264 words. What the picture is for here is the two claims a
reader might not otherwise make explicit: that the premises are linked rather than convergent,
and that the passage's load-bearing step is one Darwin never takes. Both are contestable, and
both are now on the page where they can be contested.

## Rebuilding

```bash
python3 make_source.py
```

then, from the repo root:

```bash
node app/build_argdown_viewer.mjs \
  "samples/Darwin 1859 - Natural selection/darwin-natural-selection.argdown" \
  --source-root "samples/Darwin 1859 - Natural selection"
```

## Sources

`source/darwin-1859-natural-selection.md`, written by `make_source.py` from the passage as
supplied. There is no PDF in this folder because there is no PDF: unlike every other folder here,
the reconstruction's source is a transcription, and the file's own header says so.
