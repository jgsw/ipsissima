# Wilson, "Williams, Dewey, and the Nature of Value Inquiry" (2026)

> Wilson, J. (2026) 'Williams, Dewey, and the Nature of Value Inquiry', *Philosophy*, 101.
>
> **By the author, who is also the author of Ipsissima**, and included here with his permission —
> which is the whole reason a 28-page paper can be in this folder at all. The article is open
> access; the converted text in `source/` is redistributable on that footing.
>
> The PDF is not in this repository: the publisher's typesetting is theirs, and the licence
> covers the article rather than their setting of it. `convert_source.py` takes a path.

*Philosophy* 101 (2026), pp. 511–538. Twenty-eight pages, 10,381 words, eight numbered sections.
Open **`wilson-williams-dewey (map).html`**.

**The third test of `extraction-prompt.md`, and the one that strains it.** The Carroll states no
conclusion and everything must be imputed; the Horton states everything; this paper does
something the prompt's list of forms has no entry for. Its author describes the form as closer to
music than to "I will assert that P": themes are introduced, modulate, interweave, and resolve as
the conclusion arrives.

## The reconstruction

**Four contentions, not one — and that is not a defect of the map.** Forcing a single apex would
mean inventing a super-claim the paper does not make, which is an imputation at the very top: the
thing the Carroll map had to do and this paper does not need. The four are connected rather than
four separate trees, and §8 states them in this order:

1. there is **no overall answer** to whether philosophy is humanistic or scientific — methods
   should follow research problems;
2. philosophy is **ambitious without being progressive**, so value inquiry should be more modest
   and aim at **middle-range theory**;
3. the Williams/realist debate is **not deadlocked**: the sustained mismatch is itself evidence
   for Williams;
4. **Dewey is the nimbler thinker** about what philosophy might become.

8 quotation · 33 paraphrase · 1 interpretation · **no imputations**.
21 of 21 quotations verify. 42 of 42 claims located, nothing disconnected, nothing inert.

**The first version had nothing from its first three pages**, and the by-position view is what
showed it: `no-overall-answer`, on p.3, was the leftmost node. A map that starts where the
author's own claims start leaves out what those claims are *about* — here, Williams's critique of
scientism, his two objections to it, and the changed landscape the paper answers from. Five
claims added; coverage now begins on p.1.

## What the map shows better than a reading

**The interweaving becomes measurable.** Four claims carry several outgoing edges each —
`ambition-outruns-progressiveness` (3), `ethical-freedom` (3), `middle-range` (2),
`meta-problem` (2), `sense-making-is-local` (2). In the prose these are themes returned to; in
the map they are single nodes feeding four or five places at once, which is the one thing a map
does better than reading.

**And the long-range structure shows up in the numbers.** `problematisation` is stated 7 claims
in and first drawn on 28 claims later; `philosophy-is-various` and `friendly-amendment` likewise.
Dewey enters in §3, twenty pages before he is named as the destination. The
CARRIED LONGEST report finds exactly this, and on a linear argument it would be a defect.

## What the map shows worse

**An argument map is atemporal by construction.** The paper is meant to be experienced in time,
and the map flattens that by design. For this paper the **Order view is not a supplement to the
argument view — it is the half that carries the form.**

**And the apex heuristic misses one of the four.** `no-overall-answer` is established in §§1–3
*and then used again* in §6 to dismiss the "science or humanities?" question about thought
experiments. Having an outgoing edge, it is not an apex, so the tool lists four contentions where
the paper arrives at five things. The house rule "read the apex list before believing any map"
assumes a claim is either a conclusion or a premise. In a paper whose themes return, a claim can
be both, and the heuristic has no way to say so.

## One claim, and what marking an elision is for

The claim `no-overall-answer` first read:

> There is no overall answer to whether philosophy belongs with the humanities or the sciences;
> the methods it is most fruitful to adopt depend on the research question.

The source has two sentences, with `Rather,` between them. Running them together unmarked
presents as one continuous statement something the author wrote as two thoughts — Stern's
misreporting structure, in miniature, and the sort of thing a marker would pick a student up on.
It now reads:

> There is no 'overall answer to the question whether philosophy belongs with the humanities or
> the sciences… the philosophical methods that it is most fruitful to adopt depend on the
> research question to be addressed'.

`check_argdown.py` now reports **unmarked splices**: claims made mostly of the source's words
that join passages far apart without saying so. Marked elisions were already handled; this is the
same measurement for the case where nothing declares that a join happened.

## Conversion

`pdf_to_source.py` refuses this paper, correctly: it is set with **different margins on recto and
verso** (x0=42.8 and 65.8), each with its own paragraph indent, so the global band detector sees
four left edges where there are two. The blocks reflow in `ingest.py` handles that without caring
— but leaves the running heads inline and finds no headings, and **the headings cannot be found
by typography at all**: they are set in the same 11pt as the body, and only the author's numbering
marks them. Hence this folder's own converter: the shared reflow, plus heading promotion,
furniture removal, and de-hyphenation.

## Rebuilding

```bash
python3 convert_source.py
python3 ../../.claude/skills/argdown/check_argdown.py wilson-williams-dewey.argdown --source-root .
node "../../app/build_argdown_viewer.mjs" \
    wilson-williams-dewey.argdown --source-root .
```
