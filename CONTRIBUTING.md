# Contributing

Ipsissima is early and small, and the most useful contributions are not code.

## The three things most worth sending

**A reconstruction that is wrong in a way the checker did not catch.** This is the top of the
list and it is not close. `check_argdown.py` can verify that a quotation is verbatim, that a
claim can be placed in the text, and that a departure from the text carries a reason. It cannot
tell a good reading of an argument from a bad one. Every case where a map passes every check and
is still a misreading is evidence about what a better check would have to notice — and there is
an issue template for exactly this.

**A sample.** `samples/` has five reconstructions and wants more. The constraint is the whole
difficulty: openly licensed *and* machine-readable *and* worth reconstructing. See
[samples/README.md](samples/README.md) for what a folder needs. `test_fold_invariants.mjs` walks
that directory rather than naming files, so **adding a sample strengthens the test suite by
itself** — which is why the corpus is worth growing even when nothing is wrong.

**A document that converts badly.** The ingest side has been measured against perhaps fifty
papers. Fifty is not many, and the failures that matter are the quiet ones.

## Running everything

```bash
node app/run_all_tests.mjs
```

Twenty suites: the renderer's fold logic and layout geometry, the exposition arrangement, the
one-file bundle, the desktop host adapter, the converters, the provenance rules in both
languages, and a typecheck. It takes about two minutes.

**One suite is expected to fail.** `fold invariants (state space)` reports a real defect,
diagnosed in [KNOWN-ISSUES.md](KNOWN-ISSUES.md), and is left failing rather than quietly weakened.
CI allows that one and no others. If you fix it, please also update KNOWN-ISSUES.md and the
expected list in `.github/workflows/tests.yml`.

## Setting up

```bash
python3 -m venv .venv && .venv/bin/pip install -e ipsissima-mcp
cd app && npm install
```

A virtual environment is not fussiness: a Homebrew or system Python refuses `pip install`
outright ([PEP 668](https://peps.python.org/pep-0668/)), and the suite prefers `.venv/bin/python3`
when it finds one.

The desktop application additionally needs Rust. `npm run build` in `app/desktop` says so, with
the fix, if it is missing.

## House conventions, which are unusual and deliberate

**Comments say why, not what.** Nearly every non-obvious block in this codebase carries a note
explaining the decision behind it, usually including what was tried first and how it failed.
That is not decoration: several of these files exist in their present shape because something
failed *silently*, and the note is the only record of it. A change that removes a guard should
say why the failure it guarded against cannot happen any more.

**A tool that mishandles something quietly is worse than one that says what it did.** This is the
rule the ingest side is built on. A converter reports every route it tried and every line it
dropped; a checker that cannot decide says so rather than guessing. Silence is the failure mode
this project takes most seriously, because there is nothing for a reader to notice.

**Tests are meant to be read as much as run.** Each check has a name that is a sentence about the
program, and most carry a comment naming the bug that made them necessary. A new test is welcome;
a new test whose failure message explains what is wrong is better.

**The single-file build is a constraint, not an accident.** Ipsissima is one self-contained HTML
file that opens by double-clicking and makes no network requests. Anything that would put a
bundler, a CDN or a server between the source and the reader is a bigger change than it looks —
see [app/tsconfig.json](app/tsconfig.json) for why even the typechecker does not emit.

## Licence

Ipsissima is GPL-3.0-or-later. By contributing you agree your contribution is licensed the same
way. If you add a sample, the text it carries must be redistributable and its licence must be
named in the folder's README **and in the source file itself** — a reconstruction can be sent as
a single file, at which point the source file is the only thing carrying the attribution.

Please do not add anything you do not have the right to redistribute, however useful it would be
as an example.
