# What the corpus is for

Ipsissima is tested against real documents. Until now there was one pile of them, and every
article in it was asked to do three unrelated jobs at once: prove that a `.docx` converts, prove
that a reconstruction can be checked against its source, and prove that a map draws without
glitching when you fold it.

Those are three different questions, they fail for three different reasons, and holding them in
one pile made the corpus expensive to grow. **A new format to test dragged a whole reconstruction
behind it.** A rendering bug that needed a map with four nested undercuts needed a real paper that
happened to contain four nested undercuts. Neither is true, and both were costing real work.

So the corpus is now three sets, kept apart on purpose.

---

## The three roles

### `samples/` — worked reconstructions

**Few, full, real, and openly licensed.** These are the expensive ones and the only set that
needs to be expensive: a published argument, reconstructed with provenance attached, beside the
text it was drawn from. They are what a reader opens to see what Ipsissima is *for*, and what the
reconstruction checks are measured against.

Growing this set is a scholarly act, not a technical one. It costs a careful reading of a real
paper. **It is the bottleneck, and nothing else should be routed through it.**

The licence rule for this directory is strict and is stated in `samples/README.md`: only texts
that are public domain, licensed for redistribution, or ours, because a sample folder carries the
*whole converted article* rather than a scholar's fragment of it.

### `fixtures/ingest/` — documents that exist to be converted

**Many formats, deliberately small.** What is being tested is whether a converter recovers
paragraphs, headings, page numbers and words faithfully. A two-page article tests `.docx`
conversion exactly as well as a forty-page one, and costs a twentieth as much to hold, read and
re-run.

Nothing here needs an argument worth reconstructing. Nothing here needs a map. A fixture whose
prose is dull is a *better* fixture, because a reader of the test output is looking at the
structure and not at what the structure says.

What this set is for is **coverage of the failure modes**, which are format-specific and known:
two-column layouts, running heads, footnotes, ligatures, soft hyphens against ASCII ones,
headings that are only large text, equations, tables, scanned pages with no text layer.

### `fixtures/display/` — maps that exist to be drawn

**Hand-written `.argdown`, with no source text at all.** This is the set that removes the worst
of the old bottleneck. A rendering defect — a premise-conclusion structure that flattens, a fold
that loses a group, an undercut drawn in the wrong colour — needs a *map with that shape in it*.
It does not need a paper, an author, a licence or a conversion, and waiting for one to turn up in
the wild is why several of these bugs went unreproduced for months.

A fixture here is written to be pathological. It should be the smallest map that exhibits the
thing, and its filename and a comment at the top should say what it is for.

---

## Why the split pays

|  | to add one | needs a licence | needs a reading |
|---|---|---|---|
| a worked reconstruction | hours | yes | yes |
| an ingest fixture | minutes | yes, but a page of it | no |
| a display fixture | minutes | **no** | no |

The third row is the point. Two of the three sets can now grow as fast as bugs are found.

---

## The private corpus

Some of what is most worth testing cannot be published: articles that are in copyright, documents
whose value *is* that they are somebody's real messy file, and Argdown's own sample maps, which
belong to that project.

**These live outside the repository and are named here rather than lost.** The manifest below is
checked in; the files are not. Anything that reads it must **skip cleanly when a file is absent**
and say so, so that a clone with no private corpus is green and a reader can still see what
coverage exists and where it lives.

Point `IPSISSIMA_PRIVATE_CORPUS` at the folder. Absent, everything below is skipped.

```bash
export IPSISSIMA_PRIVATE_CORPUS="$HOME/…/ipsissima-samples-not-included-in-Github"
```

`fixtures/private-corpus.json` is the manifest itself: each entry names a file, the role it
plays, the format, why it cannot be published, and **what it is meant to catch**. The last field
is the one that matters — a private fixture whose purpose is not written down is a file nobody
dares delete and nobody knows how to replace.

### What is in it now

| file | role | why private | what it catches |
|---|---|---|---|
| `Gettier 1963 - Is justified true belief knowledge/` | reconstruction | in copyright | a damaged text layer where OCR genuinely helps; the labelled repairs the converter is scored on |
| `Horton 2020 - Aggregation Risk and Reductio/` | reconstruction | in copyright | running heads, footnotes, printed page numbers that differ from sheet numbers |
| `greenspan.argdown` | display | Argdown's own sample | a premise-conclusion structure whose premises are not all bracketed — the SCP rendering defect |
| `core argument of populism.argdown` | display | Argdown's own sample | statement mentions (`@[…]`) in quantity |
| `welcome to argdown.argdown` | display | Argdown's own sample | bold, italic and links in statement text |
| `semmelweiss.argdown` | display | Argdown's own sample | ten reconstructed arguments, for PCS rendering |
| `censorship.argdown`, `pros and cons legalisation of soft drugs.argdown`, `Word vs argdown.argdown` | display | Argdown's own sample | ordinary maps written by the language's author rather than by us |

### What it still needs

The gap the author named, and it is a real one: **a `.docx` whose headings are only large body
text**, with no Heading 1 style behind them. Measured on both pandoc and markitdown, neither
recovers structure from such a file and both discard the font size that might have allowed a
guess — so the fixture's job is not to make that work, but to hold the evidence that it does not,
and to make the failure legible rather than silent.

Also wanted: a `.odt` and a `.tex` of anything at all, a scanned PDF with no text layer, and a
document with tracked changes.
