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

`server.py` used to state it a sixth time, hardcoded; it now reads the installed package's
metadata, which is why that one is not on the list and cannot drift.

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

**One repository, two applications.** They share a tag and nothing else: different users, different
install mechanisms, different update stories. Answer the two questions separately or you will give
one of them the other's answer.

### Ipsissima, the desktop application

**Help ▸ Check for Updates.** One HTTPS request to the GitHub releases API, made only when the
reader chooses it. It compares versions and reports; it downloads nothing and installs nothing.

Three decisions in that, each worth keeping:

- **The request is in Rust, not in the page.** The page is also `Ipsissima.html`, the file people
  email each other, and of *that* file it remains true without qualification that it makes no
  network request of any kind. Had the fetch gone in the frontend, the claim would have had to be
  softened for the web version too, for a feature the web version cannot use.
- **A menu item, not a startup check.** An application that contacts a server every time it opens
  is a different kind of thing to keep on a machine holding unpublished work, whatever the request
  contains.
- **It reports; it does not replace itself.** An application that can rewrite its own binary is a
  different kind of thing to trust, and this one has no need to be.

**It says how, not only that.** A version number and a URL somebody has to copy out of a text
banner by hand is a message that leaves the work undone. So the app names both versions, says the
new one installs over the old with nothing to uninstall first, says their reconstructions are not
involved, warns that the unsigned-download prompt will appear again — which is the thing that
stops people the second time as well as the first — and offers to open the download page in their
browser. That is what `open_releases_page` is for, and it takes no argument: the address is a
constant compiled in, so there is nothing for the frontend to pass and nothing to validate.

`Ipsissima.html` and `Ipsissima Reader.html` have no update check and cannot have one: they are
files somebody saved. They are re-downloaded. This is a good reason to keep the About box naming
its version.

### Ipsissima-MCP

**A `check_for_updates` tool.** A server has no menus, so the equivalent of a menu item is a tool
the reader asks for — *"is there a new version of Ipsissima?"* — and the same rules hold: only on
request, nothing sent, nothing installed. It is deliberately **not** folded into `plan_job`, where
it would fire every time somebody began a reconstruction and quietly become a startup check.

Installing the update is not the same job as for the app:

| how it was installed | how it updates |
|---|---|
| `.mcpb` bundle | download the new bundle and open it; Claude Desktop replaces the old |
| from source | `git pull` — an editable install needs nothing more |
| from an index, if ever published | `uvx` fetches the current release each run |

**It says how, and for the route they actually used.** The tool returns a `how` map rather than
one instruction, because somebody who double-clicked a file months ago does not think of
themselves as having "installed the .mcpb bundle" — so each route is labelled by what the reader
did, not by its name. It also says that **the application is a separate program on its own
schedule**: a new Ipsissima-MCP does not mean a new Ipsissima, and one repository makes that
easier to get wrong, not harder.

**The bundle format has no update feed.** There is no `update_url` in the manifest schema and no
mechanism for Claude Desktop to discover a newer bundle, so the tool is the only thing that will
tell a bundle user that one exists. That makes it more load-bearing here than the menu item is in
the app, not less.

### What this cost, and where it is written down

The absolute claim was in three files and all three now distinguish the two cases:

- `README.md` — the page makes none, the application makes one on request
- `site/index.md` — the same, noting the site's own copy has nothing of the sort
- `app/desktop/INSTALL.md` — the full statement, since that is the page somebody reads while being
  asked to click past a security warning

**If an automatic updater is ever added**, these are the files to revisit again, and the condition
to hold to is that it be opt-in, asked once, and default to off. A privacy claim that is true of
the version somebody read about and false of the version they are running is worse than never
having made it.

### Version comparison is not string comparison

Both checks compare numerically, component by component, and both have tests saying why:
**`"0.10.0"` sorts before `"0.9.0"` as text.** A tenth release would otherwise have told everybody
they were up to date — once, months from now, silently, and nobody would connect the two.

## Uninstalling

Covered for readers in `app/desktop/INSTALL.md` and `ipsissima-mcp/README.md`. For the app,
`node app/desktop/install.mjs --uninstall --dry-run` says what would go before anything does.
