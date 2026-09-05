# The Second Thoughts episode: the mission's scope, restated

Opened 5 September 2026, at the author's direction, on the branch `values-second-thoughts` —
the framework's first live values-improvement episode since it was built. The prompt is the
author's document "Second thoughts on Ipsissima's values and purpose" (5 Sep, in the private
record), which this file quotes; the quotations were reviewed and approved by the author for
an eventually public branch the same day (ruling 7, §4).

The episode followed the established shape: proposed edits on a branch, the author's rulings
at a checkpoint, nothing merged or implemented on the assistant's judgement. **Status: the
author's rulings received, 5 Sep — recorded in §4, and carried into the files the same day
(the ⟨proposed⟩ markers are off; the diff is the record). The values half of the episode is
closed; the downstream alignment work proceeds wave by wave, each on the author's word.**

---

## 1. What prompted it, and what the examination found

The author, two days after Step Three: the top-level self-descriptions "strongly focus on
questions of scholarly rigour; the assumption is that the basic use case is to create an
argdown of an academic article (or legal judgment) and then use Ipsissima as a study tool" —
and three further use cases (public-communication debate maps, hand authoring, maps of
AI-generated reports) have "not really been thought through or considered."

The examination (its full text is beside the author's document in the private folder) found
the narrowing does not live in any stated principle — B1 already reads "for everyone, not for
the trained." It lives in an unstated premise nearly every surface enacts: **a map is a map
of a text.** So the episode is the removal of a hidden premise, not a change of mission, and
the framework mostly survives. The keystone survives entirely: its own third clause —
*declared where it cannot be checked* — already says what a sourceless map owes.

Three genres of map give the episode its vocabulary:

| genre | the map is | canonical text? | trust carried by |
|---|---|---|---|
| a **reading** | of one text | yes | the fidelity apparatus, in full |
| a **survey** | of a pattern of public argument | no | the reader's own checking, plus the mapper's named identity and good faith |
| an **argument** | the map-maker's own reasoning | the author is the source | nothing yet; the tool's job is authoring support |

A reading whose manuscript is machine-generated is a reading still — with the text's own
provenance declared.

## 2. The proposed edits, in place

| where | what | status |
|---|---|---|
| `INVENTORY.md` B7 | new principle: **trust has more than one carrier** — provenance quotation, origin author (5 Sep) | **admitted as worded** |
| `INVENTORY.md` B1 | revised: the mission in the author's settled words; the addendum records the second widening | **ruled — sentence settled** |
| `THEORY.md` §1 | how the keystone reads per genre — checked / declared / not yet applicable | **admitted** |
| `THEORY.md` §2 P1 | scope condition: the A-cluster governs the reading genre; not a demotion | **admitted** |
| `THEORY.md` §2 P2 | the mission's restated scope; B7 joins the cluster; authoring is mission work | **admitted, with the settled sentence** |
| `THEORY.md` §3 | the App faces the *writer* as well as the reader; the hand-author is P3's reconstructor | **admitted** |

One case-law row was added after adjudication, not before: T1's, the first row in §5's table
whose winner depends on genre.

## 3. The tensions, adjudicated

Named in advance, Step Two's method — each proposed with a candidate resolution, and each
ruled on by the author the same day:

- **T1 — Does "accuracy vs charity — accuracy, always" hold in the survey genre?** There is
  no author to be accurate *to*; the Argdown project's own debate maps are deliberate
  steelmen. Candidate resolution: accuracy binds wherever a source exists; the survey-genre
  analogue is *fairness to the position* — each standpoint's best publicly-circulating case,
  and a declaration that this is what is being done. **Ruled, 5 Sep: adopted.** The case-law
  row is in `THEORY.md` §5 — the first whose winner depends on genre — and B7's weight
  cites it.
- **T2 — Does B3 (tolerant of mess) extend to syntactic mess?** B3 was written about
  argumentative mess (disconnected claims, missing conclusions); a classroom of hand-authors
  produces the other kind. **Ruled, 5 Sep: it does not extend.** In the author's words: "the
  map won't visualise if the syntax is wrong, so we can't be tolerant of it — but we can and
  should provide support to the user so they are less likely to inadvertently write invalid
  syntax, and help them to fix things when they do." Recorded as B3 case law. The editor
  programme's warrant is therefore not tolerance but *prevention and repair* — support
  before the error, help after it.
- **T3 — Is the defensive genealogy a value or an origin?** The trust machinery was built in
  part to disarm the AI-sceptic; the author now calls that "a bit defensive." The C1 doctrine
  disposes of it: origin changes how a value is weighed and interpreted, never whether it
  binds. The machinery stays — ratified by what it does for users, and by the observation
  that what was built to placate the sceptic is precisely what makes classroom and public
  deployment possible (no accounts, no uploads, one file that works offline). Only the
  defensive *framing* retires. **Ruled, 5 Sep: agreed.** Recorded here so the question stays
  answered.

## 4. The rulings, received 5 Sep

1. **B7** — admitted as worded.
2. **B1 and the mission sentence** — the author's settled words: **"Making complex reasoning
   intelligible through maps you can check at every step."** B1 revised in its light; the
   addendum records the second widening.
3. **The keystone's per-genre paragraph** — stands.
4. **The A-cluster scope condition** — stands.
5. **The App-faces-the-writer amendment** — stands.
6. **T1's candidate resolution** — adopted; the row is written.
7. **The quotations from the private record** — approved for an eventually public branch.

With the rulings carried into the files, the values half of the episode is closed. The
downstream work — self-description copy, the survey sample and its licence question, the
checker's greeting, the generated-text label, and the editor programme (opening with the
cross-pane navigation audit) — proceeds in the order the examination proposed, each wave on
the author's word.

## 5. The downstream record

The author gave the word for the whole queue on 5 Sep, and the waves landed the same day:

- **The checker greets the genre** — a sourceless map is asked a question that answers both
  ways instead of being handed a `!` fault and told to invent a manuscript.
- **The self-description** — site and README lead with the mission; "What it is for" tells all
  three genres honestly; the cold-start panel and the File menu offer both skeletons (New
  Reconstruction, New Debate Map).
- **The samples lint** learned the survey genre ahead of the first survey sample.
- **The generated-text label** — front-matter `text-provenance: generated`, shown as a chip
  beside the title; distinct from `reconstruction: generated:`, and the conventions draw the
  line. The checks say the map is faithful to the text, never that the text is true.
- **The navigation audit** (`docs/NAVIGATION.md`) — the two-promises doctrine stated, three
  drifts corrected: the sourceless map's error, the selection that summoned the Manuscript,
  the disabled menu item that said nothing.
- **The editor's quick wins** (the T2 ruling's warrant) — title completion on `[` and `<`,
  safe auto-closing, Enter holding the writer's level.

Still open, and why: the **survey sample** awaits Gregor Betz's answer on the licence of the
Guide's example maps (the letter is drafted for the author to send; the machinery is ready);
**friendlier parse-error wording** is unbuilt; **selection-to-claim** waits for its
measurement, per the method; the **guided build-from-a-text mode** stays at design-note
stage.
