# Issuing a release, and how updates reach people

There are four things to ship and they do not travel together: the desktop application, the
one-file web page, the MCP bundle, and the website. One tag builds and publishes all four.

`ipsissima-mcp/RELEASING.md` covers publishing the Python package to an index, which is a
separate decision and not part of this.

---

## Cutting a release

**1. One version, in five files.** Nothing keeps them in step, so `app/test_versions.mjs` checks
they agree and fails the suite when they do not:

- `app/desktop/package.json`
- `app/desktop/src-tauri/tauri.conf.json`
- `app/desktop/src-tauri/Cargo.toml`
- `ipsissima-mcp/manifest.json`
- `ipsissima-mcp/pyproject.toml`

**2. `cd app && npm test`.** Everything, including the wheel build and the bundled parser.

**3. Tag and push.**

```bash
git tag -a v0.2.0 -m "Ipsissima 0.2.0" && git push origin v0.2.0
```

`release.yml` builds on all three platforms, attaches the installers, the two HTML pages and the
`.mcpb`, and opens the release as a **draft**. `pages.yml` rebuilds the website from the same
push.

**4. Read the draft, then publish it.** Publishing is deliberately manual: the notes are written
once in the workflow and inherited by every tag, so this is the moment to notice that they no
longer describe what is being shipped.

### If a build fails after some jobs have succeeded

Delete the draft release before re-running, keeping the tag. Successful jobs upload as they
finish, so a re-run otherwise mixes artefacts built from two different commits into one release,
and nothing warns you.

---

## How an update reaches somebody

**Today: it does not, unless they look.** Ipsissima makes no network request of any kind — not
for updates, not for fonts, not for analytics — and that is a property worth more than
convenience for an application whose users open unpublished manuscripts in it. The cost is real
and should be stated rather than glossed: **somebody running a version with a bug will keep
running it until they happen to look at the releases page.**

The mitigation that costs nothing: tell people to press **Watch → Custom → Releases** on the
repository. GitHub then emails them, and the application stays silent.

### If that proves too slow, in order of what it costs

**Option A — a manual check.** A *Check for Updates…* item in the Help menu. One HTTPS request to
the GitHub releases API, made only when clicked, comparing versions and opening the releases page
in the browser if there is a newer one. It downloads nothing and installs nothing.

- The privacy claim becomes precise instead of absolute: *"makes no network request except the
  one you ask for by choosing Check for Updates"*. That is a sentence worth keeping, and it is
  still true of every other thing the app does.
- No signing keys, no new infrastructure, perhaps forty lines.
- **This is the recommended next step** if update uptake becomes a problem.

**Option B — the Tauri updater.** `tauri-plugin-updater` checks on launch, downloads and installs.

- Needs a minisign keypair (separate from code signing — an unsigned app can still use it), every
  release signed, and a `latest.json` published alongside the artefacts.
- Costs the claim properly: a request on every launch, before the user has done anything. If this
  is ever built it should be **opt-in, asked once on first run, and default to off** — an
  application that quietly contacts a server on launch is a different kind of thing from this
  one, whatever the request contains.

**What has to change in the documentation either way**, because the absolute claim appears in
three places and all three would become false:

- `README.md` — "makes no network requests of any kind"
- `site/index.md` — the same sentence
- `app/desktop/INSTALL.md` — "It makes no network requests at all. Not for updates, not for fonts,
  not for analytics."

Change all three in the same commit as the feature. A privacy claim that is true of the version
somebody read about and false of the version they are running is worse than never having made it.

### The other three things update differently

- **`Ipsissima.html`** — there is no update mechanism and cannot be one; it is a file somebody
  saved. They download a new one. This is a good reason to keep the page's About box naming its
  version.
- **The `.mcpb` bundle** — Claude Desktop manages extensions, and a newer bundle replaces the old.
- **The website** — rebuilt from `main` on every push, so it is never out of date. Note the
  consequence: **the site can be newer than the newest release**, and the samples it serves are
  built from `main` rather than from the tag. That is usually what you want and is occasionally
  confusing.

---

## Uninstalling

Covered for readers in `app/desktop/INSTALL.md` and `ipsissima-mcp/README.md`. For the app,
`node app/desktop/install.mjs --uninstall --dry-run` says what would go before anything does.
