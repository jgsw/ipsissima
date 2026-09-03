# One question, asked of everything: a theory of Ipsissima's values

Step One's interpretation — the ordering of `INVENTORY.md`'s principles from more to less
general, the division into what belongs to the whole project, to the App, and to the MCP, and
the adaptation of the means-improvement / values-improvement distinction to a piece of
software. Entry references (A1, F3, …) are to the inventory. Like the inventory, this document
is a reconstruction and is marked as one: the ordering below is **interpretation**, warrant:
`coherence` — it is the arrangement that makes the most of the record hang together, not an
arrangement the record states.

---

## 1. The keystone

Ipsissima has one constitutive question — *whose words are these, and how far does this stand
from them?* — and the striking fact about the project is that it does not only build software
that asks the question of reconstructions. It asks the question of everything it makes:

| asked of | the answer takes the form of |
|---|---|
| a claim in a map | the fidelity ladder, provenance, warrants (A2, A3, A5) |
| a quotation | character-by-character verification, and its context (A2, A4) |
| the drawn picture | "the picture says something the file does not" is a bug (F1, F2) |
| the tool's promises | per-artifact network claims, made precise under pressure (C1) |
| the About window | dependency lists read from the build, "cannot claim what it does not carry" (D6) |
| the tests | instruments shown to fail; green ≠ proof (E6, D5) |
| the measurements | [measured] / [reported] / [judgement] (E1) |
| the project's history | the record, corrections left standing, the attic (D4) |
| the credits | debts in proportion; independent arrival ≠ debt (D1) |
| the collaboration itself | interrogative, not generative; the very words are the author's (D7) |

So the most general principle in the project — never stated anywhere, enacted everywhere — is:

> **Every representation must answer for its distance from what it represents: graded where it
> cannot be binary, declared where it cannot be checked, and checked where it can be.**

Call it the **fidelity ethic**. Ipsissima is built the way it asks reconstructions to be built,
and most of the inventory's apparently disparate principles — honesty about unsigned builds,
loud converter failures, mutation-tested harnesses, the commit-subject genre — are this one
ethic applied to a new class of representation. That reflexivity is, on this reading, the
project's character; it is also why the framework in this directory marks its own provenance.

## 2. The apex: five commitments that govern the whole project

Beneath the keystone, the record supports five apex commitments. They are not derivable from
one another; every other principle in the inventory specialises one of them (or sits where two
meet).

**P1 — The fidelity ethic** (the keystone, §1). Specialised by: A1–A5, A8 (what a
reconstruction must answer for); F1–F2 (what a picture must answer for); C5, D4–D6 (what the
project must answer for); E3's negative form — a silent failure is an unanswered
representation left standing; E6 (what a test result must answer for).

**P2 — The mission: open serious argumentation to everyone** (B1). Specialised by: B2 (the
reader's own pace), B4 (cost as hindrance), B5 (the user's own words), F4 (out of the way), F7
(the right level of detail), and the novice-first rulings. The mission is why fidelity is
*drawn* rather than merely recorded — a border legible at a glance is the ladder made available
to someone who will never read a conventions file.

**P3 — Three sovereignties.** The tool serves three parties and may usurp none of them:

- *the author of the text*: their words unmodified (G1), their hedges and scope intact (A6),
  their argument reported rather than graded (A7), their manuscript never written to (C4);
- *the reconstructor*: the reading is their judgement, prepared and checked but never made for
  them (G3), their file never rewritten unasked (C4), only facts — never judgements —
  adjudicated by the machine (A10, E7, A1);
- *the reader*: their pace (B2), their machine and their trust (C1–C3, C5), their freedom to
  leave (C6), their orientation on the map (F3), their attention (F4).

D7 — interrogative, not generative — is P3 applied to the project's own making: the author of
*Ipsissima* is a party the assistant must not usurp either.

**P4 — The empirical method** (E1–E9). Measure before design; validate, never assume;
definitions before repairs; fail loudly; exhaust what can be exhausted. This is the project's
means-improvement engine (§4), and it is not value-neutral machinery: E3 and E6 are P1
commitments wearing engineering clothes.

**P5 — Scholarly citizenship** (D1–D3). Credit in proportion, licences that serve the commons
the project draws on, redistribution only by right. The project behaves as a participant in
scholarship and in free software, with the obligations of both.

The five are entangled at every edge — the case-law table in §5 is mostly records of their
collisions — but the *direction of derivation* is stable: local principles cite these; these
cite nothing above themselves except the keystone.

## 3. The division: what belongs to the whole, to the App, to the MCP

The project splits along one seam, stated in both READMEs: **the mechanical half is the
tool's; the judgement half is the model's, and behind the model the person's** (G3). The App
and the MCP sit on either side of a second seam: the App faces the *reader* of a
reconstruction; the MCP faces its *sources* and its *checking*. Each half's local principles
are the apex commitments specialised for its seam.

```
                         the fidelity ethic (keystone)
                                     │
        P1 fidelity   P2 mission   P3 sovereignties   P4 method   P5 citizenship
                                     │
     ┌───────────────────────────────┼──────────────────────────────────┐
     │                               │                                  │
   the App                    shared boundary                        the MCP
   (the reader's half)        principles                             (the source's half)
     │                               │                                  │
   F1 picture ≤ file          A9/E2 the language is                  G1 extraction = source
   F2 control = promise            someone else's: official          G2 gold/silver/bronze
   F3 mental map survives          parser, no dialect, ever          G3 judgement stays human
   F4 flow state              C6 no lock-in                          G4 loud, readable reports
   F5 one meaning/channel     G3 the judgement seam                  G5 measured instructions
   F6 hover adds only         C1 network claims, per artifact        B4 ask before spending
   F7 right level of detail   C4 the user's files                    A5–A8 via the checker
   C2 one self-contained file
```

Three things about the division are worth saying out loud:

- **The hard boundaries are shared, not App- or MCP-local.** The official parser as sole
  arbiter, no invented syntax, no lock-in (A9, E2, C6): both halves obey them, and they are the
  only principles in the inventory that read as near-absolute — because breaking them breaks a
  promise to people *outside* the project (Argdown's users and authors), where every other
  trade-off is internal.
- **The App's local principles are mostly P3-reader and P1-picture**; its heaviest
  App-specific constraint (C2, the single self-contained file) is a trust-and-mission
  commitment that happens to bind engineering, which is why it keeps beating engineering
  virtues (solvers, TypeScript, module graphs).
- **The MCP's local principles are mostly P1-text and P3-author**; its heaviest local
  constraint (G1, byte-fidelity) is A2 applied at the point where the words enter the system —
  corrupt the words at ingest and every downstream check verifies against a fiction.

Below these sit the **local principles** — narrow in scope, often near-absolute within it:
hover text (F6), the badge promise (F2's fold case), the ⊞ glyph, the debt-ink neutrality
(F5's instances), the staircase default. Generality and weight come apart in both directions
(the author's own observation, and the reason the inventory records them separately): F6
governs a few hundred pixels absolutely; E8 governs the whole project and always yields to
measurement.

## 4. Means-improvement and values-improvement, adapted to software

In "What makes a health system good?" the distinction runs: means-improvement reconfigures the
flows by which inputs become outputs, so the system better achieves its values;
values-improvement specifies and reconciles the values themselves; the two are entangled and
reciprocal, and neither is ever finished. Adapting it to Ipsissima needs one translation:
software has two families of flows.

- **Product flows**: a document → converted source → reconstruction → checked map → drawn
  picture → a reader's understanding of an argument. Their means-improvement is the visible
  daily work — converter bake-offs, round-trip rules, cost models, layout stability, fold
  correctness.
- **Development flows**: a defect → an instrument → an invariant → held ground; a decision → a
  record → the next decision. Their means-improvement is QA-PLAN, FOLDING, the mutation
  self-tests, the commit genre.

Values-improvement is what this directory does deliberately for the first time — but the
record shows the project doing it implicitly throughout, in exactly the entangled ways the
article describes:

**Means-advances dissolving values-conflicts.** The article's example is anonymisation
technology reconciling confidentiality with research. Ipsissima's exact analogue: the
quotation checker with its punctuation-normalising comparison reconciled *"a reconstruction is
an interpretation"* with *"quotations are facts"* — the two stopped competing the moment there
was machinery that checked the factual level and refused to touch the interpretive ones (A1,
A2, and `viewer.md`'s constraints). Likewise the fold-state identifier reconciled *reproducible
bug reports* with *a private corpus* (the state travels; the text does not), and the
named-rule trigger reconciled *check deduction* with *never grade conduction* (A8).

**Means-failure forcing values-revision.** The article: an outcome too expensive or
error-prone should send you back to the values. Ipsissima: token costs (18 Aug, 27 Aug) forced
the mission's affordability clause into words (B4); novices failing to read
premise-conclusion structures produced the staircase and the explicit novice-first ruling
(B1); the author's own update-check request collided with the no-network claim and the claim
was *split into two precise ones* rather than defended or dropped (C1) — a textbook
values-refinement under means pressure.

**Values discovered inside means.** The no-network principle's genealogy — born as the selling
point of a permissions workaround, entrenched by portability requirements, canonised as the
trust story for unsigned builds, ratified without ever being announced — is the record's own
demonstration that a project's values are partly *found in* its means-improvement, not only
imposed on it. Which is why this framework records origin: knowing where a value came from
changes how it should be interpreted and weighed (C1 reads as serving trust and reader
sovereignty, not as asceticism about networks), without changing whether it binds.

**Open-endedness.** The record refused to stay closed ("A record of a live project closes when
the project does, and this one has not"); the samples table is re-baselined when the corpus
moves; KNOWN-ISSUES holds an open item with a plan rather than a verdict. On the Deweyan view
the author brings to this — ends cut off from the ongoing process become arrests, fixations —
"feature-complete" is a claim about means, never about values. This framework is therefore
versioned, dated, and expected to be wrong somewhere: finding where is Step Two.

## 5. Weight, as case law

Weight is not asserted here; it is read off collisions the record actually adjudicated. The
table is the framework's working answer to "which principle wins?", and every row is a
precedent a future decision can cite or distinguish.

| collision | winner | where |
|---|---|---|
| single self-contained file vs shipping a solver | the file — checker written in-house, Z3 dev-only | VALIDITY-PLAN |
| single file vs type safety | both, by design: `checkJs` without emit | REVIEW §2 |
| single file vs "let recipients reply" | the file — editor export withdrawn | NOTES |
| Argdown compatibility vs expressive need (three jobs of `<+`) | compatibility; the note carries the rest | conventions §5 |
| accuracy vs charity | accuracy, always | method §2 |
| one imputed thesis vs multiple contentions | the paper's own plurality | 20 Aug ruling |
| privacy vs converter quality | privacy — cloud converters rejected | SECURITY, CONVERTER-FINDINGS |
| no-network vs users learning of fixes | precision, not retreat: the claim split per artifact | 29 Aug; RELEASING |
| convenience vs nothing-behind-your-back | sovereignty — menu item, not startup check | RELEASING, INSTALL |
| novice legibility vs expert compactness | the novice default, the expert option kept | 1 Sep staircase |
| metaphor fidelity vs sparkline legibility | legibility — the net, not the balance | NOTES (debt) |
| cost vs quality of shipped samples | quality — `max` for anything published | effort-testing |
| cost vs quality of the reading generally | quality — "the one saving this document does not want" | extraction-prompt |
| honest self-description vs marketing | honesty — Gospels de-centred, "arch" note rewritten | 28–29 Aug |
| licence uniformity vs mission-shaped boundary | the boundary | LICENCE-AUDIT |
| corpus usefulness vs right to redistribute | the right — in-copyright texts left, gap stated | 23 Aug; REVIEW §4 |
| dependency standardness vs owning the layout | measured case-by-case: dagre retired, parser kept | STABILITY-PLAN; CREDITS |
| picture stability vs static optimality | neither by principle: "the table decides" | STABILITY-PLAN |

Two meta-principles govern the table itself, and they are the project's native mode of doing
values-improvement:

1. **Where a conflict is measurable, convert it into a measured trade and write the trade down
   per row** — the `DEPARTURE_BOW_ALLOWANCE` decision, the stability re-baselining. "The table
   decides, not the principle" is not the abdication it sounds like: it is P4 refusing to let a
   principle claim more than its evidence.
2. **Where it is not measurable, record the judgement as a judgement** — [judgement] "is where
   to argue." A resolved conflict whose reasoning is written down can be reopened; one settled
   silently cannot.

## 6. What Step Two should press on

The framework's own weakest points, named in advance (D5 applies to this document too):

1. **The keystone may be too tidy.** "One ethic asked of everything" is an interpretation with
   warrant `coherence` — exactly the kind of reading Stern warns can be manufactured. Step Two
   should look for principles the keystone cannot absorb (candidates: F4 flow-state, which is
   about attention rather than representation; B4 cost; E8 dependency taste).
2. **The assistant-introduced entries deserve the no-network treatment.** C1's genealogy is
   done; D4, E5, E6, E9 and G5 are marked compression-or-interpretation with origin in
   practice or assistant proposal, and their weight should be confirmed by the author rather
   than inherited from enactment.
3. **Weight rows resting on a single case.** Several precedents in §5 have one instance;
   reflective equilibrium may re-decide them cheaply.
4. **Values with no principle yet.** Places the record hints at commitments the inventory does
   not capture: what the project owes the authors whose work it reconstructs beyond licence and
   credit (the courtesy letters suggest an ethic of *notification*); what "feature-complete"
   is allowed to mean (§4); whether accessibility in the disability sense (keyboard access was
   fixed, REVIEW §3) is a principle or an incident.
5. **The inventory's own fidelity marks.** Every entry marked `interpretation` or bearing an
   assistant origin is a claim the author has not yet made in his own words. The checkpoint
   between Step One and Step Two is where those markers get curated — after which, by the
   project's own rule for `generated:` files, they stop being the machine's to correct.
