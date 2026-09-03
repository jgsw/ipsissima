# What a machine may say about an improvement

Written 3 September 2026, at the author's direction: an analysis of whether the values
framework should be wired into the development process — whether there should be an automated
test for whether a change to the codebase is an overall improvement or a worsening relative to
Ipsissima's values; whether to do it at all, and if so when and how. The framework is asked to
answer for its own automation, which is the reflexivity thesis (`THEORY.md` §1) put to its
hardest test. Entry references are to `INVENTORY.md`; facts marked **[measured]** were checked
in this tree.

## 1. The verdict

Three answers, because "automated values checking" names three different machines:

1. **An automated verdict on overall improvement — never.** Not as a matter of cost or
   difficulty, but because the framework's own principles forbid it (§2). The judgement half
   of that question belongs to people, permanently.
2. **Automated checks on the values' checkable facts — yes, and the project already runs
   them.** A substantial fraction of the test suite is principles made executable (§3), grown
   by an organic rule worth keeping. A small extension — a promises lint for the class of
   drift this week's audit caught by hand — is worth building now (§4).
3. **A model-read advisory pass over a diff, citing principles, never blocking — plausible,
   later, opt-in.** Worth building when there is evidence of the need it serves, which today
   there is not (§5). The cheap thing to do now is to wire the framework into the *human*
   process (§4, second half), which costs a paragraph in CONTRIBUTING and keeps a cadence
   that already proved itself.

The author's instinct — that automation is more likely useful for a contributor without
background than for him — is not only right but is, on this analysis, *the* organising
distinction, and the framework predicts it (§2.3).

## 2. The framework, applied to its own automation

### 2.1 Overall improvement is a judgement, and A11 draws the line

A11's boundary is exact: **what has a fact of the matter is checked; what is a judgement is
only ever reported.** "Is this change an overall improvement relative to Ipsissima's values?"
is the project-scale twin of "is this reconstruction a good reading?" — and the project has
already answered that question about itself, in `REVIEW.md` §6: the checks can verify what is
mechanical, they "cannot tell a good reading of an argument from a bad one," and the checkable
conditions are **necessary conditions a bad one can fail** — "neither is a quality measure,
and calling either one would be worse than having neither."

A CI job that printed `values: pass` would be the misnamed-rule defect at project scale: a
label drawn in the checked style that nothing examined. And the A2 precedent says precisely
what happens to such labels — they get believed (38 of 126, "always in the same direction"; a
claim carrying an exact quotation *feels* like a quotation). A green values badge would let
the real worsenings — the ones that pass every mechanical check, which is exactly the class
`CONTRIBUTING.md` puts at the top of its most-wanted list — ride under false assurance. D5
makes the general point: an instrument that claims more than it measures is worse than none.

There is also no scoring function to compute, and there cannot honestly be one. The
framework's weights are **case law**, not numbers, and its two meta-principles (`THEORY.md`
§5) say how conflicts are actually resolved: measurable ones become measured trades — "the
table decides, not the principle" — and unmeasurable ones become recorded judgements.
An automated overall verdict would need the principle to decide *without* a table, which
inverts the method that produced every entry in the case law.

### 2.2 A gate would freeze the equilibrium — and this week proves it

The framework is explicitly open-ended (`README.md`; `THEORY.md` §4): values-improvement is
continual, and on the Deweyan view the author brings to it, "all ends and values that are cut
off from the ongoing process become arrests, fixations." A gate compiled from the framework
enforces *yesterday's* equilibrium, mechanically, against the very revisions Step Two exists
to make.

This is not hypothetical; it happened this week, in both directions **[measured]**:

- **The gate would have blocked a correct change.** The key card violates F4 *as Step One
  stated it* — the flat no-clutter reading refused exactly this feature. The author
  respecified F4 at the checkpoint, and the card was built the same day. An automated
  F4-checker compiled on 3 September, morning edition, would have turned red on a change its
  author had just ruled right. The framework changed the same day the code did, and only a
  human process can move both together.
- **Tripwires would have caught real violations years earlier — well, days.** T2 (a CI
  allowance that outlived its failure) and T3 (a README denying a tool the server ships) are
  mechanical facts a lint catches in milliseconds, and they stood for days as documents said
  false things. The checkable slice is real, and it was being underserved.

That pair is the whole analysis in miniature: **facts want automation, judgements want
people, and the boundary between them is A11's.**

### 2.3 The Rawlsian point: automating the author's loop contaminates the evidence

The framework is an explication of the author's considered judgments, and Rawls's condition
on considered judgments is that they be **intuitive with respect to the principles** — "we
cannot test a principle honestly by means of judgments wherein it has been consciously and
systematically used to determine the decision" (§2.5(vii)). The case law is trustworthy
evidence *because* every ruling in it predates the framework or was made without consulting
it. Wire the framework into the author's own per-change loop — a checklist, a gate, a prompt
at commit time — and every future ruling becomes framework-derived: tests 1 and 4 of the
explication lose their independent evidence, and the equilibrium can no longer be tested,
only obeyed. The framework should reach the author **retrospectively** (Step-Two-style audits
at a cadence), never prospectively per change.

For a **contributor without the author's intuitions**, the position is exactly reversed, and
Rawls says why: an explication is *defined* as a set of principles whose conscious application
by any competent person reproduces the considered judgments (§3.2). Reproducing the author's
judgments by explicit application is not contamination for a newcomer — it is the framework's
designed purpose, and the only mode available to them. The author's instinct about who
benefits is therefore a theorem of the framework's own method: **the explication is for those
who lack the intuitions; the intuitions are the evidence, and must be kept unautomated.**

### 2.4 What the rest of the apex says

- **F4, respecified, applies to the development loop too**: everything in the process serves a
  purpose, and an aid must be dismissible. A per-commit values interrogation fails F4(b) for
  its primary user. `QA-PLAN.md` §8 already made the operational version of this argument when
  it refused a screenshot gate: false positives on a red build mean "the whole team learning
  to ignore a red build" — the annoyance the author suspects, named as a correctness hazard.
  Its answer — the visual diff as a **report, not a gate**, "aimed at the author's own time" —
  is the house shape for anything with judgement in it.
- **A8's trigger design** transfers: a check invited by what a change *does* (touches a file
  carrying a promise, adds a dependency, adds a network primitive) is safe; a check that
  interrogates every change grades work by standards it never engaged.
- **E6 disciplines whatever is built**: every new tripwire must be shown to fail, and budget
  for false-positive calibration — "two instruments, two rounds of false positives... the
  honest cost."
- **T2's lesson bounds the advisory shapes**: detection without an owner is silence one level
  up. A report nobody is committed to reading is the stale allowance again. Anything advisory
  needs a named consumption point.
- **B4**: a model-read of every diff has a real token cost, paid per change forever, for a
  benefit that today has zero users (there are no outside contributors yet **[measured]** —
  the git log has one author).

## 3. The evidence already in the tree

The question is not whether to *start* wiring values into the development process. It is
whether to systematise a wiring that already exists. A census of the suite **[measured]**,
by the principle each instrument executes:

| instrument | the principle, made executable |
|---|---|
| `test_versions.mjs` | E4 — one release, one version, six files agreeing |
| `test_page_parity.mjs` | C2/E4 — an exported page carries everything but the argued drop-list |
| the NOTICES build, read from esbuild metafiles | D2 — "this list cannot claim what it does not carry" |
| `test_fold_invariants.mjs` (badge and contention rules) | F2 — a control is a promise |
| `test_rendered_dom.mjs` hover invariant | F6 — "the hover principle, made executable" (its own words) |
| `test_export_artifacts.mjs` round-trip | F1 — the same words, no more and no fewer; checked by an engine that did not write them |
| `test_dead_fields.mjs` | E4 — nothing read that nothing writes |
| `test_argdown_positions.mjs` | A2/A11 — one border rule in two languages, pinned |
| the misnamed-rule `?` | A11 — a self-claim drawn in the checked style is examined |
| `map_quality.mjs` baselines, re-baselined deliberately | meta-principle 1 — the table decides, and the trade is written down per row |
| the KNOWN-ISSUES / CI-allowance convention | D5 — a failure shipped is a failure named, and both come out together |
| the key's rendered-DOM checks | F4(a)/(b) — the newest, added this week |

Roughly a dozen instruments, none of which was commissioned as "a values check" — each was
built when **a concrete defect demonstrated the class**, per the QA-PLAN's own rule
("let the rest follow the evidence") and E9's ("a shape once minimised is a shape the
generator can be taught"). That organic rule is itself the right wiring, and nothing proposed
here should replace it. What §4 adds is the one slice the organic rule underserves: promises
made in *prose*, whose breakage no test notices because prose is nobody's fixture.

## 4. What to build now

> **Built the same day, on the author's instruction — and the calibration runs made the
> section's own argument.** Row 5's first pass found the Miller source file carrying no
> licence note at all, against the samples README's standing rule; row 4's first live run
> found the README's probe sentence still saying 9 tools five days after `check_for_updates`
> made it 10. Two real prose-promise drifts, caught before the lint was an hour old — the
> files were fixed, the rows were not weakened, and every row's mutation is named where it
> lives (`app/test_promises.mjs`, the runtime no-network row in `test_rendered_dom.mjs`, the
> probe-count row in `tests/test_server.py`). The CONTRIBUTING section of §4.2 went in with
> them; the release-cadence audit is a standing practice rather than a file, and its first
> occasion is the next release.

### 4.1 A promises lint — the T2/T3 class, held

One suite, `!`-severity facts only, every row carrying the pedigree of a real drift and its
mutation note. Candidate rows, in order of the promise's weight:

1. **The page makes no network request — asserted at runtime, not by grep.** The rendered-DOM
   harness already drives every built viewer in a real browser; Playwright can record every
   request a session makes. Assert that none leaves `file://`. This is the README's flattest
   promise (C1), `SECURITY.md`'s top reportable, and it is currently guarded by nothing but
   review. It is also the row most worth having against a future contributor who innocently
   adds a CDN font.
2. **No CI allowance without its KNOWN-ISSUES twin** (the T2 class): the workflow contains no
   expected-failure machinery unless `KNOWN-ISSUES.md` names the failure, and vice versa —
   the pairing whose halves drifted apart this week.
3. **The licence boundary holds** (D2, and the author's standing instruction that the
   boundary is deliberate): `app/package.json` says MIT, `ipsissima-mcp/pyproject.toml` says
   GPL-3.0-or-later, both LICENSE files exist. Three lines of lint against a
   well-intentioned harmonisation.
4. **The server answers what the README promises** (the T3 class, narrowed to a checkable
   fact): the probe sentence's counts — tools, prompts, resources — against the server's
   actual registry.
5. **Every samples folder names a licence** (D3, the directory's one rule): each README
   matches the licence vocabulary, each source file carries an attribution block.

Cost: a morning. Each row mutation-tested before it is trusted, each row a fact — the lint
never opines.

### 4.2 The human wiring — cheaper still, and it serves the newcomer

- **CONTRIBUTING points at the framework.** One section: what `docs/values/` is, that
  `INVENTORY.md` is the explication a newcomer applies consciously where the author judges
  intuitively, and that a change trading against a principle should say so — measurably where
  measurable, as a recorded judgement where not (the meta-principles, stated as etiquette
  rather than enforced as process). This is the entire "useful for contributors" benefit at
  the cost of a paragraph, and it is available years before any contributor arrives.
- **The audit as a cadence, not a gate.** A Step-Two-style tensions pass at each release (or
  when the itch strikes), retrospective by design so the author's judgments stay intuitive
  (§2.3). The evidence this works is Step Two itself: one pass found three measured
  violations and revised two principles. Owner and occasion named — the release checklist —
  so T2's lesson is honoured.
- **The commit-subject genre is already the per-change values wiring**, on the human side: a
  subject that must say what the change *means* is a values check the author passes through
  on every commit without a machine asking anything. It should be named as such in
  CONTRIBUTING and otherwise left alone.

## 5. What to build later, and what would trigger it

**A model-read advisory pass**: given a diff, read it against `INVENTORY.md` and the case
law, and emit `?`-severity observations — "this adds a second definition of X; E7 and the
positions precedent suggest a pin", with the principle cited — never a verdict, never a gate,
run only when invoked (the `/code-review` shape, not the CI shape). G3 places it correctly:
judgement-shaped work belongs to a model or a person, not to mechanical CI, and its findings
are the kind "you are entitled to make differently."

Triggers that would make it worth its cost, none of which holds today:

- a first sustained outside contributor (the audience it serves);
- the release-cadence audit proving too coarse — a tension discovered long after its commit,
  where a per-change advisory would have caught it;
- or the author wanting a second reader on values-sensitive changes specifically (licensing,
  promises, display semantics), which could be a path-triggered advisory per A8's design.

If built: opt-in, D7-mannered (it asks and observes; it never legislates), its instructions
measured per G5, and its output owned — findings land somewhere someone has committed to
reading, or it is not built.

## 6. What never to build

Each refusal with the principle that grounds it:

- **A `values: pass/fail` CI verdict** — A11 (a judgement drawn in the checked style), A2's
  precedent (checked-looking labels get believed), D5 (claims more than it measures).
- **A numeric values score** — the meta-principles inverted: the principle deciding without a
  table; weights are case law, not coefficients.
- **A pre-commit values questionnaire for the author** — F4(b) in the development loop, and
  §2.3's contamination: it would convert every future considered judgment into a derived one
  and quietly destroy the framework's evidence base.
- **A hard gate compiled from the framework** — §2.2: it enforces yesterday's equilibrium
  against tomorrow's revision, and this week it would have blocked a change the author had
  just ruled correct.

## 7. The view, stated plainly

Asked directly whether automated values checking would be useful or annoying from the
author's perspective: **both, split exactly along A11's line.** Automate the facts — the
promises lint is useful to the author *because* it is silent until a fact breaks, which is
the only kind of interruption the respecified F4 licenses. Do not automate the judgement —
for the author it would be annoying in the ordinary way and corrosive in a deeper one (§2.3),
and the annoyance is not a taste to be overridden but a signal the framework itself
validates. For a contributor without background, the framework-as-document is the aid, the
lint is the safety net under the promises they cannot yet feel the weight of, and the
advisory model-pass is worth revisiting on the day such a contributor exists.

The wiring the process most needs is the one it already has: instruments born from defects,
judgements recorded where they are made, and the framework re-read against the practice at a
cadence — by someone whose next ruling it cannot predict.
