#!/usr/bin/env python3
"""Splitting a book into its chapters, at the level its publisher set them.

    python3 ipsissima-mcp/tests/test_split_manuscript.py

Moved out of test_structured_source.py when the converters became Unpetrify (Nov 2026): the
conversion is tested there, and the split -- Ipsissima's step, one file a chapter plus the project
file that records their order -- is tested here, over the same Russell fixture.
"""
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src" / "ipsissima_mcp"))

from split_manuscript import heading_re, split                               # noqa: E402

fails = 0


def check(name, got, want):
    ok = got == want
    global fails
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}")
    if not ok:
        print(f"        got  {got!r}\n        want {want!r}")


print("== splitting a book")
print("chapters are not always `#`")
# AN EPUB KEEPS ITS PUBLISHER'S HEADING LEVELS. Gutenberg sets the book title as h1 and every
# chapter as h2, so a fifteen-chapter book split into two files -- valid Markdown, all the words
# present, and thirteen exposition bands the reader should have had simply absent.
BOOK = """# THE PROBLEMS OF PHILOSOPHY

Front prose.

## CHAPTER I. APPEARANCE AND REALITY

Is there any knowledge so certain that no reasonable man could doubt it?

## CHAPTER II. THE EXISTENCE OF MATTER

In this chapter we have to ask ourselves whether there is any such thing as matter.

## CHAPTER III. THE NATURE OF MATTER

We have found that it is possible to doubt whether matter exists.
"""
with tempfile.TemporaryDirectory() as td:
    book = Path(td) / "book.md"
    book.write_text(BOOK, encoding="utf-8")
    at1 = split(str(book), 1)[1]
    at2 = split(str(book), 2)[1]
    # At level 2 the book's own `#` title and the prose under it fall before the first chapter
    # heading, and become a Front matter section -- prose before the first heading is still
    # prose, which is deliberate and is why the count is chapters + 1.
    chapters2 = [s["title"] for s in at2 if s["title"] != "Front matter"]
    check("  a Gutenberg book splits into one file at level 1", len(at1), 1)
    check("  and into its chapters at level 2", chapters2,
          ["CHAPTER I. APPEARANCE AND REALITY", "CHAPTER II. THE EXISTENCE OF MATTER",
           "CHAPTER III. THE NATURE OF MATTER"])
    check("  the title and its prose are kept as front matter, not dropped",
          [s["title"] for s in at2][0], "Front matter")
    check("  which is the count that says the level was wrong", len(at2) > len(at1) * 2, True)

check("a level-3 heading is not matched at level 2",
      bool(heading_re(2).match("### Deeper")), False)
check("  and a level-2 heading is", bool(heading_re(2).match("## Chapter")), True)


print("\nthe Russell fixture, converted and then split")
# SHOWN ABLE TO FAIL, 3 Sep 2026: splitting at level 1 instead of 2 fails the chapter count with 1.
RUSSELL = HERE.parent.parent / "fixtures" / "ingest" / "russell-1912-problems-of-philosophy.epub"
if not RUSSELL.exists() or not shutil.which("pandoc"):
    print("  skip  fixture or pandoc not on this machine")
else:
    from unpetrify.epub_to_source import convert as epub_convert             # noqa: E402
    with tempfile.TemporaryDirectory() as td:
        meta, docs, skipped = epub_convert(str(RUSSELL), out_dir=td)
        whole = "\n\n".join(d["markdown"] for d in docs)
        book = Path(td) / "book.md"
        book.write_text(whole, encoding="utf-8")
        secs = split(str(book), 2)[1]
        chapters = [s["title"] for s in secs if s["title"].upper().startswith("CHAPTER")]
        check("split at level 2 finds all fifteen chapters", len(chapters), 15)
        check("  in order, Appearance and Reality first",
              chapters[0].upper().endswith("APPEARANCE AND REALITY"), True)
        check("  and the Value of Philosophy last",
              chapters[-1].upper().endswith("THE VALUE OF PHILOSOPHY"), True)

print()
if fails:
    print(f"{fails} FAILED\n")
    sys.exit(1)
print("all passed\n")
