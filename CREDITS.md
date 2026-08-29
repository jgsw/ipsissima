# Credit where it is owed

Ipsissima is a small program standing on several pieces of other people's work. Some of it is
code, some of it is a notation, and some of it is scholarship: the method a reconstruction here
follows is not this project's, and one journal article changed what the program checks.

---

## Argdown — Christian Voigt, and those who keep it

Ipsissima is a reader and editor for **[Argdown](https://argdown.org)**, and would not exist
without it. The notation, the parser, and the model of what a reconstruction *is* — statements,
arguments, premise-conclusion structures, the four relation types — are **Christian Voigt's**, and
the design has held up under everything this project has asked of it.

**A language also has to be kept.** Since the beginning of 2025 Argdown has been renovated and
maintained by **Kushal** ([@Kushal12341997](https://github.com/Kushal12341997)), **Hatim**
([@5HATIM5](https://github.com/5HATIM5)), **Lucas** ([@Morstis](https://github.com/Morstis)) and
**Gregor** ([@ggbetz](https://github.com/ggbetz)), who released Argdown 2.0 in April 2026 — see
[the release notes](https://argdown.org/changes/), which is where these names come from and which
gives them as first names and handles. Ipsissima tracks the parser they publish, so their work is
in every map this program draws.

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

Map layout was **[dagre](https://github.com/dagrejs/dagre)** (MIT) from the first render until
29 August 2026, and the debt is real even though the code is gone: dagre drew every map this
project learned on. The layout is now Ipsissima's own — the stability work in
`docs/STABILITY-PLAN.md` replaced dagre's ordering and positions with document-order home
columns, then its routes, and finally its ranking, at which point there was nothing left to
vendor. The layered-layout ideas it rests on trace to the same literature dagre implemented.

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

## How to reconstruct an argument — Fisher, Govier, Walton

`ipsissima-mcp/src/ipsissima_mcp/docs/reconstruction-cheatsheet.md` is the method a reconstruction here follows, and
almost none of it is this project's invention. **The method is Alec Fisher's and the structural
distinctions are Trudy Govier's**, as that document says at the top and again wherever it uses
them.

- **Alec Fisher**, *The Logic of Real Arguments*, 2nd edn (Cambridge, 2004) — working backwards
  from the conclusion, the **Assertibility Question**, and suppositional contexts. The AQ is what
  stops a reconstruction attributing reasoning the author never gave: generate the candidate
  reason, then ask whether the author asserts or clearly assumes it, and drop it if not.
- **Trudy Govier**, *A Practical Study of Argument*, 7th edn (Cengage, 2010) — standardising,
  **linked against convergent** support, unstated premises, Modest Charity, the ARG conditions,
  and conductive arguments with their counterconsiderations. Linked-against-convergent is why a
  premise-conclusion structure exists in these maps at all.
- **Trudy Govier**, *Problems in Argument Analysis and Evaluation* (Foris, 1987).
- **Douglas Walton, Chris Reed and Fabrizio Macagno**, *Argumentation Schemes* (Cambridge,
  2008) — argument forms paired with the critical questions that probe them.

Ipsissima records the results of that method. It does not perform it, and none of these authors
has anything to do with this program.

---

## Tom Stern, and why this program checks what it checks

> Stern, T. (2016) '"Some Third Thing": Nietzsche's Words and the Principle of Charity',
> *The Journal of Nietzsche Studies*, 47(2), pp. 287–302.

Not a dependency, and the largest debt here.

Ipsissima checks every claim marked `quotation` against its source, character by character. That
is worth having and **establishes far less than it looks like**: three of Stern's four cases of
*misreporting* — using an author's words to make him seem to say what he certainly does not —
quote perfectly accurately, and every one would come back `exact`. A hedge left just outside the
quotation marks; a partial claim quoted in support of a universal one; a passage quoted for a term
it never uses.

His structural point is the one that changed the program: misreporting **advertises** a commitment
to meaning, through the recognised meaning-seeking technique of direct quotation, while sacrificing
it. A verbatim checker verifies the currency and cannot see the debasement, because the debasement
lies entirely in what the span was cut away *from*.

So `--source-root` reports, for every quotation that *is* verbatim, what sits immediately around
it — a dropped qualifier, a correcting continuation, an oversized elision. And the fidelity
vocabulary, with `unit`, `mode` and `strength`, is Stern's three dimensions of charity rather than
an invention of this project's. `ipsissima-mcp/tests/test_reading_checks.py` is built on his four
cases and named for them.

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
