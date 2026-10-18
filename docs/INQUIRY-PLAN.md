# Inquiry: entertaining and testing hypotheses about an argument

Opened and ruled 18 October 2026, on the author's proposal that the App "explicitly adopts an
inquiry based approach to learning", once supposing and denying a conclusion had landed (6153f33,
f20b562). Admitted as B10 (`docs/values/INVENTORY.md`). Warrant: Dewey, *How We Think* (1933);
Henne, "Framed and framing inquiry" (*Synthese* 2023); Lang, *Small Teaching* (2021), ch. 1,
"Predicting". The plan was put to the author before anything was built; this file records it, his
rulings, and what shipped.

## The frame

Dewey's reflective thought runs from a felt difficulty through a suggestion, a guiding hypothesis,
reasoning out what follows from it, and testing it by action, overt or imagined. Supposing is the
last two in software. Dewey also says why a general appeal to think fails: thinking starts from a
difficulty the thinker feels, and without relevant experience "confusion remains mere confusion".

Henne's distinction makes feedback possible without grading. A *framed* question takes a framework
for granted — here, the map: "given this map, what loses its support if X is false?" has an answer.
A *framing* question puts the framework itself in question — is this the right reading, is this step
really deductive? — and stays with the reader. So the App may say where the reader and the map part
(Lang's fast feedback) without grading a reading, which the one-reading chip exists to forbid.

Lang: a prediction helps only where the reader can bring what they know to it ("stay conceptual");
a random guess, made without commitment, does not carry the benefit (Brod 2021, as Lang reports it).
Feedback should come fast, and reflection should follow.

## Findings that shaped the plan (on screen, 18 Oct)

- Supposing in Reasons was by right-click only; in Mechanism by panel buttons only, with no
  right-click at all. Two vocabularies ("Your suppositions" / "Your experiment"), two layouts.
- Bug: the Mechanism view's suppositions were held inside each mount, so switching Marks, chain or
  boxes dropped them silently.
- Every presentation control was on show and every inquiry control hidden.
- Study asked "what holds this up?" of the main claim: a request for the whole paper's argument.

## The author's rulings (18 Oct)

1. The map's answer may be drawn beside the reader's marked guesses. **Yes.**
2. Multiple choice in Study, with the wrong options drawn from the same map. **Veer towards no** —
   not built.
3. A supposition carries between Reasons and Mechanism, visibly. **Yes.**
4. The Mechanism panel opens on the chain's questions, with the findings as things to try; the
   panel's text was too much. **Yes.**
5. Add the principle as a new B principle. **Yes** — B10.

## What shipped

1. **The Mechanism suppositions survive a redraw** — kept in the controller's `keep.exp`.
2. **Same gestures in both views.** Right-click, and the context-menu key, on a state or an arrow
   in Mechanism, drawing the page's own menu; states are now keyboard buttons. In Reasons a click on
   a claim offers **What if…?** beside it, opening right-click's suppositions.
3. **One record, one banner.** `SUPP` holds Reasons' claim-level suppositions and the chain's own
   (`mfail`, `mhold`, `moff`). A step that does not run makes the claim stating it false; a claim
   supposed false (or denied in turn) stops its step, or, where it states several, the Mechanism
   panel asks which. The banner over both views lists each supposition with its own ×, and says
   how it shows in the other view or that it shows in one only. Reasons' card is now *What
   follows*, foldable from the banner.
4. **Display.** The Mechanism bar's labels, marks, boxes, nesting, zoom and fit are under one
   **Display** menu, which stays open across a redraw. The Reasons bar was left as it is: its one
   pure display control (claims Short/Full) does not earn a menu of its own.
5. **Questions to try.** The Mechanism panel opens on each finding as a question that does not give
   its answer away (`follows()` now carries `question`), with **Show** for the answer and what it
   rests on; state names are cut to their first clause in a question. The chain's counts, gaps,
   loops and legend are folded under **About this chain**.
6. **Guess first.** With it on (banner or menu; remembered; always on in Study), a new supposition
   asks the reader to mark the claims they expect to lose the map's support, or the states the
   steps will no longer bring about; **Show** tags each mark *the map agrees* / *the map keeps it*
   and each unmarked loss *not guessed*, with a one-line count. Tags, not borders: a border's
   pattern is fidelity (F5).
7. **Study for one reader.** The card opens on the text's question (the map's own question layer,
   or its chain's) and what the reader already thinks, then **On my own** or **With others**. On my
   own: one argument at a time from the ground up, premises given, "where do they lead?", hints on
   request (what the conclusion goes on to support and how the step works; then its name), Show;
   each objection met as a fork after the reader has reached what it targets, with **Try it:
   suppose it holds** (a guess first) and **How does the text answer it?**; a close that asks which
   claim the reader would deny, and whether the map changed their first view. **Study from here**
   in the right-click menu takes one part of a long map. With others: the descent from the main
   claim, as before, ending on a supposition.

## Not built, and why

- **"Which claim would cost the most?"** — guess, then rank by the load-bearing measure. A natural
  next step; left for the author's word after he has used Guess first.
- **Multiple choice** — ruled out (2).
- **A typed note** — still ruled out (Study plan, 14 Sep).

## Tests

`app/test_suppose.mjs` (What if…?, Guess first in Reasons, Study on my own, Study from here, and
a claim stating two steps on `fixtures/suppose/several.argdown`, where the panel asks which),
`app/test_mechanism_view.mjs` (the redraw bug, right-click, carrying both ways, Guess first in the
chart, Questions to try, the Display menu), and the Study checks in `test_rendered_dom.mjs` and
`test_clarity.mjs`, which now enter by **With others**.
