# Test suite speed audit — 21 Nov 2026

Measured on CI (run 44895021341, `ubuntu-latest`, 4 vCPU) and locally (M4, 10 cores), at a4e7dda.

## Outcome (built the same day)

Items 1–5 below are done. The whole suite at `--jobs 4` (CI's width) now takes **4.2 min locally,
against 18 in series**, and 2.6 min at the local default of one job per core (10). All 76 entries pass, and no check was removed: the browser suite's four parts
report the same 432 checks as the single run, with the same 4 invariants proved able to fail. CI is
not measured yet. Its cores are slower, so expect somewhat more than 4.2 min there.

| suite | before | after | how |
|---|---|---|---|
| fold invariants | 163 s | 67 s alone | `kids` and `collapsedRepr` memoised in `filterOnce`; the walk reuses the state it has. Output byte-identical |
| fold state identifier | 15.6 s | 11.4 s | the same renderer change. Output identical |
| the mechanism and the appraisal (py) | 103 s | 59 s alone | three JSON exports per checker run now go through `export_json`'s memo. 70 checker reports across samples and fixtures identical |
| the rendered map (browser) | 306 s | 4 parts of 71–95 s, side by side | `--part light/dark/checks1/checks2`; waits converted to `settle` |
| other browser suites | | 5–15% faster each | `settle` in place of fixed sleeps after clicks and loads |

What else changed, and why:

- `run_all_tests.mjs` runs the suites in parallel, slowest first. It holds each suite's output and
  prints the blocks in file order. It forces `IPSISSIMA_CHECK_LOG=off` for every suite.
- Running in parallel turned up a real race. `build_argdown_viewer.mjs` wrote its intermediate bundles
  under fixed names in `app/`, so two builds at once deleted each other's (`ENOENT .md-bundle.js`).
  The names now carry the process id.
- `test_argdown_shim.mjs` builds the shim into a temporary folder (`build_argdown_shim.mjs --out-dir`)
  instead of rebuilding the committed file in place. It now also checks the NOTICE, which it used to
  rewrite without restoring. That comparison was shown able to fail.
- `app/browser_settle.mjs` replaces the fixed sleeps after clicks and loads (210 sites). It wraps the
  page's own `setTimeout` and `requestAnimationFrame`, so it waits for **every timer due within the
  old sleep's length**, every animation frame, every finite CSS animation, and 120 ms of no change to
  the document. Then it returns, never later than the sleep would have. A first call on a page is a
  full sleep, because the timer record has to exist before the action. The 18 sleeps that follow typing
  or sit inside a held press were left fixed, out of caution.
- The saving from `settle` was smaller than item 2 predicted. After Open, the map really is moving for
  about 870 ms (a glide runs up to 700 ms), so the 900 ms sleeps were not padded much. The larger gain
  came from splitting the browser suite.

### On CI, and then three machines

The first CI run after this (44915561735) passed in 9.6 min overall, with the suite step at 8.5. The
runner was saturated: running four at a time, the suites took 33.5 min of suite time inside 8.5 min
of wall clock. So CI now runs the same command on three machines, each taking `--shard K/N` of the
list. Every way that splitting could go wrong quietly is designed out, and the reasons are in the
header of `.github/workflows/tests.yml`:

- **No suite falls between shards.** `run_all_tests.mjs` computes the division from its own list:
  heaviest first, each to the least-loaded shard. Checked for N = 1–5, every suite lands in exactly
  one shard. The workflow names no suite.
- **N is never written twice.** It is `strategy.job-total`. Dropping a matrix entry makes the rest
  re-divide to cover everything, and a part numbered past the total is refused.
- **A failure cannot merge.** Branch protection requires a check called `suite`, which is now a job
  that passes only if every shard did. It runs `if: always()`, because GitHub counts a *skipped*
  required check as passed. Without it, a failed shard would skip `suite` and the PR could merge.
- **Every failure is shown.** `fail-fast: false`, so one red shard does not cancel the others.

The price: setup (apt, pip, Chromium, about a minute) runs three times, and a stale weight in
`WEIGHT` leaves the shards uneven. That costs minutes, never coverage.

The analysis as it was written before any of this follows.

## Where the time goes

CI median by month: **6.1 min (Aug) → 10.1 (Sep) → 22.6 (Oct) → 24.4 (Nov)**. Setup is under
a minute; the single `run_all_tests.mjs` step is 22 min. It runs 74 suites **one after another**.

| Suite | CI | Local | What it is spending the time on |
|---|---|---|---|
| the rendered map (browser) | 322 s | 306 s | **211 s of fixed `waitForTimeout` sleeps** (400 calls) |
| fold invariants | 247 s | 163 s | `filterGraph` recomputed, mostly in the product's own fold walk |
| the mechanism and the appraisal (py) | 161 s | 103 s | 106 checker runs × 4 Node spawns each |
| suppositions and contraposition | 91 s | 89 s | 39 s of fixed sleeps; 11 viewer builds |
| the mechanism arrangement | 87 s | 77 s | 107 sleep sites; 39 spawns (checker + builds) |
| designed against the misreading | 74 s | 69 s | **52 s of fixed sleeps** of 72 s |
| everything else (68 suites) | ~5 min | ~4 min | mostly under 30 s each |

The top six are 77% of the run. Two facts stand out:

- **The browser suite takes about as long on an M4 as on CI's 4-core runner** (306 s vs 322 s).
  Faster hardware cannot help a suite that is mostly sleeping.
- **The suites that walk every sample grow by themselves** (fold invariants, the rendered map in
  both schemes, the shim comparison, map quality). That is deliberate ("adding a sample strengthens
  this suite by itself") and worth keeping, but the fold cost rises faster than the node count:
  Prescott-Couch (191 nodes) alone is 70 s of the 247 s.

The time is going on waiting and on repeating the same computation. I found no sign that duplicated
assertions are what makes the run slow, so nothing below drops a check.

## Recommendations, in order of value per unit of risk

### 1. Run the suites in parallel (no test changes)

`run_all_tests.mjs` uses `spawnSync` in a loop. Run them with a pool of `os.availableParallelism()`
workers instead. Buffer each suite's output and print it whole when that suite finishes, so the log
stays readable. Keep the same list and the same PASS/FAIL summary: one definition of "the tests" still
holds. Scheduled longest-first on CI's own timings:

| workers | CI wall time |
|---|---|
| 1 (today) | 21.9 min |
| 2 | 11.0 min |
| 4 (CI's runner) | **5.5 min**, the floor being the browser suite alone (5.4 min) |

Two things have to be fixed first:
- `test_argdown_shim.mjs` rebuilds the **committed** shim in place and puts it back afterwards. In
  parallel, the Python suites could read the half-rebuilt file. Build to a temp path and compare that.
- Fixed sleeps under CPU contention become flakes. That is why item 2 comes next. As a stopgap, run
  the browser suites at concurrency 2 and everything else at full width.

### 2. Wait for a condition instead of sleeping (faster, and more rigorous)

The fold animation is 350 ms (`DEFAULTS.duration`), but the browser suites sleep for 900–1600 ms after
each click. A fixed sleep is also a weaker test. It passes or fails on timing, and it can sample
the page halfway through a transition on a loaded machine. The fix:

- The renderer marks when it is done, e.g. `#map[data-settled]` set after layout and transition end,
  or a `window.__IPS_RENDERS__` counter. Tests then `waitForFunction` on that. The editor already does
  this with `readbackCount()`.
- Contexts open with `reducedMotion: "reduce"`, which the template already honours, so most transitions
  disappear.
- Convert one suite at a time. Each suite's mutation self-tests show whether it still catches what it
  caught before.

Estimate: the browser suite falls from about 307 s to about 100 s. Clarity and suppositions shrink by
the 52 s and 39 s they spend sleeping. Then split the browser suite's 22 independent `*Checks(browser)`
groups and its per-map loop across 3–4 concurrent contexts in the one browser. That lowers the floor
that limits item 1.

### 3. Fold invariants and fold-state id: two exact changes (measured)

On a scratch copy, at 300 steps over all samples, with byte-identical output (same check counts, same
verdicts on every map and view):

| change | fold invariants | fold state id |
|---|---|---|
| as committed | 53.6 s | 15.6 s |
| memoise `kids()` and `collapsedRepr()` within one `filterOnce` (renderer) | 39.6 s | 11.4 s |
| + the walk passes the state it already has to `step()`, instead of re-filtering it | **21.3 s** | — |

```js
// src/argdown-live-map.js, in filterOnce — both are pure within one call
const kidsMemo = new Map();
const kids = id => { let k = kidsMemo.get(id);
  if (!k) { k = (ix.childrenOf.get(id) || []).filter(c => passes.has(c)); kidsMemo.set(id, k); }
  return k; };
const reprMemo = new Map();
const collapsedRepr = id => { let r = reprMemo.get(id);
  if (r === undefined) { const chain = groupChain(ix, id).filter(g => S.collapsedGroups.has(g));
    r = chain.length ? "group:" + chain[chain.length - 1] : id; reprMemo.set(id, r); }
  return r; };

// test_fold_invariants.mjs
function step(graph, state, action, apex, byText, known) {
  const before = known || filterGraph(graph, state);
// …and pass vis0 / vis at the three call sites
```

Projected CI time for the fold invariants: 247 s → about 100 s. The renderer change also makes every
redraw of a large map in the app faster, since `filterGraph` runs on each fold.

One thing to check: no invariant may mutate the `before` it is handed, since that object is now reused.
None does today; `Object.freeze` in the test would make that enforced.

Next, if needed: one worker thread per map. Prescott-Couch alone is about 30% of the suite.

(Replacing the walk's `queue.shift()` with an index was tried. It made no difference, because the queue
is short.)

### 4. The checker spawns Node four times where two will do

One checker run on a small fixture takes 0.8 s. 0.67 s of that is four parser processes: `map --format dot`
once, and `json` **three times** on the same file. `export_json()` is already memoised, but
`provenance_report()` (`check_argdown.py:1654`) and the "JSON cross-check" (`:3268`) export again
without going through it. Routing both through `export_json` (with a `copy.deepcopy` for provenance,
which mutates the document via `apply_defaults`) saves about 0.3 s, or 40%, on **every** checker call.
That covers:

- `test_mechanism.py` (106 runs), the mechanism view, frames, Stern cases, the census;
- the fidelity pass inside every viewer build;
- and users' `argdown_check` fix loop, outside the tests.

`test_mechanism.py` could also run its 106 independent checks through a thread pool, since they are
subprocess-bound.

### 5. Stop the tests writing to the checker ledger (not speed: data quality)

Every checker run appends to `~/.ipsissima/check-log.jsonl`, the ledger meant to show which mistakes
models make in real fix loops. 21,859 of its 54,343 lines are the test fixture `brief.argdown`, and the
next nine most frequent are test fixtures too. `run_all_tests.mjs` should set `IPSISSIMA_CHECK_LOG=off`
for its children.

### 6. Tiers: probably unnecessary after 1–4; if wanted, add rigour

Items 1–4 together project to about **4–5 min on CI**, a little less locally. At that point a "quick"
tier is a convenience, not a need. If one is still wanted, the version that **raises** rigour is a
nightly scheduled job that runs the fold walk at more steps with a **new seed each night**, printing the
seed. Per-push keeps the fixed seed, so it stays reproducible.

Avoid test selection by changed files. The py/js parity suites exist to catch the cross-boundary drift
that such selection would skip.

### Not worth doing

- Caching viewer builds: 0.5–0.8 s each, of which esbuild is 35 ms; about 100 builds per run, all
  parallelisable anyway.
- CI setup (apt, pip, Playwright install): about 50 s in total.

## How this was measured

- CI: per-line timestamps of the job log, split at the runner's `====` suite headers.
- Local: a copy of the runner that times each suite (`spawnSync` with piped output). All 73 suites
  passed.
- Sleeps: a preload that wraps Playwright's `waitForTimeout` and totals the requested milliseconds.
- Fold experiments: a scratch copy of `app/` with the two files patched, its output diffed against
  the unpatched run.
