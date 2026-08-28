# zotero-mcp, read against ours

Two questions about [zotero-mcp](https://github.com/54yyyu/zotero-mcp), asked on 27 Aug 2026 and
answered from its source rather than its README: how it reads the Zotero database without
damaging it, and what its `install-skill` command actually buys. Line numbers are from `main` as
of that date and will drift.

Everything below about locking was measured on this machine, against this Zotero, rather than
inferred. Where a measurement contradicts what a comment in either codebase says, the measurement
is what is reported.


## What they do

The direct SQLite access lives in one file, `src/zotero_mcp/local_db.py`, in
`LocalZoteroReader._get_connection` (line 676). It is three lines:

```python
uri = f"file:{self.db_path}?immutable=1"
self._connection = sqlite3.connect(uri, uri=True)
self._connection.row_factory = sqlite3.Row
```

No copy, no `busy_timeout`, no `PRAGMA` of any kind beyond registering a custom collation for
accent folding, no shared cache. The comment beside it gives the reason: Zotero "holds a write
lock while running, which blocks even read-only connections. `immutable=1` skips all lock checks
— safe here since we only read and tolerate slightly stale data."

The reasoning in that comment is wrong about the mechanism and right about the conclusion. It says
Zotero uses a rollback journal. This library does not: bytes 18 and 19 of the file header are both
`2`, which is WAL, and `zotero.sqlite-wal` and `zotero.sqlite-shm` are sitting beside it. But the
conclusion survives, because with Zotero running an ordinary read-only connection is refused
anyway:

```
mode=ro           FAIL OperationalError: database is locked   (after a 5s busy_timeout)
mode=ro&nolock=1  FAIL OperationalError: unable to open database file
immutable=1       OK   items=12347                            (0.01s)
```

So `immutable=1` is not laziness. It is the only URI that opens the live file at all while the
application holds it, and the price is exact and known: **an immutable read cannot see committed
transactions that are still in the WAL.** In a controlled test with one row committed after the
last checkpoint, `immutable=1` returned 2000 of 2001 rows and could not see the new one.

They know this, and it has cost them. `LocalZoteroReader.get_all_item_keys` (line 1176) exists for
no other purpose than to detect it, and its docstring says so — "an `immutable=1` read cannot see
rows that are still in an un-checkpointed WAL file". The consumer is
`SemanticSearch._verify_local_snapshot_version` in `semantic_search.py` (around line 1979), which
asks the running Zotero's HTTP API for every item key it knows about, subtracts the key set the
SQLite scan actually saw, and refuses to advance the incremental-sync watermark if anything is
missing. Without that, an item added minutes before a scan would be skipped by the index
permanently; that is their issue #292. The refinement is worth noting: the key set is captured on
the *same connection* the scan uses, because a fresh read taken later could already include rows
from a checkpoint that landed mid-scan, "masking the very staleness we check for."

Beyond that there is less than the reputation suggests. There is **no schema or version check** —
nothing reads the `version` table, `PRAGMA user_version` or `PRAGMA integrity_check`; `schema.py`
sounds like it might but is about Zotero's *global* item-type schema fetched from
`api.zotero.org/schema`, an unrelated thing. There is **no detection of whether Zotero is
running**; `immutable=1` makes the question moot. There is **no guard against reading mid-write**
at the point of reading — the guard is the after-the-fact reconciliation above, and it exists for
one consumer only.

What they do have is a careful failure policy. The SQL path is opt-in behind
`ZOTERO_SEARCH_BACKEND=sqlite` (`utils.py:181`) and requires `ZOTERO_LOCAL=true`. When a query
raises, `tools/search.py:226` logs at debug and falls through to the pyzotero API path — with one
deliberate exception: a cross-library search has no API equivalent, so it raises rather than
quietly returning a narrower answer. Database discovery (`_find_zotero_db`, line 618) reads
`extensions.zotero.dataDir` out of each profile's `prefs.js` before falling back to `~/Zotero`,
honours a `ZOTERO_DB_PATH` override, and names every path it checked when it fails.


## What we do

`from_zotero.py:38` takes the other route:

```python
tmp = Path(tempfile.mkdtemp()) / "z.sqlite"
shutil.copy(ZOTERO / "zotero.sqlite", tmp)
return sqlite3.connect(tmp)
```

The comment above it is correct in every particular — a reader that locks the file can stop the
application writing, and this takes no SQLite lock at all because it is a byte copy. On the safety
question the two projects are equivalent and both are fine: neither can write to the user's
database, and ours additionally cannot block it.

On the *correctness* question we have the same blind spot they have, arrived at by a different
road. Copying `zotero.sqlite` and leaving `zotero.sqlite-wal` behind produces a database whose
header says WAL and which has no WAL to recover, so SQLite reads the last checkpointed state and
reports nothing amiss. Measured on the same 2001-row test: **the copy returned 2000 rows and
could not see the new one, identically to `immutable=1`.**

This matters more for us than for them. `from_zotero.py`'s own opening paragraph says the file is
on disk before this toolchain is asked anything, because the connector saved it. The interval
between the connector saving a paper and Zotero checkpointing its WAL is precisely when a user
would ask us to read it — and what we return in that interval is `nothing in Zotero matches, or
its files are not stored locally`, which reads as a statement about the library rather than about
our snapshot.

Two smaller things. The temporary directory from `mkdtemp()` is never removed and the connection
is never closed, so every `zotero_lookup` leaves a copy behind for the life of the machine. And
the copy is cheaper than it looks — 0.06 s for the 56 MB file here — so the cost of this design is
tidiness, not speed.

The query in `attachments()` has no `deletedItems` exclusion and no `ORDER BY`. Both are real
gaps, and it is worth being accurate about how real. Measured against the library as it stands:
3,096 attachments match the current `WHERE ia.path LIKE 'storage:%'`; **none** of those
attachments is itself in the trash, and **eleven** belong to a parent item that is. There are
**zero** cases where a trashed HTML snapshot would outrank a live PDF under our `ROUTES` order —
so the exact bug zotero-mcp shipped a fix for (their #427, a trashed connector snapshot beating
the real PDF) is latent here, not active. The eleven trashed parents are the live exposure: a
title-fragment lookup can match a paper the user deleted and hand it back as though it were part
of the library.

The linked-file gap is smaller still. `path LIKE 'storage:%'` cannot see attachments stored
outside the Zotero tree, and zotero-mcp reads `extensions.zotero.baseAttachmentPath` from
`prefs.js` to resolve them. This library has no such attachments at all: the `linkMode` census is
674 imported files, 2,486 imported URLs, 245 linked URLs (which have no file), and no linked
files. Nothing is being missed today.


## What is worth taking

**Copy the WAL.** This is the one finding that changes behaviour, and it is one line. Copying
`zotero.sqlite` and `zotero.sqlite-wal` together closes the blind spot completely — 2001 of 2001
rows in the same test — and the `-shm` is not needed, since SQLite rebuilds it during recovery.
Two constraints: copy the main file *first* and the WAL second, so that a checkpoint landing
between the two can only leave the WAL ahead of the main file rather than behind it (a WAL whose
salt no longer matches is ignored, which degrades to today's behaviour rather than to corruption);
and open the copy normally, because opening it with `immutable=1` disables WAL recovery and
re-opens the very hole this closes. This is the one place where the right answer is better than
either project's current one.

**Exclude the trash.** One clause on the attachment and one on the parent. Eleven items are
currently reachable that should not be, and the cost of the failure — a reconstruction of a paper
the user deleted, discovered late — is far above the cost of the clause.

**Order the result.** `best()` walks the list in whatever order SQLite happened to return it, so
an item with two HTML snapshots gets an arbitrary pick that can differ between runs on the same
library. A deterministic `ORDER BY` makes the tool answer the same question the same way twice,
which is a precondition for the provenance this project is built on.

**The installer pattern from `install-skill`** — see below. This is the genuinely portable idea in
the whole repository, and it has nothing to do with SQLite.

**Read the schema version, once.** Cheap insurance that zotero-mcp does not have. `SELECT version
FROM version WHERE schema='userdata'` returns 129 here; `compatibility` is 9. Our SQL is
hand-written against an unversioned layout, and the failure mode of a schema change is not an
exception but a wrong or empty answer. Refusing loudly above a known-good ceiling is better than
that. This is insurance rather than urgency — the `itemAttachments` / `itemData` shape has been
stable for years.


## What is not worth taking, and why

**`immutable=1` in place of the copy.** It is the headline precaution and it would be a
regression. It buys us nothing we need — we read once per lookup and the copy costs 0.06 s — while
costing the WAL, which is the thing actually worth fixing. It is also, on its own terms, the case
the SQLite documentation warns about: declaring a file immutable when it demonstrably is not.
Their reason for reaching for it is real, and it is a reason to *keep* the copy rather than to
adopt the immutable read: an ordinary `mode=ro` connection is refused while Zotero runs, so the
copy is what buys us a readable file at all.

**The API cross-check.** `_verify_local_snapshot_version` is good engineering for a problem we do
not have. It exists because zotero-mcp maintains a persistent index behind a sync watermark that,
once advanced past unseen items, skips them forever; the reconciliation stops one transient miss
becoming permanent. We hold no index and no watermark — every lookup reads fresh — so a miss
costs one retry. Copying the WAL addresses the same underlying fact for a fraction of the
machinery, and leaves nothing to reconcile afterwards.

**A `busy_timeout`.** Meaningless in either design. `shutil.copy` takes no SQLite lock; neither
does an immutable read. The probe above shows a five-second timeout does not rescue `mode=ro`
against a running Zotero — the lock is held for the session, not transiently.

**Shared cache.** One connection, one read, no relevance.

**Detecting whether Zotero is running.** Neither project needs it, and there is nothing we would
do differently with the knowledge.

**The opt-in-with-silent-fallback architecture.** zotero-mcp can afford `ZOTERO_SEARCH_BACKEND` and
a quiet fallback because there is an HTTP API underneath to fall back *to*. We have none, and a
silent fallback to nothing is worse than an error. `server.py:569` already handles the only case
that matters, and handles it the right way round: no Zotero, no tool.


## Recommended changes to `from_zotero.py`, in order

1. **Copy `zotero.sqlite-wal` alongside `zotero.sqlite` in `_db()`, main file first, and keep
   opening the copy without `immutable`.** Closes a silent wrong-answer path in exactly the
   workflow the module's docstring describes: a paper saved by the connector is invisible to us
   until Zotero checkpoints, and the tool reports it as a fact about the library. Measured: main
   file alone sees 2000 of 2001 rows, main plus WAL sees 2001.

2. **Exclude trashed rows from `attachments()`** — `att.itemID NOT IN (SELECT itemID FROM
   deletedItems)` and the same for `parent.itemID`. Eleven items in this library are currently
   reachable through a deleted parent; the attachment-level case is the bug zotero-mcp shipped a
   fix for and is latent here rather than active.

3. **Release the copy.** Hold the temp directory for the call and delete it, and close the
   connection — `tempfile.TemporaryDirectory` in a context manager, or an explicit `finally`.
   Every lookup currently leaves 56 MB behind until the machine is rebooted.

4. **Add a deterministic `ORDER BY`** to the attachment query so `best()` returns the same
   attachment on every run of the same library. Newest first (`att.dateAdded DESC`) is the
   defensible default: where a snapshot has been re-saved, the later one is the one the user meant.

5. **Escape `%` and `_` in the title fragment** before interpolating it into the `LIKE`, with
   `ESCAPE '\'`. Today those characters are silently wildcards in what the user typed as a
   literal. zotero-mcp treats this as a correctness requirement and shares one definition of it
   between its two backends (`search_semantics.py`).

6. **Check `SELECT version FROM version WHERE schema='userdata'` once per connection**, and refuse
   with a clear message above a known-good ceiling rather than returning a wrong answer against a
   changed layout. Currently 129.

7. **Stop hard-coding `~/Zotero`.** Read `extensions.zotero.dataDir` from the profile's `prefs.js`
   (macOS: `~/Library/Application Support/Zotero/Profiles/*/prefs.js`) and honour an environment
   override, as `_find_zotero_db` does. Lowest priority because the default path is correct on this
   machine — but the failure is invisible: `_zotero_available()` gates tool *registration*, so a
   relocated data directory does not produce an error, it produces a server with no Zotero tool and
   nothing that says why.

Not recommended: resolving linked-file attachments via `baseAttachmentPath`. The mechanism is
sound and this library contains no linked files at all, so it would be untested code guarding
nothing. Worth revisiting if that census ever changes.


## `install-skill`, and what it is actually for

The command lives in `src/zotero_mcp/skill_install.py`. It copies
`src/zotero_mcp/skills/zotero-cli/` — a 5.7 KB `SKILL.md` and a 10.9 KB generated `reference.md` —
into whichever agent harness it finds in the current project: `.claude/skills/zotero-cli/`,
`.cursor/rules/zotero-cli.mdc`, `.windsurf/rules/zotero-cli.md`, or, for `AGENTS.md` and
`GEMINI.md`, a short *pointer* block written between managed markers (line 42) and upserted in
place, never appended twice. A destination that exists and differs is reported rather than
replaced unless `--force` is passed.

The mechanism is worth stating precisely, because the obvious guess is wrong. The skill does not
teach the model to use the MCP tools well so that it stops making exploratory calls. It teaches
the model to use `zotero-cli`, a separate command-line program, **instead of** the MCP server; its
second paragraph says so outright. The saving is not fewer calls, it is a tool surface that is
never sent at all. An MCP server transmits every enabled tool's name, description and JSON
parameter schema on every request, before the user has typed anything; a skill's frontmatter is
all that sits in context until the model decides the skill applies.

They measure it rather than assert it. `scripts/measure_context_cost.py` serialises each tool
exactly as an MCP `tools/list` entry — including the parameter schema, which is most of the wire
size — and counts `cl100k_base` tokens: **13,448 for 38 tools** in the default profile, against
**98** for the skill's frontmatter and **1,368** once the body loads. `tests/test_context_cost_claim.py`
asserts the *relationship* rather than the numbers, so ordinary edits do not fail the build but a
change that invalidates the claim does. Their own caveat is repeated three times and deserves
repeating here: this is the fixed cost only, and "a cheaper surface that gets the answer wrong is
not cheaper."

One qualification they cannot have anticipated. In this harness the MCP tool schemas are
*deferred* — this session lists some forty `mcp__zotero__*` tools by name alone and fetches a
schema only when one is called. The 13,448-token figure is what a client that sends full schemas
pays, which is Claude Desktop and most of the field; here the standing cost is much closer to the
names. The argument is real but it is not universal, and it is weakest in exactly the client where
we do most of our work.


## Whether we should do the same

Not for the cost. Measured the same way — approximately, since `tiktoken` is not installed here
and these are chars/4 — the entire ipsissima-mcp surface is about **2,300 tokens over nine tools**,
plus roughly 160 for two prompts and 440 for eight resource descriptions: call it 2,900 against
their 13,448. `docs/SKILL.md` is about 1,760 tokens whole and 101 as frontmatter. Swapping the
server for the skill would save on the order of two thousand tokens per request in a
schema-sending client and nothing measurable in this one. That is not a problem worth
restructuring around, and the tools are not thin wrappers besides: `plan_job`, `extract_text` and
`check_reconstruction` orchestrate subprocesses and return structured results the model acts on,
and their descriptions are what make the sequencing legible in the first place.

The transferable idea is the installer, and it points at something missing. `docs/SKILL.md`
already carries correct skill frontmatter — `name: argdown`, a description written to trigger on
the right requests — but nothing puts it where a harness will look. There is no `.claude/skills/`
in this repository (`.claude/` exists and is empty) and none under `~/.claude/`. So the file is a
skill in form and a document in fact, found only by an agent that already knows to read it, or by
`eval/baseline-instructions`. NOTES.md refers to it as "the `argdown` skill", which is what it
should be and is not yet.

Two of their choices are worth copying exactly if that gap is closed. **A pointer block rather
than the whole body in shared instruction files** — pasting 1,400 tokens into every agent's
always-loaded context spends precisely the advantage the arrangement exists for. And **managed
markers with refuse-rather-than-overwrite**, so re-running is idempotent and a hand-edited
`AGENTS.md` is safe by construction rather than by care.

One trap specific to us: `SKILL.md` refers to seven sibling documents by bare filename, and its
closing table is entirely such references. They resolve only if the files travel with it. An
installer must copy the directory or rewrite those to absolute paths, or the skill installs
cleanly and its whole read-on-demand structure dead-ends.


## Their skill, for finding papers

Worth installing, in the right place. `zotero-cli` is already on this machine at
`~/.local/bin/zotero-cli` and already configured: `zotero-cli config` reports `ZOTERO_LOCAL=true`
with an API key and library id present. The content is a sound operating manual for corpus work —
the find-keys-then-act loop, `--json` for parseable output, when `semantic` beats `items` beats
`tag`, reading a PDF by outline-then-page-range rather than whole. Two lines in it are worth more
than the rest for this particular job: *"Do not report 'you have no papers on X' until you know the
library is actually reachable and indexed"*, and *"An item marked `deleted: true` is in the trash.
Do not treat it as part of the live library."* Those are the two failure modes that would quietly
corrupt a corpus selection, and both are the same class of error as the trashed-parent gap above.

Two caveats. It teaches a **write-capable** CLI — its Writing section covers `add`, `edit`, `notes
create`, `batch` and `delete` — so installing it at user scope puts those instructions in front of
every agent in every project, and installing it at project scope inside this repository would sit
badly beside a project whose stated position is that it never writes to Zotero. The clean
arrangement is to install it in whatever workspace the library-tending actually happens in, and
not in this one. (The write surface is present in this session regardless: `zotero_add_item`,
`zotero_update_item` and `zotero_delete_item` are among the MCP tools already available.) And
`--all-libraries`, which the skill recommends whenever a search comes up empty, requires
`ZOTERO_SEARCH_BACKEND=sqlite`; that is not in the config output above, so it will be refused
until it is set.
