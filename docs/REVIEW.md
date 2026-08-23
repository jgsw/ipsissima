# Ipsissima before release: an outside reading

Written 23 August 2026, as a reviewer who had not seen the code before would write it. Findings
acted on are marked **[fixed]** with the commit's subject; findings left standing are marked
**[open]** and say why.

The short version: **the code is in better shape than the project's own status note suggests, and
the documentation is unusually good.** The gaps that matter are not in the renderer or the
converters. They are in the corpus, in the untested paths, and in one problem the project names
honestly and has not solved.

---

## 1. Code quality, and where a library would do better

### What is already right

The JavaScript leans on established libraries at every point where it should: **CodeMirror 6**
for the editor, **dagre** for graph layout, **docx** for Word export, **markdown-it** for prose,
and the **official Argdown parser**, bundled unmodified. There is no reinvented parser, no
hand-rolled layout engine, no bespoke diffing. The one place a subset parser was tried is
recorded, along with what it silently dropped.

The Python's bespoke work — recovering paragraph structure from ink positions in
`pdf_to_source.py` — is the part most likely to look like reinvention, and it is the part with
the strongest evidence behind it. `eval/CONVERTER-FINDINGS.md` records `marker`, `docling` and a
local `llama.cpp` measured against a labelled repair set and removed, about 3.9 GB of
dependencies, because `pymupdf4llm` with `rapidocr` beat all of them at a fraction of the cost.
That is a better justification than most projects have for anything.

### Simplification found and taken

- **[fixed]** `check_argdown.py` spawned the Argdown CLI **twelve times** per run — 5.66s of a
  6.7s profile — three of them asking the same question. Memoised, and the selection-mode census
  made opt-in. *(Report the faults to a fix loop, not the whole census)*
- **[fixed]** `install.mjs` carried a workaround for Homebrew's keg-only rustup that
  `npm run build` — the command the README gives — did not have. One documented command worked
  and the other did not. Now shared. *(Take the library card out of the manuscript)*
- **[fixed]** Two names exported twice from the renderer's public surface, found by the
  typechecker on its first run.

### [open] The renderer is 3,800 lines in one file

`argdown-live-map.js` is the largest thing here by a wide margin, and it is one classic script
with no imports. That is deliberate — it is inlined into a single self-contained HTML file, and a
module graph would put a bundler between the source and what people double-click — but the
tension is real and should be named rather than defended. It is well-sectioned and the sections
have honest boundaries (indexing, filter, exposition layout, rendering, styles, export), so
splitting it into files that a build concatenates would be mechanical. **My advice is not to do
it yet.** The cost is paid by contributors, of whom there are currently none, and the benefit of
the single file is paid to readers, of whom there will be many.

### [open] `argdown_provenance.py`, 1,670 lines

The other large file, and the one I would look at first if it needed changing. Unlike the
renderer it has no single-file constraint forcing it, and it does several distinguishable jobs:
locating claims in a text, verifying quotations, Stern's misreporting checks, fidelity
derivation, and justificatory-debt measurement. Those are four modules wearing one name. Not
urgent; worth knowing.

---

## 2. TypeScript

**Assessed, and the answer is no — but typechecking, yes.** `tsc --noEmit` with `checkJs` now
runs over every shipped `.js` and `.mjs` as the first suite in the test run.

The evidence for the recommendation is the first run itself: **29 complaints over 10,000 lines,
of which exactly one was a defect.** The rest were DOM narrowing (`Element` where the code knows
it holds an `HTMLElement`) and the globals a classic script uses to find its neighbours — both
now declared or annotated, so the check is clean and CI can hold it there.

A 10,000-line JavaScript codebase that yields one real fault to a type checker does not have a
type problem. What it has is a *regression* risk, and `checkJs` covers that at no cost to the
single-file build. A conversion to `.ts` would introduce a compile step between the source and
the emailable HTML file, which is the property the whole design protects.

`strict` is off deliberately. Turned on, DOM narrowing alone buries the findings that matter.

---

## 3. Usability

Read against the usual interface guidelines — visibility of system status, match to the user's
world, user control, consistency, recognition over recall, error prevention, help.

### Strong, and unusually so

- **Every control carries a real `title`**, and the titles are sentences about the argument
  rather than restatements of the label: *"Ordered by what supports what — the main claim at the
  apex"*, not *"Reasons view"*.
- **The empty state teaches the one thing a new reader needs**: that a folder brings the
  manuscript and a lone file does not.
- **The vocabulary is the reader's.** *Reasons* and *Exposition* are philosophy's own pair — the
  order of reasons against the order of exposition — and they arrive already understood by the
  people this is for. The earlier names (*Argument* and *Manuscript*) implied the second was not
  the argument and collided with a pane name.
- **Status is stated, not implied.** The Argdown pane says where Save will put the file *before*
  an hour's work, not at the moment Save is pressed.
- **Help is a document, not a tooltip tour**: `help.md` is rendered into the panel, and opens on
  its contents rather than dropping the reader into the middle of the first answer.

### [open] Discoverability: controls hidden until a precondition is met

`Exposition`, `Notes`, `Manuscript`, `Find`, line numbers, fold and Save are all `hidden` until
something makes them applicable. That is defensible — a control that cannot work is worse than no
control — but it means the interface a first-time reader sees is not the interface, and they
learn what the program does by accident. **A disabled control with a tooltip saying what would
enable it teaches; an absent one cannot.** The Exposition button already does exactly this
(disabled rather than absent when the claims cannot be placed), which suggests the principle is
accepted and unevenly applied.

### [fixed] Keyboard access to the map

Claims and fold badges are now focusable (`tabindex`, `role="button"`, an `aria-label` read from
the claim's own text), operable by **Enter** and **Space**, with **Shift-Enter** for "show me the
passage this came from" — the keyboard equivalent of shift-click — and the context-menu key for
the menu right-click offers. Verified in a browser: Tab reaches the map, Enter folds, Shift-Enter
loads the manuscript.

The focus ring is an `outline`, deliberately, and not a change to the box's stroke: **the stroke
already carries fidelity**, so thickening or dashing it would say something false about whose
words the claim is in.

### [open] Undo on the map has no visible affordance

Comments are written on the map, where nothing has focus, and undo is reachable from the menu
and the keyboard but is not on screen. The desktop menu routes `Cmd-Z` to CodeMirror's history
deliberately and correctly; the browser build has no menu at all. This is the gap I would close
first.

### Visual coherence

Coherent, and quietly so: one icon set drawn inline at one weight, one neutral ink for the debt
sparkline chosen specifically *because* green and red mean support and attack a few centimetres
away, borders carrying fidelity rather than colour. The one thing I would question is how much
meaning the reader is asked to hold — border style *and* line style *and* tag colour *and*
sparkline position are four encodings at once. The help explains each; nothing on screen reminds
them. A legend, dismissible, would cost little.

---

## 4. Tests

**Twenty suites, and they are the best-argued part of the project.** Several are property tests
over a state space rather than examples: `test_fold_invariants.mjs` walks fold states at random
from a seed and checks named invariants; `test_layout_geometry.mjs` runs adversarial cases;
`test_argdown_positions.mjs` exists solely to police the drift between one rule implemented in
two languages. Each check is named as a sentence about the program, and most carry a comment
naming the bug that made them necessary.

**[fixed]** The corpus-driven suites named their samples in a list. Now they walk `samples/`, so
adding a sample strengthens the suite by itself — which is how the fifth sample immediately
produced a second reproducer for a bug that had only ever had one.

### [open] What is not covered

- **The desktop shell's Rust.** No tests. The host *adapter* is tested headlessly against a fake
  Tauri, which is the right 80%, but the queue that holds a double-clicked file until the webview
  exists — the one genuinely hard thing in `lib.rs` — is verified by hand.
- **The EPUB route has no sample.** `epub_to_source.py` is 313 lines and the corpus exercises
  none of it. Its shared tidier had two silent bugs found only when the HTML route was tried on a
  real page.
- **`split_manuscript.py` has no sample.** A book is the case it exists for and the corpus has no
  book.
- **The escalation path for a damaged PDF is untested end to end.** Of 398 CC-licensed candidates
  triaged from a real library, **none** was hard enough to need it: modern open-licensed articles
  are all born-digital. The hard case needs an old scan, which by its nature is not CC-BY. This
  is a structural gap in what an openly-licensed corpus *can* test, and worth stating rather than
  hoping about.

---

## 5. The corpus

**Five samples, up from three.** Carroll and Darwin (public domain), Wilson (the author's own),
and now Tooming & Jakapi and Prescott-Couch, both CC-BY and both verified against Crossref as
well as Unpaywall.

**Is it enough?** No, and it is worth being precise about what "enough" would mean. Sweeping a
12,000-item Zotero library found **411 CC-BY or CC-BY-SA articles with a stored PDF**, 147 of
them with an HTML snapshot as well — so the constraint is not supply. What the current five give:

| | covered |
|---|---|
| old scan, single column | Carroll |
| hand-made short text | Darwin |
| modern single-column journal PDF | Wilson |
| modern two-column journal PDF | Tooming |
| publisher HTML + PDF pagination | Prescott-Couch |
| **EPUB** | — |
| **a book, multi-chapter** | — |
| **a PDF needing OCR** | — |
| **a paper with tables or figures that matter** | — |

Four gaps, and the third is the one an openly-licensed corpus may not be able to close.

**What a sample costs.** Measured on Prescott-Couch, end to end: an 8,500-word source, a 36-claim
map with 21 verified quotations, and **two check-and-fix rounds**. The first check returned
fifteen findings and every one was a fidelity marker rather than a structural fault. The
reconstruction is the expensive step and it is a single pass of judgement over ~10k tokens of
source; the check loop is now cheap by design (221 words a round, 2.4 seconds). **On this
evidence a corpus of ten to twelve is affordable**, and the binding cost is not tokens but the
`map_quality.mjs` and fold-invariant suites, which run over every sample on every test run and
grow linearly.

---

## 6. Reconstruction quality: the unsolved problem

The project states this honestly and I will not pretend it is solved. Two things are worth adding.

**Two failure modes are already mechanically detectable, and the checker half-measures both.**
*Coverage* — the map reports where each claim sits in the text, so "hardly anything from §4 or §5
appears" is computable rather than impressionistic, and could be a check rather than a
paragraph a reader must notice. *Interpretive load* — the checker already computes, for each
contention, whether some route to it runs on reported material alone. Neither is a quality
measure, and calling either one would be worse than having neither; both are **necessary
conditions a bad reconstruction can fail**, which is a different and more honest claim.

**A cheap proxy for reliability that does not exist yet: inter-reconstruction agreement.** Map
the same paper twice, independently, and compare the structures — how many claims correspond, how
many relations agree, whether the contention is the same. This measures *reproducibility*, not
correctness, and reproducibility is not correctness. But it is measurable without a gold standard,
it needs no expert time per paper, and it would answer a question nobody can currently answer:
*is the process stable at all?* A method whose two runs disagree about what the paper argues
cannot be accurate, whatever else is true — so disagreement is evidence and agreement is only
the absence of one kind of evidence against.

**What would actually be needed** is a small number of reconstructions built by hand by someone
who knows the paper, treated as references, with a distance measure over maps. That is expensive
and slow and there is no way around it. The intermediate step worth taking first is to make the
*checkable* conditions checks, and to keep a public tracker of reconstructions that passed every
check and were still wrong — which is why that has its own issue template.

---

## 7. Release hygiene

**[fixed]** Publisher access stamps naming the downloading institution, in a shipped sample and
in every future ingest. Hard-coded `/Users/…` paths in two converters. Three of one author's
folder names baked into the file walker as things never to show a reader. A university's
reveal.js theme referenced as though it were a general case. `app/package.json` calling itself
`argdown-tools`, ISC-licensed, with a `test` script that exited 1. Stale workspace paths
throughout the notes. `python3 -m ipsissima_mcp.ingest` — the module's own first usage line —
raising `ModuleNotFoundError`. A top-level directory named `mcp/` shadowing the `mcp` SDK.

**[fixed]** Credit. Stern was load-bearing across four files and cited in none. Deep Drafter is
acknowledged as the workspace this grew inside, together with the finding — from comparing both
trees — that no code is shared.

**[open] The author's name is throughout, and should be.** `James Wilson` appears as the package
author, in the About panel, and as the author of one sample, which is his own paper. That is
attribution, not leakage. The only identifying material removed was what nobody chose to publish.

---

## What I would do before making it public

1. **Close the undo affordance gap** on the map. The keyboard-access half of this is done; undo
   is still reachable only from the menu and the keyboard, and the browser build has no menu.
2. **Add an EPUB sample and a book sample.** Two whole modules currently ship untested against
   anything real.
3. **Decide about the fold bug in public.** It is diagnosed, reproducible in one click, and
   documented with a reverted fix. Shipping with it is defensible; shipping without saying so
   would not be, and the project already says so.
