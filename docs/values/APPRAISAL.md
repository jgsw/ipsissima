# The Appraisal episode: assessment on request

Opened 21 November 2026, at the author's direction ("Does the values framework need updating in the
light of the decision to build the appraisal pass … and whether there are any other changes to the
code since the last values framework update that might suggest updates"). This is the framework's
fifth live values-improvement episode, after Second Thoughts (5 Sep), Formation (14 Sep), Inquiry
(18 Oct) and Purpose (20 Oct), and it follows their shape. Proposed edits are marked ⟨proposed⟩. The
author rules at a checkpoint, and nothing is carried into `INVENTORY.md` or `THEORY.md` on the
assistant's judgement. **Status: ruled 21 Nov, all nine proposals as drafted (§6), and carried into `INVENTORY.md` and
`THEORY.md` the same day; the diff is the record.** The ⟨proposed⟩ markers below are kept as the
record of what was put to the author. The wording of
every proposal was assembled by the assistant and is the author's to settle (D7). The quotations of
the author below are from the private record of 18–20 November; they are his to approve before this
file is pushed (README, "Two cautions").

---

## 1. What prompted it

The last change to the framework was on 30 October. Since then:

- **0.4.1 (2 Nov).** Samples upgraded, a fixed order of seats in each row, and a checker fault for a
  key written twice.
- **Unpetrify (9 Nov).** The converters were split into a package of their own, offered on its own,
  and published on PyPI on 20 November.
- **The appraisal trial (18 Nov).** Twelve blind appraisals of three texts, half written with the
  checked map and half from the text alone, judged blind.
- **Appraisal on request (19 Nov, profiles 1.27 and 1.28).** On a request that says so, the model
  assesses a text's argumentation, its mechanisms and its comparisons. The result is a report beside
  the map (`<map>.appraisal.md`), shown in an Appraisal pane whose links go into the map. The checker
  verifies the report's quotations and links.
- **Where to look (19–20 Nov).** A panel on the map's bar, shown unasked, lists what the map records
  no reply, reason or evidence for, ranked by how much rests on each. The same list is the MCP's
  `argdown_audit`.
- **Room for an open panel, and tablets and phones (20 Nov).**
- **0.5.0 (20 Nov).** All of the above, released.

The author's request asked the framework to test the appraisal above all. His rulings of 19 November
are its main material:

> Overall, one very useful lesson that this appraisal exercise has taught me is that building the
> argdown aids *human* comprehension of the source text. It has little or no impact on the AI's
> comprehension of the article (though the improvement in accuracy in quotations is worth having).

> Let's try including the computed diagnostics unasked. I can see if they seem useful and/or if they
> seem to overstep too far into evaluation.

> My assumption is that if the user *only* wants an appraisal but no argdown it wouldn't be worth
> making an argdown merely to help the appraisal. So offering the user a choice here seems
> appropriate.

---

## 2. What the examination found

**The framework says Ipsissima never grades, and Ipsissima now does, on request.** A7 reads "The tool
reports the argument; it does not grade the author". P3 promises the author of the text "their
argument reported rather than graded (A7)". Neither has a qualification. Since 26 September a map
could carry the reconstructor's own appraisal (`#appraisal`, written only on request, off until
switched on). Since 19 November a whole pass exists to assess an argument, its mechanisms and its
comparisons. The framework mentions neither. Its only reference to an appraisal is a Display menu item
in `PURPOSE.md`. By D6, the framework describes itself under the project's own fidelity rules, and here
it misdescribes the product.

**A7 holds two commitments, and they have come apart.**
- *Assessment and report must never blur* ("make crystal clear what is assessment of the quality of
  the argument, and what is merely reporting what the argument is", 18 Aug). Everything built honours
  this, and the redesign of 19 November strengthened it:
  - the appraisal is a separate document, in a pane of its own;
  - nothing of it is written into the map;
  - `#appraisal` claims in a map are left out of every measure of the author's argument;
  - Weigh labels any it shows as "the appraisal, not the text".
- *The tool does not grade.* This is no longer true without qualification. It is true by default: a
  map reports and never evaluates (the author, 1 Oct, in the private record, and restated in
  `appraisal-pass.md`: "A map reports what a text says and never evaluates it").

**Nothing new at the apex, and no new principle.** The case for assessment on request is already in
the framework:
- B1's mission includes "wherever someone wants to assess reasons for and against a conclusion";
- B6 makes the user the touchstone;
- B9 makes a reader's own purpose sovereign.
What the framework lacks is the statement that the default and the request differ, and how they are
kept apart.

**The other changes are enactments, not revisions.** Each fits an existing principle:
- the tablet work enacts B1 and F2;
- room for a panel enacts P6 and F3;
- the duplicate-key fault enacts E3;
- the dependency overrides are E8.
Only Unpetrify raises a question of scope (§3.6). The appraisal trial supplies a case-law row (§3.8)
and a line about self-description (§3.5).

---

## 3. Proposed changes

### 3.1 A7 respecified ⟨proposed⟩

> ### A7. The map reports the argument; assessment comes only when asked for, and always apart
>
> **It says.** A map measures how a text arranges its reasons, and does not score the arrangement.
> Neither anticipated nor prepared support is a fault, and a text is compared against its own
> practice, not against an absolute convention. That is the default, and nothing in a map
> evaluates. A user may ask for an assessment: what is wrong with an argument, how it could be
> strengthened, whether its mechanisms are plausible, whether its comparisons are cogent. Then the
> model assesses, and the assessment stays apart:
> - in a document of its own, under its own name;
> - never written into the author's argument;
> - never counted in a measure of it;
> - with every checkable claim in it checked (A11).
>
> What is assessment and what is report must never blur. That half is absolute; "does not grade" is
> the default.

Seen in, added:
- the appraisal report and its pane (profile 1.28);
- `#appraisal` claims, written only on request, off until switched on, left out of every measure of
  the author's argument (26 Sep);
- Where to look's "facts about the map, not verdicts".

Weight: unchanged (heavy). Case law, added:
- **the sibling layer withdrawn (19 Nov).** An appraisal written into a second Argdown file was
  hard to read and sat far from what it appraised (the author: the appraisal claims "are gathered
  together a long way from the individual claims that they are appraising"). It was replaced by a
  report in its own pane, linked into the map: separation won over co-location;
- **load ranks, it does not grade (19 Nov).** On the author's objection that Where to look showed
  "which premisses are load bearing, not that the argument is thin at this point", load now only
  orders the list. A linchpin is not a weakness.

Provenance: unchanged, with the additions as **compression**, origin author (the rulings of 1 Oct and
18–20 Nov).

### 3.2 P3, the author's sovereignty ⟨proposed⟩

`THEORY.md` §2, P3, first bullet, from "their argument reported rather than graded (A7)" to:

> their argument reported rather than graded unless a user asks, and an assessment then kept apart
> from the report (A7)

### 3.3 B10, clause 2 scoped ⟨proposed⟩

From "The App never supplies the conclusion of the reader's inquiry, only the map's answer to a framed
question." to:

> The App never supplies, unasked, the conclusion of the reader's inquiry, only the map's answer to a
> framed question. An appraisal the user commissioned is a document the App displays, as it displays
> the Manuscript, under its own name; it is not the App's answer.

**A possible enactment, not proposed for building now.** The Appraisal pane could open on the
guess-first pattern ("Which claim do you think is weakest?") before it shows the ranking. It would be
off by default, as Guess first is (the formative-staging ruling of 14 Sep). It is noted here so a later
episode can take it up if readers of appraisals turn out to skip to the verdict.

### 3.4 A11, a fifth instance ⟨proposed⟩

Seen in, added: "the appraisal report's quotations, checked against the text, and its links, checked
against the map (fifth, 19 Nov)". The report's claims about the text are self-claims with a fact of
the matter. Its claims about the argument's quality are the assessment, and are reported, not checked.

### 3.5 D6, what the map does for the model ⟨proposed⟩

Seen in, added, with a case:

> The appraisal trial (18 Nov) measured what a map does for the model that reads it. The model's
> appraisals were more exact but no more insightful: every objection rated strongest was found by
> both arms. The author's conclusion is that a map aids human comprehension, and that for the model
> its gain is exact quotation. Self-descriptions therefore never claim that a map makes the model's
> reading or critique better. None did when the trial reported, and the method says so of itself
> (`appraisal-pass.md`, "A map is not worth making for the appraisal alone").

### 3.6 Unpetrify, in the division ⟨proposed⟩

`THEORY.md` §3, after the diagram, a fourth point:

> **The ingest ethic has a home of its own.** Since 9 Nov the converters are Unpetrify, a package
> Ipsissima-MCP uses and that anyone may use on their own, for text that will never become a map.
> - **What binds it:** the G cluster (it is the extraction); the E cluster; C1 (nothing leaves the
>   machine: the OCR runs locally and caches locally); C6; D2 (GPL, as the MCP is).
> - **What does not:** P2's mission and the B and F clusters, which are about maps and their
>   readers.
> Its README and reports are self-descriptions, so D6 binds them too.

The G cluster's heading in `INVENTORY.md` would read "The ingest ethic (Ipsissima-MCP and
Unpetrify)".

### 3.7 F6, the touch equivalent ⟨proposed⟩

Seen in, added: "On a touch screen, a held finger shows a control's title, so what a mouse reads by
resting a finger can read by holding (20 Nov)". The principle is unchanged. The hover layer now has
two ways in.

### 3.8 Case law ⟨proposed⟩

Two rows for `THEORY.md` §5:

| collision | winner | where |
|---|---|---|
| making a map to help the model appraise vs its cost (B4) | measurement: the map made appraisals more exact, not more insightful, so none is made for an appraisal alone, and the user is offered the choice with its cost | appraisal trial, 18 Nov; ruled 19 Nov |
| an assessment drawn into the picture vs a report linked into it (P6, A7) | the report: readable, never mistaken for the text's argument, and one click from what it appraises. It replaced a second Argdown layer | profile 1.28, 19 Nov |

And one row marked **open**:

| collision | winner | where |
|---|---|---|
| computed diagnostics shown unasked vs the map that reports and the reader's attention (B10 cl. 4, B11 vs A7, P6) | **open: a trial.** Where to look is on the bar unasked, its items facts about the map, ranked by load and three at a time. The author will judge whether it helps or "overstep[s] too far into evaluation" | 19 Nov ruling; this file |

### 3.9 What stays, and why

- **G3 is unchanged.** The server still does not appraise. The method it serves says how to, the audit
  computes facts, and the checker checks quotations and links. The assessment is the model's
  judgement, and behind the model the person's who asked for it.
- **B4 is unchanged, and was honoured.** The appraisal never runs unasked, and the plan offers the
  cheaper route where there is no map.
- **B10's clause 4 is unchanged.** In the map an empty cell stays the reader's question. An appraisal
  may answer it, but only in its own document.

---

## 4. Housekeeping done with this draft

Two self-descriptions were out of date once Unpetrify was published (20 Nov). Both were corrected on
21 Nov (D6, E4):
- `unpetrify/README.md` said Unpetrify "is not on PyPI yet". That README is also the package's
  description on PyPI, so the PyPI page itself said so.
- `ipsissima-mcp/RELEASING.md` said Unpetrify's PyPI project "does not exist yet". It now records
  the first upload, and the publisher's exact workflow name, which cost a failed upload.

The PyPI page will show the corrected README at Unpetrify's next release. The description an index
holds cannot be edited after upload.

---

## 5. For the author's ruling

1. **A7 respecified** (§3.1): yes, or as amended.
2. **P3's author clause** (§3.2).
3. **B10 clause 2 scoped** (§3.3). The guess-first pane is noted only, not proposed.
4. **A11's fifth instance** (§3.4).
5. **D6's line on what the map does for the model** (§3.5).
6. **Unpetrify in the division** (§3.6), with the G cluster's heading.
7. **F6's touch line** (§3.7).
8. **The two case-law rows, and the open trial** (§3.8).
9. **The quotations in §1 and §3.1** may go to GitHub.

## 6. The author's rulings (21 Nov)

"All as drafted." Rulings 1–9 of §5 are yes, without amendment, the ninth included: the quotations in
§1 and §3.1 may go to GitHub.

## 7. What was carried (21 Nov)

- **`INVENTORY.md`:**
  - A7 respecified, with its new case law and provenance;
  - A11's fifth instance;
  - B10's second clause scoped;
  - D6's line on what the map does for the model;
  - F6's touch line;
  - the G cluster retitled "The ingest ethic (Ipsissima-MCP and Unpetrify)".
- **`THEORY.md`:**
  - P3's author clause;
  - a fourth point on the division, for Unpetrify;
  - three case-law rows, one of them open (Where to look, a trial awaiting the author's judgement).
- **`README.md`:** the episode listed.
