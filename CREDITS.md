# Credit where it is owed

Ipsissima is a small program standing on several pieces of other people's work. Some of it is
code, some of it is a notation, and one of it is an argument in a journal article that changed
what this program checks.

---

## Argdown — Christian Voigt

Ipsissima is a reader and editor for **[Argdown](https://argdown.org)**, and would not exist
without it. The notation, the parser, and the model of what a reconstruction *is* — statements,
arguments, premise-conclusion structures, the four relation types — are Christian Voigt's.

Ipsissima **bundles the official parser and uses it unmodified**, so a file that parses here
parses everywhere Argdown does. It never substitutes a parser of its own: the one time a
lighter-weight subset parser was tried, it silently dropped `<arguments>`, premise-conclusion
structures and undercuts, and the maps it drew were wrong in ways nothing reported.

Argdown is MIT licensed. Ipsissima is an independent program, is **not endorsed by or affiliated
with the Argdown project**, and any defect here is this project's, not theirs.

## ArgVu — Peter Stahmer, funded by the KIT Debatelab

The notation is set in **ArgVu**, the Argdown project's own typeface, designed by Peter Stahmer
with funding from the [KIT Debatelab](https://debatelab.philosophie.kit.edu/). Bundled under its
own licence — see `app/vendor/ArgVu/LICENSE.md` and `PROVENANCE.md` beside it.

## dagre — the dagre contributors

Map layout is **[dagre](https://github.com/dagrejs/dagre)**, MIT licensed, vendored at
`app/vendor/dagre.min.js` with its licence beside it. Ipsissima runs the layout in the browser so
that folding a section makes the map re-flow rather than leaving a hole; everything above the
layer that assigns ranks and orders is this project's, and everything at it is dagre's.

## CodeMirror, docx, markdown-it

The Argdown editor is **[CodeMirror 6](https://codemirror.net/)**. Comments written on the map
export as real Word comments through **[docx](https://docx.js.org/)**. The manuscript pane and the
help are rendered with **[markdown-it](https://github.com/markdown-it/markdown-it)**. All MIT.

## pymupdf, pymupdf4llm, RapidOCR, pandoc

The ingest side rests on **[PyMuPDF](https://pymupdf.readthedocs.io/)** and `pymupdf4llm` for
reading PDFs, **[RapidOCR](https://github.com/RapidAI/RapidOCR)** when a text layer is damaged,
and **[pandoc](https://pandoc.org/)** for everything a publisher or an author wrote in a real
document format. `ipsissima-mcp/eval/CONVERTER-FINDINGS.md` records what else was measured and
why these won.

---

## Tom Stern, and why this program checks what it checks

> Stern, T. (2016) '"Some Third Thing": Nietzsche's Words and the Principle of Charity',
> *The Journal of Nietzsche Studies*, 47(2), pp. 287–302.

This is not a dependency. It is the reason a whole class of check exists here, and the debt is
larger than any of the code above.

Ipsissima verifies quotations: a claim marked `quotation` is checked, character by character,
against the source it cites. That is worth having, and it establishes **far less than it looks
like**. Stern's four illustrations of *misreporting* — using an author's words to make it seem he
is saying something he certainly is not — **quote accurately in three cases out of four**. Every
one of those three would come back `exact` from a verbatim checker:

- a hedged claim quoted, with the author's own unhedged correction, in the same sentence, left
  just outside the quotation marks;
- a partial claim ("*some* drives do x") quoted in support of a universal one, with the "whereas
  some drives do the exact opposite" that follows it dropped;
- a passage quoted as evidence for a term the passage never uses.

His structural point is what made the difference: misreporting *advertises* a commitment to
meaning through a recognised meaning-seeking technique — direct quotation — while sacrificing it.
The importance of the currency is assumed in the act of debasing it. A verbatim checker verifies
the currency and **cannot see the debasement**, because the debasement is entirely a matter of
what the span was cut away *from*.

So `--source-root` reports, for every quotation that *is* verbatim, what sits immediately around
it: a dropped qualifier, a continuation that corrects it, an oversized elision. And the fidelity
vocabulary — quotation, paraphrase, compression, interpretation, imputation — together with
`unit`, `mode` and `strength`, are Stern's three dimensions of charity rather than an invention
of this project's.

`ipsissima-mcp/tests/test_reading_checks.py` is built directly on his four cases and is named for
them.

---

## Deep Drafter — Simon Goldstein

Ipsissima began as an addition to **[Deep Drafter](https://github.com/simondgoldstein/deep-drafter)**,
Simon Goldstein's Claude workspace for writing academic papers, and grew inside a copy of it
before it became clear it was a different project. It was extracted on 22 August 2026.

**No Deep Drafter code is used here.** The two trees were compared before release: of some 2,400
distinctive lines of Python, five are shared, and all five are in files that were Ipsissima's own
ancestors sitting in that workspace. Deep Drafter contains no JavaScript at all. The debt is
therefore one of occasion and of habit rather than of code — several conventions this project
takes seriously, particularly that a tool which mishandles something *quietly* is worse than one
that says what it did, were learned there.

Deep Drafter is MIT licensed.

---

## And the works reconstructed in `samples/`

The samples carry other people's arguments, and the reconstructions are readings of them, not
substitutes for them. Each sample folder's README says where its text came from and under what
licence. Carroll and Darwin are long out of copyright; anything more recent is there because its
author or its publisher released it under a Creative Commons licence permitting exactly this.
