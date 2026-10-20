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

## The second round (18 Oct, after the author had used it)

- **A new file starts afresh.** Suppositions are kept by label, so they followed the reader into the
  next file; opening one (`render`) now clears them, and any guess in progress (`suppReset`).
- **While guessing in Mechanism, what was supposed is greyed**, as in Reasons, and nothing that
  follows from it is (`keep.quiet`): "too easy to forget which element you've supposed".
- **Which claim would cost the most?** — a third way into Study, offered again when either other
  way ends. The reader clicks a guess; Show ranks every claim beneath a main claim by what supposing
  it false costs (main claims losing support first, then claims losing it), and sets the guess
  beside the three costliest. Where no single claim takes a main claim's support, the card says so.
- **A teaching map of causal junctions** after Pearl (`teaching/causal-junctions.argdown`): a chain
  through a mediator, a fork, a back door, a collider and a joint cause, each with its lesson in
  Reasons. Supposing is an intervention (*do*), so the collider's selection trap is stated as an
  association and said not to be computed; the README says so plainly. Each lesson is held by
  `test_mechanism_view.mjs`.

## The third round: the table as the next form (18 Oct)

After the follow-up to the Mechanism think piece ("Think piece follow-up — structures to do things
with", kept with the think piece outside the repository), which judged new structures by what a
reader can do with them: a framed question the map answers, an answer worked out rather than read
off, something the reader can change, a framing question left over, a move that transfers. The
author accepted the table as the next form, and the order; ruled that accounts against evidence be
both a panel and a fourth way into Study; asked for the process-tracing tests in words that serve a
cause and a reason alike, since readers "will probably not be aware of the terminology"; and gave
the go to the two small items and to "nothing to draw".

- **Weigh the accounts** (`src/argdown-accounts.js`, the page's `#weigh`). The text's account and
  each rival it reports (`#reported`, `#contested`) that is set against it, with the reasons the map
  gives for or against each as rows. A row tells them apart where it bears on two accounts
  differently, bears on both alike, or on one only — where the text says nothing of what the other
  would make of it. From a claim's right-click menu or What if…?, and as the fourth way into Study
  (lean first, guess, Show, reflect on a blank cell, ask again at the end). **Test?** asks two
  questions and names the answer: a pointer, a test to pass, a clincher, decisive (Van Evera's straw
  in the wind, hoop, smoking gun, doubly decisive, as Collier 2011 sets them out). The reader's
  reading; the panel adds what the map records.
- **These cannot all hold.** `inconsistent: <name>` on each claim of a set the text says cannot all
  hold (carried by `toGraph`, known to the checker, documented in the MCP's reference), and every
  contradictory or contrary pair: which would you give up, guessed, then what giving up each costs.
- **What the starting states do.** For a chain with two to four starting states, every combination
  walked (`conditionsTable`): what each outcome needs (any one, two together, one it cannot do
  without), with the whole table on request; each start can be switched off as a supposition.
- **Suppose an actor does nothing** (`actorOff`), on a state's menu where two actors or more carry the
  chain: what the actor alone carries stops; a state it shares is named and left standing.
- **Nothing to draw** (`plainChain`). A chain that is one short line, within one level, opens in
  words (what it comes to end to end stays the panel's question); **Draw it**, or any supposition, draws it. Fourteen of the
  corpus's 231 chains open so on 18 Oct.

Not built: the `cases:` block (typology, definition and counterexample, comparison of cases), which
waits until these tables have been used.

## Tables by design: the text's own comparisons (19–20 Oct)

The third round's tables were a side effect of data gathered for other purposes, so few maps
yielded one. The answer was to record what each claim is *about*. Three steps came first:

- extraction now names the tables a text cites and loses;
- the weigh panel says when a rival is only a denial;
- a census of twelve texts found comparisons in all of them, in two families: case tables and
  account tables.

The tabulation pass (`docs/tabulation-pass.md`; `frames:` and `about:` in the profile, a trial)
was then tried on four maps: Gettier, Stone, Valentino and Bates. Every pass checked ok and
verified. The pass also found relations the texts state that the maps had not drawn.

**The author's rulings (20 Oct):**

1. **The tables earn a panel in the app** (step 6). The views so far make the argument
   perspicuous (Reasons), give an analytical summary in order (Exposition), and show what the text
   says changes what (Mechanism). Tables give access to a different structure: how the text
   collects and classifies its information and evidence.
2. **Declared accounts probably replace the derived sets.** Not settled: test it.
3. **Several values in one cell: instinct says no**, and the interface would be hard. Look at
   mockups, or test its use, before deciding.
4. **The four passes go back into the original maps.** Done 20 Oct, all ok and verified.

**To do once the tables work is complete: what Ipsissima is for.** The purpose has shifted. It is
no longer only to let a reader understand writing that reasons to a conclusion, by breaking the
argument into steps so that the conclusion and the reasoning for it can be seen. Ipsissima now
builds a data layer, combined in one Argdown file, that gives the reader different ways to
interact with, explore and question what an argumentative text says. These need revising to say
so:

- the website;
- the other documentation (README, help, the extension's descriptions);
- the values and principles framework.

## Not built, and why

- **Conditioning** — what selecting on a state (a collider, above all) does to the associations
  among its causes. It would need d-separation over the chain, not the forward walk supposing uses.
- **Multiple choice** — ruled out (2).
- **A typed note** — still ruled out (Study plan, 14 Sep).

## Tests

`app/test_suppose.mjs` (What if…?, Guess first in Reasons, Study on my own, Study from here, and
a claim stating two steps on `fixtures/suppose/several.argdown`, where the panel asks which),
`app/test_mechanism_view.mjs` (the redraw bug, right-click, carrying both ways, Guess first in the
chart, Questions to try, the Display menu), and the Study checks in `test_rendered_dom.mjs` and
`test_clarity.mjs`, which now enter by **With others**.
