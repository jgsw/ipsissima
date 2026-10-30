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

## How a reader questions a map — Dewey, Henne, Lang

Since October 2026 the App has been designed as a place to inquire into an argument, and not only
to look at it: suppose a claim false and see what follows, guess before looking, weigh rival
accounts, and study an argument from its premises up (`docs/INQUIRY-PLAN.md`;
`docs/values/INVENTORY.md`, B10). That design is not this project's invention.

- **John Dewey**, *How We Think*, rev. edn (D. C. Heath, 1933) — reflective thought as running
  from a felt difficulty, through a suggestion, to testing it by action, overt or imagined.
  Supposing in Ipsissima is that last step, done in software; and inquiry begins from a question,
  which is why Study opens on the text's.
- **Céline Henne**, "Framed and framing inquiry: a pragmatist proposal", *Synthese* (2023) — the
  distinction between a *framed* question, which takes a framework for granted and so has an
  answer, and a *framing* one, which puts the framework itself in question. It is why the App may
  say where a reader and the map part without ever grading the reader's reading.
- **James M. Lang**, *Small Teaching: Everyday Lessons from the Science of Learning*, 2nd edn
  (Jossey-Bass, 2021), ch. 1, "Predicting" — a prediction helps where the reader can bring what
  they know to it, feedback should come fast, and reflection should follow. **Guess first** is
  built on it.
- **Stephen Van Evera**, *Guide to Methods for Students of Political Science* (Cornell, 1997), and
  **David Collier**, "Understanding process tracing", *PS: Political Science & Politics* 44 (2011)
  — the four tests (straw in the wind, hoop, smoking gun, doubly decisive) that the weigh panel's
  **Test?** names in plain words.

## How a causal chain is drawn — the mechanists, Coleman, Ylikoski, Pearl

The Mechanism view draws what a text says happens, and the profile's causal annotations record it.
The sources of that half are listed in full at the foot of
`ipsissima-mcp/src/ipsissima_mcp/docs/mechanism-cheatsheet.md`, and in `docs/PROFILE.md` where
each annotation is introduced. The largest debts:

- **Peter Machamer, Lindley Darden and Carl F. Craver**, "Thinking about mechanisms" (2000), and
  **Carl F. Craver**'s later work, for what a mechanism is and when a sketch is enough.
- **James S. Coleman**, *Foundations of Social Theory* (Belknap, 1990), for the boat, and **Petri
  Ylikoski**, for reading it: "Understanding the Coleman boat" (2021), and, with **Rodrigo
  Martínez-Peña**, "Coupling social and ecological mechanisms with the Coleman boat" (2024). The
  boat is drawn the way they draw it.
- **Lars-Göran Johansson, Thomas Banitz, Tilman Hertz, Maja Schlüter** and their colleagues in
  social-ecological systems research. Their *A Primer to Causal Reasoning About a Complex World*
  (2024) shaped the profile's association and scope annotations. Banitz et al., "Visualization of
  causation in social-ecological systems" (2022), and Hertz, Mancilla García and Schlüter, "From
  nouns to verbs" (2020), shaped how stocks, flows and processes are drawn.
- **W. Brian Arthur**, "Economics in nouns and verbs" (2023), for amounts, levels and rates moved
  by steps that raise or lower them.
- **Judea Pearl**, with **Dana Mackenzie**, *The Book of Why* (Basic Books, 2018), for the
  junctions (chain, fork, collider) that `teaching/causal-junctions.argdown` teaches. Supposing
  there is an intervention in Pearl's sense, and the teaching map says so.

None of these authors has anything to do with this program.

## How a text's comparisons are read — the tables literature

Since October 2026 every reconstruction also records what a text compares: cases against a
definition, options against criteria, studies against questions, rival accounts against the
evidence. Those comparisons are declared as frames, and the Tables panel and **Weigh the accounts**
draw them. The method is `ipsissima-mcp/src/ipsissima_mcp/docs/tabulation-pass.md`. Its section
"Reading a text's comparisons" and its Sources list say which rule comes from which work. The
largest debts:

- **Richards J. Heuer Jr**, *Psychology of Intelligence Analysis* (CIA, 1999), ch. 8, "Analysis of
  Competing Hypotheses". It is the source of working across the row, of a finding that fits every
  account telling the reader nothing, and of rival accounts set against the evidence at all.
- **Gary Goertz**, *Social Science Concepts* (Princeton, 2006). It is why `rule:` means a rule the
  text states both ways, and why a one-way rule stays in its claim.
- **Paul F. Lazarsfeld and Allen H. Barton**, on property space (1951), read through **Colin
  Elman**, "Explanatory typologies in qualitative studies of international politics" (2005), and
  **David Collier, Jody LaPorte and Jason Seawright**, "Putting typologies to work" (2012), for how
  a typology's rows, columns and cells are read, and how they are misread. **Kenneth D. Bailey**,
  *Typologies and Taxonomies* (Sage, 1994), for types against cases.
- **Charles C. Ragin**, *The Comparative Method* (1987) and *Redesigning Social Inquiry* (2008):
  an empty cell is a remainder, and filling one is an assumption. That is why the page leaves the
  text's silences empty.
- **Klaus Krippendorff**, *Content Analysis* (4th edn, 2019), for coding a cell from the text's own
  words.
- **Joanne E. McKenzie and Sue E. Brennan** (*Cochrane Handbook*, ch. 12), **Mhairi Campbell et
  al.** (SWiM, 2020) and **David Ogilvie et al.** (the harvest plot, 2008), for tables of studies.
  They are why the page never counts votes or files a mixed result under the account it "best
  supports".
- **Daniel Silver**, "Figure It Out!" (2020), on cross-classification and slotting.

None of these authors has anything to do with this program.

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

## Arrived at independently — Gregor Betz and Georg Brun

**This one is not a debt, and saying it were would be false.** Ipsissima was built, and this file
first written, before anybody here had read a line of it. The work was found on **30 August 2026**,
after the fact, and it turns out to have got to the central idea first.

**[DeepA2](https://arxiv.org/abs/2110.01509)** (Gregor Betz and Kyle Richardson, 2021) sets out a
data structure for argument analysis whose dimensions include *"verbatim reason statements in
source text"* and *"verbatim conjectures in the source text"*, each carrying a reference into the
reconstruction. That is the claim this program is built on — that a reading should quote the text
it is a reading of, claim by claim — and it is five years older than anything here.

**And the distinction the fidelity apparatus draws already had a name.** DeepA2 §3.1 asks a
reconstruction to be both *systematically correct* — valid, non-circular, free of irrelevant
premises — and *exegetically adequate*, that is, to account for the original text; and it names
the trade-off between the two as a source of the underdetermination that makes several
reconstructions of one text legitimate at once, citing **Brun and Betz (2016)**. The reading
policy in `§4` of `ipsissima-conventions.md` is a way of declaring where a reconstruction sits on
exactly that trade-off. It was arrived at from Stern and from practice, not from them, which is
why this section sits apart from the ones above.

What is this project's own is narrower than provenance, and worth stating precisely: a **gradation**
where DeepA2 has a binary, including the two categories that record where the reconstructor has
*departed* from the text; **mechanical verification** of every quotation against the source before
the map is built; and a **reader**, so that a person can follow a claim back to its passage and
disagree with it there.

Independent arrival is not a claim to priority. It is evidence the distinction is real.

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
