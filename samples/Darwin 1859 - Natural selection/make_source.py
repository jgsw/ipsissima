#!/usr/bin/env python3
"""Write the source text the Darwin reconstruction cites.

NO PDF, AND THEREFORE NO EXTRACTION STEP. The other sample folders convert a PDF; this one
does not, because the passage was supplied by the author as text, transcribed from

    Charles Darwin, The Origin of Species, Penguin edition, p. 168

which is not held here in any form. So the passage is carried verbatim in this script, and the
script's job is not extraction but the ONE editorial decision below, made executable so it can
be inspected and undone. Nothing here has been checked against a copy of the Penguin volume:
the wording and the pinpoint are the author's, and the reconstruction's `pinpoint:` metadata
says so rather than implying a verification that did not happen.

THE ELISIONS ARE THE AUTHOR'S. The passage as supplied has two ellipses. They are preserved as
`[...]` on their own lines and NOT filled in. Restoring them would need the volume, and a
plausible reconstruction of elided text is exactly the kind of quiet fabrication the fidelity
markers exist to prevent.

ONE LINE PER CLAUSE, AND WHY IT IS NOT THE USUAL CHOICE. The other converters here write one
line per PARAGRAPH, because the locator's unit is the line and a journal article has enough
paragraphs to give every claim its own position. This passage has two. Written that way, all
fourteen of the quoted claims would resolve to one of two lines, the Order view would have two
columns, and the exposition axis -- the thing these maps are for -- would show nothing at all.
So the passage is broken at ITS OWN JOINTS: Darwin's semicolons and the "then" / "Therefore" /
"Thus" hinges, which are where the argument turns anyway. No wording is altered and no
punctuation is added or removed; only line breaks are inserted, and markdown renders the result
as the same two paragraphs. This is the general lesson for short arguments -- the granularity of
the source file, not the length of the text, is what the position tooling can see.

THERE ARE NO HEADINGS. Three editorial ones were removed on 20 Aug 2026: the converted source is
now only what the passage says. The `[...]` elisions stay, because they are the
argument but not a break Darwin made.

    python3 make_source.py
"""

from pathlib import Path

OUT = Path(__file__).resolve().parent / "source" / "darwin-1859-natural-selection.md"

HEADER = """---
title: "Natural selection (passage)"
author: "Charles Darwin"
source: "The Origin of Species, Penguin edition, p. 168 (pinpoint as supplied by the author)"
---

<!-- TRANSCRIBED PASSAGE - NOT A CONVERTED SCAN, AND NOT CHECKED AGAINST THE VOLUME.
     Made by make_source.py from the passage as supplied by the author, who transcribed it
     from the Penguin edition, p. 168. No copy of the volume is held here, so neither the
     wording nor the pinpoint has been verified; the reconstruction records that.
     (a) The two `[...]` marks are the AUTHOR'S ellipses. The elided material is not
         restored and must not be guessed at.
     (b) Line breaks are inserted at the passage's own joints - Darwin's semicolons and his
         'then' / 'Therefore' / 'Thus' hinges - because the position tooling's finest unit is
         the line, and two paragraphs would give the Order view two positions. No wording or
         punctuation is altered.
     (c) No headings. The file is the passage and nothing else; the `[...]` markers are the
         author's own elisions, kept so the text does not look continuous where it is not. -->
"""

# The passage, verbatim, one entry per line of the output. `None` marks an elision.
PASSAGE = [
    ("If during the long course of ages and under varying conditions of life, organic beings "
     "vary at all in the several parts of their organisation, and I think this cannot be "
     "disputed;", "text"),
    ("if there be, owing to the high geometrical powers of increase of each species, at some "
     "age, season or year, a severe struggle for life, and this certainly cannot be disputed;",
     "text"),
    ("then, considering the infinite complexity of the relations of all organic beings to each "
     "other and to their conditions of existence, causing an infinite diversity in structure, "
     "constitution, and habits, to be advantageous to them,", "text"),
    ("I think it would be a most extraordinary fact if no variation ever had occurred useful to "
     "each being's own welfare, in the same way as so many variations have occurred useful to "
     "man.", "text"),
    ("But if variations useful to any organic being do occur, assuredly individuals thus "
     "characterised will have the best chance of being preserved in the struggle for life;",
     "text"),
    ("and from the strong principle of inheritance they will tend to produce offspring "
     "similarly characterised.", "text"),
    ("[...]", "elision"),
    ("Therefore during the modification of the descendants of any one species, and during the "
     "incessant struggle of all species to increase in numbers, the more diversified these "
     "descendants become, the better will be their chance of succeeding in the battle of life.",
     "text"),
    ("Thus the small differences distinguishing varieties of the same species, will steadily "
     "tend to increase till they come to equal the greater differences between species of the "
     "same genus, or even of distinct genera.", "text"),
    ("[...]", "elision"),
    ("This principle of preservation, I have called, for the sake of brevity, Natural "
     "Selection.", "text"),
]


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out = []
    # Blank lines now fall at the ELISIONS, which are the passage's own joints, rather than at
    # editorial headings, which are gone. The `[...]` markers stay: they are the transcription
    # being honest about what it cut, and removing them would make the passage look continuous
    # where it is not.
    for line, kind in PASSAGE:
        if kind == "elision" and out:
            out.append("")
        out.append(line)
        if kind == "elision":
            out.append("")
    body = "\n".join(out)
    OUT.write_text(HEADER + "\n" + body + "\n", encoding="utf-8")

    words = sum(len(line.split()) for line, kind in PASSAGE if kind == "text")
    print(f"wrote {OUT}")
    print(f"  {words} words on {sum(1 for _, k in PASSAGE if k == 'text')} lines, "
          f"{sum(1 for _, k in PASSAGE if k is None)} editorial headings (none, by design), "
          f"{sum(1 for _, k in PASSAGE if k == 'elision')} elisions preserved")
    print("  every line is verbatim; only line breaks were inserted")


if __name__ == "__main__":
    main()
