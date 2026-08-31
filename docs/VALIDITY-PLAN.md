# Checking that a named inference rule is telling the truth

Written 30 August 2026. The question: an Argdown inference line may name a rule —
`-- Modus ponens {uses: [1, 2]} --` — and **nothing checks it**. Not the parser, not
`check_argdown.py`, not the map, which draws the name on the bar and takes it on trust. No file
in the corpus names one, so nothing is wrong today; the question is what to build if they start.

The requirement that shapes the answer is that it must work **in the desktop app as well as in
Ipsissima-MCP**, so that editing a reconstruction can show a step shifting from valid to invalid
as it is edited. The app is a Tauri shell around `Ipsissima.html` — the same self-contained page
that runs in a browser and gets emailed — so "in the app" means **in the page**, not in Python.

Numbers below are marked. **[measured]** was taken on this machine on the date above;
**[reported]** comes from a project's own documentation or package registry; **[judgement]** is a
design call and is where to argue.

---

## 1. The verdict

**Write the checker; use Z3 in continuous integration to prove it right, and ship neither Z3 nor
any other solver.**

That is not the answer the question invites, so §3 makes the case against the four desiderata
rather than asserting it.

---

## 2. What is available, and what it costs

| | licence | maintained | size | runs in the page? |
|---|---|---|---|---|
| `z3-solver` (Python) | MIT | active | **73 MB** installed **[measured]** | no |
| `z3-solver` (npm, WASM) | MIT | active | **33 MB** in one `.wasm` **[measured]** | **no** — §2.2 |
| cvc5 | BSD-3 | active | ~10–12 MB wheel **[reported]** | no JS build |
| SymPy | BSD | active | **29 MB** **[measured]** | no |
| `logic-solver` (JS) | MIT | **last published 2015** **[reported]** | small | yes |
| written here | ours | ours | ~0 | yes |

**[measured]** `z3-solver` 5.1.0 into a clean 3.12 venv: 73 MB. `z3-solver` 5.2.0 from npm: a
7.7 MB tarball unpacking to 34 MB, of which `build/z3-built.wasm` is 33 MB. SymPy: 29 MB, and it
does decide propositional validity correctly (`satisfiable` over premises-and-negated-conclusion).

### 2.1 The proportions

**[measured]** The MCP's Python environment is already **473 MB** — cv2 121 MB, PyMuPDF 113 MB,
onnxruntime 77 MB, rapidocr 32 MB. Z3 would be +15% and the fourth-largest package. On that side
of the house the size objection is real but not fatal.

**[measured]** `Ipsissima.html` is **2.5 MB**, and it is the file people email each other. A
33 MB WebAssembly blob is a fourteenfold increase in the artifact the project is named for.

### 2.2 Z3 cannot run in the page, for a second and independent reason

From the npm package's own README **[reported]**:

> The package requires threads, which means you'll need to be running in an environment which
> supports `SharedArrayBuffer`. In browsers, in addition to ensuring the browser has implemented
> `SharedArrayBuffer`, you'll need to serve your page with special headers.

Those headers are COOP/COEP, and **a page opened from `file://` has no headers at all**. The
central promise of `Ipsissima.html` is that you can be sent it and double-click it. There are
community single-threaded Z3 WASM forks; they are forks, and adopting one trades desideratum (b)
for desideratum (d).

### 2.3 The JavaScript solvers are abandoned

**[reported]** `logic-solver` — which `sat-solver` and most tutorials wrap — was last published
ten years ago. `propsat` is three years old. There is no actively maintained JS SAT package.
**Adopting one fails "well maintained" harder than writing our own**, which would at least have
somebody answering for it.

---

## 3. The case, against the four desiderata

The fragment actually needed is small, and that is what makes this tractable.

- **Propositional** — modus ponens and tollens, hypothetical and disjunctive syllogism,
  constructive and destructive dilemma, contraposition, De Morgan. Decided **completely** by a
  truth table. A step with 8 distinct atoms is 256 rows; real steps have two or three.
- **Monadic / syllogistic** — Barbara, Celarent, universal instantiation. Monadic predicate logic
  has the finite model property, so a formula with *k* predicates is satisfiable iff it is
  satisfiable in a model of size ≤ 2^*k*. Brute-force model search, and the models are tiny.
- **Full first-order with relations** — undecidable. Z3 does not rescue this either: it returns
  `unknown` on quantified formulas often enough that it could not be relied on.

Against the desiderata:

**(a) Licence.** Ours. Nothing to reconcile, on either side of the house.

**(b) Well maintained.** A file in this repository beats a package abandoned in 2015. This is the
desideratum that most decisively rules out the JS options, and it is the one that usually argues
*for* adoption.

**(c) The standard tool professionals would use.** **[judgement]** For SMT generally that is Z3 or
cvc5, and if the job were "decide arbitrary quantified formulas over arithmetic" the answer would
be Z3 without hesitation. But the job is deciding validity in a fragment where **the truth table
is the standard complete decision procedure** — it is what every logic textbook teaches, Aldisert
included. Using it is not a compromise with the standard; it is the standard.

**(d) Install size.** Zero, in the page and in Python alike.

And only this option satisfies the requirement that prompted the question at all: **live
re-checking as somebody edits, in an emailed file.**

### 3.1 Where Z3 does earn its place

**As a development dependency, never shipped.** Generate a corpus of random formulas and steps,
decide each one both ways, and fail the build on any disagreement. Differential testing against
the industry-standard prover gives the correctness assurance without putting 73 MB into anybody's
install.

Z3 rather than cvc5 for that role, for a reason beyond the toss-up: it is what
`debatelab/argdown-feedback` uses, so the same files can be cross-checked against Gregor Betz's
verifiers — see `ipsissima-mcp/eval/argdown-feedback/README.md`, which found that suite's logical
handlers do discriminate, given formalizations.

### 3.2 Why this is not the argument CREDITS.md rejects

`CREDITS.md` says Ipsissima bundles the official Argdown parser and never substitutes one of its
own, because a subset parser silently dropped arguments, premise-conclusion structures and
undercuts. That reasoning does not transfer. **A notation is somebody else's and can only be
discovered empirically; a decision procedure is a theorem.** Truth-table completeness for
propositional logic is proved, not observed, and §3.1 is how it stays honest anyway.

---

## 4. What to build

### 4.1 The data, borrowed rather than invented

Use **`{formalization: "p -> q", declarations: {"p": "...", "q": "..."}}`** — the keys
`argdown-feedback` already reads. No new vocabulary, nothing for a reader to learn twice, and a
second opinion is always one command away. This is the same reasoning that kept `uses` rather
than switching to DebateLab's `from`, in the other direction.

### 4.2 Only a named rule invites the check

**This is load-bearing and is the reason the feature is safe.** `reconstruction-cheatsheet.md` is
emphatic that most philosophical argument is **conductive** — independent considerations weighed,
premises that do not entail the conclusion — and that "recording a conductive argument as if its
premises entailed its conclusion overstates what the author claimed". A validity checker run over
every map would report most good reconstructions as invalid for failing to be something they never
claimed to be.

So: a bare `-----` claims nothing and is never checked. `-- Modus ponens --` claims deductive
validity and is checked. **The rule name is the trigger**, which turns it from decoration into the
thing that says *this step is worth formalizing* — and means a handful of steps get formalized
rather than all of them.

### 4.3 Tiers

1. **Propositional.** Validity, premise relevance (drop one and re-test), premise consistency.
   Ships in the page and in the MCP. This is the whole of the first release.
2. **Monadic / syllogistic.** Small-model search. Still no dependency.
3. **Full first-order.** Do not. If it ever matters, Z3 as an *optional* MCP-only extra,
   documented as sometimes answering "unknown".

### 4.4 What the reader sees

The bar already carries the rule name and the map already re-renders as the Argdown is edited, so
the bar gains a third state — **checked valid**, **checked invalid**, **not checked** — and a step
shifting from one to the other becomes visible as it happens. A truth table over three atoms is
microseconds, so this can run on every debounced keystroke. **A threaded 33 MB WASM module could
never do this in a file somebody was emailed**, which is the clearest statement of why the small
answer is the right one here.

`check_argdown.py` reports the same thing as a fault, and reports a **named rule with no
formalization** as a `?`. That mirrors the fidelity story deliberately: a claim the reconstructor
makes about their own work with nothing checking it drifts — 38 of 126 markers were wrong across
six reference reconstructions, always in the same direction.

---

## 5. Risks, and what would make this wrong

**Two implementations will diverge.** This is the real maintenance cost, and it is larger than the
algorithm. The mitigation is a shared file of test vectors that the JavaScript and the Python must
both pass, in the spirit of `app/test_source_pane.mjs`, which lifts its function out of the
shipped template rather than keeping a copy that can drift.

**Formalizing is work, and it is the reconstructor's.** Most steps will not carry a formalization,
and that is fine — they are simply unchecked, exactly as today. If it turns out nobody ever writes
one, this feature was not worth building, and the cheapest way to find out is §4.3 tier 1 alone.

**A valid step can still be a bad reconstruction**, and vice versa. This checks the argument's own
form, which is the *systematic correctness* half of the distinction in `ipsissima-conventions.md`
§4. Ipsissima's existing checks are the other half, exegetical adequacy. Neither answers the
other's question, and the map must not imply that a ticked step is a faithful one.

**If a real first-order need appears**, this plan does not stretch, and §4.3 tier 3 is the
admission. That would be the moment to reconsider Z3 on the MCP side — where 73 MB against an
already 473 MB environment was never the objection anyway.

---

## 6. Not decided here

- Whether to check that a step **is the rule it names** — that "Modus ponens" is modus ponens
  rather than merely valid. That is pattern-matching on form, a different and larger job than
  entailment, and nothing above depends on it.
- What the invalid state looks like on the map. `docs/` has no design for a third bar state yet.
- Whether the MCP should offer `argdown-feedback` as an optional second opinion, which is a
  separate question with its own answer in `ipsissima-mcp/eval/argdown-feedback/README.md`
  (short version: not without pinning the official parser behind it).
