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

**`ipsissima-mcp/` — Ipsissima-MCP.** The other half of the work: turning a document into something a
reconstruction can cite. It ingests a PDF, EPUB or HTML article — or a list of them — and produces
the structured Markdown a reconstruction points at, along with the tools that check a finished
reconstruction against its sources. Today it is a Python package with a command line; an MCP
server over the same tools is the next step, and the name is there in advance.

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
parser and the model of what a reconstruction *is* are **Christian Voigt's**; Ipsissima bundles the
official parser and uses it unmodified, so a file that parses here parses everywhere Argdown does.
The notation is set in **ArgVu**, the Argdown project's own typeface, by **Peter Stahmer**, funded
by the **KIT Debatelab**. Ipsissima is an independent program and is not endorsed by or affiliated
with the Argdown project.

## Status

Early. The tests run on every commit's worth of change and are meant to be read as much as run.

**One known failure.** `test_fold_invariants` reports three claims in the Carroll sample drawn with
no visible connection, in the exposition arrangement, under some fold states. It is a real defect
in the renderer, it predates this repository, and it is left failing rather than quietly weakened.
See `KNOWN-ISSUES.md`.
