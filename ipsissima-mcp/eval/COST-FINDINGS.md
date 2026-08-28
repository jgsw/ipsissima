# What a reconstruction actually costs, and where the time goes

*Measured 27 August 2026, against the six maps in `samples/` and the two A/B arms in
`eval/baseline-instructions/`. Every number here is reproducible from a command in this file.*

The A/B test of the rewritten instructions improved the maps and did not make them cheaper or
faster. This asks why, and the answer is that the thing being optimised was not the thing costing
the money.

---

## The premise that was already true

The proposal was to default the checker to `--only-problems`. On the MCP path **that is already
the default and has been**: `check_reconstruction` runs `--format json`, and `--format json`
implies `--only-problems` and also switches off the six extra CLI spawns that the selection-mode
census needs. `SKILL.md` tells command-line users the same thing. There was nothing to switch on.

The saving is real but small, and smaller than the earlier report suggested — the checker itself
got faster in the meantime, so the gap it was measured against has closed:

| mode | wall | words | bytes |
|---|---|---|---|
| bare | 4.6s | 682 | 5,427 |
| `--only-problems` | 1.9s | 284 | 1,992 |
| `--format json` | 2.0s | 372 | 3,293 |

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/check_argdown.py \
    "samples/Darwin 1859 - Natural selection/darwin-natural-selection.argdown" \
    --source-root "samples/Darwin 1859 - Natural selection" --no-fix --format json
```

**Against a run that spends minutes writing ten thousand output tokens, two and a half seconds a
round is between one and three per cent.** That is the whole finding about the checker.

## But the short form was losing something, and now does not

There was a downside, and it was not the one to expect. `--format json` prints the `FINDINGS`
list, and five of the checker's observations were printed as prose and never registered as
findings at all. So the fix loop could not see them:

- **thin inference steps** — a bar resting on one claim, which usually means a missing premise
- **spliced claims** — a claim joining two passages far apart in the source
- **a warrant on something not marked as a departure**
- **a reading-policy value outside the vocabulary**
- **fidelity that claims less than the words earn** — the very case `extraction-prompt.md` uses
  to explain what a `?` is

On three of the six sample maps the prose report raised a `?` that the JSON channel did not
carry. Meanwhile the prompt told the model to weigh `?` findings against a channel that had none
in it, and described the distinction as though it were observable.

**Fixed by registering all five as `?` findings** rather than by sending anyone back to the full
report. The stop condition is untouched — `ok` is still `not any(severity == "!")`, so the loop
still halts on faults alone and the new findings are advisory. The short form now carries strictly
more than it did, at 3,293 bytes against the census's 5,427:

```bash
python3 ipsissima-mcp/eval/check_patterns.py     # once the ledger has runs in it
```

There is no speed-against-quality trade here to surface, because the asymmetry that would have
made one was a defect rather than a design.

---

## Where the money actually goes

Measured on Akhlaghi, which is a typical paper rather than an extreme one:

| | tokens | what it is |
|---|---|---|
| the three reference documents | ~13,500 | read before writing any node, every run |
| `extraction-prompt.md` + `SKILL.md` | ~3,200 | the instructions themselves |
| the source text | ~9,000 | read at least once |
| **the map written out** | **~10,600** | **output** |
| each check round | ~650 | output of the checker, read back |

Input and output are not comparable. Output tokens are generated serially and are what wall-clock
time is made of; input tokens are processed in parallel and, on a warm cache, cost a tenth of what
they look like they cost. **A 42 KB map is the floor on how fast a reconstruction can be**, and
nothing that leaves the map the same size will make a material difference to how long it takes.

That is why better instructions did not make it faster. They were never going to. The two arms of
the A/B differ by 2.4% in bytes — 41,330 against 42,372 — so they cost within a rounding error of
each other to write, and the whole of the improvement was in what those bytes said.

## Two-fifths of every map is metadata

```
file                                        total     meta  source:    meta%
akhlaghi-revelatory-autonomy.argdown        42372    19098    12866      45%
carroll-tortoise-achilles.argdown            8993     3579      829      40%
darwin-natural-selection.argdown            14983     6153     1640      41%
prescott-couch-reverse-engineer.argdown     23907     9957     2834      42%
tooming-jakapi-aphantasia.argdown           21302     7964     4160      37%
wilson-williams-dewey.argdown               21157     8260     1923      39%
```

On Akhlaghi the `source:` fields alone are **30% of the entire file** — 12,866 characters of
verbatim quotation, median 143 characters each, that the model copies out of the text it has
just read.

**This is the largest single lever there is, and it is also the one place where speed and the
project's purpose pull against each other.** A quotation is not only a locator: it is the
*ipsissima verba*, the thing a reader sees on the claim, and the reason the border can be drawn
as solid rather than believed. Shortening it makes the map cheaper and the evidence thinner.

What is worth measuring before deciding anything: **how short a quotation can be and still pin
its claim uniquely in the source.** If the median 143 characters could be 40 without losing the
pin, the question becomes an honest one about how much quotation a reader needs, rather than a
guess. That measurement needs `argdown_provenance.py`'s own matcher rather than a naive substring
search — the `source:` fields carry the claim's own quotation marks, which are not in the text —
and it has not been done. **It is the first experiment to run.**

---

## The instrument that was missing

Nothing anywhere recorded what a reconstruction cost, and nothing recorded what the checker found
on the way. Both absences matter, and the second is worse.

**The corpus cannot tell you what goes wrong.** Every map in `samples/` passed before it was
committed, so the corpus records the destination and never the route. The mistakes happen inside
the fix loop and are edited away within minutes. The evidence that would improve the instructions
is destroyed by the process that would have used it — which is why "what kinds of Argdown error
send the file back to the model?" could not be answered from anything in this repository.

So `check_argdown.py` now appends one line per run to `~/.ipsissima/check-log.jsonl` — the
basename, a content hash, the elapsed time, the shape, and the checks that fired. No content ever,
and it lives outside any repository so it cannot be committed by accident.
`IPSISSIMA_CHECK_LOG=off` disables it; setting it to a path moves it.

`eval/check_patterns.py` reads it back and reports **rounds to clean** (the same file with a
changing hash is the next round of one loop; the same hash twice is a re-run and is not counted),
**recurrence**, **what the first check of each file found** — the only uncontaminated measure of
how good a draft is before feedback — and **parse failures**.

Ask again in twenty reconstructions. Until then any claim about which mistakes recur is a
recollection, not a measurement.

## What is already known about parse failures

One class is documented and is the one a model actually hits: **a YAML error inside a `{…}`
metadata block or the `===` front matter**. `app/test_parse_failure.mjs` pins the behaviour — the
parser does not throw, reports zero parser and zero lexer errors, and returns an *empty document*.
On the Darwin sample one stray character after a closing brace takes 23 claims to none with
nothing raised anywhere.

The CLI does catch it, so `check_argdown.py` reports it correctly. But the detail it passed on was
1,200 characters of which some 950 were a JavaScript stack trace through `node_modules`, and
truncating at 1,200 sometimes cut off the caret line that says *where*. Cutting at the first stack
frame instead leaves 184 characters, all of them signal:

```
YAMLException: end of the stream or a document separator is expected (1:391)

 1 |  ... lume)", reviewed: "2026-08-18"}Z
-----------------------------------------^
```

---

## The levers, in the order they are worth trying

1. **Faster output on the same model.** The dominant term is output tokens generated serially, and
   this is the only lever that attacks it without changing a single thing about the map. It is the
   same model, so there is no quality question to answer. Try it first.
2. **Shorter quotations, if the pin survives** — the measurement above. Potentially ~20% of output,
   and the one lever with a real trade to surface.
3. **Sonnet instead of Opus.** Cheaper and faster per token. Whether it holds the reading is
   exactly what `compare_reconstructions.py` was built to answer, and the experiment is
   well-defined: same source, same instructions, compare expressive range, provenance coverage,
   faults, and rounds-to-clean. The corpus gives six sources to run it on.
4. **Fewer round trips before the first node.** Three reference documents are three reads. Serving
   them as one resource removes two round trips, each of which re-sends the whole context.
5. **Less thinking.** Cheap to test with the same harness, and the riskiest of these, because
   reconstruction is the judgement half rather than the mechanical half.
6. **The checker.** Already at the fast tier. Worth one to three per cent.

Levers 3 and 5 need real generation runs and a human reading the maps afterwards. Levers 1 and 4
can be taken today. Lever 2 needs the measurement first.

---

## Two faults found while measuring

**The extraction prompt taught a call that does not exist.** It said
`check_reconstruction(argdown_path, source_root, format="json")`; the tool's parameters are
`path`, `source_root` and `full_report`. A model following it either errors and retries or drops
the argument — a wasted round trip on a prompt whose whole purpose is to save them. Corrected.

**The Darwin sample fails its own checker.** Nine claims are marked `interpretation` or
`imputation` with no `warrant`, and the file has never carried one. It is not a regression — the
map has been this way since the first commit. It is left as it is here because writing those nine
warrants is a judgement about Darwin's text and not a mechanical repair, but a shipped sample that
does not pass is a poor advertisement for the check.
