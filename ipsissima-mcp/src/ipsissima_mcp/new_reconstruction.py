#!/usr/bin/env python3
"""Scaffold a reconstruction folder from a PDF, in one command.

    python3 -m ipsissima_mcp.new_reconstruction \\
        "/path/to/paper.pdf" "Author YEAR - Short title" \\
        [--start "1. Introduction"] [--end "References"] [--slug my-paper]

Builds the folder, writes its `convert_source.py`, a skeleton `.argdown` and a
README stub, runs the conversion, and prints the converter's report.

WHY ONLY TWO OPTIONS. This was going to take a ten-field form. Then a real paper was converted
with the shared converter and it turned out to need exactly two things that cannot be worked out
from the page -- where the article starts and where it stops. Everything else (columns, the left-
edge bands, running heads, footers, page numbers, footnotes, and on a modern paper the section
headings) is detected. So the scaffold asks for those two, and both are optional: run it without
them, read the report, and fill them in.

RUN IT TWICE, DELIBERATELY. The first run shows what the converter found; the second, after
`--start` and `--end` are known, is the real one. Re-running never overwrites `convert_source.py`
or the `.argdown` once they exist -- only the converted source is rebuilt -- so edits are safe.

WHAT THE SKELETON DOES AND DOES NOT CONTAIN. It carries the front-matter defaults, a commented
`reconstruction:` block for the reading policy, the fidelity key, and the source's own section
names as comments, so the metadata is there to copy. It
contains no argument: the shape is the one thing here that cannot be scaffolded, and a plausible
stub would sit in the file looking like a decision. It carries a single TODO contention, because
an Argdown file of only comments does not parse -- and because finding the conclusion first is
where a reconstruction should start anyway.
"""

import argparse
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
# `ipsissima-mcp/src/ipsissima_mcp` -> the repository root. The default parent folder was
# `Argdown samples` under the workspace this grew inside; here the folder is `samples/`, and a
# default pointing at a directory that does not exist writes the scaffold somewhere nobody
# looks.
ROOT = HERE.parents[2]
SAMPLES = ROOT / "samples"

CONVERTER = '''#!/usr/bin/env python3
"""Convert the {title} PDF to the markdown the reconstruction cites.

SOURCE. {pdf}
Opened READ ONLY. Nothing is ever written to the source folder.

TODO, BEFORE THIS FOLDER IS FINISHED: replace this paragraph with what THIS paper needed --
what its scan got wrong, what had to be repaired and on what evidence, and any liberty taken
that a reader of the converted text would not otherwise see. The machinery is shared and
documents itself; this docstring is for the part that is peculiar to this paper.

    python3 convert_source.py
"""

import sys
from pathlib import Path

# Find the shared build scripts by walking up, rather than counting directories. A fixed
# `parents[2]` breaks the moment the folder is moved or copied somewhere else, and breaks with an
# ImportError that says nothing about why.
_here = Path(__file__).resolve()
for _p in _here.parents:
    _build = _p / "src" / "ipsissima_mcp"
    if _build.is_dir():
        sys.path.insert(0, str(_build))
        break
else:
    sys.path.insert(0, r"{build}")     # absolute fallback, recorded when this was scaffolded
from pdf_to_source import Config, convert, print_report          # noqa: E402

HERE = Path(__file__).resolve().parent

CFG = Config(
    pdf=Path(r"{pdf}"),
    out=HERE / "source" / "{slug}.md",
    first_page=1,
{start}{end}    title="{title}",
    author="",
    source="",
)

if __name__ == "__main__":
    print(f"wrote {{CFG.out}}")
    print_report(convert(CFG))
'''

# NOT WRITTEN FOR A SINGLE PAPER, and that is the point. A project file states the reading order
# of several sources; requiring one to state the order of ONE file is pointless, and it used to
# be a hard error -- the viewer builder refused to build without `_quarto.yml`. With no project
# file the reading order is now taken from the chapters the reconstruction cites, which for one
# paper is exactly right.
#
# It is kept here for the multi-source case: a book, or a paper reconstructed alongside the
# replies to it. Written as `argdown-project.yml` rather than `_quarto.yml` so it does not look
# like it needs Quarto, which it does not -- `_quarto.yml` is still read where one exists, so an
# existing Quarto project keeps working untouched. No leading underscore: `@argdown/node`
# ignores `**/_*` relative to the working directory.
PROJECT = '''title: "{title}"

# The order your sources are read in. Paths are relative to this file, so moving the folder
# does not break them. `part:` groupings are optional.
chapters:
  - source/{slug}.md
'''

SKELETON = '''===
title: {title}
defaults:
  chapter: "source/{slug}.md"
  reviewed: "{today}"
# WHAT IS THIS RECONSTRUCTION TRYING TO BE? Uncomment and choose. The same map can be excellent
# as a report of what the text says and poor as a reading of what it should say, and until the
# aim is declared there is no fact about which this file is -- so no fact about whether its
# departures from the text are earned.
#
# Deliberately left commented rather than defaulted: a value nobody chose would sit here looking
# like a decision, which is the failure this block exists to prevent. check_argdown.py asks for
# it once the map starts marking fidelity.
#
# reconstruction:
#   aim: fit            # fit -- what the text says | appropriation -- the best philosophy in it
#   unit: meaning       # meaning -- which sense of the words | commitment -- which view is held
#   mode: coherence     # what "best light" means: coherence | truth | soundness | agreement |
#                       # interest. They pull apart -- the coherent reading of a text and the
#                       # true one are not the same reading.
#   strength: ordinary  # minimal | ordinary | strong -- how much better than the words the
#                       # author is assumed to be
===

// {title}
//
// THE FORM. <Name the argument's shape before writing any nodes -- elimination of alternatives,
// reductio, inference to the best explanation, dilemma, refutation by counterexample. The shape
// is the map's skeleton; working section by section instead produces a map that mirrors the
// table of contents and hides the argument.>
//
// LINKED OR CONVERGENT? Sibling `+` relations assert that the reasons are INDEPENDENT -- knock
// one out and the rest still stand. That is the default a careless reconstruction falls into and
// it is usually wrong. Premises that only work together belong in a premise-conclusion structure.
//
// FIDELITY.
//   quotation      the author's own words, checked against the converted source
//   paraphrase     close restatement
//   compression    (unmarked default) several sentences reduced to one claim
//   interpretation a reading the text supports but does not state
//   imputation     a premise the argument NEEDS but the author never states
//
// A DEPARTURE OWES A REASON. Mark `interpretation` and `imputation` with a `warrant` saying why
// the reading leaves what the text says: enthymeme (the argument is invalid without it),
// hyperbole, sloppy-phrasing, secret-sign, other-texts, coherence, convention. The vocabulary is
// a prompt, not a jail -- any short reason will do. What matters is that it was written down,
// because the pattern across a file is the thing worth seeing: three claims read as hyperbole is
// a decision about the author, and nobody notices making it one claim at a time.
//
// `chapter` and `reviewed` come from the defaults above; put them on a claim only to override.
// Every claim still needs `section` OR a `source:` quotation, or it cannot be placed in the text.
//
// Objections tagged #dispute are not the author's. Say so, and say whether they are sourced.

{sections}

// A DOCUMENT OF ONLY COMMENTS DOES NOT PARSE -- "Expecting {{linebreak}}{{linebreak}} (Empty
// Line) but found ''", reported at 1:1 wherever the real problem is. So the skeleton carries one
// placeholder, which is also the right place to start: find the conclusion first, then the form.
[the contention]: TODO -- what is this paper trying to get you to accept? Replace this, then
build the argument underneath it. #core
'''

README = '''# {title}

**Converted, not yet reconstructed** — there is no `.argdown` map here yet.

## The source

<What this paper's text layer was like, what had to be repaired, and on what evidence.>

## Rebuilding

```bash
python3 convert_source.py
```
'''


def main():
    ap = argparse.ArgumentParser(description="Scaffold a reconstruction folder from a PDF.")
    ap.add_argument("pdf")
    ap.add_argument("title", help='folder name, e.g. "Gettier 1963 - Is justified true belief knowledge"')
    ap.add_argument("--start", help="text of the first line of the article proper")
    ap.add_argument("--end", help="text of the first line of the back matter")
    ap.add_argument("--project", action="store_true",
                    help="also write argdown-project.yml, for a folder that "
                         "will hold several sources. A single paper needs none.")
    ap.add_argument("--slug", help="basename for the converted source (default: from the title)")
    ap.add_argument("--into", default=str(SAMPLES), help="parent folder (default: Argdown samples)")
    a = ap.parse_args()

    pdf = Path(a.pdf).expanduser()
    if not pdf.exists():
        sys.exit(f"no such PDF: {pdf}")
    slug = a.slug or re.sub(r"[^a-z0-9]+", "-", a.title.lower()).strip("-")
    # A LEADING UNDERSCORE MAKES THE FILE INVISIBLE. `@argdown/node` ignores `**/_*` by default,
    # matched relative to the working directory, so `_paper.argdown` -- or any file inside a
    # folder whose name starts with `_` -- is silently not found from some directories and fine
    # from others. The error it produces is "No Argdown files found at: <the exact path you just
    # passed>", which reads like the file is missing while you are looking straight at it. Caught
    # here rather than an hour later.
    if a.title.startswith("_") or slug.startswith("_"):
        sys.exit("a leading underscore makes the .argdown invisible to the CLI "
                 "(@argdown/node ignores '**/_*'). Rename the folder or pass --slug.")
    folder = Path(a.into).expanduser() / a.title
    (folder / "source").mkdir(parents=True, exist_ok=True)

    fields = dict(title=a.title, slug=slug, pdf=str(pdf), today=date.today().isoformat(),
                  build=str(HERE),
                  start=f'    starts_at="{a.start}",\n' if a.start else
                        '    # starts_at="1. Introduction",   # front matter is not the article\n',
                  end=f'    end_marker="{a.end}",\n' if a.end else
                      '    # end_marker="References",         # back matter and bibliography\n')

    wrote, kept = [], []
    # No project file for a single paper -- see the note on PROJECT above. `--project` writes one
    # for a folder that will hold several sources.
    files = [("convert_source.py", CONVERTER.format(**fields)),
             ("README.md", README.format(**fields))]
    if a.project:
        files.insert(1, ("argdown-project.yml", PROJECT.format(**fields)))
    for name, body in files:
        path = folder / name
        (kept if path.exists() else wrote).append(name)
        if not path.exists():
            path.write_text(body, encoding="utf-8")

    print(f"folder: {folder}")
    print(f"  wrote: {', '.join(wrote) or 'nothing new'}"
          + (f"   kept as they were: {', '.join(kept)}" if kept else ""))

    r = subprocess.run([sys.executable, str(folder / "convert_source.py")],
                       capture_output=True, text=True)
    print(r.stdout.rstrip() or r.stderr.rstrip())
    if r.returncode:
        print("\n  the conversion failed; fix the Config and re-run this command")
        return

    # The skeleton is written AFTER the conversion, so it can list the sections the source
    # actually has -- which are what `section:` metadata has to match, character for character.
    md = folder / "source" / f"{slug}.md"
    heads = re.findall(r"^# (.+)$", md.read_text(encoding="utf-8"), re.M) if md.exists() else []
    listing = ("// SECTIONS IN THE SOURCE, for `section:` metadata -- copy them exactly:\n"
               + "\n".join(f'//   section: "{h}"' for h in heads)) if heads else \
              ("// The source has no `#` headings, so every claim will need a `source:` quotation\n"
               "// to be placed more precisely than the top of the file.")
    skel = folder / f"{slug}.argdown"
    if skel.exists():
        print(f"  kept as it was: {skel.name}")
    else:
        skel.write_text(SKELETON.format(sections=listing, **fields), encoding="utf-8")
        print(f"  wrote: {skel.name}  ({len(heads)} section names carried over)")

    print("\nnext:")
    if not a.start or not a.end:
        print("  * read the report above, then set --start / --end (or edit the Config) and re-run")
    print(f'  * reconstruct into {skel.name}, then:')
    print(f'      python3 .claude/skills/argdown/check_argdown.py "{skel}" --source-root "{folder}"')
    print(f'      node app/build_argdown_viewer.mjs '
          f'"{skel}" --source-root "{folder}"')


if __name__ == "__main__":
    main()
