# What Ipsissima holds itself to: the principles, with their provenance

Step One of the values and principles framework — see `README.md` beside this file for the
method, the fidelity marks, and the meaning of the **origin** and **weight** fields. Sources:
every document in this repository, the full commit history (224 commits at extraction), and the
project's private record ("the record" below — the timeline and transcripts, quoted with dates).
Dates are 2026 throughout.

Entries are grouped by subject matter; the ordering from more to less general is `THEORY.md`'s
job, not this file's. Within each entry:

- **It says** — the principle, stated as this framework understands it.
- **Seen in** — a place it is used, so the claim is checkable.
- **Provenance** — fidelity mark, origin, and the words or decisions it rests on.
- **Generality** — where it applies: the whole project, the App, the MCP, or a narrower locus.
- **Weight** — case law where a collision has tested it; *untested* where none has.

---

## A. What a reconstruction is

### A1. A reconstruction is an interpretation, and must be legible as one

**It says.** There is no fabula behind the text and no gold standard for a reading. The text's
order, the reconstructor's DAG, and the author's actual order of reasons are three things, and
the third is precisely what is contested — so the map is another syuzhet, an interpretation to
be marked as one, and one text legitimately supports several reconstructions at once.

**Seen in.** `order-views.md` ("The DAG is another arrangement, not the underlying truth");
the evaluation harness renamed "reference", not "gold"; `ipsissima-conventions.md` §4's reading
policy, which makes a file declare *which* reading it attempts (aim, unit, mode, strength).

**Provenance.** **compression** — origin: author, with the assistant supplying the disanalogy.
The author raised the fabula/syuzhet question (17 Aug, 07:56, preserved complete in the record);
the assistant pressed the three-things disanalogy that same morning; the author supplied the
sceptical half on 20 Aug: "how do we know what the gold standard is in this context? (We'd
previously agreed that argument reconstruction is *interpretation*…)".

**Generality.** The whole project. It is the premise of the fidelity apparatus: only because the
reading is an interpretation does its distance from the words need marking.

**Weight.** Near-constitutive. Case law: the harness rename (20 Aug); the refusal to let
`check_argdown` adjudicate `interpretation`/`imputation` (`viewer.md`: judgements about the
reading, "nothing here may touch them"); `REVIEW.md` §6 declining to call coverage or
interpretive load quality measures.

### A2. Whose words are these: fidelity is graded, drawn, and checked

**It says.** Every claim is marked for how far it stands from its source — quotation ·
paraphrase · compression · interpretation · imputation — the map draws the grade as the border
of the box, and the one level with a fact of the matter is verified rather than believed.

**Seen in.** The `fidelity:` field and its border rendering; `check_argdown.py --derive-fidelity`
overriding declared borders at build time; the brand itself (`brand/README.md`: the mark is a
claim box whose border runs solid to dash-dot).

**Provenance.** **quotation** — origin: author. "How to make it more perspicuous when verbatim
words from the source … appear in the Argdown, and when what's presented is a summary, or an
interpretation … much more important where I want you to make an Argdown version of an article
by someone else" (17 Aug, 07:56). The five-level taxonomy was the assistant's articulation,
approved the same morning ("The five level fidelity taxonomy looks good to me").

**Generality.** The whole project; it is the name, the strapline, and the identity.

**Weight.** The heaviest single principle in the project. Case law: it reshaped the brand (28
Aug); it is why the checker computes `quotation` rather than believing it (38 of 126 hand
markers wrong, always in the same direction); it governed even the project's writing about
itself (see D6). Nothing in the record has beaten it.

### A3. A reconstruction is a scholarly claim, so a reader must be able to check it

**It says.** A map is a claim about someone else's work. Every claim in it says where it came
from — file, quotation, pinpoint — and the map and the manuscript are linked in both
directions, so disagreement can happen at the passage rather than at the picture.

**Seen in.** `ipsissima-conventions.md`'s one idea ("a reconstruction is a claim about someone
else's text, so a reader must be able to check it"); the side-by-side source pane; the rule that
a map that cannot be checked against its source "is the one thing this project exists to
prevent" (`ipsissima-mcp/README.md`).

**Provenance.** **paraphrase** — origin: author (the 17 Aug fidelity question, and the 20 Aug
master-plan review); the side-by-side specification arrived in the 20 Aug plan and was named
"the heart of the app" by adoption.

**Generality.** The whole project.

**Weight.** Very heavy. Case law: `--source-root` made "not optional" for any map of a text on
disk (`viewer.md`, standing preference of 17 Aug); the device-bridge failure written up as the
canonical failure precisely because it produced an uncheckable map.

### A4. Verbatim is not enough

**It says.** A quotation can be exact and still misreport — a hedge left just outside the marks,
a *some* quoted for an *all*, a passage cited for a term it never uses — so checking the
currency is not checking the debasement, and the checker must report what each verbatim span
was cut away *from*.

**Seen in.** The quotation-context checks; `CREDITS.md`'s Stern section ("the largest debt
here"); `about.md`'s "Whose words" tab, which states the limit of the verbatim check in the
About window itself.

**Provenance.** **compression** of Stern's argument, adopted deliberately — origin: assistant
proposal from the author's own citation of Stern (18 Aug, 19:35), ratified throughout.

**Generality.** The whole project (MCP checks; App display; documentation).

**Weight.** Heavy and structural: it is why the checks did not stop where they would have been
easiest to stop. Untested against another principle — nothing has yet argued for weakening it.

### A5. Departures are declared, never silent

**It says.** Every `interpretation` and `imputation` carries a `warrant` saying why the reading
leaves the words. Using one of charity's devices — hyperbole, sloppy-phrasing, secret-sign — is
not forbidden; using one silently is, because the pattern across a file is a decision about the
author that nobody notices making one claim at a time.

**Seen in.** The `warrant:` vocabulary; the checker's "unwarranted departures" fault; draft mode
rule 3 ("mark the holes, and mark them as yours").

**Provenance.** **compression** — origin: assistant, from Stern's three devices, under the
author's steer that assessment and reporting be kept "crystal clear[ly]" apart (18 Aug, 19:35).

**Generality.** The whole project; the reconstruction method's centre.

**Weight.** Heavy. Case law: imputations are *required* to be visible even when unflattering —
Carroll's contention drawn dot-dashed on the website's own showcase sample.

### A6. Accuracy outranks charity

**It says.** Charity governs how an unclear text is read; it never licenses attributing a claim
the text does not make. The Assertibility Question generates candidates *to check against the
text*, and a candidate the text does not support is dropped, not attributed. Hedges and scope
survive: *most* is not *all*. A tidier argument than the page's is not a better reconstruction
of it.

**Seen in.** `reconstruction-cheatsheet.md` §2 ("the operative rule"); "What makes a
reconstruction bad" ("the argument is tidier than the paper's | charity over accuracy").

**Provenance.** **compression** of Fisher, Govier and Stern, adopted as the house method —
origin: assistant assembly, author-directed (the 18 Aug charity brief; the 27 Aug instruction to
build the method sheet from the author's own shelf).

**Generality.** The reconstruction method (MCP-served, model-executed); it also constrains the
App (borders may not flatter).

**Weight.** Heavy. Case law: multiple contentions recorded rather than a single imputed thesis
(20 Aug: "better to record multiple main claims, rather than imputing a single main claim");
suppositions never recorded as assertions; punctuation tolerance widened but *rewording* never
("Punctuation is not rewording", 27 Aug).

### A7. The tool reports the argument; it does not grade the author

**It says.** Ipsissima measures how a text arranges its reasons and does not score the
arrangement. Neither anticipated nor prepared support is a fault; a text is compared against
its own practice, not an absolute convention; and the tool does not editorialise — what is
assessment and what is report must never blur.

**Seen in.** `order-views.md` ("Neither direction is a fault, and the view must not imply one
is"); reach, not direction, carrying the visual emphasis; the Pryor/Williams pair as the
standing example that a careful writer can refuse the announce-then-argue convention.

**Provenance.** **paraphrase** — origin: author. The Williams reading (17 Aug, 19:52), the
Pryor clarification (30 Aug), and the editorialising worry: "make crystal clear what is
assessment of the quality of the argument, and what is merely reporting what the argument is"
(18 Aug, 19:35).

**Generality.** The whole project, most visible in the App's exposition views.

**Weight.** Heavy. Case law: colour was refused for the anticipated/prepared distinction because
colour reads as verdict; the debt sparkline's ink chosen "one neutral" for the same reason.

**Amended at Step Three (3 Sep), from `TENSIONS.md` T4 — and re-amended the same day, on the
author's challenge.** The first draft of this amendment permitted displays of "the reader's
burden", and the author showed that formulation is loaded in its own right: the standing case
*for* the announce-then-argue convention is precisely that it reduces what a reader carries, so
"burden" quietly grades the other direction, as "debt" graded the first. Both conventions ask
something of a reader, of different kinds, and no single-direction welfare word is neutral
between them. What the tool may measure and display is therefore stated without welfare
vocabulary at all: **where a claim's reasons fall in the text relative to the claim, and how
far away** — temporal and positional facts, carried in the project's own neutral pair
(*anticipated* / *prepared*) — with the verdict channels (the colours that mean support and
attack, the fault marks) never borrowed. Reader-facing surfaces were reworded accordingly;
"justificatory debt" survives as an internal term of art in the code and the documents of
record — settled, not merely open: the author ruled the same day that the internal
documentation keeps it. The boundary is the reader: the metaphor may organise the code and the
records, and what a reader is shown stays temporal and neutral.

### A8. Exegetical adequacy is this project's half of the bargain

**It says.** A reconstruction can be systematically correct (valid, non-circular) and can be
exegetically adequate (accountable to its text), the two pull apart, and Ipsissima checks the
second. Systematic correctness is checked only where the file *claims* it — a named rule of
inference invites the validity check; a bare inference line claims nothing and is never
checked, because most philosophical argument is conductive and grading it as failed deduction
would misreport it.

**Seen in.** `ipsissima-conventions.md` §4 (Betz and Brun named); `VALIDITY-PLAN.md` §4.2 ("the
rule name is the trigger … the reason the feature is safe"); the argdown-feedback comparison
("Your verifier grades systematic correctness; mine grades exegetical adequacy … Neither of us
has both halves", 30 Aug).

**Provenance.** **compression** — origin: practice first, vocabulary found later. The division
of labour was built from Stern and use; Betz and Brun's naming of it was discovered on 30 Aug
and credited the same day ("Betz and Brun named the distinction before this program drew it").

**Generality.** The whole project — it fixes the boundary of what the checks may claim.

**Weight.** Heavy. Case law: a corpus-wide validity check was declined (VALIDITY-PLAN §4.2)
even though it was cheap, because it would grade good conductive reconstructions as failures.

### A9. Where the notation cannot carry a distinction, the note carries it — and no syntax is invented

**It says.** Argdown's `<+` does several jobs (evidence, institutional authority,
precondition), and this project does not add private relations: a dialect would stop the file
being Argdown, would parse nowhere else, and would break the promise that Ipsissima displays
the language rather than a variant of it. The remedy is to use what the language has (tags,
premises, structure) and to say the rest in the claim's `note:` — "a limitation the reader is
told about is a limitation, while one they must infer from a flat arrow is a misreading waiting
to happen."

**Seen in.** `ipsissima-conventions.md` §5 (`#authority`, and "this project does not invent
syntax"); `extraction-prompt.md` ("where the language runs out, say so rather than inventing").

**Provenance.** **compression** — origin: assistant, forced by Miller (30 Aug), consistent with
the author's compatibility requirement from the start (the official parser as ground truth).

**Generality.** The whole project; a hard boundary.

**Weight.** Near-absolute. Case law: Miller's three-jobs problem was resolved *within* the
language at real expressive cost, rather than by extending it.

### A10. Tags say whose claim it is; the map computes the rest

**It says.** A tag records what the structure cannot compute — whose claim this is
(`#reported`, `#conceded`, `#contested`, `#authority`, `#obiter`) — and never what it can:
importance, centrality and depth are computed (the spine control), because a hand-applied
estimate means something different in every file and nothing can check it.

**Seen in.** The retirement of `#core` (27% of one map, 65% of another — "the chip meant
something different in every file") and of `#background`; `ipsissima-conventions.md` §5's
three-part test for a new tag.

**Provenance.** **compression** — origin: assistant, author-ratified in the commit "Tags say
whose claim it is; the map works out what holds it up" (27 Aug).

**Generality.** Conventions and App display.

**Weight.** Medium-heavy; the division of labour it draws (human judgement records; mechanism
computes) recurs project-wide (see E7). Case law: `#core` retired against the convenience of
keeping it.

### A11. What the reconstruction claims about itself is checked; what it claims about the author is only reported

**It says.** Wherever the reconstruction asserts something about its own workings that has a
fact of the matter — *this claim is a verbatim quotation*; *this step is deductively valid on
these formalizations*; *these formulas were read against these words* — the assertion is
checked rather than believed. What the reconstruction says about the author — the reading
itself — is never graded, only reported (A1, A7). The verdict on a self-claim is never a
verdict on the author, and the display must keep that difference legible.

**Seen in.** Quotation verification (the principle's first instance); fidelity derivation at
build time (second); the validity check, triggered only by a named rule (third); the
`formalized:` stamp (fourth). The version-agreement test and the build-derived About lists are
the same principle applied to the *software's* claims about itself (D6).

**Provenance.** **interpretation**, ratified — origin: assistant. Surfaced at Step Two
(`TENSIONS.md` §4) as the unstated principle that explicates the validity checker; approved by
the author at the checkpoint of 3 Sep ("I like principle A11. It seems right — do add it").
The warrant was `coherence`; ratification has discharged it.

**Generality.** The whole project. It states the ground A8 gestured at, and explains why the
checker's evaluative marks do not breach A7.

**Weight.** Heavy — it inherits the case law of its four instances, including A2's precedent
that instruction alone does not keep self-claims honest (38 of 126, "always in the same
direction"). Its display corollary — a self-claim drawn in the checked style must actually
have been checked — is what generates the rule-name items in `ALIGNMENT-PLAN.md`.

---

## B. The mission, and who it is for

### B1. Ipsissima is for everyone, not for the trained

**It says.** The mission, in the author's settled words (5 Sep): **"Making complex reasoning
intelligible through maps you can check at every step."** Not philosophical argumentation
only, and not the academy only — wherever someone wants to assess reasons for and against a
conclusion. Its users include checkers, teachers, students studying hard texts, and academics;
the people it most exists to help are those *not* used to long arguments with numbered
premises — and design decisions are tested against the novice before the adept.

**Seen in.** The staircase decision ("Sketch B … is *much* easier to follow for those who are
not used to long arguments with numbered premisses; and these are the very people Ipsissima
exists to help!", 1 Sep); comments addable with "absolutely no skill in or understanding of
Argdown" (21 Aug); "It will seem a bit too much like reading The Matrix to the novice user!"
(22 Aug); the four-users brief (21 Aug, 08:50).

**Provenance.** **quotation** — origin: author, twice over: the earlier form in the record
(27 Aug, "aims to open up philosophical argumentation to everyone"), restated in the settled
words above at the Second Thoughts checkpoint (5 Sep); and repeated author rulings. The
audience widened explicitly on 20 Aug, 08:43: "We are moving from a tool that will be used
only by me … to one that will be used by hundreds or even thousands of people" — and a second
time on 5 Sep (addendum below).

**Generality.** The whole project.

**Weight.** Heavy. Case law: Sketch B chosen over the more compact expert layout (the expert
form kept as an option, not the default); the walkthrough; `top-level` documented as a trap
rather than assumed understood.

*Addendum (5 Sep, ruled at the Second Thoughts checkpoint).* The audience widened a second
time: "I created a tool that initially seemed to be for use only in an academic environment,
but I think it can be useful wherever someone wants to assess reasons for and against a
conclusion" (5 Sep, the private record). The mission was restated the same day in the
author's settled words, above — the draft form in "Second thoughts" was his to settle (D7),
and was settled at the checkpoint. B7 says how trust is carried where no text anchors it.

### B2. The reader explores at their own pace

**It says.** The map's job is to let someone see the main points at a glance or descend into
detail where they choose, without being overwhelmed — "at their own pace … rather than the
author's order of exposition". Folding, stepwise revelation, the how-much ladder and the
staircase all serve this one requirement.

**Seen in.** The founding "holy grail" message (15 Aug, 15:59); stepwise expansion ("a section
of forty claims never lands on you at once", `help.md`); the 21 Aug brief ("What the tool
excels at is allowing someone to explore an argument *at their own pace*").

**Provenance.** **quotation** — origin: author (15 Aug: "My holy grail for this would be a way
of visualising the argument that is foldable — so you can see the main points at a glance, or
zoom in with more detail where you want — all without becoming overwhelmed by complexity").

**Generality.** The App, with the MCP's conventions (front-matter defaults, groups) feeding it.

**Weight.** Constitutive for the App — folding is the feature the project was founded on, and
the fold-correctness campaign (FOLDING.md) is costed to it. Untested against other apex
principles; it has only ever been on the winning side.

### B3. The tool must be tolerant of mess

**It says.** Work in progress is the condition the tool exists to help with, not a degenerate
input. A draft's disconnected claims, missing conclusions and multiple apexes are "the shape of
the problem, not evidence of carelessness"; the tool that only works on a tidy argument is no
use to the person trying to tidy one. Unfinishedness is reported as observation, not fault, and
holes are marked as the reconstructor's own so they become a list of what is left to write.

**Seen in.** Draft mode (`extraction-prompt.md`, "If the text is a draft"); `order-views.md`
("Be tolerant of mess"); the Parts reflection (20 Aug: "the tool … should be tolerant of, and
help the user, even in cases where what it's been given is in parts a mess!").

**Provenance.** **quotation** — origin: author (20 Aug), with the draft-mode machinery the
assistant's articulation of it.

**Generality.** The whole project; sharpest in the MCP's checker and the exposition views.

**Weight.** Medium-heavy. Case law: `inert` demoted from alarm to observation for drafts;
"more than one apex is a result, not a failure." Bounded on 5 Sep (Second Thoughts T2): B3
does not extend to syntactic mess — "the map won't visualise if the syntax is wrong, so we
can't be tolerant of it" — what is owed there is editor support, so the user is less likely
to write invalid syntax inadvertently, and help fixing it when they do; never checker
leniency.

### B4. Cost is a mission constraint, and the tool asks before it spends

**It says.** "It is a hindrance to its mission if it's too expensive to create a new Argdown
map." Cost is therefore measured, modelled, published, and driven down — but never by trading
a worse reading for a shorter run. And because a reconstruction is the expensive step, the tool
reports what is ambiguous rather than guessing, and refuses to convert several sources until
the question is answered: "the server declining to spend your money on a coin toss."

**Seen in.** The cost model in `ipsissima-mcp/README.md` (measured over nine runs); the
round-trip rules ("Do not trade a worse reading for a shorter run — that is the one saving this
document does not want"); `plan_job`'s questions; the 18 Aug alarm ("This level of token
expenditure and time is unsustainable").

**Provenance.** **quotation** (27 Aug mission sentence; 18 Aug alarm) — origin: author.

**Generality.** Chiefly the MCP; the App's build economics inherit it.

**Weight.** Heavy but bounded by quality: case law is the effort-testing verdict — `max` for
anything published, because more of `high`'s correctness came from the check than from the
writing; the 16% saving was declined for shipped samples.

### B5. Meet users in their own words

**It says.** The natural-language contract: "make an Ipsissima diagram", "map the argument",
"make an Argdown" are one request. The interface vocabulary is the reader's own — *Reasons* and
*Exposition*, titles in prose, rule names abbreviated the way a logic text abbreviates them —
and help is organised by what the reader is doing, not by which control does it.

**Seen in.** The MCP server instructions; `REVIEW.md` §3 ("The vocabulary is the reader's");
`help.md`'s header comment (groups divide "by WHAT THE READER IS DOING"); update instructions
"labelled by what the reader did, not by its name" (`RELEASING.md`).

**Provenance.** **paraphrase** — origin: author (the 23 Aug release brief's natural-language
contract), extended by practice.

**Generality.** The whole project's surfaces.

**Weight.** Medium. Case law: the Cowork field test (31 Aug) treated a discoverability failure
as a real failure and fixed it in documentation idiom rather than blaming the client.

### B6. The author's values are not automatically Ipsissima's

**It says.** Ipsissima's values are fixed by what is best for its users, not by the author's
private preferences. Being the author does not make every personal value a project value: a
candidate principle earns its place by serving the user, and a personal preference stronger
than the user's interest warrants is recorded as a preference, not legislated. This is a
second-order principle — it governs how the framework itself admits and weighs values, the
author-origin counterpart of the scrutiny the **origin** field already applies to
assistant-introduced ones (C1's genealogy).

**Seen in.** Its first application, the same day it was stated: the F4 respecification, where
the author's own very-heavy intolerance of visual clutter was re-scoped into the user-centred
requirement that clutter be *avoidable* — "some others are more tolerant of visual clutter
than I am."

**Provenance.** **quotation** — origin: author (3 Sep, at the Step Two checkpoint: "While I am
the author of Ipsissima, it doesn't follow that all my personal values are Ipsissima's values
— it depends on what is best for the user").

**Generality.** Second-order: the framework and every future values decision.

**Weight.** Heavy and structural, though tested only once — its first application re-scoped an
apex principle on the day it was stated, which is a strong opening precedent.

### B7. Trust has more than one carrier

**It says.** Automated fidelity checking is the apt trust mechanism only where a canonical text
exists. Where none does — a map of a pattern of public argument rather than of one text —
trustworthiness is carried by other things: the map's own checkability by the reader (every
step of the argument on screen, each standpoint's case laid out to be examined), and the
mapper's identity, expertise and good faith, displayed rather than certified. A map without
sources is a genre, not a defect, and no part of the tool may treat it as a reconstruction
with missing provenance.

**Seen in.** The viewer's tab policy (3 Sep): a map citing no text keeps the Manuscript tab
hidden — "there is nothing to obtain, and a control that can never work is clutter, not
teaching". The export gate fixed on Betz's censorship map (4 Sep) — a survey-genre map the
tool was made to serve properly. Not yet seen in any user-facing description, which is the
tension the Second Thoughts episode exists to resolve.

**Provenance.** **quotation** — origin: author (5 Sep, "Second thoughts on Ipsissima's values
and purpose", in the private record): "much of the burden of trustworthiness can and should be
carried by the expertise, credentials, and good faith of the reconstructor", with the
science-journalism analogy — a fellow scientist can check the report; the average reader
trusts the institutional facts about the newspaper.

**Generality.** The whole project; sharpest in the App's handling of sourceless maps and in
every self-description.

**Weight.** One case, ruled the day the principle was admitted (5 Sep, Second Thoughts T1):
in the survey genre "accuracy vs charity" gives way to **fairness to the position** — each
standpoint's best publicly-circulating case, declared as such — while accuracy still binds
wherever a source exists. The first case-law row whose winner depends on genre (`THEORY.md`
§5).

---

## C. Trust: the reader's machine, and the author's files

### C1. Nothing leaves the machine — stated precisely, per artifact

**It says.** `Ipsissima.html` makes no network request of any kind, ever; the desktop
application makes exactly one, on explicit request (Help ▸ Check for Updates); the MCP sends a
DOI to ask about open licences and *nothing else* — "a decision rather than an omission",
because sending someone's library to a third-party converter is a licensing and privacy
decision a tool should not make on their behalf.

**Seen in.** `README.md`'s flattest promise; `SECURITY.md`; the converter bake-off rejections
(`CONVERTER-FINDINGS.md`); the commit "Two applications, two update checks, and one claim that
had to become precise" (29 Aug).

**Provenance.** **compression**, with the record's own provenance study attached — origin:
**assistant-introduced** (15 Aug, as the justification for the browser-based workaround),
hardened by the author's portability requirements, canonised as the compensating trust story
for unsigned builds (22 Aug), ratified by the author at every step, and made precise under his
own counter-pressure (29 Aug: "we'd need to soften claim that Ips never access the internet").

**Generality.** The whole project, with per-artifact force: absolute for the one-file page;
one-request for the desktop app; DOI-only for the MCP.

**Weight.** Very heavy, and instructively not absolute: when it collided with keeping users
informed of fixes, it was *split into two precise claims* rather than either retreating or
blocking the feature. The provenance matters for interpretation: the principle serves trust and
user sovereignty; it is not asceticism about networks.

### C2. One self-contained file, and nothing between the source and the reader

**It says.** Ipsissima builds to a single HTML file that opens by double-clicking, works from
`file://`, and can be emailed. Anything that would put a bundler, a CDN, a server, or a
multi-megabyte runtime between the source and what people double-click is a bigger change than
it looks — "a constraint, not an accident."

**Seen in.** `CONTRIBUTING.md` (house conventions); `VALIDITY-PLAN.md` (Z3's 33 MB WASM and its
COOP/COEP headers ruled out by `file://`); `tsconfig.json` (the typechecker does not emit);
`REVIEW.md` §1 (the 3,800-line single-file renderer defended for readers over contributors).

**Provenance.** **compression** — origin: author's requirements (emailable, double-clickable,
usable by non-technical students), articulated as doctrine by the project.

**Generality.** The App.

**Weight.** Among the heaviest in the App. Case law: beat shipping any solver (Z3, 31 Aug);
beat TypeScript conversion (checkJs adopted instead); beat the "…with the editor" export
(withdrawn — every copy would be "a fork of the program frozen at the moment it was sent");
holds the renderer in one file against ordinary code-organisation virtue.

### C3. Nothing happens behind the reader's back

**It says.** No startup checks, no timers, no background contact, no self-replacement: "an
application that contacts a server every time it opens is a different kind of thing to keep on
a machine holding unpublished work," and one that can rewrite its own binary "is a different
kind of thing to trust." Zotero is read from a copy, never the live database, and nothing is
written into its storage. Positions are recomputed from live files rather than stored.

**Seen in.** `RELEASING.md` (the three decisions on the update check); `SECURITY.md` (Zotero
read-only); `order-views.md` ("Nothing is written back"); the MCP's `check_for_updates`
deliberately not folded into `plan_job`.

**Provenance.** **compression** — origin: assistant articulation, author-ratified; continuous
with C1's history.

**Generality.** The whole project.

**Weight.** Heavy. Case law: the update check shipped as a menu item with the cost stated ("you
have to remember to look") — convenience lost to sovereignty, deliberately.

### C4. The user's files are the user's

**It says.** Ipsissima never modifies the manuscript — a reconstruction is a reading *of* a
text, and the tool writes only the `.argdown`. A hand-curated reconstruction is someone's work
and is never written to without being asked (`generated: true` is precisely the declaration
that nobody's judgement is invested yet). Uninstalling removes the program and "no uninstaller
should be going looking for" the user's own files.

**Seen in.** `INSTALL.md` ("It never modifies your manuscript"); the `--no-fix` default in the
extraction prompt and reconstructor agent; `viewer.md` ("Nothing is written back to the
`.argdown`. It is the reconstructor's file").

**Provenance.** **compression** — origin: practice, ratified in documentation; no single
founding statement.

**Generality.** The whole project.

**Weight.** Heavy. Case law: fidelity derivation overrides the *picture* but refuses to write
the file even when it knows the file is wrong — the tool "knows a claim is *not* a quotation
but not which weaker level applies, so writing one in would impose a judgement it cannot
justify."

### C5. Honesty over the appearance of trustworthiness

**It says.** Unsigned builds are explained, not disguised: "until those [certificates] exist,
the honest thing is to say so rather than to look trustworthy." The install page shows every
dialog before the reader meets it, "so that the warning is something you were told about
rather than something that happened to you." The threat model is stated plainly, including
what it is *not*.

**Seen in.** `SECURITY.md`; `INSTALL.md`; the settled stance of 22 Aug ("prepare users honestly
rather than pay for certificates not yet fundable").

**Provenance.** **paraphrase** — origin: author decision (22 Aug), articulated by the project.

**Generality.** The whole project's outward face.

**Weight.** Heavy; see D6 for the general form. Untested against a live conflict other than
cost, which it beat.

### C6. No lock-in, at any layer

**It says.** A file that parses here parses everywhere Argdown does; "a reconstruction written
here is not locked to this program." The server is plain MCP over stdio — "It is not
Claude-only." The method lives in documents served off disk "where anyone can read and change
them" — "improving a reconstruction should mean editing a document, not shipping a release."

**Seen in.** `about.md`; `README.md`; the commit "Whether this is Claude-only was asked, and
nothing here answered it" (28 Aug); `extraction-prompt.md`'s header.

**Provenance.** **compression** — origin: mixed; the Claude-only question was the author's to
raise and the answer was already latent in the architecture.

**Generality.** The whole project.

**Weight.** Heavy. Case law: A9 (no dialect) is partly this principle's enforcement arm; the
`.mcpb` documented as "a convenience, not a capability."

---

## D. The project's own scholarly manners

### D1. Credit where it is owed — and stated precisely

**It says.** Debts are named, in proportion, with their evidence: Argdown's creator and
maintainers by name; the method's authors (Fisher, Govier, Walton) with what each supplied;
Stern as "the largest debt here"; dagre "thanked and retired" with the debt kept after the code
went. And precision cuts both ways: an independent arrival is *not* a debt and "saying it were
would be false" — Betz and Brun are credited for priority, exactly, the day the work was found.

**Seen in.** `CREDITS.md` throughout; `about.md`'s Argdown tab ("Argdown's credit is not the
place to economise"); the courtesy letters to sample authors (30 Aug).

**Provenance.** **compression** — origin: author-directed ("It will be particularly important
to give adequate credit to Argdown", 22 Aug).

**Generality.** The whole project.

**Weight.** Heavy. Case law: Stern found load-bearing and uncited before release — treated as a
release blocker class of fault, fixed (23 Aug); the DeepA2 discovery rewrote the credits within
hours.

### D2. The licence boundary is deliberate, and follows the mission

**It says.** The app is MIT *so that* its layout work can flow back to the MIT projects it is
built on, Argdown first; the Python keeps the licence its dependencies require, because "a
permissive licence there would promise what that dependency does not allow." Notices travel
inside the file that is the distribution, because the single HTML file *is* the distribution.

**Seen in.** `LICENCE-AUDIT.md` (the whole document, with its [verified]/[judgement]
convention); the commits of 2 Sep; `README.md`'s licence section.

**Provenance.** **quotation** for the aim ("to allow reuse of this code by the Argdown
project", 2 Sep) — origin: author decision on an assistant-prepared audit.

**Generality.** The whole project.

**Weight.** Heavy. Case law: option C (remove PyMuPDF to unify at MIT) rejected because "
relicensing would be undoing a decision that was made on measurement"; uniformity lost to the
mission-shaped boundary.

### D3. Redistribute only what you may

**It says.** A sample folder carries a whole converted article, which is beyond scholarly
quotation, so only public-domain, openly-licensed, or the project's own texts are published —
"however useful it would be as an example." Attribution travels in the source file itself, not
only the README, because a reconstruction can be sent as a single file and "a README left
behind on disk is not attribution."

**Seen in.** `samples/README.md` (the directory's only rule); `CONTRIBUTING.md`; the
copyright triage of 23 Aug; the private corpus held outside the repository (`CORPUS.md`).

**Provenance.** **compression** — origin: author-directed triage, articulated as policy.

**Generality.** Samples, fixtures, and the corpus.

**Weight.** Absolute so far: in-copyright texts left the repo on 23 Aug regardless of their
value as tests; the structural gap it creates (no old-scan sample can be published) is
*stated* rather than worked around (REVIEW.md §4).

### D4. The record keeps its own provenance

**It says.** Decisions that were expensive to reach are written down with what was tried first
and how it failed; corrections are left standing rather than edited away ("a zero in a results
table is exactly the kind of number that later gets quoted as a finding"); retired code goes to
an attic "kept because it explains why the current thing looks the way it does"; the project's
history is itself compiled, dated and quoted. Comments say why, not what, because "the note is
the only record" of a silent failure.

**Seen in.** `docs/NOTES.md`; `CONVERTER-FINDINGS.md`'s correction header; the effort-testing
README's struck headline ("This section's headline did not survive"); `docs/attic/`;
`CONTRIBUTING.md`'s house conventions; the commit-subject genre itself.

**Provenance.** **interpretation**, warrant: `coherence` — origin: practice. No single
statement establishes it, but it is enacted so consistently, and at such cost, that reading it
off the record is safe. (This framework is itself an instance of it.)

**Generality.** The whole project.

**Weight.** Heavy, and — see THEORY §2 — the clearest evidence that the project applies its
fidelity ethic to itself.

### D5. Name your own gaps

**It says.** An audit that does not name its own gaps is worse than none. The unsolved problem
(measuring reconstruction quality) is stated under its own honest heading; checks are
"necessary conditions a bad reconstruction can fail," never proof; green does not mean
everything passes, and the README says so; a known failure is left failing "rather than
quietly weakened."

**Seen in.** `LICENCE-AUDIT.md`'s "What this document did not check"; `README.md`'s Status
section; `CONTRIBUTING.md` ("One suite is expected to fail"); the 23 Aug release brief's
heading "an unsolved challenge"; `REVIEW.md` §6.

**Provenance.** **quotation** for the founding instance — origin: author (23 Aug: "we've come
at the instructions … through intuition and iteration rather than as a result of systematic
theory or testing"), generalised by practice.

**Generality.** The whole project.

**Weight.** Heavy. Case law: KNOWN-ISSUES entries "record how honestly rather than
triumphantly"; the issue tracker solicits maps that *passed every check and were still wrong*
as "the most useful thing in this tracker."

### D6. The project describes itself under its own fidelity rules

**It says.** What is true of a claim in a map is true of the project's claims about itself: the
About window's dependency list "cannot claim what it does not carry" (read from the build, not
written by hand); the name's history is told without privileging one tradition ("The Gospels
are one chapter of the name's history, not its frame"); a release note that tried to be arch
was corrected; and the blog about the project was reverted to the author's own words, because
"It seems rather off to be writing a blog extolling an app that's about fidelity to an author's
precise words, and then use AI to do so!"

**Seen in.** `about.md`'s runtime-filled lists; the branding session (28 Aug); the blog
reversal (30 Aug); release-notes standards (29 Aug).

**Provenance.** **compression** — origin: author rulings on assistant drafts, repeatedly.

**Generality.** The whole project's self-presentation.

**Weight.** Heavy. Case law: marketing lost to accuracy every time they met (Gospels; "arch"
note; "All MIT licensed" corrected in the licence audit).

### D7. Interrogative, not generative

**It says.** In the making of Ipsissima, the assistant asks, objects, connects, and builds; the
framings — and, where the work will carry the author's name, the words — remain the author's. A
language model that writes the exploratory prose supplies the framings the author then
"discovers", which is precisely the danger the project began by naming; and a project about
fidelity to an author's words cannot have its own words ghost-written.

**Seen in.** The founding objection and its diagnosis (15 Aug); the blog reversal (30 Aug: "It
seems rather off to be writing a blog extolling an app that's about fidelity to an author's
precise words, and then use AI to do so!" — the draft reverted to serve as background for a
post the author will write himself); the record's own summary ("the machine assembles the
record; the very words will be the author's").

**Provenance.** **compression** — origin: assistant-proposed (15 Aug, its own role in discovery
named "interrogative rather than generative"), author-ratified from then on and enforced by him
at the blog.

**Generality.** The whole project — it governs how the project is made and spoken for, not what
the software does; and it is the collaboration-side twin of A1's product-side humility.

**Weight.** Heavy. Case law: the blog reversal, where a finished, compressed draft was set
aside for the value; repo documents of record (reviews, plans, this framework) are assembled by
the machine and say so, while everything under the author's name is his.

---

## E. Method: how the project is built

### E1. Measure before design

**It says.** Numbers are collected before decisions are made, and claims are marked by their
epistemic standing — [measured] on this machine with the command named, [reported] from
someone's documentation, [judgement] "and is where to argue." Bake-offs are run against
labelled sets; instructions are A/B tested; costs are modelled from transcripts, with the
model's own falsifiers stated.

**Seen in.** `QA-PLAN.md`, `VALIDITY-PLAN.md`, `LICENCE-AUDIT.md` (the convention stated at the
top of each); `CONVERTER-FINDINGS.md`; the effort-testing variance control; "measure and report
before implementing" (author's working-register signature, 1 Sep).

**Provenance.** **paraphrase** — origin: author's standing instruction, enacted by the
assistant throughout.

**Generality.** The whole project's method.

**Weight.** Very heavy. Case law: ELK stayed on the table until measurement removed it ("don't
consider ELK to be off the table", then "Proceed with owning the ranker", 29 Aug); the
`DEPARTURE_BOW_ALLOWANCE` settled by a table; STABILITY-PLAN's rule that "the table decides,
not the principle."

### E2. Validate, never assume; the parser is ground truth

**It says.** Nothing is declared finished unchecked: "never declare an .argdown file finished
without running the CLI over it." The bundled official parser is the single arbiter of
validity, unmodified, "so a file that parses here parses everywhere Argdown does" — and the one
time a subset parser was tried, it silently dropped structures and drew wrong maps. Nor may the
model's knowledge be assumed: "there are so few code samples of argdown online, that we CANNOT
assume any background knowledge" (27 Aug) — hence cheat sheets, mined and tested, instead of
confidence.

**Seen in.** `docs/NOTES.md` (the Argdown section); `CREDITS.md` (the subset-parser lesson);
the 27 Aug "catastrophic assumption" correction and the two cheat sheets.

**Provenance.** **quotation** — origin: author (16 Aug: "I need Claude to be able to produce
accurate Argdown … would it be better to create … a Claude skill … or … software?"; 27 Aug as
above).

**Generality.** The whole project.

**Weight.** Very heavy; with A9 it forms the hard compatibility boundary. Exception carved
deliberately and narrowly: the validity checker is first-party because "a decision procedure is
a theorem" — provable, where a notation can only be discovered empirically — and even that is
differentially tested against Z3 in CI.

### E3. A tool that mishandles something quietly is worse than one that says what it did

**It says.** Silence is the failure mode the project takes most seriously, because there is
nothing for a reader to notice. Converters report every route tried and every line dropped; a
checker that cannot decide says so rather than guessing; parse errors say where and why; "a
spill is not an error; it is the tool saying where it put the output."

**Seen in.** `CONTRIBUTING.md` (house conventions, stated as the rule the ingest side is built
on); the metadata-comma defect ("precisely the kind of thing that is likely to confuse (or
enrage) a user", 21 Aug) answered with line-by-line reporting; the missing-OCR lesson (345
words, "no error, a perfectly well-formed Markdown file"); the field-test note ("an invalid
`fidelity:` value was silently ignored … I burned three probe rounds on it", 31 Aug).

**Provenance.** **paraphrase** — origin: learned at Deep Drafter (per `CREDITS.md`), adopted
and radicalised here; countless author ratifications.

**Generality.** The whole project.

**Weight.** Among the heaviest method principles; it repeatedly *generates* work (guards,
reports, loud failures) and has never lost a collision.

### E4. Nothing stale, nothing hidden

**It says.** What is derived is rebuilt or checked for staleness; what is stated twice is
tested for agreement (six version files; two-language rules pinned by cross-checks); what is
read but never written is deleted (the dead-field lint); "an expectation that has quietly
become untrue is the same species of bug."

**Seen in.** `rebuild_viewers.mjs --check`; `test_versions.mjs`; `test_argdown_positions.mjs`
("duplicate and pin it with a cross-check"); `QA-PLAN.md` §9.

**Provenance.** **compression** — origin: practice, from repeated silent-staleness failures.

**Generality.** The whole project.

**Weight.** Medium-heavy; the enforcement arm of E3 over time.

### E5. Definitions before repairs

**It says.** Behaviour is derived from a stated model, never from a proxy near the truth.
Fold whack-a-mole ended when one sentence was written — "folding a claim hides everything
reachable only through it" — and the badge became derivable rather than guessable ("a fold
control is drawn when visible(state) differs from visible(state + this fold)"). A design gap
("nowhere … is it written down what folding is supposed to do") is a cause of defects in its
own right.

**Seen in.** `FOLDING.md`; `viewer.md`'s opening; the commit "Folding is what is reachable only
through it" (28 Aug).

**Provenance.** **compression** — origin: assistant diagnosis under the author's pressure ("Why
are you continually being surprised by problems in the visualisation…", 27 Aug, 19:09).

**Generality.** The App's logic; generalises to any subsystem.

**Weight.** Heavy within its locus; produced the project's most decisive methodological win.

### E6. An instrument must be shown to fail, and a measurement is code

**It says.** "A harness that has never failed is worth nothing": every invariant and every
metric is mutation-tested — break the thing it watches, watch it complain — because
measurements lie in exactly the ways code does (a flag that did nothing, a filtered
denominator, a vacuous lookup). Verify UI on screen with the real gesture, because "synthetic
events lie." And numbers are necessary, not sufficient: render the picture and disbelieve the
number.

**Seen in.** `viewer.md` ("Four ways a measurement lied here"); `QA-PLAN.md` §7 (merge rule)
and the `--selftest` machinery; the standing instruction of 1 Sep ("That principle about also
verifying UI work onscreen is an important one please remember it!").

**Provenance.** **paraphrase** — origin: assistant practice, with the on-screen half the
author's explicit standing instruction.

**Generality.** The whole project's testing.

**Weight.** Heavy; QA-PLAN makes it a precondition of merging an instrument.

### E7. One job per thing; compute what can be computed

**It says.** Documents get one job each ("Four documents with one job each, instead of two that
overlapped"); the corpus is split by role so two of three sets can grow cheaply; the checker is
read-only and the builder builds; and wherever there is a fact of the matter, the mechanism
computes it rather than trusting a hand-written record (fidelity derived; spine computed;
versions read from the build) — while wherever there is not, the mechanism keeps its hands off
(A1, C4).

**Seen in.** The 27 Aug documentation reorganisation; `CORPUS.md`; `viewer.md`'s constraints on
fidelity derivation; `about.md` ("this list cannot claim what it does not carry").

**Provenance.** **compression** — origin: practice, author-ratified in commits.

**Generality.** The whole project.

**Weight.** Medium-heavy; the boundary it draws with judgement (compute facts, never
judgements) is load-bearing everywhere.

### E8. Dependencies: the standard tool, well maintained, rightly licensed, small — and zero in the page

**It says.** Third-party code is taken where it is the standard and alive (CodeMirror, docx,
markdown-it, the official parser), measured before adoption, and removed on evidence (marker,
docling, llama.cpp; dagre when its job shrank to one pass and its maintenance died). A file in
this repository beats a package abandoned in 2015; and nothing heavyweight ships in the
single file (C2).

**Seen in.** The author's standing desiderata quoted in the record (31 Aug: "right licence,
well maintained, the standard tool, small"); `VALIDITY-PLAN.md` §2–3; `CONVERTER-FINDINGS.md`;
`CREDITS.md` (dagre).

**Provenance.** **quotation** for the desiderata — origin: author; the individual verdicts
assistant-measured, author-accepted.

**Generality.** The whole project.

**Weight.** Medium — always adjudicated case by case, by measurement (E1), never by doctrine.

### E9. Exhaust small spaces, shrink real failures, hold the ground

**It says.** Whack-a-mole ends when the space is small enough to enumerate, not by finding more
moles in the big map. The walk finds that something is wrong; delta-debugging says what;
enumeration holds the ground afterwards, "because a shape once minimised is a shape the
generator can be taught."

**Seen in.** `FOLDING.md` (the three instruments and their division of labour);
`test_fold_exhaustive.mjs`; `KNOWN-ISSUES.md`'s summary of the same.

**Provenance.** **compression** — origin: assistant method, author-ratified by results.

**Generality.** Testing, App-side; portable.

**Weight.** Medium within its locus; untested against other principles.

---

## F. The App's display ethic

### F1. The picture claims nothing the file does not

**It says.** Everything drawn is an assertion, and a wrong drawing is a misreport: "The picture
says something about the argument that the file does not" is the renderer's own issue-template
definition of a bug. Junction bars assert linked support, so `uses` exists to make the
assertion the reconstructor's "rather than the layout's"; arrows must be visible ("an arrow
that cannot be seen is not an arrow"); exports are checked by an independent engine because
"the engine that wrote the file is the wrong engine to check it with."

**Seen in.** `.github/ISSUE_TEMPLATE/a-map-is-drawn-wrongly.md`; `extraction-prompt.md` on
`uses`; `viewer.md` (arrowheads under badges, measured); `QA-PLAN.md` §6.

**Provenance.** **compression** — origin: practice; the issue template is its cleanest
statement.

**Generality.** The App.

**Weight.** Very heavy — it is the App's instance of A2/A3, and the QA campaign of 1 Sep is
costed to it.

### F2. A control is a promise

**It says.** A badge that does nothing is the interface contradicting itself; a fold control is
drawn only where folding would change the picture; a disabled control with a tooltip teaches
where an absent one cannot; the ⊞ glyph is not `+` because `+3` already means "three hidden
claims here, and this hides nothing." An offer can be declined as well as accepted.

**Seen in.** `viewer.md` (the badge as promise); `REVIEW.md` §3 (hidden-until-applicable named
as a tension); the ⊞ decision and the walkthrough's decline option (1 Sep).

**Provenance.** **compression** — origin: mixed; the dead-badge experience made it doctrine,
and the ⊞ reasoning is the author's.

**Generality.** The App's interface.

**Weight.** Heavy within the App; the fold-invariant suite enforces its central case
mechanically.

### F3. The reader's mental map survives the click

**It says.** A fold is a local request, and the claims that stay on screen hold still enough
that the reader's orientation survives; the document decides placement (home columns, own
routes, own ranks), so a filtered view is a projection of one fixed order, never a fresh global
optimisation; the camera holds what the reader pressed.

**Seen in.** `STABILITY-PLAN.md` (the principle stated, the targets quantified);
`KNOWN-ISSUES.md`'s open item, measured; the retirement of dagre in service of it.

**Provenance.** **compression** — origin: author observation ("a reader watched a claim glide
across the whole map"), assistant plan, author-gated ("getting the display right is mission
critical", 29 Aug).

**Generality.** The App's renderer.

**Weight.** Heavy: it retired a dependency and re-baselined static quality deliberately — with
the meta-rule that when it collides with within-picture quality, "the table decides, not the
principle."

### F4. The reader's attention: everything visible earns its place, and orientation can be dismissed

**It says** (respecified 3 Sep, at the Step Two checkpoint; the original below). Ipsissima
must be easy to use **without** visual clutter — which is not an outright ban on visible aids
but two requirements: **(a)** everything visible serves a useful purpose; **(b)** where
additional information is needed for discovery and user orientation, the user can easily turn
it off. The walkthrough is the exemplar: it calls attention to itself once, on first opening;
the user can easily exit; and it remains available for reactivation whenever wanted.

The original statement (18 Aug, 10:12): "I require tools that allow me to maintain a flow
state while I am working … the design should be as clean and non-distracting as possible …
Zettlr, not Word." Chrome is quiet; nothing reflows unbidden; explanation lives behind How to
use; debugging counts move out of the footer. The respecification is compatible with this and
deliberately widens its scope: a dismissible aid is permitted where the flat reading would
have refused it.

**Seen in.** The design constitution (18 Aug); `viewer.md` ("The viewer's interface");
`REVIEW.md` §3; the walkthrough's own behaviour.

**Provenance.** **quotation**, twice over — origin: author, 18 Aug and again 3 Sep ("Not an
outright 'no' to visual clutter, but: (a) everything visible serves a useful purpose, and (b)
where additional information is required for discovery and user orientation, the user should
be able to turn this off"). The respecification came with the second-order ruling recorded as
[[B6]]: the author's personal intolerance of clutter is stronger than the principle Ipsissima
needs, and "what matters here is *Ipsissima's* values, rather than my own private values."

**Generality.** Apex — P6 in `THEORY.md` §2, elevated at Step Three from an App-local
principle; it governs every reader-facing surface, with F3, F6 and F7 its nearest
specialisations.

**Weight.** Very heavy — the author's ruling at the Step One checkpoint (3 Sep: "It's often in
my mind when I make suggestions, but I don't often state it explicitly"), raised from the
Heavy its case law alone supported. Case law: the Order scatter retired as "a curiosity";
counts demoted; full-screen implemented as hiding chrome rather than an API call because that
is what the value actually wanted. Two findings about method attach: case-law weighting
undercounts values that operate silently inside the author's suggestions (`TENSIONS.md` §1);
and the respecification reopened T6 — a legend the flat reading refused is permitted if it can
be turned off.

### F5. One meaning per channel, and every encoding earns its place

**It says.** Fidelity is pattern; relation is colour — "solidity means closeness to the words,
everywhere, always," and nothing else may colour-code fidelity. The debt sparkline's ink is
neutral because green and red mean support and attack centimetres away; dashes are not reused
for direction because they already mean undercut; the focus ring is an outline because the
stroke already carries fidelity and thickening it "would say something false about whose words
the claim is in."

**Seen in.** `brand/README.md` (the one principle, stated once); `order-views.md`;
`REVIEW.md` §3 (keyboard-access note); `NOTES.md` (the debt ink).

**Provenance.** **compression** — origin: assistant articulation of the author's design
rulings; the brand file states it as law.

**Generality.** The App and the identity.

**Weight.** Heavy within its locus; REVIEW's open worry (four encodings at once) is a
recognised cost paid knowingly.

### F6. Hover adds what the box could not

**It says.** "Hover text should provide additional information and context to what is
immediately visible on the map" — a tooltip that repeats its box is noise, and a claim drawn in
full with no provenance gets no tooltip at all.

**Seen in.** The 1 Sep census and rework (`viewer.md`); the rendered-DOM invariant "no tooltip
repeats what its own box already draws."

**Provenance.** **quotation** — origin: author (1 Sep).

**Generality.** Local: the App's hover layer — with the underlying thought (say only what is
not already said) echoing more widely.

**Weight.** Local but firm; made executable as an invariant.

### F7. Open at the right level of detail

**It says.** The document holds all the detail; the view decides how much is shown. A map that
is too detailed for its purpose fails its reader — "the challenge is one of finding the right
level of detail at which to open the map" — so maps open folded to the skeleton past 25 nodes,
reveal one level per click, and a deliberately constrained map (or a report instead of a map)
can be the better product.

**Seen in.** `map-semantics.md` (the central idea); stepwise expansion; the 28 Aug book-map
verdict ("more useful than the map, which at 136 nodes was a bit too detailed").

**Provenance.** **quotation** for the challenge — origin: author (28 Aug); machinery
assistant-built.

**Generality.** The App, and the reconstruction method's sizing decisions.

**Weight.** Medium-heavy; B2's operational half.

---

## G. The MCP's ingest ethic

### G1. The extraction is what is in the source

**It says.** "The extraction of text should just be what is in the source" — no interpolated
headings, no silent corrections, no invented structure; OCR damage is quoted as it stands
rather than fixed inside quotation marks; publisher access stamps are stripped because they are
the library's mark, not the author's text.

**Seen in.** The byte-fidelity ruling (20 Aug, author verbatim); `ipsissima-conventions.md`
("Never silently correct the source inside quotation marks"); "Take the library card out of the
manuscript" (23 Aug).

**Provenance.** **quotation** — origin: author.

**Generality.** The MCP's converters; the checker enforces its consequences.

**Weight.** Heavy. Case law: the footnote converter caught corrupting years (`1963` →
`196[^3]`) was stopped and rebuilt rather than patched.

### G2. Prefer the source that knows its own structure

**It says.** Markdown is gold, pandoc-readable formats are silver, PDF is bronze — "a heading
is a heading because the document says so, not because something guessed from the type size."
Where a DOI can turn bronze into gold, ask; where two sources each have what the other lacks,
use both (HTML for structure, PDF for pagination); and tell the user when they are offering
bronze while holding silver.

**Seen in.** The 23 Aug release brief (author's own words); `ipsissima-mcp/README.md` ("the
single most useful thing on this page"); the Prescott-Couch two-source build; `plan_job`'s
advice.

**Provenance.** **quotation** — origin: author (23 Aug).

**Generality.** The MCP.

**Weight.** Heavy within its locus; structures the whole ingest pipeline.

### G3. The mechanical half is the tool's; the judgement half is not

**It says.** Ipsissima-MCP "does not reconstruct arguments itself; that judgement belongs to
the model" (and behind the model, the person) — the server prepares sources, serves the method
as readable documents, and checks results. The checker likewise: `!` is a fault; `?` is
"something to look at, and some of those are judgements you are entitled to make differently."

**Seen in.** `README.md` (both of them); the prompts/resources architecture; the checker's
two-tier findings.

**Provenance.** **paraphrase** — origin: the 20 Aug master plan's shape, ratified and sharpened
by the author throughout.

**Generality.** The MCP's architecture; with A1/C4 it forms the project-wide
judgement/mechanism boundary.

**Weight.** Heavy; never breached — even `--fix` only ever adjudicates the one level with a
fact of the matter, and only on files declared `generated`.

### G4. Reports are for reading: say what was tried, dropped, and why

**It says.** A converter's report "is designed to be the first thing you read: it names every
route it tried, what it scored, what it cut and what it could not do." Findings come back as
faults with locations and fixes, not as a census to re-derive; the fix loop is fed what it
needs and no more.

**Seen in.** The ingest reports; "Report the faults to a fix loop, not the whole census"
(23 Aug); `--only-problems` measured at 221 words against 687.

**Provenance.** **compression** — origin: practice under E3, author-ratified.

**Generality.** The MCP's tools.

**Weight.** Medium; E3's local enforcement.

### G5. Instructions are measured prose, and economy is part of the method

**It says.** The method the model follows is written down, tested against the parser and
against A/B comparison, and costed: round-trip rules exist because they were measured (41 calls
to 6), and the one saving that is never taken is a worse reading for a shorter run.

**Seen in.** `extraction-prompt.md` (the four rules, with their measurements); the
baseline-instructions eval; the reconstructor agent's honest cost report ("A run that overspent
and says so is worth more than one that rounds down").

**Provenance.** **compression** — origin: assistant, under the author's cost pressure (B4).

**Generality.** The MCP's served method.

**Weight.** Medium; subordinate to A-section principles by its own text.
