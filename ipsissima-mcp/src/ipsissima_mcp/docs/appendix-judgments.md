# Court judgments

Read this when the source is a legal judgment, with the reconstruction documents.

## The disposal, the ratio and *obiter*

**If the source is a legal judgment, the conclusion is the disposal** — the order the court
actually made, not the most interesting proposition in it. Work back from there. The steps the
court expressly or impliedly treated as necessary to reach that order are its *ratio*; everything
else it said is `#obiter`, and belongs on the map, tagged, rather than left out. **Obiter still
has to hang off something.** It is not unrelated to the judgment — it bears on some claim in it,
and only fails to hold up the order — so give it the relation it really has. A statement carrying
no relation at all is not a map node in Argdown, so tagging it `#obiter` and leaving it loose puts
it nowhere: it drops out of the map, out of the tag chips, and out of the reader's view entirely,
which is worse than not marking it. A step in a
judgment usually has the shape *rule of law + facts found → legal conclusion*, so a step with no
rule of law among its inputs is usually missing one. Do not try to state *the* ratio as a claim of
its own: which rule a case stands for is settled by later courts, not by this one, and a map that
records the route to the disposal lets a reader read it off without the reconstruction pretending
to fix it.

## `#authority`, and the thing it half-fixes

An authority is not a reason in the ordinary sense. *The King hath no prerogative but that which
the law of the land allows him* supports the claim it hangs under **because a court decided it in
1611**, not because a reader finds it plausible. Article 9 of the Bill of Rights binds whatever
anyone thinks of it. Drawn as a bare `<+`, both look exactly like evidence, and a reader cannot
tell from the map which supports are arguments and which are citations.

It earns its place on the three tests below: the structure cannot compute it, it recurs wherever a
judgment cites its authorities, and *"show me only what this judgment rests on"* is the first
question a lawyer asks of a case. Tag the **cited proposition**, not the claim it supports.

**What it does not fix, and what to do instead.** Miller exposed `<+` doing three different jobs:
evidential support, institutional authority, and jurisdictional precondition — the last being
something that must hold before a court may rule at all. Argdown has one arrow for all three, and
**this project does not invent syntax**: a map that used a private relation would stop being
Argdown, would not parse anywhere else, and would fail the promise that Ipsissima displays the
language rather than a dialect of it.

So:

- **institutional authority** → tag the cited proposition `#authority`;
- **jurisdictional precondition** → usually a modelling mistake rather than a notation gap. A
  precondition is a *premise* of the step it conditions, so put it in the premise-conclusion
  structure instead of hanging it off the conclusion as support;
- **anything still overloaded** → say so in the claim's `note:`. A limitation a reader is told
  about is a limitation; one they must infer from a flat arrow is a misreading waiting to happen.

That last rule is general. **Where the notation cannot carry a distinction the argument turns on,
the note carries it** — and the reconstruction is more honest for saying which distinction the map
is not drawing.
