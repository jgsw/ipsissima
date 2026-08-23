# Security

## What Ipsissima does with your data

**Nothing leaves your machine.** The viewer and editor make no network requests of any kind — not
for updates, not for fonts, not for analytics. You can disconnect from the internet and the
program behaves identically. The About panel says so, and it is checkable: the built HTML file
contains every asset it uses.

**Ipsissima-MCP does make network requests, and only these:**

- **Crossref, Unpaywall and Europe PMC**, to ask whether an article has a machine-readable
  version or an open licence. Only a **DOI** is sent. This is what turns a PDF into a structured
  source, and it is skippable.
- **nothing else.** No document, no extracted text and no reconstruction is ever uploaded. That
  is a deliberate decision rather than an omission: the documents people put through this are
  copyrighted articles from a personal library, and sending them to a third-party converter is a
  licensing and privacy decision that a tool should not make on someone's behalf. See
  `ipsissima-mcp/eval/CONVERTER-FINDINGS.md`, where several otherwise-good converters were
  rejected for exactly this.

**Zotero is read-only.** The library is read from a *copy* of the database, never the live file,
and nothing is ever written into the storage tree.

**Publisher access stamps are removed.** A PDF served to a logged-in reader carries a line naming
the downloading institution on every page. Ipsissima strips those during ingest, because a
reconstruction is made to be shared and the manuscript travels inside it.

## The desktop application's file access

The Tauri shell asks the operating system for the narrowest permissions that let it work:
read and write text files, read directories, watch files, and open a file dialog. It has **no
network permission, no shell access and no process spawning**. Its scope is your home folder and
mounted volumes, with `~/.ssh`, `~/.aws`, `~/.gnupg` and the macOS keychains explicitly denied.
See `app/desktop/src-tauri/capabilities/default.json` — it is short on purpose and worth reading.

**Builds are unsigned.** macOS and Windows will both warn the first time. `app/desktop/INSTALL.md`
says exactly what you will see. Signing costs an Apple Developer membership and a Windows
code-signing certificate; until those exist, the honest thing is to say so rather than to look
trustworthy.

## Reporting a vulnerability

Open a **private security advisory** through GitHub's "Security" tab on this repository, rather
than a public issue.

Things worth reporting, in rough order of seriousness:

- anything that causes Ipsissima to make a network request
- anything that lets a `.argdown` file, or a manuscript, read or write a file outside the folder
  it was opened from
- script injection through a reconstruction's own content — the map draws claim text, and a
  reconstruction is a file people send each other
- a path traversal in the ingest tools

Ipsissima is a single-user desktop program with no server and no accounts, so the threat model is
narrow: it is about what a **malicious file** can do to someone who opens it.
