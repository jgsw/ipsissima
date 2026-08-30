# Does `argdown-feedback` tell a good argument from a bad one?

Run 30 August 2026 against `debatelab/argdown-feedback` at HEAD, with `run_battery.py` in this
folder. **The short answer is no — not on anything Ipsissima currently produces.** It checks
*form*, not cogency, and the checks that would catch bad reasoning need data Ipsissima does not
emit. The useful finding is the dependency chain that would change that.

`argdown-feedback` is **AGPL-3.0**, which is compatible with `ipsissima-mcp` (already AGPL-bound
through PyMuPDF) and **not** with `app/`. It is not vendored here. Install it separately:

```
uv pip install "git+https://github.com/debatelab/argdown-feedback"
```

## What was tested

The 7 public samples, the private reconstructions and Argdown's own sample maps (17 `.argdown`
files in all), plus two newspaper columns reconstructed specially as controls — chosen because
their reasoning is bad in ways a reader can name, so anything that detects argument quality
should separate them from Darwin and Carroll.

## Finding 1 — it rests on a reimplemented parser, and that parser rejects valid Argdown

**5 of 17 files would not parse at all.** Every one of them parses cleanly under Christian
Voigt's official parser, the one Ipsissima bundles and runs unmodified. `argdown-feedback`
depends on `pyargdown`, a separate implementation, which rejected:

| construction | example | file |
|---|---|---|
| tag on a proposition reference in a PCS | `(1) [The Weltanschauung] #reported` | Prescott-Couch |
| tag on an argument reference in a list | `- <Editors easier> #pro-editor` | Word vs argdown |
| markdown link inside statement text | `[here](https://…)` | core argument of populism |
| HTML comment | `<!-- … -->` | **welcome to argdown** |
| relation line with adjacent reference | (see Williams) | Williams 1981 |

The fourth row is the one to note: `pyargdown` cannot parse the Argdown project's own tutorial
document. `CREDITS.md` already records why Ipsissima never substitutes a parser of its own — a
subset parser silently dropped arguments, premise-conclusion structures and undercuts. This is
the same hazard, and it fails loudly rather than silently, which is the better failure. But it
means **`argdown-feedback` cannot be adopted as a checker without pinning the official parser
behind it.**

## Finding 2 — nearly every failure is task-shape mismatch, not quality

It was built as a reward function for RL training, so its checks encode the shape of the
*training task*: one argument, no inline data, no sections, and either a map or a reconstruction
but never both. An Ipsissima map is none of those. Of the 19 non-logical checks, **8 fail on
almost every file by design** — including `NoPropInlineDataHandler`, which fails precisely
because a claim carries `fidelity`, `pinpoint` and `source`. The tool marks Ipsissima's whole
method as a defect. `run_battery.py` classifies every check so this noise can be set aside.

## Finding 3 — on the checks that do apply, the corpus is clean

Across the 12 files that parsed, **9 of the 10 SIGNAL checks failed zero times**: no duplicate
labels, no malformed premise-conclusion sequences, no dangling proposition references, no
missing labels. The tenth, `HasGistHandler`, flagged arguments carrying a label but no gist in
**Akhlaghi** and **Tooming & Jakapi** — a real if minor observation, and the only quality
finding the exercise produced about the samples.

## Finding 4 — the controls came back identical to the best samples

The two newspaper columns produced **exactly the same two findings as Darwin, Carroll, Akhlaghi,
Tooming, Wilson, Miller, Gettier and Horton**: missing inference data, and its consequence.
`argdown-feedback` did not distinguish a column running on an unstated premise it contradicts
two paragraphs later from Darwin on natural selection.

That is not a defect in the tool. It is what it is for. Nothing in the applicable suites asks
whether an argument is any *good*.

## Finding 5 — the checks that would ask are real, and are two steps away

The quality checks live in `LogRecoCompositeHandler`, which is skipped entirely because it needs
`{formalization: …}` and `{declarations: …}` inline data. Given those, it works. Tested directly:

| snippet | verdict |
|---|---|
| modus ponens | passes |
| affirming the consequent | **caught** by `GlobalDeductiveValidity` and `LocalDeductiveValidity` (Z3) |
| valid, with one premise doing no work | **caught** by `AllPremisesRelevant` |

So there is a dependency chain, and it is worth stating plainly:

1. **Emit `{from: ["1","2"]}` on inference lines.** Ipsissima writes bare `-----`, so every
   inference is implicit and 11 of 12 files fail `HasInferenceDataHandler` and, in consequence,
   `UsesAllPropsHandler`. This is a genuine gap independent of anything above: the map does not
   record which premises feed which conclusion.
2. **Then emit formalizations.** That unlocks deductive validity, premise relevance and premise
   consistency — the first checks in this tool that would say anything about argument quality.

Step 1 is cheap and worth doing on its own merits. Step 2 is a substantial change to what a
reconstruction *is*, and is exactly the "systematic correctness" half of the distinction in
DeepA2 §3.1 that Ipsissima has so far deliberately left alone.

## Reproducing

```
python run_battery.py --corpus ../../../samples -o results.json
```

`--corpus` is repeatable. The two newspaper columns are in copyright and are **not** in this
repository; they and their results live in the private working folder.
