# The Purpose episode: from a map to a data layer, and from showing to inquiry

Opened 20 October 2026, at the author's direction. This is the framework's fourth live
values-improvement episode, after Second Thoughts (5 Sep), Formation (14 Sep) and Inquiry
(18 Oct). It follows their shape. Proposed edits are marked ⟨proposed⟩, the author rules at a
checkpoint, and nothing is merged or built on the assistant's judgement. **Status: the author's
rulings received, 20 Oct, and recorded in §6.** §§3.1–3.5 were carried into the framework files the
same day, with their ⟨proposed⟩ markers off; the diff is the record. The mission sentence the author
settled is his own (§6, ruling 2). The two case-law rows (§3.6) stay open. The quotation in §1 is from the author's message
of 20 Oct, and he approved it for the public repository the same day.

The file has three parts:

- the proposed changes to the framework (§§2–3);
- an audit of the App and Ipsissima-MCP against them (§4);
- a plan, in waves, for bringing what the audit found into line (§5);
- the author's rulings (§6).

---

## 1. What prompted it

The author's message of 20 October:

> Over the past few days, the purpose of Ipsissima has been both broadened and clarified. It's been
> broadened in that it's no longer just about allowing the user to understand writing that reasons
> to a conclusion by breaking the argument down into individual steps … Rather, Ipsissima analyses
> an argumentative text, and extracts a variety of information from it in addition to argumentative
> structure. The resulting rich argdown file allows the user several different ways of interacting
> with, exploring, and questioning, what an argumentative text says. … the purpose of Ipsissima has
> also been made more specific, in so far as I've clarified the centrality of something like
> Dewey's account of inquiry (and constructivist approaches to learning) in the kinds of tools and
> approaches that the App offers the user for grappling with, interpreting and interrogating a text.

Earlier, on the same day, in the tables rulings (`docs/INQUIRY-PLAN.md`): the views so far make the
argument perspicuous (Reasons), give an analytical summary in order (Exposition), and show what the
text says changes what (Mechanism); tables give access to "a different structure: how the text
collects and classifies its information and evidence". On 18 October the author proposed the
inquiry principle, B10. Before that, interacting with a map "was mostly confined to choices about
*how much* of the graph to show".

## 2. What the examination found: two hidden premises

Each earlier episode found a premise that no principle stated and nearly every surface assumed.
Second Thoughts removed *a map is a map of a text*; Formation removed *intelligibility delivered is
understanding formed*. This episode finds two.

**H1. The argument is what an argumentative text has to offer.** Every self-description assumes it.

- The website: "breaks the argument down into individual steps".
- The walkthrough: "This is an argument map".
- The README: "shows an argument three ways at once".
- The MCP's instructions: "Argdown argument reconstructions".

Yet since late September the file has come to record much more than argument:

- what the text says happens (the mechanism);
- what it asks (the question layer);
- the rival accounts it sets against each other, and the claims it says cannot all hold;
- where readings divide (`#crux`);
- what kind of text it is (`voice:`);
- and now how it collects and classifies its cases and evidence (`frames:`).

Not all of this is argument structure. A typology is not an inference, and a causal chain is not a
justification. They are other structures of the same text, read with the same care.

**H2. Understanding is delivered by showing.** P2 measures what the map delivers: is it
intelligible, and can it be checked? B8 and B9 added the reader's formation. B10 added inquiry, but
filed it as a specialisation of B2, the reader's own pace. The author's clarification moves inquiry
to the centre, as a constructivist account of how the App helps. Understanding is *built* by the
reader's own activity:

- framing a question;
- making a guess;
- supposing something false and seeing what follows;
- comparing cases;
- building a map;
- reflecting on what changed.

The file is the material and the test bed, not the lesson. With H2 gone, choosing how much of a map
to show is one way into it among several. It is no longer the core interaction.

One consequence follows directly from Dewey. Reflective thought begins with a felt difficulty
(*How We Think*, 1933). Without one, "confusion remains mere confusion". So a way into a text
should begin from a question — the text's own, or the reader's — rather than from a finished
picture. The map's question layer already exists, but the App opens on the picture.

## 3. Proposed changes to the framework

### 3.1 The mission sentence — superseded by the author's own (§6, ruling 2)

The current sentence, settled 5 Sep: **"Making complex reasoning intelligible through maps you can
check at every step."** Its second half names the trust mechanism, and that should stay. Its first
half names the old measure, which is intelligibility delivered by a map. Three candidates:

| | sentence | keeps | changes |
|---|---|---|---|
| **a** | **Making complex reasoning open to inquiry: one reading you can check at every step, and many ways to question it.** | "check at every step"; "complex reasoning" | the measure becomes inquiry; "maps" becomes one reading (the data layer) with many ways in |
| b | Making complex reasoning intelligible through maps you can check at every step — and question in many ways. | the whole of the settled sentence | inquiry is appended, not central |
| c | Question complex reasoning, from a reading you can check at every step. | the trust clause | the reader becomes the subject of the sentence (the constructivist reading); drops "making" |

**Recommendation: (a).** (b) keeps continuity but leaves inquiry as an appendix, which is the
position the author has just moved it out of. (c) is the most constructivist, but as an imperative
it reads as a slogan, and the project's sentences have so far been descriptions. Under (a),
**"one reading"** keeps the keystone's object in view, because the file is a reading of a text and
answers for its distance from it. **"Many ways"** names the data layer without the jargon. The
sentence appears in nine files, listed in §4, which is a reason to settle it once.

### 3.2 P2 restated — ruled

**P2 — The mission: making complex reasoning open to inquiry.** The mission has two halves, and
each binds the other:

- **What Ipsissima makes:** one reading of a text, in one ordinary Argdown file, holding the
  several structures the text has (its reasons, the order it tells them in, what it says happens,
  how it sorts its cases and evidence, what it asks), each checkable at every step;
- **What it is for:** the reader's inquiry, with ways into that file that let the reader frame a
  question, test a guess against the reading, and reflect on what changed.

B1 says who it is for (everyone, the novice first). B2, B8, B9 and B10 say how a reader is served.
B7 says how trust is carried where no text anchors it. B11 (§3.4) says what earns a place in the
file.

*Not proposed: a seventh apex for inquiry.* The apexes are not derivable from one another, and an
inquiry apex could never collide with the mission. It would be the mission. Restating P2 puts
inquiry where the author placed it, at the centre, without a new apex. If the author wants it
visible as an apex nonetheless, the alternative is P7, "the reader inquires", with B10 as its
statement and P2 kept as it is. That would give two mission apexes, which the theory currently
avoids.

### 3.3 B10 respecified — ruled

Kept: the core statement, Henne's distinction between framed and framing questions, never grading
the reader's reading, and "offered, never imposed" (T2). Changed:

- **Generality: the whole project.** For the App, B10 governs interaction design. For the MCP, it
  governs what a reading should record: B11's third duty is B10 applied at extraction.
- **It no longer specialises B2. It states what B2 serves.** The reader's own pace becomes the
  pace of the reader's own inquiry.
- **Four additions, each with its warrant:**
  1. *Inquiry begins from a difficulty* (Dewey). A way in starts from a question, the text's own or
     the reader's, before it shows the answer. The picture is where an inquiry is tested, not where
     it begins.
  2. *The reader builds; the App supplies material and fast feedback.* This is the constructivist
     clause. Making a map is inquiry too, so the guided mode (New from text…) and the editor are
     inquiry tools. The App never supplies the conclusion of the reader's inquiry, only the map's
     answer to a framed question.
  3. *Every way in closes on reflection* (Lang; Dewey's testing in imagined action). An inquiry
     tool ends by asking what changed: Study already does, and the weigh panel asks again at the
     end. Supposing and the tables do not yet.
  4. *The text's absences are the inquiry's best questions.* An empty cell stays empty. A denial
     is not a rival account. A chain with nothing to draw is said in words. What the text does not
     say is put to the reader as a question, and never filled in by the machine.

### 3.4 New: B11 — several structures, one file, many ways in — ruled

**It says.** An argumentative text does more than argue: it asks, tells, says what happens, sorts
its cases, sets accounts against each other, and divides its readers. Ipsissima records each of
these as a layer of one ordinary Argdown file, written to the profile. The reader reaches each
layer by a way in that names the question it answers. Three duties:

1. **Every layer is a reading, and answers for its distance** (P1 extended). A mechanism, a frame,
   a question or an account is a claim about the text, so it is carried on claims that bear
   fidelity marks and pinpoints. What the reconstructor adds is marked as theirs: a frame's label,
   a dimension the text does not name, a question the text implies.
2. **A layer records only what the text supplies.** The text's own tables, not the reconstructor's.
   An absence is drawn as an absence (see §3.3, addition 4). This generalises rulings already made:
   the empty cell, "nothing to draw", and saying when a rival is only a denial.
3. **A layer earns its place by what a reader can do with it.** This is the test from the
   18 October follow-up: a framed question the map can answer, an answer worked out rather than
   read off, something the reader can change, a framing question left over, and a move that
   transfers. It becomes the admission test for new layers and new marks. It replaces the
   moratorium on new marks (17 Oct) with a criterion.

**Seen in.** `frames:` and the Tables panel; the question layer and Study's opening; `inconsistent:`
and "these cannot all hold"; accounts and the weigh panel; the mechanism and suppositions carried
across views.

**Provenance.** **compression**, origin: the author (20 Oct, §1). The three duties are the
assistant's, assembled from rulings of 17–20 Oct, and are the author's to settle.

**Weight.** Untested as a principle. Its candidate collision is B4, cost (§3.6).

### 3.5 The seam, restated (THEORY §3) — ruled, with "a map's" for "the reading's"

At present: "the App faces the *reader* of a reconstruction; the MCP faces its *sources* and its
*checking*". The MCP now does more: it serves the method that decides which layers a reading
gathers, and the profile that defines them. Proposed:

> **The MCP gathers the reading's layers — the text, and the several structures read from it —
> under a method it serves and a checker it runs. The App opens the ways into them.** The
> judgement seam (G3) runs through both unchanged: the machine gathers and checks, the model
> reads, the person judges, and the reader inquires.

### 3.6 Case law — both rows ruled as proposed (§6, rulings 9 and 10)

There are two collisions, both live.

| collision | proposed winner | why |
|---|---|---|
| more layers vs cost per map (B11 vs B4) | **a layer becomes a default only on measurement**. It stays on request until a trial shows readers use it and its cost is measured. `argdown_plan` offers the layers a text seems to have rather than running them unasked | P4 (measure before design) and B4 (ask before spending). The mechanism became a default this way (1 Oct); tabulation is on request now |
| inquiry controls vs display controls for the visible bar (B10 vs P6) | **inquiry visible, display gathered**: the Reasons bar follows the Mechanism view's Display menu (18 Oct) | at present every control on show is display, and supposing is reached by click or right-click alone. A reader cannot try what they cannot see |

### 3.7 What stays, and why

- **The keystone gains weight.** Each new layer is a new class of representation that must answer
  for its distance. That is the same reflexive move the keystone made at every earlier widening.
- **A7, report and never grade.** The inquiry tools compare the reader's guess with the map. They
  never score it. The tables' "worse on every ranked count" reports the text's own ranking.
- **The genres.** Reading, survey, argument of one's own. The teaching map of causal junctions is
  an argument of its maker's own and needs no fourth genre.
- **The name.** *ipsissima verba* remains the distinctive half. It now describes the standard every
  layer is held to, not the only thing the program does.

## 4. The audit: what is out of line

Each finding names the premise it carries (H1, H2), the principle it falls short of, and where it
is. The audit covered:

- the repository's self-descriptions;
- the help, the walkthrough, and the About and drop panels;
- the App on screen (the Wilson sample, and the frames fixture);
- the MCP's instructions, prompts, method documents and package metadata;
- the credits.

### 4.1 Self-descriptions (H1; P2, D6, E10)

| # | where | what it says | out of line because |
|---|---|---|---|
| 1 | `site/index.md:21–24` | "Ipsissima is for understanding writing that reasons to a conclusion … breaks the argument down into individual steps" | the sentence the purpose has outgrown, in the first paragraph a visitor reads |
| 2 | `site/index.md`, "What it is for" | justification and exposition, debate, own map, draft | it leaves out mechanism, tables, questions and every inquiry tool |
| 3 | `README.md:6, 15–17` | "shows an argument three ways at once: the map, the passage …, and the marks" | H1; and the views are now Reasons, Exposition, Mechanism and Tables, with Study and supposing |
| 4 | `README.md`, "What it does that other Argdown tools do not" | ten items, all about display, fidelity or editing | it leaves out supposing, Guess first, Study, weighing accounts and the text's own tables; "Three arrangements of the same claims" |
| 5 | `app/about.md` | "opens an argument as an interactive map" | H1 |
| 6 | `app/help.md:46` | the mission sentence, and "a reading of one text, a survey of a whole debate, or an argument of your own" | to be updated with §3.1 |
| 7 | `app/desktop/src-tauri/tauri.conf.json:46–47` | "Argument reconstruction, against the text it is of." | what the operating system shows; H1 |
| 8 | `ipsissima-mcp/pyproject.toml:8`, `manifest.json` (description, long_description) | "Turn a document into a source an Argdown reconstruction can cite, and check the reconstruction against it" | the MCP now also serves the method for four layers; see §3.5 |
| 9 | `server.py` INSTRUCTIONS, docstring, and the `reconstruct_argument` prompt's description | "turns documents into Argdown argument reconstructions"; the order of work names argument alone | H1. Tabulation exists but is never mentioned to a client, so a user cannot ask for what they do not know is there |
| 10 | `ipsissima-mcp/README.md` opening | "Ask your assistant for an argument map … the mechanical half" | as 8 |
| 11 | `docs/SKILL.md` description | "argument reconstruction from prose into premises and conclusions" | H1 |
| 12 | `docs/PROFILE.md` intro | records "where a claim comes from …, how far …, whose view …, what backs a causal step" | it leaves out questions, accounts, inconsistent sets and frames |
| 13 | the mission sentence in nine files: README, `app/package.json`, `help.md`, `about.md`, `brand/README.md`, `docs/NOTES.md`, `THEORY.md`, `site/_config.yml`, `site/index.md` | copies with no machinery holding them together | E10: one source of truth, or copies held together by machinery. `test_promises.mjs` has no row for it |
| 14 | `CONTRIBUTING.md:14, 29`; `README.md:47` | "five reconstructions", "Twenty suites", "ten worked reconstructions" | there are eleven samples and many more suites. A stale self-description (D6) |

### 4.2 Credit (P5, D1)

| # | where | finding |
|---|---|---|
| 15 | `CREDITS.md` | **It names none of the sources the inquiry and causal work rests on.** Absent: Dewey (*How We Think*), Henne (2023), Lang (*Small Teaching*), Van Evera and Collier (2011; the tests in the weigh panel, which `help.md:979` names), Pearl (the causal-junctions teaching map), and Ylikoski and Coleman (the boat drawing). Also absent: the mechanism profile's sources (Craver, Johansson et al., Arthur, Hertz et al.), and Bates and Stone as the tabulation trial's texts. Under D1 this is the clearest breach the audit found, and the cheapest to mend |

### 4.3 The App's interface (H2; B10, P6, F8)

| # | where | finding |
|---|---|---|
| 16 | the map's bar (seen on screen) | **Every control on the bar is display:** how much, claims, sections, spine and hashtags. Study and Tables sit at its left end, the same size as a display switch, so they read as display modes. Supposing, What if…?, Weigh the accounts and "These cannot all hold" are reached only by click or right-click |
| 17 | `argdown-viewer.template.html:4353`; `:1281`; `:4842` | Study's tooltip says "say what you think holds each claim up before unfolding it", and its card's hint says "predict, then unfold". Both describe the 14 Sep design. Study now opens on the text's question and has three ways in (On my own, With others, Which claim would cost the most?) plus weighing accounts |
| 18 | the view switcher and the help topic "Three arrangements of the same claims" (`help.md:221`) | Reasons, Exposition and Mechanism are arrangements. Tables, Weigh and Study are panels or cards. **Nowhere is there one list of the ways in, each with the question it answers**: what holds this up? where does the reader meet it? what does the text say happens? how does it sort its cases? what follows if…? what did I expect? |
| 19 | the opening of a map | a map opens on its picture, fitted to the main claim. Where the map has a question layer, the question sits in a chip in the strip (`qchip`). B10's first addition asks for the question first, offered and not imposed (T2, F4) |
| 20 | the walkthrough (`template:3630–3880`) | it opens: "Ipsissima helps you understand and analyse … arguments by visualising them". Of its ten steps, none questions the map: it demonstrates folding and not supposing. Its 411-word budget is a promise ("two minutes"), so an inquiry step must replace a step and cannot be added |
| 21 | `help.md`, "What's on the screen?" | it lists marks only, with no row for What if…?, Study, Tables or the suppositions banner |
| 22 | `help.md` groups | supposing, tables and Study are filed under **# Reading an argument**. The help's own rule (its header) is that groups divide by what the reader is asking, so a missing group, *questioning a map*, is the groups being wrong |

### 4.4 The MCP's method (H1; B11, B4)

| # | where | finding |
|---|---|---|
| 23 | `docs/extraction-prompt.md` | It tells the model what the file *is* ("a scholarly claim about someone's work") but not what it is *for*. A model that does not know the file feeds suppositions, Study, the weigh panel and the tables cannot make the choices those uses need. Two examples: drawing a finding's relation to *each* account, and recording an absence rather than filling it. B11's third duty belongs in the method |
| 24 | `argdown_plan` (`server.py:181`) | Its intents are `reconstruct` and `extract`, and it has no way to offer layers. Ingest already notices tables the conversion lost (step 1, 19 Oct), but nothing passes that on as "this text compares; would you like its tables?" |
| 25 | `docs/values/` itself | `README.md`'s episode list; THEORY §1–§3 and §5; B2's weight note ("folding is the feature the project was founded on" — true as history, but no longer the core interaction); F1 says "picture" where it now governs every way in. These are the proposals' own downstream edits |

What the audit did **not** find is worth recording too. The Reader carries every inquiry tool, so a
reader sent a map can question it. No inquiry tool grades. "Offered, never imposed" holds
everywhere: Guess first is off until chosen, and Study asks before it begins. The empty cell, the
denial line and "nothing to draw" already enact B11's second duty.

## 5. The plan

Wave 0 comes first, and each later wave proceeds on the author's word. The order puts the cheapest
and least contestable changes first, and the interface last, because it needs mockups.

**Wave 0 — rulings (the author).** Rulings are needed on:

- the mission sentence (§3.1);
- P2 restated, or P7 instead (§3.2);
- B10 respecified (§3.3);
- B11 (§3.4);
- the seam (§3.5);
- the two case-law rows (§3.6).

They are then carried into `INVENTORY.md`, `THEORY.md` and the framework's `README.md`, with the
⟨proposed⟩ markers off. The diff is the record.

**Wave 1 — say it once, everywhere (findings 1–15).** The work:

- write the settled mission paragraph and a short list of the ways in once;
- carry them into the README, the site, `about.md`, `help.md`'s intro, the Tauri descriptions, the
  MCP's `pyproject`, manifest, README, INSTRUCTIONS and prompt description, `SKILL.md`, and the
  profile's intro;
- add a `test_promises.mjs` row holding the mission sentence identical across the nine files
  (E10);
- correct the counts in CONTRIBUTING and the README;
- add the missing credits.

Code is untouched apart from the lint. *Note:* the website shows the latest tag, so the site
changes reach readers only with a release, and a release is asked for first.

**Wave 2 — the help (findings 18, 21, 22, and 17's words).** The changes:

- a new group, **# Questioning a map**, holding Supposing, Weigh the accounts, These cannot all
  hold, What does the text compare? and Studying a map;
- "Three arrangements of the same claims" becomes **"Ways into a map"**, each named by the question
  it answers;
- "What's on the screen?" gains rows for What if…?, Study, Tables and the banner;
- Study's tooltip and card hint are reworded.

`test_teaching_text.mjs` holds every renamed link. Retired words go into `vocabulary.json`.

**Wave 3 — the walkthrough (finding 20).** One step is replaced by a step that performs a
supposition on the open map: "What if this were false?", demonstrated rather than described, as
the fold step is. The title card's sentence follows the mission. The two-minute budget is kept, and
its word count is re-measured.

**Wave 4 — the interface (findings 16, 19), mockups first.**

- Reasons' display controls go into one **Display** menu, as Mechanism's did. The bar then leads
  with the ways in: Study, Tables where a map has frames, and What if… for the claim in hand.
- The map's question is offered first on opening, where the map has one, and can be dismissed and
  remembered (T2, F4).
- Supposing and the tables gain a closing reflection (§3.3, addition 3).

Each is a ruling for the author on a comparison page, as with the tables.

**Wave 5 — the method (findings 23, 24).**

- A short section in `extraction-prompt.md`, *What the file is for*: which way in each layer
  feeds, and B11's three duties.
- `argdown_plan` reports the layers a text seems to offer (lost tables, comparisons, a causal
  chain) and asks.
- The server INSTRUCTIONS name the layers.
- A cost measurement of tabulation as a default, on the corpus's maps, before any default changes
  (§3.6, row 1).

**Wave 6 — release.** Once waves 1–3 land, they want a release, so that the site, the bundle and
the app all say the same thing. Asked first, as always.

## 6. The author's rulings (20 Oct)

1. **The mission sentence: (a)**, "it's not perfect but the best of the three". The author may revisit
   it once the waves are done.
2. **The word "reading" is not quite right**, in the mission sentence and elsewhere. The assistant
   pointed out that "reading" already names one genre, so "one reading" leaves two genres out of the
   mission, and that "interpretation" is a rung of the fidelity ladder (F8). The author then proposed
   his own sentence, "Making complex reasoning clear through charts you can check and question". He
   weighed "charts" and "visualisations" against "maps": a table is not obviously a map, but "chart"
   already names the Mechanism view's drawing, and "visualisation" names the passive half the episode
   moved away from. He settled on **"Making complex reasoning clear through maps you can check and question."**, with the breadth in the line beneath: **"The argument and its reasons, the order the text tells them in, what it says happens, and the tables of what it compares — each one a way into the text."**
   Where the proposals said "the reading" for the whole file (P2, the seam), they now say "a map".
3. **P2 restated: yes.** No seventh apex.
4. **B10 respecified: yes.**
5. **B11: yes.**
6. **The seam: yes**, with "a map's layers" in place of "the reading's layers".
7. **The quotation in §1** may go to GitHub.
8. **The build order of §5: yes.**

The two case-law rows of §3.6 were left open at first, and ruled after waves 0–3 were built:

9. **Inquiry visible, display gathered: yes.** "I agree with putting the inquiry controls on the
   bar, with the Display elements openable via a 'Display' button as per the Mechanism view."
10. **A layer becomes a default only on measurement: yes.** "I agree with the need to measure
    before committing to making the tables a default part of extraction." 

## 7. What was built (20 Oct)

**Wave 0.** The rulings were carried into `INVENTORY.md` (B1's addendum, B2's weight note, B10
respecified, B11 new), `THEORY.md` (P1, P2, the seam and its diagram, a revision note) and the
framework's `README.md`.

**Wave 1 — say it once, everywhere** (findings 1–15).

- The mission sentence and the line beneath it now appear in:
  - the README, the website, the About window and the help's opening;
  - the desktop app's descriptions;
  - `app/package.json`, `site/_config.yml`, `brand/README.md` and `docs/NOTES.md` (with the
    history of the line).
- The README and the website now say what a map holds and how it can be questioned. The README's
  list of what Ipsissima does gains supposing, Study, weighing accounts and the text's own tables.
  "Three arrangements" became "Several ways into one file".
- The MCP's `pyproject.toml`, `manifest.json`, README, server instructions, docstring and prompt
  description now say what the map is for. The instructions offer the text's tables rather than
  leaving a client unaware of them. This is finding 9; the rest of finding 24 stays with wave 5.
- `SKILL.md`'s description and the profile's introduction name the further layers.
- The counts were corrected: eleven samples, six of them papers, and over sixty suites.
- `CREDITS.md` gained two sections: how a reader questions a map (Dewey, Henne, Lang, Van Evera
  and Collier) and how a causal chain is drawn (the mechanists, Coleman, Ylikoski and
  Martínez-Peña, the social-ecological systems group, Arthur, Pearl and Mackenzie). The Zotero
  library was checked for each citation.
- `test_promises.mjs` gained a row holding the sentence, the line beneath it and the retired
  sentence across eleven files. It was shown able to fail.

**Wave 2 — the help** (findings 17, 18, 21, 22).

- A new group, **# Questioning a map**, holds supposing, the tables and Study.
- "Three arrangements of the same claims" became **Ways into a map** under *Start here*, naming
  the question each of six ways in answers.
- *What's on the screen?* gained drawn rows for What if…? and for Study and Tables.
- Study's tooltip and its card's opening hint no longer describe only the 14 Sep design.
- `vocabulary.json` retires the old topic name and the old mission sentence.

**Wave 3 — the walkthrough** (finding 20).

- "The margins" gave way to **What if it were false?** The step supposes false the claim whose
  falsity costs the most, so that what it supported fades, and takes the supposition back when the
  reader leaves the step. Any supposition the reader had made is restored.
- The title card now states the mission.
- The tour is 410 words against 411, so it keeps its two-minute promise. It was checked on screen
  with real key presses on the Wilson sample: forward, back and Escape.

**Wave 4, first part — the bar** (finding 16; ruling 9). The Reasons and Exposition bar now
runs in three parts:

- **the ways to question the map:** Study, Tables, and a new **Weigh**, which opens the weigh
  panel on the first set of accounts a reason bears on;
- **the ways to move around it:** how much, and sections;
- **Display ▾**, which gathers claims, flow, shape, spine, hashtags and the appraisal, as the
  Mechanism view's Display menu does.

The menu opens closed. It stays open while several choices are made, and closes on a press
elsewhere or on Esc. "N claims hidden by switches" stays on the bar, so a switch behind a closed
menu never hides claims silently. On a phone the menu is placed by the window, clear of the
sideways-scrolling strip, and its hashtags wrap.

The help's *The controls* and every place that sent the reader to "the bar" for a switch now say
"under Display". `test_tables.mjs` holds the bar's order, the menu's manners and Weigh. One check
runs on the Bates sample, where the first set has no reasons; it was found on screen, and was
shown to fail when Weigh opens set 0.

**Wave 4, the rest — ask first, reflect after** (finding 19; B10 clauses 1 and 3). The mockups
were put to the author on a comparison page (https://claude.ai/artifact/CyabRah5Kwc4xPN6px8EWG),
and he ruled the same day: "The recommended options look good; build them." Built:

- **The question first (A1, A3).** As a map that names its question opens, a card over the map asks
  it: **Study it**, **Show me the map**, **Don't ask first**. The card comes once per map opened,
  never while the walkthrough or Study has the reader, and a press anywhere else puts it away.
  "Don't ask first" is remembered, and the top
  of How to use offers it back. The strip's chip now says the question itself, first, instead of
  counting questions.
- **After supposing (B1, B2).** With Guess first, the banner asks about the one place the reader
  and the map parted: a claim, or in Mechanism a state, they did not expect to go, with **Show what
  it rests on** (the route from the supposition) or **Show it**; else one they expected to go that
  the map keeps, with **Show what holds it up**. The banner serves both views. Without a guess,
  *What follows* and the chain's panel each end on one line that sends the reader back to the text.
- **In the Tables panel (T1).** One question to end on, from the strongest move the table shows:
  alike but for the verdict, against the rule, one respect apart, no better on any count, a silent
  cell. Cross tables ask about their first empty cell; account tables about a finding that bears on
  one account only, or, where none tells the accounts apart, what finding would.

Each was checked on screen, and each check in `test_tables.mjs`, `test_suppose.mjs` and
`test_mechanism_view.mjs` was shown to fail under its mutation. Tests that drive a map with a
question say "Don't ask first", as they already said the walkthrough was seen.

**Still to come:**
- wave 5 (the method; the §3.6 row on cost);
- wave 6 (a release, asked for first).
