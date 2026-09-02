# Can Ipsissima move from GPL-3.0 to MIT?

> **It did. Option B was implemented on 2 September 2026**: the repository root is MIT,
> `ipsissima-mcp/` keeps GPL-3.0-or-later with its own `LICENSE` file, the four attribution
> gaps of §8 are closed, and the Deep Drafter comparison of §5 has been re-run and recorded.
> §11 lists exactly what was changed. The analysis below is kept as the record of why.

Written 27 August 2026 against the tree at `faadf52`; **revised 2 September 2026 against
`a0d8b3f`**, re-running the mechanical checks — §10 lists what changed in between. Line numbers
are against the revision commit; check a citation before quoting it in anything binding. The
question came from one place: **Argdown
is MIT, and a GPL-3.0 Ipsissima is a one-way valve.** Code can come in and nothing can go back —
so the layout work done here, which is the piece most obviously useful to the project it was
built on top of, cannot be returned. (When first written, that layout sat on dagre; since
`a79576d`, 29 August, the layout engine is wholly this project's own code, which only sharpens
the point — what Argdown could take back is now entirely first-party.) The goal is outbound
permissiveness, and the answer turns entirely on what comes *in*.

**Neither the author of this document nor the owner of this project is a lawyer.** That is not a
disclaimer bolted on at the end; it is the reason for the convention below, which is used
throughout and is the only thing that makes this document safe to act on.

> **[verified]** — a mechanical fact, checked against a file in this tree, with the check named.
> Someone else running the same command gets the same answer.
>
> **[judgement]** — a reading of a licence. Stated as a reading, with the alternative given where
> there is one. **Every one of these needs a human before anything is signed.**

The short version: **`app/` is clear and could be MIT tomorrow. `ipsissima-mcp/` is not, and the
thing stopping it is PyMuPDF, which is AGPL-3.0. And the goal that prompted the question only ever
needed `app/`.**

---

## 1. The verdict

**Conditional — and the condition is a boundary, not a blocker.** *(The boundary was drawn on
2 September 2026 — see §11.)*

| | |
|---|---|
| **`app/`** — viewer, editor, desktop shell | **Nothing blocks MIT.** Zero copyleft in anything bundled, vendored, or built with. |
| **`ipsissima-mcp/`** — the Python ingest half | **Blocked.** `pymupdf` and `pymupdf4llm` are AGPL-3.0-or-commercial and are hard dependencies. |
| **`samples/`** | Not affected. Each text carries its own licence already and is not covered by the repository's. |

The layout code Argdown would want is in `app/src/argdown-live-map.js`,
`app/argdown-graph.mjs` and `app/map_quality.mjs` — since 29 August wholly first-party, with no
dagre underneath it. **None of it is anywhere near the Python.** The
motivating goal is reachable by relicensing `app/` alone and leaving `ipsissima-mcp/` where it is.

---

## 2. What is bundled, and what is only used to build

This is the distinction the whole audit rests on, and it is worth saying why. A dependency that is
*compiled into* `Ipsissima.html` travels to every recipient and its licence travels with it. A
dependency that only runs on the build machine — esbuild, the typechecker, the Argdown CLI — is
never distributed, and its licence constrains nothing about the artifact. `app/package.json`'s own
`dependencies`/`devDependencies` split **does not** track this distinction: `markdown-it` and
`docx` are devDependencies and are bundled; `@argdown/cli` is a dependency and is not.

**[verified]** The bundled set was determined by re-running the four esbuild invocations from
`build_argdown_viewer.mjs` with `--metafile` and reading the module list out, rather than by
reading the manifest. **41 distinct npm packages** reach the page — plus JSZip, which the metafile
cannot see because `docx` ships it already inlined in its own prebundled ESM, and which was found
by grepping the built bundle instead.

**[verified, 2 Sept]** The bundled set is unchanged since 27 August except that dagre is gone:
the lockfile diff `faadf52..a0d8b3f` removes only `@dagrejs/dagre` and `@dagrejs/graphlib`, adds
only packages in build-tool trees (`@anthropic-ai/mcpb`, `playwright`, and their dependencies,
none of which reach the page), and bumps no version of any bundled package — `markdown-it`
15.0.0, `entities` 8.0.0 and `js-yaml` 5.3.0 were re-read from `node_modules` and match the table
below.

### Bundled into the built HTML

| dependency | licence | which build | compatible with outbound MIT? |
|---|---|---|---|
| `@argdown/core` 2.0.1 | MIT | both | yes |
| `@argdown/highlightjs` 2.0.0 | MIT | both | yes |
| `chevrotain` 11.2.0 + `@chevrotain/{gast,regexp-to-ast,utils}` | **Apache-2.0** | both | yes — see §2.3 |
| `@hpcc-js/wasm-graphviz` 1.28.0 | **Apache-2.0** | both | yes — 4.9 KB of tree-shaken tables only |
| `highlight.js` 11.11.1 | **BSD-3-Clause** | both | yes, with notice retained |
| `js-yaml` 5.3.0 | MIT | both | yes |
| `lodash-es`, `lodash.{clonedeep,deburr,defaultsdeep,last,merge,partialright,union}` | MIT | both | yes |
| `xmlbuilder` 15.1.1 | MIT | both | yes |
| `string-pixel-width` 1.11.0 | MIT | both | yes |
| `eventemitter3`, `mdurl`, `punycode` | MIT | both | yes |
| `markdown-it` 15.0.0 + `markdown-it-footnote` 4.0.0 | MIT | both | yes |
| `linkify-it`, `uc.micro`, `punycode.js` | MIT | both | yes |
| `entities` 8.0.0 | **BSD-2-Clause** | both | yes, with notice retained |
| `docx` 9.7.1 | MIT | both | yes |
| ↳ `jszip` 3.10.1, inlined inside docx's own bundle | **MIT *or* GPL-3.0-or-later, at your choice** | both | yes — see §2.4 |
| `@codemirror/*` ×6, `@lezer/{common,highlight}`, `codemirror` | MIT | editor only | yes |
| `crelt`, `style-mod`, `w3c-keyname`, `@marijn/find-cluster-break` | MIT | editor only | yes |
| ~~`dagre` + `graphlib`, vendored at `app/vendor/dagre.min.js`~~ | MIT | — | **retired 29 August** (`a79576d`): the bundle carries no layout engine, the vendored file and `dagre.LICENSE` are deleted, and the debt is recorded in `CREDITS.md` |
| **ArgVu**, embedded as a base64 WOFF2 data URI | **Bitstream Vera Fonts licence** | both | **stays under its own licence** — see §2.5 |

"both" means `Ipsissima.html` and `Ipsissima Reader.html` alike. **[verified]** at
`build_argdown_viewer.mjs:576–651`: only the CodeMirror bundle is gated on `--editor`; the docx
exporter is in every standalone build, because "a standalone viewer can be handed any file,
including one full of comments".

### Build-time only, never distributed

| dependency | licence | why it never ships |
|---|---|---|
| `@argdown/cli` 2.0.0 and the 149-entry tree beneath it — `pdfkit`, `fontkit`, `axios`, `yargs`, `png-js`, `brotli`, … | MIT / ISC / BSD / Apache-2.0 / `Python-2.0` (`argparse`) / BlueOak-1.0.0 / `(MIT AND Zlib)` (`pako`) | validator and Node-side renderer; `build_argdown_viewer.mjs` imports `@argdown/node`, and only `@argdown/core` is bundled for the browser |
| `esbuild` 0.28.x | MIT | the bundler itself |
| `typescript` 5.9 | Apache-2.0 | `tsc` does not emit — see `app/tsconfig.json` |
| `@tauri-apps/cli` 2.11.4 | Apache-2.0 OR MIT | packages the desktop app |
| `@argdown/pandoc-filter` 2.0.1 | MIT | used by `argdown-live-filter.mjs` for pandoc documents, not by the viewer |

**[verified]** Every one of the **178** installed packages under `app/node_modules` was read for
its `license` field. The only non-permissive string anywhere in the tree is `jszip`'s dual
`(MIT OR GPL-3.0-or-later)`. `png-js` declares no `license` field but ships a plain MIT `LICENSE`
naming Devon Govett. **There is no GPL-only, LGPL or AGPL package in the JavaScript half at all.**

### 2.3 Apache-2.0 in an MIT work

**[judgement]** Apache-2.0 code cannot be sublicensed as MIT; it stays Apache-2.0 inside a larger
work whose own code is MIT. §4 then asks for the licence text to travel and for existing notices
to be retained. `chevrotain`, `@hpcc-js/wasm-graphviz` and `typescript` ship a `LICENSE` and **no
`NOTICE` file** — **[verified]** by listing each package directory — so §4(d), the clause people
usually trip on, does not bite. This is a place where MIT is *easier* than the status quo: the
current GPL-3.0 build depends on Apache-2.0's one-way compatibility with GPLv3, which is a live
constraint. Under MIT there is no combined-work licence to reconcile at all, only notices.

**[verified]** `@hpcc-js/wasm-graphviz` contributes 4,912 bytes to the parser bundle — attribute
tables, tree-shaken. The package ships `dist/index.js` and nothing else; **no Graphviz WebAssembly
binary is present in the package or in the built page.** This matters because Graphviz itself
carries EPL/CPL terms rather than Apache-2.0, and none of it is here.

### 2.4 JSZip's dual licence

**[verified]** `docx`'s prebundled ESM inlines JSZip; six `JSZip` identifiers survive minification
in the export bundle. `jszip@3.10.1` declares `(MIT OR GPL-3.0-or-later)` and its
`LICENSE.markdown` opens: "JSZip is dual licensed. At your choice you may use it under the MIT
license *or* the GPLv3 license."

**[judgement]** The recipient's choice is MIT, and an MIT-licensed Ipsissima would simply be
exercising the option the copyright holders offered. This is the ordinary reading of a dual
licence and is not a close call — but it is worth writing down that the project *relies* on the
choice, because a future JSZip that dropped the MIT arm would silently become a problem.

### 2.5 ArgVu, which cannot become MIT

**[verified]** `app/vendor/ArgVu/LICENSE.md` is the Bitstream Vera Fonts licence, with Arev
(Tavmjong Bah) and AMSFonts sections; ArgVu's and DejaVu's own changes are dedicated to the public
domain. It is permissive, but it is **not MIT**, and it carries two conditions MIT does not:

- a modified font must be **renamed** to drop "Bitstream" / "Vera";
- the Font Software may be sold as part of a larger package but **no copy of a typeface may be
  sold by itself**.

**[verified]** `build_argdown_viewer.mjs:517–520` embeds the WOFF2 as base64. Every built page
therefore *contains a copy of the Font Software*, and the licence says its permission notice
"shall be included in all copies".

**[judgement]** The font stays under its own licence whatever the surrounding code does. The
practical consequence of moving to MIT is one of *phrasing*: "Ipsissima is GPL-3.0" was never read
as a claim about the bundled font, whereas "Ipsissima is MIT" invites exactly that reading, so the
carve-out has to be said out loud. `app/vendor/ArgVu/PROVENANCE.md:12` currently says the licence
"is compatible with GPL-3.0" — true, and it needs a second sentence rather than a correction.

For the motivating goal this is a non-issue: **Argdown ships ArgVu itself.**

### 2.6 The Argdown shim, vendored into the Python package *(new since 27 August)*

**[verified]** The Python package now ships a JavaScript file:
`ipsissima-mcp/src/ipsissima_mcp/vendor/argdown-cli.mjs`, a 2.7 MB esbuild bundle of the two
Argdown CLI commands the checker uses. It is committed to the tree, and
`[tool.setuptools.package-data]` puts it inside the wheel — so it now travels in every PyPI
install and in the `.mcpb` bundle attached to releases. Re-running its build
(`app/build_argdown_shim.mjs`) with `--metafile` on 2 September: **91 npm packages reach the
bundle**, every one permissive — MIT for the bulk (`@argdown/node`, `pdfkit`, `fontkit`, `axios`,
the lodash family, …), Apache-2.0 for `chevrotain`, `@hpcc-js/wasm-graphviz` and `@swc/helpers`,
BSD-3-Clause for `highlight.js` and `ieee754`, BlueOak-1.0.0 for `glob`, 0BSD for `tslib`, and
`png-js` with no `license` field but a plain MIT `LICENSE` file. **No copyleft.**

**[judgement]** Permissive JavaScript inside a GPL-3.0 wheel is the easy direction, and this
changes nothing about §4's blocker. Two things are worth writing down anyway. First, the bundle
is minified with `legalComments: "none"` (`build_argdown_shim.mjs:46`), so the attribution gap of
§8 now applies to the PyPI wheel and the `.mcpb` as well as to the built HTML. Second, if
`ipsissima-mcp/` is ever relicensed, this vendored bundle is not what stands in the way —
PyMuPDF is.

---

## 3. The desktop application — Rust

**[verified]** As of 27 August, `app/desktop/src-tauri/Cargo.lock` resolved **490 entries** (489
crates plus `ipsissima` itself). 263 were present in the local registry cache and were read directly for their
`license` field. The other 227 are simply not in this Mac's cache — a set dominated by Linux,
Windows, Android and wasm targets that were never built here, but not exclusively so, and **their
licences are unverified rather than known-good**. `cargo` is not on this machine's `PATH`, so
`cargo license` was not available and the cache was read directly instead.

Of the 263 verified: **zero copyleft.** The distribution is `MIT OR Apache-2.0` (120), `MIT` (45),
`Apache-2.0 OR MIT` (31), `Unicode-3.0` (18, the ICU crates), `MIT/Apache-2.0` (14),
`Zlib OR Apache-2.0 OR MIT` (8), `Unlicense OR MIT` (5), **`MPL-2.0` (5)**, and single-figure tails
of BSD-2/3, `CC0-1.0`, `0BSD` and `Zlib`. `tauri`, `tauri-build`, `wry`, `muda` and every
`tauri-plugin-*` are `Apache-2.0 OR MIT`; `tao` is **Apache-2.0 only**; `notify` is `CC0-1.0`.

The five MPL-2.0 crates are `cssparser`, `cssparser-macros`, `dtoa-short`, `option-ext` and
`selectors`. **[judgement]** MPL-2.0 is file-level copyleft: those files stay MPL, and a larger
work that merely links them may be distributed under other terms. This is the same position they
already occupy in the GPL build and MIT does not change it.

**[verified, 2 Sept]** The lock now resolves **532 entries**, and the growth is one feature:
`reqwest` 0.13 (`rustls`, `json`, `system-proxy`) was added for Help ▸ Check for Updates
(`Cargo.toml` says why), bringing the rustls TLS stack with it. The new crates readable from the
local cache: `ring` is `Apache-2.0 AND ISC`; `aws-lc-rs` is `ISC AND (Apache-2.0 OR ISC)` and
`aws-lc-sys` a longer compound of the same permissive parts; `rustls` is
`Apache-2.0 OR ISC OR MIT`; `rustls-webpki` and `untrusted` are ISC; `subtle` is BSD-3-Clause;
the `quinn` / `zeroize` / `rand` group is `MIT OR Apache-2.0`. `webpki-root-certs` 1.0.9 is not
in the cache; crates.io reports **CDLA-Permissive-2.0** — the Mozilla/CCADB root store shipped as
data. **Still zero copyleft** among everything readable. Incidentally, the update checker is the
first code in the desktop binary that touches the network at all — worth knowing next to the
AGPL §13 discussion, even though nothing on the Rust side is AGPL.

**[judgement]** The one thing worth a second look is the **Linux** build, which is not covered by
the 263 verified crates. Tauri on Linux draws through WebKitGTK and GTK3 via the `webkit2gtk`,
`gtk`, `soup3` and `javascriptcore-rs` binding crates. The Rust bindings are permissive; **the C
libraries they bind are LGPL-2.1**, dynamically linked, and supplied by the user's distribution
rather than by us. The usual reading is that dynamic linking against a system LGPL library is fine
for a permissively-licensed application provided the relinking freedom is preserved, which a
distro-supplied shared library preserves by construction. macOS uses WKWebView and Windows uses
the Microsoft WebView2 runtime, neither of which is copyleft. **This is unchanged by the move to
MIT** — it is a fact about Tauri on Linux, not about Ipsissima — but it is the sort of thing that
should be known rather than discovered.

---

## 4. The Python half, and exactly where it stops

**This is the blocker, and it is a real one.**

**[verified]** `ipsissima-mcp/pyproject.toml` declares seven hard dependencies — unchanged on
2 September, though the `.venv` these versions were read from has since been removed, so the
installed-version column is as of 27 August. Read from the
installed distributions in `.venv`:

| dependency | installed | licence | outbound MIT? |
|---|---|---|---|
| **`pymupdf`** | 1.28.2 | **Dual Licensed — GNU AFFERO GPL 3.0 or Artifex Commercial License** | **no** |
| **`pymupdf4llm`** | 1.28.2 | **same** | **no** |
| **`pymupdf-layout`** (transitive) | 1.28.2 | **same** | **no** |
| `mcp` | 2.0.0 | MIT | yes |
| `rapidocr` | 3.9.2 | Apache-2.0 | yes |
| `onnxruntime` | 1.29.0 | MIT | yes |
| `beautifulsoup4` | 4.15.0 | MIT | yes |
| `lxml` | 6.1.2 | BSD-3-Clause | yes |

**[verified]** Of the 58 distributions in `.venv`, the only other copyleft strings are `certifi`
(MPL-2.0) and `tqdm` (`MPL-2.0 AND MIT`) — file-level, and not an obstacle. `pyzotero`, the one
optional extra, is not installed and was not checked.

**[verified]** PyMuPDF is not a corner of the codebase. Five of the seventeen modules reach it
(re-checked 2 Sept — the three modules added since, `validity.py`, `tei_to_source.py` and
`from_zotero.py`, import none of it; `validity.py` is standard library only, and the z3 in
`eval/validity/difftest_z3.py` is an eval-only manual install, not a dependency):

- `pdf_to_source.py:47` — a **top-level, unconditional** `import pymupdf`, in the module
  that recovers paragraph structure from ink positions;
- `ingest.py:173,276`, `server.py:337,436`, `paginate.py:65`, `sources.py:90` — function-local
  imports, deferred but not optional: the code path fails without them.

**[judgement]** The AGPL's reach over a Python program that imports an AGPL library is the whole
question, and it is a reading rather than a fact. The Free Software Foundation's position — and
the position Artifex's commercial licensing business depends on — is that importing a library
forms a combined work that must be distributed under the AGPL. The counter-argument that
dynamic-language imports are arm's-length has never, as far as this audit found, been tested in
court. **Someone qualified has to decide this.** But the practical posture is not in doubt:
publishing `ipsissima-mcp` as MIT while it imports PyMuPDF would be making a promise the project
may not be in a position to keep.

**[judgement]** A finding that is *independent* of the MIT question and should be looked at
anyway: `ipsissima-mcp` is currently declared `GPL-3.0-or-later`, and GPLv3 §13 does permit
combination with AGPLv3 code — but the AGPL portion keeps its network-interaction obligation.
For a tool that runs an **MCP server**, that clause is not hypothetical. Whether the current
declaration understates the position is a question for the same lawyer, and it exists today.

**[verified, 2 Sept]** And it is more pressing than it was: distribution has stopped being
hypothetical. `.github/workflows/publish-pypi.yml` now publishes the wheel and sdist to PyPI by
trusted publishing, and `release.yml` attaches a `.mcpb` bundle to every GitHub release. The
distribution the AGPL question attaches to is public and versioned, which moves §9's question 2
up the list.

### `pandoc` is a different situation, and the difference is decisive

**[verified]** pandoc is **never linked**. `ingest.py:55` and `epub_to_source.py:101–103` locate a
`pandoc` binary via `shutil.which` (falling back to a Zettlr-bundled copy) and run it as a
**separate process**, exchanging bytes. It is not in `pyproject.toml`'s dependencies at all — the
user is expected to already have it.

**[judgement]** pandoc is GPL-2.0-or-later. Invoking a GPL program as a separate process at
arm's length, over stdin/stdout, is the textbook case of *not* forming a combined work — it is
the same relationship a Makefile has with `gcc`. This is the most settled judgement in this
document, and pandoc does not constrain Ipsissima's licence in either direction.

**[verified]** The same is true of the one call in the other direction:
`build_argdown_viewer.mjs:456` spawns `check_argdown.py` as a subprocess to derive fidelity
borders. `check_argdown.py` and `argdown_provenance.py` import **only the Python standard
library** — no PyMuPDF anywhere in that path — and the call is wrapped in a `try` that degrades to
"the borders are as declared". So `app/` does not reach the AGPL surface even indirectly, and does
not require the Python half to build at all.

---

## 5. Provenance: the Deep Drafter claim

`README.md` says Ipsissima "began inside a copy of Simon Goldstein's Deep Drafter, though it
shares no code with it". If GPL code had actually been copied in, that would end the discussion,
so the claim is worth checking rather than repeating.

What can be verified from this repository:

- **[verified]** There is exactly one root commit, `221f1dd`, 22 August 2026, "Ipsissima and
  Ipsissima-MCP, extracted from the Deep Drafter workspace". Its message records what was
  deliberately left behind. 108 files. **There is no pre-extraction history in this tree**, so git
  cannot corroborate or refute anything about the period before it.
- **[verified]** `LICENSE` was added in that same root commit and has never been touched since. The
  project has been GPL-3.0 from its first commit; there is no earlier licence to reconcile.
- **[verified]** No first-party source file — `.mjs`, `.js`, `.py`, `.rs` — contains a third-party
  copyright line, an `@license` annotation, or an SPDX identifier. A grep for
  `Copyright (c)` / `Copyright ©` across the whole tree, excluding `node_modules`, `.venv` and
  `app/vendor`, returns **nothing**. Re-run 2 September over the ~90 files added since, including
  the new `site/`: still nothing.
- **[verified]** The only "ported from" note in first-party code is
  `app/src/argdown-positions.js:170`, and it points at `argdown_provenance.py` — this project's own
  Python.
- **[verified]** Deep Drafter is MIT, per `CREDITS.md`. Even a shared line would not block MIT; it
  would only require attribution.

**[judgement]** `CREDITS.md` states the comparison that was actually run: "of some 2,400
distinctive lines of Python, five are shared, and all five are in files that were Ipsissima's own
ancestors sitting in that workspace. Deep Drafter contains no JavaScript at all." **That
comparison is not reproducible from this repository** — the other tree is not here. It is the
owner's own testimony, it is specific enough to be falsifiable, and it points the right way, but
this audit did not independently verify it. If certainty is wanted before relicensing, re-running
that diff and recording the command and its output is an hour's work.

**[verified, 2 Sept] The comparison was re-run before relicensing, against the owner's local
copy of the Deep Drafter workspace** (a `deep-drafter-main` tree outside this repository).
Method, so the run is reproducible: every `.py` line in each tree (Ipsissima excluding `.venv`,
`node_modules` and `.claude`), stripped of surrounding whitespace, keeping lines of ten or more
characters that are not bare boilerplate (a lone `return`, a stdlib import, a closing bracket);
the two sets intersected, and every shared line located in both trees. The workspace's Python
splits into Deep Drafter's own code (`Behind the scenes (Claude)/Build scripts/`, 5,650
distinctive lines) and the Ipsissima-ancestor sample scripts that were growing in it
(`Argdown samples/`, 437). Results, against Ipsissima's 8,417 distinctive Python lines today:

- **Shared with Deep Drafter's own code: 22 lines, every one a commonplace idiom** —
  `def main():`, `except Exception:`, `sys.exit(1)`, `HERE = Path(__file__).resolve().parent`,
  `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))`, and the like. Nothing that
  carries expression; nothing distinctive to either project.
- **Shared with the ancestor files: 211 lines — and they are the same files**: the
  `make_source.py` / `convert_source.py` scripts in `samples/` sat in that workspace because it
  is where Ipsissima grew, exactly as `CREDITS.md` says. (The count is higher than the "five"
  recorded at extraction because those sample scripts still exist, whole, in both trees, and
  because the distinctiveness filter differs; the *category* is the same.)
- **JavaScript/TypeScript files in Deep Drafter: zero.** The claim that matters most for the
  relicensed `app/` — that the JavaScript half can owe Deep Drafter nothing — holds trivially.

The substance of the `CREDITS.md` claim is confirmed: **no Deep Drafter code is used in
Ipsissima**, and even under a dual-licence-free reading nothing shared rises above stock idiom.
(Deep Drafter is MIT in any case, so the stakes were attribution, not permission.)

---

## 6. Copyright holders

**This is the part that usually kills a relicensing, and here it is trivial.**

**[verified]** `git log --format='%an <%ae>' | sort -u` returns **one line**:

```
James Wilson <4345358+jgsw@users.noreply.github.com>
```

161 commits as of 2 September (37 when first written), all of them authored *and* committed by
the same identity. `CONTRIBUTING.md` exists
but has attracted no outside contribution. There is no CLA to chase and no second rights-holder
whose agreement is needed. **A sole copyright holder may relicense his own work at will**, and
that is what makes everything above a question about *dependencies* rather than about *consent*.

**[verified]** 135 of the 161 commits carry a `Co-Authored-By` trailer naming a Claude model
(`Claude Opus 5` in the earlier commits, `Claude Fable 5` in the later ones, both
`<noreply@anthropic.com>`).

**[judgement]** That trailer records how the work was done, not a second human rights-holder. Under
Anthropic's terms the user holds whatever rights subsist in the output, and current US Copyright
Office guidance is that purely machine-generated material is not itself protected by copyright —
on either reading there is nobody to obtain permission from. This is noted because a diligent
reader will see the trailers and ask; it is not thought to be a live issue. If the project ever
wants belt and braces, a one-line statement in `CONTRIBUTING.md` about the trailer's meaning costs
nothing.

---

## 7. If the answer is yes: what actually changes

The recommendation is **option B**, which reaches the goal with the least work and the fewest
judgement calls. *(Implemented 2 September 2026 — §11 records what was actually done, including
the two places the implementation improved on this table.)*

### Option A — MIT the whole repository
**Blocked** by PyMuPDF, unless it is removed. Not available today.

### Option B — MIT `app/`, leave `ipsissima-mcp/` where it is *(recommended)*
The two halves are already independent: no shared code, no import in either direction, and the one
subprocess call degrades gracefully. Argdown gets what it wants; the Python keeps the licence its
dependencies require.

**Files to change:**

| file | now | becomes |
|---|---|---|
| `LICENSE` | GPL-3.0 text, 674 lines | MIT text, `Copyright (c) 2026 James Wilson` |
| `ipsissima-mcp/LICENSE` | *(does not exist — inherits the root)* | **new**: the GPL-3.0 text, moved here so the boundary is explicit |
| `README.md:142` | "free software under the **GNU General Public License v3**" | MIT for `app/`, GPL-3.0-or-later for `ipsissima-mcp/`, and why |
| `CONTRIBUTING.md:86–91` | "Ipsissima is GPL-3.0-or-later. By contributing you agree…" | the same inbound=outbound clause, per-directory |
| `app/package.json:6` | `"license": "GPL-3.0-or-later"` | `"license": "MIT"` |
| `app/about.md:122–128` | the Licence section, GPL wording | MIT wording, with the ArgVu carve-out named |
| `app/about.md:112` | **"All MIT licensed."** | **factually wrong today** — see §8 |
| `app/argdown-viewer.template.html:1114` | `var ABOUT_LICENCE = "GPL-3.0";` | `"MIT"` |
| `app/vendor/ArgVu/PROVENANCE.md:11–14` | "compatible with GPL-3.0" | keep, and add that the font stays under its own licence regardless |
| `ipsissima-mcp/pyproject.toml` | `GPL-3.0-or-later` (the `license` line and the Trove classifier) | **unchanged** — and worth a comment saying it is deliberate, because a reader who sees MIT at the root will assume drift |
| `Ipsissima.html`, `Ipsissima Reader.html` | built artifacts — **no longer tracked in git**: since the audit was written they are gitignored and built at release time by `release.yml`, and for the site by `pages.yml` | rebuild locally with `node app/rebuild_viewers.mjs`; the first *release* after the change is what puts relicensed pages in front of anyone |

**No dependency has to be swapped, and nothing has to move from bundled to build-time.**

**A `NOTICE` file is needed**, and would have been needed under GPL-3.0 too — see §8. It should
carry: the Bitstream Vera / Arev / AMSFonts text for ArgVu, the Apache-2.0 notices for
chevrotain and `@hpcc-js/wasm-graphviz`, the BSD notices for `highlight.js` and `entities`, JSZip's
dual-licence notice with the MIT arm elected, and the MIT notices for the rest. (The first
version of this list included the Chris Pettitt notice for dagre; dagre is no longer bundled, so
no notice is owed — `CREDITS.md` keeps the acknowledgement as a debt of influence rather than of
licence.) The same exercise is owed by the **Python distribution** for the shim bundle of §2.6.

**Worth doing while in here:** the project has no per-file licence headers at all. Argdown taking
the layout code would be a cleaner transaction if `app/src/argdown-live-map.js`,
`app/argdown-graph.mjs` and `app/map_quality.mjs` carried an `SPDX-License-Identifier: MIT` line,
so a file lifted out of the tree still says what it is.

### Option C — MIT everything, PyMuPDF removed
Honest but expensive. `pdf_to_source.py` is 1,263 lines built on it, and
`ipsissima-mcp/eval/CONVERTER-FINDINGS.md` records that `pymupdf4llm` with `rapidocr` beat
`marker` (itself GPL-3.0 plus a RAIL-M weight licence), `docling` and a local `llama.cpp` on a
labelled repair set. **Relicensing would be undoing a decision that was made on measurement**, and
that is a bad reason to redo it. If it is ever revisited, `docling` is MIT and was the runner-up on
licensing grounds already — but it lost on the thing that matters, which was quality.

---

## 8. Four attribution gaps found on the way

None of these is caused by the licence question. All of them existed under GPL-3.0, and the
relicensing pass was the natural moment to fix them. **All four were closed on 2 September
2026** — each bullet below ends with how.

- **[verified] The bundles are built with `legalComments: "none"`.** All four esbuild invocations
  in `build_argdown_viewer.mjs` share it (`build_argdown_viewer.mjs:68`), and so does the shim
  build (`build_argdown_shim.mjs:46`) — so the gap now extends to the PyPI wheel and the `.mcpb`.
  It strips every `@license` and copyright banner out of the
  minified output. Grepping the built `Ipsissima.html` for "Permission is hereby granted", "shall
  be included in all copies" and "WITHOUT WARRANTY OF ANY KIND" returns **zero** in each case
  (re-checked 2 Sept).
  MIT, BSD and Apache-2.0 all ask for their notice to travel with the copy. **[judgement]** A
  `NOTICE` section reachable from the About window, or an HTML comment in the page, would discharge
  this; `--legal-comments=eof` would too, at a cost in bytes. This one is worth taking seriously,
  because the single self-contained HTML file *is* the distribution — there is no accompanying
  `node_modules` for a recipient to consult.
  **Fixed**: every build now assembles the licence text of everything it actually bundled — read
  from the esbuild metafiles, deduplicated by byte-identical text, ArgVu and JSZip added
  explicitly — into a `NOTICES` page section (`app/notices.mjs`, `noticesPart` in the builder),
  shown under About ▸ Licence and, because it is not on the export drop-list, carried into every
  copy a page exports of itself. The shim build writes the same notices to
  `vendor/argdown-cli.NOTICE.md`, committed beside the bundle and shipped in the wheel and
  `.mcpb` by `package-data`. The greps above now return 24 matches each on the built Reader.

- **[verified] `app/about.md:112` says "All MIT licensed."** of the bundled dependency list. It is
  not accurate: chevrotain and `@hpcc-js/wasm-graphviz` are Apache-2.0, `highlight.js` is
  BSD-3-Clause, `entities` is BSD-2-Clause, and ArgVu is under the Bitstream Vera licence. The
  sentence sits directly beneath a `<dl>` whose whole point, per the paragraph above it, is that
  "this list cannot claim what it does not carry".
  **Fixed**: the sentence now names the Apache, BSD, dual-licence and Bitstream Vera exceptions
  and points at the notices in the Licence tab.

- **[verified] The ArgVu permission notice does not travel with the font.** The built page embeds
  the WOFF2 and mentions "Bitstream" exactly once, in the About prose. The licence text itself is
  in the repository at `app/vendor/ArgVu/LICENSE.md` — which is exactly right for a source
  checkout, and reaches nobody who is handed the HTML file.
  **Fixed**: the builder writes `vendor/ArgVu/LICENSE.md` into the `NOTICES` section of every
  built page, first in the list, so the permission notice is inside the same file as the
  embedded WOFF2 — and inside every copy that page exports.

- **[verified] The site self-hosts EB Garamond with no licence text beside it** *(new since
  27 August)*. `site/assets/fonts/` carries four EB Garamond WOFF2 files, served by the GitHub
  Pages site. EB Garamond is under the **SIL Open Font License 1.1**, whose notices are expected
  to accompany the Font Software. **[judgement]** The copyright and licence declaration embedded
  in the font files' own metadata is commonly taken to satisfy this for web serving, and the OFL
  imposes nothing on the site's code either way — but an `OFL.txt` dropped next to the fonts
  costs one file and removes the question. Same shape as the ArgVu gap, smaller stakes.
  **Fixed**: `site/assets/fonts/OFL.txt` now carries the EB Garamond project's own copyright
  line and the OFL 1.1 text, fetched verbatim from the Google Fonts repository, and
  `main.scss`'s font comment points at it.

---

## 9. What a lawyer needs to be asked

Compressed, so it can be sent as-is. Everything below is **[judgement]**.

1. **The one that matters.** Does importing `pymupdf` (AGPL-3.0-or-commercial) into
   `ipsissima_mcp` create a combined work that must itself be AGPL? If yes, option B is the only
   route and `ipsissima-mcp/` should probably be examined for whether GPL-3.0-or-later is even the
   right declaration for it today.
2. Is the current single `GPL-3.0-or-later` declaration over a tree containing an AGPL dependency
   accurate — particularly given that `ipsissima-mcp` runs as an MCP **server**, which is what
   AGPL §13 is about?
3. Confirm that a sole copyright holder relicensing GPL-3.0 work he wrote entirely himself needs
   nothing from anyone. (Expected: yes. Asked because it is cheap to ask.)
4. Confirm that the `Co-Authored-By: Claude Opus 5` trailers create no third-party interest.
5. Confirm the reading in §2.4 that a dual-licensed dependency may be taken under its MIT arm.
6. Confirm the reading in §4 that invoking `pandoc` as a subprocess creates no obligation.
7. What form of `NOTICE` discharges the attribution duties of the bundled MIT / BSD / Apache-2.0 /
   Bitstream Vera components **inside a single self-contained HTML file**, where there is no
   directory of licence files alongside it?
8. Whether the Deep Drafter comparison in `CREDITS.md` should be re-run and recorded before
   anything is signed, given that this tree's history begins at extraction.

---

## 10. What changed between `faadf52` (27 Aug) and `a0d8b3f` (2 Sept)

124 commits landed between the two audits. **None of them changes the verdict**: `app/` is still
clear for MIT, `ipsissima-mcp/` is still blocked by PyMuPDF, and there is still exactly one
copyright holder. What did change:

- **dagre was retired** (`a79576d`, 29 August). The bundle carries no layout engine; the
  vendored `dagre.min.js` and `dagre.LICENSE` are deleted, and layout is wholly first-party code.
  This *strengthens* the motivating case — the code Argdown would want back now has no
  third-party engine underneath it — and removes dagre from the NOTICE list (§7).
- **The Python package now distributes JavaScript**: the Argdown shim bundle of §2.6, committed
  at `ipsissima-mcp/src/ipsissima_mcp/vendor/argdown-cli.mjs` and shipped in the wheel and the
  `.mcpb`. All 91 bundled packages are permissive; the `legalComments: "none"` attribution gap of
  §8 now applies to the Python distribution too.
- **Distribution went public.** The built viewers are no longer tracked in git; they are built at
  release time by `release.yml` and for the GitHub Pages site by `pages.yml`, and
  `publish-pypi.yml` publishes `ipsissima-mcp` to PyPI by trusted publishing. The AGPL question
  of §4 now attaches to a real, public, versioned distribution rather than a hypothetical one.
- **The desktop app gained a network feature**: `reqwest` with the rustls stack, for
  Help ▸ Check for Updates. `Cargo.lock` grew from 490 to 532 entries; everything readable is
  permissive (§3).
- **A public site appeared** (`site/`), self-hosting EB Garamond under the SIL OFL — the fourth
  gap in §8.
- **`fixtures/ingest/` now redistributes third-party documents** — public domain
  (Russell, Dewey, Ramsey), Open Government Licence (Miller), CC-BY 4.0 (Robeyns) — under the
  same stated rule as `samples/`, with each item's licence named in its README. Per-item
  provenance was not independently confirmed, same as `samples/`.
- Housekeeping: the repository is at 0.2.1, the commit count is 161, the Co-Authored-By trailers
  now name two Claude models, and `requires-python` rose to 3.11 (an onnxruntime wheel matter,
  nothing to do with licensing).

## 11. The relicensing, as carried out — 2 September 2026

Option B, per §7's table, with every row done and two improvements on it:

- **`LICENSE`** is now the MIT text, `Copyright (c) 2026 James Wilson`. The GPL-3.0 text it
  replaced moved, byte for byte, to **`ipsissima-mcp/LICENSE`**, so the boundary is a file a
  reader trips over rather than a footnote.
- **`README.md`** states the split and the reason (PyMuPDF), points at this document, and names
  the two carve-outs an MIT badge might otherwise seem to claim: ArgVu, and the sample texts.
- **`CONTRIBUTING.md`** now carries the per-directory inbound=outbound clause.
- **`app/package.json`** declares `MIT`; **`app/about.md`**'s Licence tab has the MIT wording
  with the ArgVu carve-out and the MCP server's GPL named; the template's `ABOUT_LICENCE` says
  `MIT`.
- **`ipsissima-mcp/pyproject.toml`** is unchanged, and now says so in a comment — GPL-3.0-or-later
  on purpose, not drift — with this document cited.
- **`app/vendor/ArgVu/PROVENANCE.md`** adds that the font stays under its own licence whatever
  the surrounding code's is, and that the builder now writes its licence into every page.
- **SPDX headers** (`SPDX-License-Identifier: MIT`) went onto the three files Argdown would lift:
  `app/src/argdown-live-map.js`, `app/argdown-graph.mjs`, `app/map_quality.mjs`.
- Both standalone viewers were rebuilt and the full test suite passes.

The two improvements over §7's plan. First, the planned repository `NOTICE` file became
something better: the **`NOTICES` section built into every page** (§8), which reaches every
recipient of the actual distribution rather than only readers of the source tree — and the
Python distribution got its own, `vendor/argdown-cli.NOTICE.md`. Second, §7 asked for the
notices "while in here"; they were done first, so no MIT-labelled artifact was ever built
without its notices in it.

Still true after the switch, and worth restating: the §9 questions remain questions for a
lawyer — what changed is that the sole copyright holder exercised the relicensing §6 said he
could, not that any judgement in this document became a fact. And `ipsissima-mcp/`'s own
position (GPL-3.0-or-later over an AGPL dependency, distributed on PyPI) is exactly as §4 left
it: unresolved, and now the most important open item in this document.

## What this document did not check

Said plainly, because an audit that does not name its own gaps is worse than none:

- **The Rust lock entries not in this machine's cargo registry cache** were not read — 227 of 490
  on 27 August, and the gap persists proportionally at 532, since `cargo` is still not installed
  here (the new TLS tree was spot-verified from the cache, and `webpki-root-certs` from
  crates.io). Mostly other platforms' targets, but not
  entirely. Running `cargo license` — on Linux and Windows as well as macOS, since the dependency
  graph differs by target — would close it.
- **`pyzotero`**, the one optional Python extra, was not installed when its licence would have
  been read (it is BSD-3-Clause by reputation, which is not a verification). The venv the 27
  August versions came from has since been removed, so the §4 installed-version column cannot
  currently be re-derived on this machine.
- **Transitive bundled binaries.** `opencv-python`, pulled in by `rapidocr`, is Apache-2.0 as a
  package, but its PyPI wheels have historically bundled FFmpeg under LGPL terms. Not verified.
  It is in the Python half, which is not moving to MIT under option B, so it does not bear on the
  recommendation — but it would matter under option C.
- **The Deep Drafter tree**, which is not in this repository. See §5.
- **`samples/`.** Read for its own licensing policy, which is sound — public domain, CC-BY 4.0, or
  the author's own, with each folder's README naming the licence and each reconstruction released
  under the repository's own terms. **[judgement]** CC-BY imposes attribution but not share-alike,
  so a reconstruction of a CC-BY text can be released under MIT. The provenance of each individual
  text was not independently confirmed against its publisher. (Re-checked 2 Sept: the sample
  texts added since — Akhlaghi, Prescott-Couch, Tooming & Jakapi, Wilson — each name CC-BY 4.0 or
  the author's own permission in their READMEs, so the policy is being followed; the same
  per-item caveat applies.)
