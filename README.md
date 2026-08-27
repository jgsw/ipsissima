# Ipsissima

Read an argument reconstruction beside the text it is a reading of.

*ipsissima verba* — the very words themselves. Scholars of the Gospels set it against *ipsissima
vox*, the authentic voice: did he say **these words**, or is this a faithful report of what he
meant? That is the distinction this program keeps, on every claim.

Ipsissima reads [Argdown](https://argdown.org) — Christian Voigt's argumentation markup language —
and shows a reconstruction three ways at once: the argument as a map, the passage each claim was
drawn from, and the marks a reader writes in the margin. It runs entirely on your own machine and
makes no network requests of any kind.

---

## Two parts

**`app/` — Ipsissima.** The viewer and editor. It builds to a **single self-contained HTML file**
you can double-click, email, or put on a web page, and to a **desktop application** for macOS,
Windows and Linux that adds what a web page cannot do: open a `.argdown` by double-clicking it,
save back in place on any platform, and reload the manuscript when it changes on disk.

**`ipsissima-mcp/` — Ipsissima-MCP.** The other half of the work: turning a document into
something a reconstruction can cite. An **MCP server**, so you can ask the assistant you are
already talking to for an argument map and it does the rest — getting a PDF, EPUB, `.docx` or
HTML article into structured Markdown with its paragraphs and page numbers intact, and then
checking the finished reconstruction against its sources word for word. It does not reconstruct
arguments itself; that judgement belongs to the model, and the instructions for it are served as
a prompt read off disk. The command line is still there for a one-off.

**`samples/`** — worked reconstructions of real arguments, with the texts they were drawn from.

## Try it without installing anything

```bash
cd app && npm install && node rebuild_viewers.mjs
```

That writes `Ipsissima.html` (editor) and `Ipsissima Reader.html` (read-only) to the repository
root. Open either in a browser and drop a `.argdown` file — or a folder — onto it.

Then open one of the samples:

```bash
node app/build_argdown_viewer.mjs \
  "samples/Darwin 1859 - Natural selection/darwin-natural-selection.argdown" \
  --source-root "samples/Darwin 1859 - Natural selection"
```

## The desktop application

```bash
cd app/desktop && npm install && npm run build
```

Needs Rust and, on macOS, the Xcode command line tools. `node install.mjs` builds and installs a
single registered copy — read `app/desktop/README.md` first, particularly the section on the five
things that fail silently.

Builds are **unsigned**: macOS and Windows will both warn the first time. `app/desktop/INSTALL.md`
is written for the download page and says exactly what a reader will see and what to click.

## What it does that other Argdown viewers do not

- **The claim and the passage it came from, side by side.** Every claim can record which file and
  which words it was drawn from; the map and the manuscript are linked in both directions.
- **Whose words are these.** Each claim is marked for how far it stands from its source —
  quotation, paraphrase, compression, interpretation, imputation — and the map draws that as the
  box's border. Quotations are *checked* against the source rather than believed.
- **Two arrangements of the same claims.** By the order of reasons, or by the order of exposition.
- **Justificatory debt.** In the exposition arrangement, a sparkline on every band and one for the
  whole piece: below the line, claims asserted here whose reasons come later; above, claims their
  reasons have already earned.
- **Margins that go back to the writer.** Comments written on the map export as *real Word
  comments* on the essay, anchored to the passage each one is about.
- **One file that carries everything.** A reconstruction and the text it is of can be saved as a
  single `.argdown` — still a valid one — or as a self-contained web page the recipient
  double-clicks.

## Licence, and credit where it is owed

Ipsissima is free software under the **GNU General Public License v3** — see `LICENSE`.

It is a reader and editor for **Argdown**, and would not exist without it. The notation, the
parser and the model of what a reconstruction *is* are **Christian Voigt's**; Ipsissima bundles
the official parser and uses it unmodified, so a file that parses here parses everywhere Argdown
does. The notation is set in **ArgVu**, the Argdown project's own typeface, by **Peter Stahmer**,
funded by the **KIT Debatelab**. Ipsissima is an independent program and is not endorsed by or
affiliated with the Argdown project.

Its checks owe a particular debt to **Tom Stern's** "'Some Third Thing': Nietzsche's Words and
the Principle of Charity" (*The Journal of Nietzsche Studies*, 2016), which is why this program
does not stop at verifying that a quotation is verbatim: three of Stern's four illustrations of
misreporting quote *accurately*. It began inside a copy of **Simon Goldstein's Deep Drafter**,
though it shares no code with it.

**`CREDITS.md` has the full account**, including why each of those matters to what the program
actually does.

## Reading the code

`docs/NOTES.md` is the record of decisions that were expensive to reach, several of which exist
because something failed silently. `docs/REVIEW.md` is an outside reading of the whole project
written just before release — what was found, what was fixed, and what is still open, including
an honest account of the one problem the project has not solved.

`CONTRIBUTING.md` says which contributions are most useful, and the answer is not code.

## Status

[![tests](https://github.com/jgsw/ipsissima/actions/workflows/tests.yml/badge.svg)](https://github.com/jgsw/ipsissima/actions/workflows/tests.yml)

Early. The tests run on every commit's worth of change and are meant to be read as much as run.

**Green does not mean everything passes.** The workflow allows exactly the one failure documented
in `KNOWN-ISSUES.md` and turns red on any other — a second contention drawn unattached in one fold
state, found on 27 Aug 2026 by adding a sixth sample, which is what a corpus is for.

Two earlier fold defects were fixed on 23 Aug 2026, and the second turned out to be the first
one's fix. Both accounts are kept.
