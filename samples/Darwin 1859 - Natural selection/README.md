# Darwin, natural selection (*Origin of Species*, Penguin edn., p. 168)

> Darwin, C. (1859) *On the Origin of Species*, 1st edn, London: John Murray, p. 168.
>
> **Public domain.** Darwin died in 1882 and the first edition is out of copyright everywhere.
> The passage in `source/` is transcribed from the text, not from anyone's typesetting of it, so
> nothing here is under a publisher's rights. The reconstruction is this project's, under the
> repository's own licence.

Open **`darwin-natural-selection (map).html`**.

A passage of about 260 words, supplied by the author with their own two elisions. 12 claims, 3
arguments with premise-conclusion structures, 2 contentions. Every quotation verified verbatim
against the transcribed passage; every claim placed in it.

**This one is here to answer a question: what does reconstruction do for a SHORT argument?** The
other folders reconstruct whole articles. This is two paragraphs, and it is short enough that a
reader can hold the whole thing in their head — which is exactly the case where a map has to earn
its place rather than simply making a long thing navigable.

## The form

Darwin announces it himself, which is rare: *"If ... and I think this cannot be disputed; if ...
and this certainly cannot be disputed; then ..."*. Two conditions and a conclusion. Then a second
stage: given useful variations, preservation plus inheritance gives the principle, and the
principle plus the advantage of diversity gives divergence — varieties widening into species.

**Everything here is LINKED, and that is the map's main claim about the passage.** Variation
without struggle preserves nothing; struggle without variation has nothing to preserve; neither
yields divergence without the complexity of relations that makes diversity pay. So the premises
sit in premise-conclusion structures rather than as lists of siblings — sibling `+` relations
would assert that knocking one out leaves the rest standing, which is false of every step of
this argument. Compare the Gettier map next door, whose two cases are genuinely independent and
are drawn as siblings for that reason. The two folders together are the clearest statement of
the distinction in this collection.

Two premises are used **twice**, in different structures — `struggle-for-life` and
`diversity-is-advantageous`. On the page each is stated once, in a subordinate clause. That
double duty is the thing a map shows and a linear reading does not.

## Where the reconstruction is contested

- **The conclusion Darwin does not draw.** The first stage ends at *"it would be a most
  extraordinary fact if no variation ever had occurred useful to each being's own welfare"* — and
  the second stage opens *"But **if** variations useful to any organic being **do** occur"*. He
  never asserts the categorical. The map's one **`imputation`** is `useful-variations-occur`,
  drawn dot-dashed and in italics, because the whole second stage needs it and the passage
  declines to state it. Nine claims descend from that node.
- **Four claims tagged `#dispute`** mark where the argument is pressed: that an appeal to what
  *cannot be disputed* is not an argument (the two antecedents are conclusions of the book's
  earlier chapters, drawn on here rather than defended); that "it would be extraordinary if not"
  reports what would surprise us rather than what is so; that the analogy with variation useful
  to man carries less than it needs to, since those variations were preserved by a breeder who
  wanted them; and — as an **undercut on the divergence step, not on any premise** — that
  "steadily tend to increase" states a direction where the conclusion needs a magnitude.

**The `#dispute` claims carry no citations.** They are the standard pressure points as I
understand them, recorded so the map shows where the argument is contested rather than presenting
it as watertight. No secondary literature was read for this, so nothing is attributed to any
particular critic.

## What is NOT verified, and why that is on the face of the map

The passage was supplied as text, transcribed from the Penguin volume. **No copy of that volume
is held here**, so:

- the **wording** is the author's transcription, not a reading of the book;
- the **pinpoint** — p. 168 — is likewise the author's, and every claim's `pinpoint:` metadata
  says so in as many words rather than implying a check that did not happen;
- the **two elisions are the author's** and are left as `[...]`. Filling them in would need the
  volume, and a plausible reconstruction of elided Darwin is precisely the quiet fabrication the
  fidelity markers exist to prevent.

What *can* be checked from here is the reconstruction against the passage, and that is checked:
every one of the 12 claims is pinned by a quotation, and all 12 are exact.

## What changes when the argument is short

Three things, and they are the reason this folder exists.

**1. The position tooling can only see as far as the source file's granularity.** Its finest unit
is the line. The other converters here write one line per paragraph, which is right for a journal
article with forty of them. This passage has two. Written that way, all twelve quoted claims
would land on one of two lines and the Order view would have two columns. So `make_source.py`
breaks the passage at **its own joints** — Darwin's semicolons and his *then* / *Therefore* /
*Thus* hinges — inserting line breaks and altering nothing else. That is the general lesson:
**for a short text, granularity is a conversion decision, and it is made before the
reconstruction, not after.**

**2. The Order view still finds a policy, and it is the same one Williams follows.** 15 support
relations: 12 sit within 5 claims of what they support, 3 reach further, and **all 3 that reach
lay the support down before the claim it serves.** Longest reach: 10 claims preparing against 1
anticipating. In two paragraphs Darwin builds to his conclusions rather than announcing them —
the same architecture as a twelve-page paper, visible at a fiftieth of the length.

The three that reach furthest are worth the look they take, because they are the same two
premises both times: `struggle-for-life` holds up the preservation argument 8 claims after it is
stated and the divergence argument 10 after, and `diversity-is-advantageous` reaches 9. Each is
stated once, in a subordinate clause, and then carries two structures — the double duty described
above, here as a measurement rather than a reading.

**3. The map stops being a navigation aid and becomes an argument about the argument.** Nobody
needs help finding their way around 260 words. What the picture is for here is the two claims a
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
