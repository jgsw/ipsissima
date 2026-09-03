# Bringing the code into line: the values-alignment plan

Step Three's second half, drafted 3 September 2026. What has to change for the codebase to
match the revised framework, item by item — each with the principles that demand it, what
done looks like, and a cost. Held as a **proposal**: the author said his Step Three
instructions were likely to become more detailed, so the ordering below is a recommendation
built to be reordered, not a schedule.

> **Carried out the same day, on the author's instruction to start at item 1 and move
> forward.** Items 1–6 and 8–10 are done as specified, each with its verification run and its
> commit; item 7 stands at its own first stage — the design note is written into `viewer.md`,
> the feature deliberately not built. Two departures from the letter of the plan, both
> recorded where they happened: item 5's schema check exempts a line naming *several* rules (a
> compound derivation is not an instance of either schema), and item 8's wording went further
> than an audit after the author showed "reader's burden" is loaded the other way — the
> reader-facing surfaces now use the anticipated/prepared pair and temporal phrasing, and
> A7's amendment was re-amended to match. Item 10's second half concluded *verified, no
> change*: the DOI lookup is parameterised and named in `assess_pdf`'s own signature. The
> item-5 check's first pass over the corpus left one standing `?` on Miller for the
> reconstructor to judge.

Two standing rules govern every item. Per E6, any new check or instrument must be **shown to
fail** before it is trusted — the mutation that breaks it named in the test file. Per the
meta-principles (`THEORY.md` §5), any item that turns out to trade one principle against
another is settled by measurement where measurable, and its trade written down where not.

---

## The items, in recommended order

### 1. Make the CI truthful again — T2

Remove the `fold invariants (state space)` allowance from `.github/workflows/tests.yml`;
update `CONTRIBUTING.md` ("One suite is expected to fail" is no longer true) and the
KNOWN-ISSUES cross-reference. *Principles:* E4, E3 — the allowance is a hole that would turn a
real regression green. *Done when:* a deliberately broken invariant turns the workflow red
locally (`act` or a draft PR), and no document announces an expected failure. *Cost:* minutes.
*Confidence it should happen:* high, author-confirmed.

### 2. Make the MCP README truthful about updates — T3

Rewrite `ipsissima-mcp/README.md` §"Updating and removing it": the server ships
`check_for_updates` (server.py:677) — on request, nothing sent about the user, nothing
installed — and for bundle users it is the *only* way to learn a release exists
(`RELEASING.md` already says all of this correctly). *Principles:* E4, D6, C1's
precision-per-artifact case law. *Done when:* the two documents agree, and the sentence
"makes no network request of its own accord" — which is true — survives. *Cost:* minutes.
*Confidence:* high, author-confirmed.

### 3. Align the verdict wording with A11's display corollary — §4 residual (2)

The rule-label tooltip says "Checked: the conclusion does NOT follow"
(`argdown-live-map.js:3480`); the `!` badge already adds "on the formalizations given"
(line 3496). Add the qualifier to the label's string so no mark on the map states the verdict
without attributing it to the formalizations — the five-word display half of A11. *Done when:*
both strings attribute; the export text round-trip still passes. *Cost:* minutes.
*Confidence:* high.

### 4. Check the borders wherever the manuscript is present — T1

The substantial item. Derive `quotation`/`paraphrase` **in the page** on the paths readers
actually use — the desktop app, a folder dropped on the standalone viewer, a bundle — using
the tightened contiguous-substring rule `viewer.md` records as available ("four lines on top
of `ArgdownPositions.normalise`", 251/251 agreement with `--derive-fidelity`). Constraints
carried over unchanged: only the two factual levels are ever adjudicated; nothing is written
back to the `.argdown`; no verdict under 30 characters; where no manuscript is available the
borders stay as declared and the status line keeps saying so. *Principles:* A2, A11, F1 — and
the framework's clearest positive prediction. *Done when:* the status line on those paths
reads as checked rather than "as declared, not checked"; `test_argdown_positions.mjs` (or a
sibling) pins the in-page rule against `--derive-fidelity` over the whole corpus; the pin is
mutation-tested (damage `normalise`, watch it fail). *Cost:* small code, careful tests — the
rule exists, the work is wiring and pinning. *Confidence:* high, author-confirmed.

### 5. A wrong rule name gets a finding — §4 residual (1), A11's third instance completed

`check_argdown.py` reports a `?` when an inference line names one of the eighteen canonical
rules and the step's formalizations do not instantiate that rule's schema (propositional
tier only; unrecognised names exempt — they were never claims to a known form). The map's
display is unchanged for now: this is option (a) from `TENSIONS.md` §4, the report-side
remedy that fidelity had before `--fix` existed. *Principles:* A11's display corollary, E3
(the one silent self-claim left in the system), A2's precedent that instruction alone does
not keep labels honest. *Done when:* vectors in `validity-vectors.json` include a
modus-tollens-labelled modus ponens and the checker flags it — and, per E6, the check is
shown to fail when the schema table is broken. *Cost:* bounded — schema-matching eighteen
propositional forms, not general form-recognition (`VALIDITY-PLAN.md` §6's larger job stays
not-built). *Confidence:* medium-high.

### 6. Decide the hidden/disabled question per control, and write it down — T5

A short table in `viewer.md`: each gated control; hidden or disabled-with-tooltip; why.
Respecified F4 supplies the criterion: a disabled control must itself pass test (a) — it
earns its pixels by teaching a capability the reader would want and can obtain (Manuscript
is the clear case: "drop a folder and the text appears here" is the one thing a new reader
most needs to learn). Most of the rest likely stay hidden. *Principles:* F2, B1, F4(a);
meta-principle 2 — the point is that the policy be recorded, not that it land one way.
*Done when:* the table exists and the template matches it. *Cost:* an hour of judgement,
minutes of code. *Confidence:* medium.

### 7. A key that can be sent away — T6, reopened by respecified F4

The four encodings (border, edge, chips, sparkline) may now get the dismissible legend
`REVIEW.md` suggested and the flat no-clutter reading refused — built to the walkthrough
exemplar named in F4(b): it may introduce itself **once**, is exited in one action, stays
reachable from How to use, and its dismissal is remembered. Design note first, feature
second. *Principles:* F4(a)+(b), B1, F5. *Done when:* a first-run reader can learn the
encodings without opening help, and a returning reader never sees the key again unless they
ask. *Cost:* modest; the key content already exists as `relkey`/`fidkey`. *Confidence:*
medium — the author's respecification licenses it; his appetite should set its priority.

### 8. Audit the debt wording — T4, under amended A7

`help.md` and the exposition hovers: "owed", "debt", "earned" phrased so the burden is
always the reader's, never the author's fault — per the A7 amendment. The encodings
themselves (neutral ink, no verdict channel) already comply; this is prose only. *Done
when:* the reader-facing strings survive the test "could an author being shown their own
draft hear a grade?" *Cost:* small. *Confidence:* medium.

### 9. Test what ships: an EPUB and a book — T8

Close the two confessed E2 gaps within D3's constraint: a small EPUB fixture for
`epub_to_source.py`, and a public-domain multi-chapter book through `split_manuscript.py`
(the corpus manifest's other wants — an `.odt`, a `.tex`, a scan with no text layer — can
ride along where cheap). `fixtures/ingest/` is the home; `CORPUS.md` already states the
shape. *Done when:* both modules are exercised by the suite against something real, and the
fixtures' READMEs name licences. *Cost:* the finding and converting, mostly. *Confidence:*
high, author-confirmed.

### 10. Two small records

- A sentence in the Miller sample's README saying it ships deliberately unstamped so a
  future rebuild tests the `formalized:` loop end to end (D4 — a shipped exemplar doing
  quiet test duty should say so).
- Verify `plan_job`'s report names the DOI lookup before it happens; add the line if it
  does not (C3 — currently unverified either way).

*Cost:* minutes each. *Confidence:* medium.

---

## What deliberately does not change

Recorded so the plan's silences are decisions rather than omissions:

- **The renderer stays one file** — C2's adjudication stands, revisit trigger unchanged (the
  arrival of contributors). T7.
- **`argdown_provenance.py` stays whole until it next needs real change** — E7's claim is
  registered, not urgent. T7.
- **The countermodel's presentation stays** — behind a click, on an invoked claim only;
  B1 is served by the loudness gradient. §4 residual (3).
- **No name-verification on the map's display yet** — item 5 is the report-side remedy;
  escalation to display changes waits on evidence that `?` findings are not enough.
- **The four-encodings baseline stays** — item 7 adds a teaching aid, not a fifth channel.
- **Hidden controls that fail item 6's teaching test stay hidden** — F4(a) prevailing.

## The sequence, in one table

| # | item | principles | cost | confidence |
|---|---|---|---|---|
| 1 | truthful CI | E4, E3 | minutes | high ✓ |
| 2 | truthful MCP README | E4, D6, C1 | minutes | high ✓ |
| 3 | verdict wording | A11 | minutes | high |
| 4 | borders checked in-page | A2, A11, F1 | small code, careful tests | high ✓ |
| 5 | wrong-name finding | A11, E3, A2 | bounded | medium-high |
| 6 | hidden/disabled table | F2, F4(a) | an hour | medium |
| 7 | dismissible key | F4(b), B1 | modest | medium |
| 8 | debt wording audit | A7 amended | small | medium |
| 9 | EPUB and book fixtures | E2, D3 | finding + converting | high ✓ |
| 10 | two small records | D4, C3 | minutes | medium |

✓ marks verdicts the author confirmed at the Step Two checkpoint. Items 1–3 are an
afternoon's honesty; item 4 is the one that changes what a reader is shown; items 5–8 are
the framework newly earning its keep; 9–10 are debts already confessed elsewhere.
