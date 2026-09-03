# Where the practice and the principles disagree

Step Two of the values and principles framework, written 3 September 2026. `INVENTORY.md` and
`THEORY.md` are the explication this document tests; the method is Rawls's ("Outline of a
Decision Procedure for Ethics", *Philosophical Review* 60:2, 1951), adapted in §1. Entry
references (A2, F4, …) are to the inventory; verdicts carry a stated confidence. Facts marked
**[measured]** were checked on this machine today, with the command or file named.

The instruction this step answers: find as many concrete decisions as possible, test them
against the framework, and wherever there is an apparent discrepancy, recommend — with a
degree of confidence — whether the fault lies with the decision or with the framework.
Discrepancy is diagnostic, not a call for immediate change: sometimes the behaviour is the
mistake, and sometimes the behaviour is instantiating a value the framework overlooked.

> **Acted on at the checkpoint, 3 September.** The author confirmed the high-confidence
> verdicts, approved A11 ("It seems right — do add it") and the move away from a single apex.
> T5 and T6 were resolved a third way, better than either drafted verdict: not by the trade as
> recorded but by a **respecification of F4** (now apex P6) — everything visible serves a
> useful purpose, and orientation aids must be dismissible and recallable, the walkthrough the
> exemplar — which permits a legend the flat no-clutter reading refused, provided it can be
> turned off. The respecification carried a new second-order principle, B6: the author's
> personal values are not automatically Ipsissima's; the touchstone is the user. The framework
> revisions are in `INVENTORY.md` and `THEORY.md`; the behaviour items are carried by
> `ALIGNMENT-PLAN.md`.

---

## 1. Method: Rawls, adapted to a repository

Rawls's procedure has three parts, and each has a precise analogue here.

**Considered judgments.** Rawls admits only judgments made on *actual* conflicts (not
hypotheticals), preceded by "a careful inquiry into the facts", felt with certitude, and
stable across occasions (§2.5). The framework's case law satisfies these unusually well: every
row in `THEORY.md` §5 is a real collision, most were preceded by measurement (the project's
E1 discipline is Rawls's fact-inquiry condition made mechanical), and several are stable
across repeated occasions (honesty beat marketing three separate times). One Rawlsian
condition matters especially: a considered judgment must be **intuitive with respect to
principles** — "not determined by a conscious and systematic use" of the principles being
tested, on pain of circularity (§2.5(vii)). Every judgment in the case law predates the
framework, which did not exist until 3 September. The evidence base is therefore
uncontaminated: the explication was extracted from judgments that could not have been derived
from it.

**The explication.** The inventory and theory are an explication in Rawls's sense (§3.2): a
set of principles whose conscious application would reproduce the considered judgments case by
case. Rawls demands comprehensiveness *with simplicity* (§3.5) — which is exactly the pressure
that produced the keystone, and exactly why the keystone must be stress-tested (§5 below): a
simplicity bid can overreach.

**The four tests of a principle** (§4.3): (1) it explicates the considered judgments; (2) it
wins the free assent of competent judges on reflection — here, the checkpoint reviews; (3) it
can settle new perplexing cases — the validity checker (§4 below) is precisely such a test;
(4) it can *hold its own against* a subclass of considered judgments — we become convinced,
on reflection, that the judgment and not the principle was the mistake, ideally with an
account of the anomaly. Test 4 is what licenses this document to recommend against existing
behaviour; test 1's failures are what license it to recommend against the framework.

**Verdicts.** Each tension below is resolved one of four ways:

| verdict | meaning |
|---|---|
| **behaviour yields** | the decision is wrong by principles that hold their own (test 4) |
| **framework yields** | the decision reveals a principle missing or mis-stated (test 1 fails) |
| **dissolves** | the conflict disappears under a distinction the framework already draws |
| **stands as a trade** | genuine conflict; record it per the meta-principles (THEORY §5) |

**Two honest departures from Rawls.** First, his judges must be disinterested (§2.5(i–ii));
a sole author judging his own project cannot be, and no adaptation fixes that. The partial
substitutes are the measurement discipline (facts constrain partiality), the outside-reader
stance of `REVIEW.md`, and the checkpoint itself, where the framework's claims meet the
author's reflection — Rawls's second test doing double duty. Second, the F4 correction at the
Step One checkpoint exposed a structural bias this method inherits: **case-law weighting
undercounts values that operate silently inside the author's suggestions** — a value can be
"often in my mind" and rarely in the record. Stability (§2.5(vi)) requires judgments to be
*expressed*; some of the heaviest are not. The corrective is the checkpoint question, asked
deliberately: *which other principles operate in your suggestions more often than they are
stated?* This document flags candidates in §6.

---

## 2. The sweep

Concrete decisions examined and found **consonant** — Rawls test 1 passing, listed so the
explication's positive evidence is on the table and checkable, not only its failures:

| decision | explicated by |
|---|---|
| `generated: true` gates the checker's marker-correction; curated files never written unasked | C4, E7 — consent embedded in the declaration; only the factual levels touched |
| `spine` exempts the contention; `untagged` does not — documented asymmetry | F2 — each control does exactly what it says; reasoning recorded |
| maps open folded to the skeleton past 25 nodes; one level per click | F7, B2 |
| the checker is read-only; the builder asks Python rather than reimplementing | E7, E4 — "duplicate and pin it with a cross-check" |
| a bundle is attached as line comments, so it is still a valid `.argdown` | C6, A9 |
| the update request lives in Rust, not the page, so the page's claim stays absolute | C1 — exemplary precision |
| the private corpus is a checked-in manifest whose files skip cleanly when absent | D3, E3 |
| `max` effort for anything published from `samples/` | A2 beating B4, deliberately |
| licence notices assembled into every built page, because the page is the distribution | D2 |
| the name's history told as a chorus, no tradition the frame | D6 |
| a paper may argue two things; two apexes recorded rather than one imputed | A6 |
| a judgment reconstructed backwards from the disposal; obiter tagged and attached | A6, A10 |
| draft mode: unfinishedness reported as observation, holes marked as the reconstructor's | B3, A5 |
| the staircase defaults to the readable form; ⊞ chosen because `+` already means something | B1, F2, F5 |
| tooltips rebuilt to carry only what the box could not | F6 |
| the fold-state identifier: a reader's private map reproduces a bug without the text travelling | E3 with D3 — a means-advance dissolving a values-conflict |
| the walkthrough offers, remembers a decline | F2, C3 |
| six version files held in agreement by a test | E4 |
| publisher access stamps stripped at ingest | G1, and the reader's privacy |
| update messages say *how*, for the route the reader actually took | B5 |
| `supported: false` (formalization the checker cannot read) is never shown as invalid | G3 — argdown-validity.js:26 states it as law |
| the subset parser's failure recorded in CREDITS as the reason the official one is bundled | E2, D4 |
| the cost model published with its residuals and falsifiers | E1, D5 |

Minor observations, noted without full entries: Miller ships deliberately unstamped so a
future rebuild tests the stamp loop end to end — a shipped exemplar quietly serving as a test
instrument; harmless, but the sample's README could say so (D4). The DOI lookup is on by
default though skippable — `SECURITY.md` discloses it and a DOI is a published work's metadata,
not the user's content; consonant with C1 as written, worth confirming that `plan_job`'s
report names the lookup before it happens (unverified). The site self-hosts its fonts to keep
the app's manners — consonant, already recorded.

The tensions found follow, ordered with the deep case last.

---

## 3. The tensions

### T1. The fidelity border is unchecked on the ordinary reading paths

**The decision.** `--derive-fidelity` verifies the border a claim wears — but its only caller
is the per-file build with `--source-root`. In the desktop app, the standalone viewer with a
folder dropped on it, and every exported page, borders are drawn **as declared**. `viewer.md`
documents this candidly: the three "as declared" rows "are now the ordinary way to read a
reconstruction … a reader who has been told the border says whose words these are is being
shown an unchecked one most of the time." The status line discloses it ("borders as declared,
not checked").

**The principles.** A2 — quotation is the one level with a fact of the matter, "so the checker
computes it rather than believing it"; the declared marker was wrong 38 times in 126, always
in the flattering direction. F1 — the picture claims nothing the file does not; here the
picture repeats the file's claim on the very axis the project exists to check. D5 is partially
satisfied by the disclosure line.

**Analysis.** This is the sharpest tension in the codebase, and the project has already
half-adjudicated it: `viewer.md` records that the original blocker "**expired**" — the
tightened contiguous-substring rule is "four lines on top of `ArgdownPositions.normalise`,
which is already inlined in every viewer," and agrees with the Python on **251 of 251**
adjudicated claims. The remaining rationale for asking Python is drift-hazard policy, and the
project's own answer to that hazard is already deployed for this exact rule: duplicate and pin
with a cross-check (`test_argdown_positions.mjs`). A disclosure line is the right mitigation
for what cannot be checked; it is not the right resting place for what can be — by the
project's own argument that a claim carrying an exact quotation *feels* like a quotation, a
border *feels* checked, and a footer line does not undo that.

**Verdict: behaviour yields — confidence high.** Derive `quotation`/`paraphrase` in the page
wherever the manuscript is present (app, folder drop, bundles), keeping the existing
constraints: only the two factual levels, nothing written back, no verdict under 30
characters, "as declared" retained — and disclosed — only where no manuscript is available.
The framework is not merely intact here; this is its clearest positive prediction.

### T2. The CI still forgives a failure that no longer exists

**The decision.** `.github/workflows/tests.yml:69` allows `fold invariants (state space)` to
fail; `CONTRIBUTING.md` says "One suite is expected to fail." **[measured]** The suite passes
clean today — `node app/test_fold_invariants.mjs` exits 0, every invariant held on every
corpus map at the committed seed — and `KNOWN-ISSUES.md` itself says no fold defect is open.
`QA-PLAN.md` §9 flagged this staleness on 1 September; two days later it stands.

**The principles.** E4 — "an expectation that has quietly become untrue is the same species of
bug as `n.full`." E3, with teeth: the allowance is not just a stale sentence, it is a **hole**
— a real regression in that suite would turn the build green, silently, which is the exact
failure mode the project takes most seriously. D5 — CONTRIBUTING now misdescribes the suite to
every newcomer.

**Verdict: behaviour yields — confidence high.** Remove the allowance from `tests.yml`, update
`CONTRIBUTING.md` and the KNOWN-ISSUES cross-reference. One observation for Step Three rather
than a framework change: the project's instruments *detected* this (QA-PLAN §9) and nothing
owned acting on it — detection without an owner is E3's failure mode one level up.

### T3. The MCP's README denies a tool the server ships

**The decision.** `ipsissima-mcp/README.md:224`: "**Neither version checks for updates.** …
Watching the releases page on GitHub is the way to hear about a new one." **[measured]**
`server.py:677` defines `check_for_updates`, and `RELEASING.md` describes it at length — on
request, nothing sent, nothing installed — noting it is *more* load-bearing than the app's
menu item, because the bundle format has no other way to learn a release exists.

**The principles.** E4 (drift between two documents of record); D6 (the project's
self-description must be as checked as its dependency list); and C1's own case law — the 29
Aug lesson was precisely that update-check claims must be made per-artifact and exact, "one
claim that had to become precise." The MCP README missed that pass. The sentence's second half
("makes no network request of its own accord") remains true; the first half is false.

**Verdict: behaviour yields — confidence high.** Rewrite the section to match RELEASING.md:
the tool exists, fires only when asked, and is the bundle user's only signal. No framework
change; C1-as-refined predicts exactly this fix.

### T4. "Justificatory debt" is a loaded ledger in a tool that refuses verdicts

**The decision.** The exposition view names the anticipated direction *debt*: "below, a
promise outstanding; above, a claim its reasons have already earned"; "full ink means already
justified, pale means still owed."

**The principles.** A7 — neither direction is a fault, "and the view must not imply one is";
the same document that draws the ledger insists on this, keeps colour off the distinction, and
gives emphasis only to reach, "what costs a reader something whichever way it runs." Yet
*debt*, *owed*, *earned* are not neutral words, and only one direction carries them.

**Analysis.** The conflict dissolves under a distinction the framework has not yet stated
explicitly: A7 forbids grading the **author's style**; the ledger describes the **reader's
position** — what they are being asked to hold, and for how long. Those are different subject
matters: a Pryor-convention text accrues "debt" by deliberate design and is not thereby worse,
and the display practice (pale ink, not red; no verdict channel touched) is consistent with
the reader-cost reading. But the framework should say this rather than leave it to be
inferred, because the vocabulary alone invites the misreading — an author shown their own
draft "in debt" may hear a grade.

**Verdict: dissolves, with a framework amendment — confidence medium.** Amend A7: the tool
grades neither the author's argument nor their style; it may measure and display *the reader's
burden*, provided the display never borrows the verdict channels (colour, fault marks). A
lower-confidence behavioural suggestion: audit the reader-facing wording (help, hovers) so
"owed" is always owed *to the reader*, never *by the author* — the distinction survives in
prose only if the prose keeps it.

### T5. Controls hidden until applicable, in a tool whose controls are promises

**The decision.** Exposition, Notes, Manuscript, Find, line numbers, fold and Save are
`hidden` until a precondition makes them applicable (47 hidden-gated elements in the template
**[measured]**, by rough count). `REVIEW.md` named the tension and the project's own accepted
alternative: the Exposition button is *disabled with a tooltip saying what would enable it* —
"a disabled control with a tooltip teaches; an absent one cannot" — "which suggests the
principle is accepted and unevenly applied." (The undo half of that review item has since been
closed: an Undo button now appears once there is something to take back.)

**The principles.** F2 and B1 argue for teaching; F4 — now Very heavy by the author's ruling —
argues for quiet chrome: a rank of disabled controls is clutter for every reader who never
needed them.

**Analysis.** This is a genuine trade, not a defect, and F4's upgrade changes its balance:
blanket "disabled teaches" would be the wrong resolution. The Exposition pattern earns its
place where the control names a *capability the reader would want and can obtain* (drop a
folder, get the manuscript view); hiding stays right where the precondition is structural (Save
in a build that cannot save). What violates the framework is not either policy but the
*unevenness* — no recorded rule says which controls teach and which hide.

**Verdict: stands as a trade, to be decided and recorded per control — confidence medium.**
Per meta-principle 2 (THEORY §5): a short table in `viewer.md` — control, hidden or disabled,
why — would convert an accident into a policy. Expected outcome: Manuscript and Exposition
teach; most of the rest stay hidden, F4 prevailing.

### T6. Four encodings at once, and nothing on screen to read them by

**The decision.** Border style (fidelity), edge colour and style (relation kind), tag chips,
sparkline position (debt) — four meanings a reader must hold, each explained in help, none
reminded on screen. `REVIEW.md` raised it and suggested a dismissible legend.

**The principles.** F5 (each encoding earns its place — each of the four does, individually);
B1 (the novice is the design target); F4 (Very heavy: a permanent legend is exactly the chrome
the constitution forbids).

**Verdict: stands as a recorded trade — confidence medium-low.** With F4 at its corrected
weight, a *permanent* legend is ruled out; the fidelity key already lives in How to use and in
the border hover (F6 pattern). If anything is done, the walkthrough — opt-in, declinable — is
the F2-compliant teaching channel, not new chrome. Record the trade; revisit only on evidence
that readers misread the encodings (none is in the record).

### T7. Two modules with four jobs, in a project that gives documents one each

**The decision.** `argdown_provenance.py` (~1,670 lines: locating, verifying, Stern checks,
debt measurement) and the 3,800-line renderer. Both named in `REVIEW.md`; the renderer's
single file is *defended* by C2 (readers over contributors), the Python has "no single-file
constraint forcing it."

**The principles.** E7 against the Python; C2 successfully overriding E7 for the renderer.

**Verdict: stands, as already adjudicated — confidence high in the adjudication.** The
renderer's case is closed by C2 with a stated revisit trigger (the arrival of contributors).
The Python is a recorded, non-urgent tension: E7 says split it when next it needs real change;
nothing says split it now. No framework change.

### T8. Two ingest modules ship untested against anything real

**The decision.** The EPUB route and `split_manuscript.py` have no sample or fixture;
`REVIEW.md` §4 and `CORPUS.md` both say so and say what is wanted.

**The principles.** E2 (validate, never assume) against the shipped state; D5 satisfied (the
gap is named, loudly, in three documents); D3 constrains the fix (the corpus can only hold
what may be redistributed).

**Verdict: behaviour yields — confidence high, urgency medium.** This is a tension the
project has already confessed; Step Three should carry it as an alignment item (a small EPUB
fixture and a public-domain multi-chapter book are both obtainable within D3). The framework
is untouched.

---

## 4. The deep case: the logic checker, and its results on the map

*The question put directly at the Step One checkpoint: is the decision to include a validity
checker — and to draw its verdicts on the map — fully compatible with Ipsissima's stated
values?*

**The decision as shipped.** An inference line that names a rule (`-- Modus ponens
{uses: [1, 2]} --`) claims the conclusion follows; given `formalization:` on its lines, the
claim is decided — truth-table complete, first-party, zero dependencies, differentially tested
against Z3 in CI, never shipped as a solver. The bar has four states, drawn to a deliberate
loudness gradient: rule name plain (checked, follows — "the quietest possible positive mark");
red `!` badge with countermodel (checked, does not follow — "the one state worth interrupting
for"); rule name hollow (named, nothing checks it); no name (nothing claimed, "not a fault:
most steps name no rule"). A `formalized:` stamp, written only by `--stamp` after a human has
read the formulas against the words, guards drift; a stale stamp draws a wavy underline. What
was deliberately not built: any check that the step *is* the rule it names. A bare `-----`
claims nothing and is never checked.

### The case against

1. **A7 — the tool does not grade.** This is the first evaluative verdict Ipsissima draws.
   Everywhere else the project has refused verdict channels with something like horror
   (neutral debt ink; no colour on anticipated/prepared); here is a red badge and a struck
   claim of failure. If a reader takes "the conclusion does NOT follow" as a fact about *the
   author's argument*, the map misreports — most dangerously on a conductive argument whose
   reconstructor named a rule they should not have.
2. **A1 and the Betz–Brun boundary.** Ipsissima's constitutive half is exegetical adequacy;
   the checker imports the systematic-correctness half. `VALIDITY-PLAN.md` names the risk
   itself: "the map must not imply that a ticked step is a faithful one."
3. **E3/A2 — the silent wrong name.** The verdict comes from the formalizations alone; "a
   step labelled `Modus tollens` that is in fact a valid *modus ponens* passes quietly"
   (`help.md`). The name is then drawn *plain* — the checked state — though nothing examined
   it. The project's own history predicts what happens to labels that feel checked: fidelity
   markers were wrong 38 of 126, "always in the same direction," and instruction alone
   "halved the rate … and did not remove it." A wrong rule name is a misreport waiting for a
   reader who trusts the mark.
4. **B1 — countermodels for novices.** `p = true, q = false` is logician's furniture in a
   tool whose design target is the reader *not* used to numbered premises.

### The case for

1. **It is the fidelity apparatus, extended to inference.** The four bar states are exactly
   the fidelity ladder's epistemic grades transposed: claimed-and-verified /
   claimed-and-failed / claimed-and-unexamined / unclaimed. Naming a rule is a **claim the
   reconstruction makes about itself**, and — given formalizations — one with a fact of the
   matter. The keystone demands precisely that such a claim be checked rather than believed;
   a bar that drew "Modus ponens" unchecked forever would be the *fidelity-marker bug* in new
   clothing. On this reading the checker is not an import from the rival half of Betz–Brun;
   it is A2's logic applied to the one other place the reconstruction asserts something
   checkable.
2. **The trigger design answers A7.** Nothing is graded until the *reconstructor* claims
   deduction; the author is never measured against a standard the text did not invoke. And
   the danger of the reconstructor over-claiming on the author's behalf is policed where it
   belongs — by A6 and the extraction prompt ("a rule name on such a step claims something
   the author never did. Do not reach for this by default"), not by the display.
3. **The Miller result shows the feature serving exegesis.** Formalising the route to the
   order returned a countermodel whose missing premise — `[What is founded on null advice is
   itself null]` — the court applies and never states; it entered the map as an `imputation`,
   warranted `enthymeme`. The checker's verdict *produced better reading*: a suppressed
   premise made visible and marked as the reconstructor's, which is A5 working exactly as
   written. "Formalising a step in Miller found a premise the court never states" is the
   strongest single argument that this feature belongs to Ipsissima's project rather than to
   argdown-feedback's.
4. **Drawing it on the map is required by F1, not merely permitted.** The junction bar
   already asserts the premises stand or fall together. Once the file carries formalizations
   and a rule name, a map that suppressed a failed verdict would show a confident bar over a
   step the toolchain *knows* does not go through — the picture claiming what the check has
   disproved. And the requirement that shaped the whole build was live re-checking while
   editing: the display is not a bolt-on to the checker, it is the point of it. A verdict
   confined to CLI reports would reach reconstructors and never readers — the constituency
   the project exists for.
5. **The engineering honoured the surrounding values throughout**: E8 and C2 (truth table
   over a 33 MB WASM solver, "using it is not a compromise with the standard; it is the
   standard"); E1 (every size measured); G3 (`supported: false` "must never be shown as
   invalid"); D5 (`help.md` states what is not checked, in italics, to the reader).

### The judgment

**The decision is compatible — and it is Step Two's clearest case of a discrepancy resolved
against the framework rather than the behaviour.** The inventory as written cannot fully
explicate this feature: A8 says systematic correctness is checked "only when claimed," which
is true but does not say *why that is principled rather than a carve-out*. The feature reveals
the principle that was operating unstated:

> **Proposed addition (working name A11). What the reconstruction claims about itself is
> checked wherever a fact of the matter exists; what it claims about the author is only ever
> reported.** Quotation verification was this principle's first instance; fidelity derivation
> its second; the validity check its third; the `formalized:` stamp its fourth. The verdict on
> a self-claim is never a verdict on the author — and the display must keep that legible.

With A11 in place, A7 and A8 stop looking strained: the red badge is not the tool grading
Williams, it is the tool reporting that *the reconstruction's own asserted warrant fails on
the reconstruction's own formalizations* — the same species of finding as a failed quotation.
Confidence in this resolution: **high** for including the checker; **high** for drawing the
verdict on the map (the F1 argument); **medium-high** for A11's formulation as the right
generalisation, which is exactly what the checkpoint should test.

Three residual misalignments, all behaviour-side, none blocking:

1. **The silent wrong name — confidence medium-high that something should change.** The
   name is the one self-claim in the system that is drawn in the checked style without being
   checked. For the eighteen canonical rules the file abbreviates, schema-matching a
   propositional step is bounded work (`VALIDITY-PLAN.md` §6 deferred it as larger than
   entailment, which it is; it is not large). The A2 precedent says instruction will not fix
   mislabelling; the options, in rising cost: (a) `check_argdown` reports a `?` when a
   canonical name's schema does not match the formalizations; (b) the map draws the *name* in
   a style that never asserts checkedness — only the verdict mark does; (c) full name
   verification. Recommend (a) at minimum; it keeps the reader-facing display unchanged while
   the pattern gets a finding, which is how fidelity was handled before `--fix` existed.
2. **One tooltip under-attributes — confidence high, cost trivial.** The `!` badge says "on
   the formalizations given" (argdown-live-map.js:3496); the rule-label tooltip says only
   "Checked: the conclusion does NOT follow" (line 3480). Align the label's wording with the
   badge's, so no string on the map states the verdict without attributing it to the
   formalizations — A11's display half, in five words.
3. **The countermodel's audience — confidence low that change is needed.** A countermodel is
   inherently technical; it appears only behind a click, only on a step whose reconstructor
   invoked deduction. B1 is adequately served by the loudness gradient. Note and leave.

---

## 5. The keystone, stress-tested

*The author's instruction at the checkpoint: test whether the reflexivity thesis is too neat.*

The test Rawls supplies is the fourth (§4.3): a principle earns supremacy only if, where it
conflicts with considered judgments, we conclude on reflection that the judgments were wrong.
So: classify all 44 entries by whether the keystone ("every representation must answer for its
distance from what it represents") actually governs them, and check the case law for
judgments a supreme keystone would get wrong.

**The count.** Genuinely keystone-governed: the A section (A1–A11), F1, F2's core (a control's
badge is a representation of what a click does), F5–F6, C5, D1, D4–D6, E1–E4, E6, G1, G4 —
roughly **half the inventory, 22 or so entries**. Not derivable from it without strain: the
mission cluster (B1–B5); the sovereignty cluster (C3, C4, C6, D7, G3); the trust-and-access
constraint C2; the attention cluster (F3, F4, F7, B2); citizenship duties (D2, D3); the
method-craft entries (E5, E8, E9); G2. Attempts to absorb these read as the kind of
manufactured coherence Stern warns about — C2 did not beat Z3 because of anything about
representation; it won on trust, portability, and the mission.

**The case-law check.** If the keystone were supreme, at least three considered judgments
would come out wrong: the staircase ruling (novice legibility over compact display — nothing
representational at stake), the flow-state retirements (the Order scatter was a perfectly
honest representation; it died for being a *distracting* one), and the menu-item update check
(a startup check could be represented with perfect honesty; it lost on sovereignty). The
judgments are firm and the keystone does not explicate them. By Rawls's own test, the keystone
is **not supreme** — and `THEORY.md` §1's sentence that "most of the inventory's apparently
disparate principles" are the one ethic applied overstates by a margin: *about half, and the
distinctive half* is the defensible claim.

**What survives.** The five-apex structure of THEORY §2 survives intact — it never claimed
derivability of P2–P5 from P1, and the case law distributes across all five. What should
change is §1's framing: the keystone is Ipsissima's **distinguishing** value (what makes this
project unlike other software, the thing its name states), not its **governing** one. A
sharper residual question for the author: the attention cluster (F3, F4, F7, B2 — the reader's
cognition as something the tool stewards) is currently split between P2 and P3 and, with F4
now Very heavy, may deserve to be named as an apex commitment of its own. That would make six.
This step does not decide it.

**Verdict: framework yields — confidence high.** Amend THEORY §1 ("about half"; "distinctive,
not supreme") at Step Three; put the sixth-apex question to the author.

---

## 6. Summary of recommendations

| # | tension | verdict | who moves | confidence |
|---|---|---|---|---|
| T1 | borders unchecked on ordinary paths | behaviour yields | in-page fidelity derivation | high |
| T2 | stale CI failure allowance **[measured]** | behaviour yields | tests.yml, CONTRIBUTING, KNOWN-ISSUES | high |
| T3 | README denies `check_for_updates` **[measured]** | behaviour yields | ipsissima-mcp/README.md §Updating | high |
| T4 | "debt" vocabulary vs no-grading | dissolves | amend A7 (reader-cost clause); wording audit | medium |
| T5 | hidden vs disabled controls | trade, to be recorded | per-control table in viewer.md | medium |
| T6 | four encodings, no legend | trade, recorded | nothing now; walkthrough if evidence arrives | medium-low |
| T7 | two four-job modules | already adjudicated | nothing now | high |
| T8 | EPUB and book routes untested | behaviour yields | fixtures, within D3 | high |
| §4 | the logic checker | **framework yields** | add A11; plus three small behaviour items | high / medium-high |
| §5 | the keystone | **framework yields** | THEORY §1 reframed; sixth-apex question posed | high |

Framework changes proposed for Step Three, gathered: **A11** (self-claims are checked; claims
about the author only reported — with its display corollary); **A7 amended** (reader-cost
description permitted, verdict channels never borrowed); **THEORY §1 reframed** (distinctive,
not supreme; "about half"); and two questions only the author can answer — whether the
attention cluster becomes a sixth apex, and which further principles operate in his
suggestions more often than the record shows (the F4 class). Candidates for that last
question, offered from the pattern of his recorded interventions: a principle about *proper
scale* (the panel sized to its argument, the site name not three times, the release note
neither cryptic nor arch — a recurring "as much as its subject needs, and no more" that the
inventory nowhere states); and a principle about *etiquette toward other people's work and
attention* (the courtesy letters, the academic-etiquette pause before adding his own paper,
the Argdown non-affiliation line) that D1–D3 only partly capture.
