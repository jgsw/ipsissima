#!/usr/bin/env node
/* build_argdown_viewer.mjs — self-contained interactive viewers for .argdown files.
 *
 * Two builds off ONE template (argdown-viewer.template.html), differing only in where the
 * parsing happens:
 *
 *   per-file    node parses the file now and bakes the graph into the page.
 *               Small (~200KB), correct, emailable. Goes stale if the .argdown is edited,
 *               which is why the source is baked in beside the graph and shown in the
 *               Source pane -- what you are looking at is always what drew the map.
 *
 *   standalone  the Argdown parser itself is bundled into the page, so any .argdown can be
 *               dropped on it. ~1MB, never stale, nothing to regenerate.
 *
 * Both use the same adapter (argdown-graph.mjs) and the same renderer
 * (src/argdown-live-map.js), so a file draws identically whichever route it took.
 * That is the point of the shared module: the structure browser's own subset parser silently
 * drops <arguments>, premise-conclusion structures and undercuts, and a viewer that did the
 * same would be confidently wrong.
 *
 * Usage
 *   node build_argdown_viewer.mjs FILE.argdown [-o OUT.html]     one file, graph baked in
 *   node build_argdown_viewer.mjs FILE.argdown --source-root DIR
 *   node build_argdown_viewer.mjs --standalone [-o OUT.html]     the drop-anything viewer
 *   any build + --editor    adds CodeMirror and the Argdown mode, so the file can be edited
 *                           and the map redrawn from what is typed (+346 KB)
 *
 * A BUNDLE IS ACCEPTED WHEREVER A .argdown IS. `argdown-bundle.js` defines a one-file container
 * -- the reconstruction with its sources attached as line comments the parser discards -- and a
 * bundle handed to this builder needs no --source-root, because it IS its own source root. That
 * is what makes a reconstruction sendable to someone who has no folder to be given.
 *
 * --source-root is the manuscript folder the reconstruction is OF. Given it, each claim is
 * located in the text and its position baked in beside the graph, which is what the viewer's
 * exposition-order toggle lays out on. Without it the viewer is exactly as before and the
 * toggle does not appear -- the standalone build never has a manuscript, so it never offers it.
 */

import fs from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import * as esbuild from "esbuild";
import { argdown } from "@argdown/node";
import { toGraph, RUN, metadataProblems, parseProblems } from "./argdown-graph.mjs";


const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Bundle one entry point with esbuild, through its JS API rather than its command line.
 *
 *  NOT THE `.bin` SHIM, ON ANY PLATFORM, and the reason is that the shim is a different artifact
 *  on each. On macOS and Linux `node_modules/.bin/esbuild` is the 10 MB native binary itself; on
 *  Windows npm writes `esbuild.cmd` and `esbuild.ps1` there and no extensionless file at all. So
 *  a hardcoded bare name fails on Windows with ENOENT — and naming the `.cmd` instead then fails
 *  with EINVAL, because Node has refused to `execFileSync` a `.cmd` or `.bat` since the
 *  CVE-2024-27980 hardening. Both were found by the first release, one per attempt.
 *
 *  `shell: true` would get past that and bring Windows quoting with it, for paths this build
 *  does not control. The API takes the same options with no shell, no shim and no quoting — and,
 *  the deciding argument, it makes the code path IDENTICAL on every platform. What is tested here
 *  on macOS is then the same code Windows runs, which the subprocess route could never be.
 */
function bundle(opts) {
  esbuild.buildSync(Object.assign({
    bundle: true, format: "iife", platform: "browser", target: "es2019",
    minify: true, legalComments: "none", absWorkingDir: HERE
  }, opts));
}
const BUILD = path.resolve(HERE, "src");
const TEMPLATE = path.join(HERE, "argdown-viewer.template.html");
const require = createRequire(import.meta.url);
// `require`, not an ESM default import: js-yaml ships CommonJS, and `import yaml from "js-yaml"`
// resolves only against the ESM copy that happens to sit inside Argdown's own tree. esbuild
// interops for the browser bundle on line ~93; Node here does not.
const yaml = require("js-yaml");
// The one-file container, shared with the page so that "what a bundle is" is defined once.
const BUNDLE = require(path.join(BUILD, "argdown-bundle.js"));
// And the section list, shared with the page for exactly the same reason -- see the header of
// argdown-page.js for what having TWO of them cost. The marker vocabulary, the substitution and
// the JSON escaping all live there now; nothing in this file may keep a second copy of any of
// them, because the page's copy of the copy is the one nobody looks at.
const PAGE = require(path.join(BUILD, "argdown-page.js"));

/** A literal </script> inside a payload would close the wrapper early.
 *
 *  `part` names the section, and it is written onto the tag rather than only into the comment
 *  above it, because the PAGE now reads these back: exporting a self-contained copy of itself
 *  means picking up its own bundles by name and leaving out the ones the copy does not need.
 *  A comment node beside a script is a fragile thing to look something up by; an attribute is
 *  not. The names are the template's marker names, so one vocabulary describes both directions.
 */
const wrap = (label, body, part) =>
  `<!-- ${label} -->\n<script${part ? ` data-part="${part}"` : ""}>\n` +
  `${body.replace(/<\/script/gi, "<\\/script")}\n</script>\n`;

/** JSON that is safe to sit inside a <script> body. One implementation, in argdown-page.js,
 *  because the browser needs the identical rule when it writes a payload of its own. */
const safeJSON = PAGE.safeJSON;

/** Read a script that will be inlined, and SYNTAX-CHECK it first.
 *
 *  The payload is inlined as text, so nothing here parses it and a broken file ships happily
 *  into a viewer that then does nothing at all. That happened: a stray backtick inside the
 *  renderer's CSS template literal ended the string, `createLiveMap` became undefined, and
 *  three viewers were built and delivered before anyone loaded one. A build that emits a
 *  file it cannot parse should fail, loudly, here.
 */
function readScript(file) {
  const abs = path.join(BUILD, file);
  const src = fs.readFileSync(abs, "utf8");
  try {
    new Function(src);            // parses without executing
  } catch (e) {
    throw new Error(`${file} does not parse, so the viewer would be inert: ${e.message}\n` +
                    `  (a backtick inside the CSS template literal is the usual cause)`);
  }
  return src;
}

/** markdown-it, so the manuscript reads as prose rather than as raw source.
 *
 *  IN BOTH BUILDS. Reading the text a reconstruction is OF is not an editing feature, and the
 *  Viewer is exactly the build someone is handed when they want to check a map against its
 *  source. 116 KB with the footnote plugin.
 *
 *  What makes this safe is that markdown-it's tokens carry `.map` — the source line range of
 *  every block — so the rendered prose can keep a line number on each paragraph and every piece
 *  of click-to-claim linking goes on working. Without that, rendering would have cost the
 *  feature the pane exists for.
 */
function markdownBundle() {
  const entry = path.join(HERE, ".md-entry.mjs");
  const out = path.join(HERE, ".md-bundle.js");
  fs.writeFileSync(entry, `
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
// TWO RENDERERS, and the difference is a security boundary rather than a convenience.
// __MARKDOWN__ draws the MANUSCRIPT -- someone else's file, often a student's -- and must never
// pass its HTML through. __MARKDOWN_TRUSTED__ draws help.md, which ships inside this build and
// needs raw HTML for the handful of elements the program fills in at runtime.
// NB no backticks anywhere in this block: it lives inside a template literal, and one ends it.
window.__MARKDOWN_TRUSTED__ = function (text) {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
  return md.render(text);
};
window.__MARKDOWN__ = function (text) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
  md.use(footnote);
  // A line number on every block, taken from the token the block came from.
  const keepLine = (name) => {
    const prev = md.renderer.rules[name];
    md.renderer.rules[name] = function (tokens, idx, options, env, self) {
      const t = tokens[idx];
      if (t.map) t.attrSet("data-l", String(t.map[0] + 1));
      return prev ? prev(tokens, idx, options, env, self)
                  : self.renderToken(tokens, idx, options);
    };
  };
  ["paragraph_open", "heading_open", "blockquote_open", "bullet_list_open",
   "ordered_list_open", "list_item_open", "table_open", "fence"].forEach(keepLine);
  return md.render(text);
};
`);
  bundle({ entryPoints: [entry], outfile: out });
  const js = fs.readFileSync(out, "utf8");
  fs.rmSync(entry, { force: true }); fs.rmSync(out, { force: true });
  return wrap("markdown-it + footnotes", js, "LIVEMAP_DEPS");
}

function liveMapDeps() {
  const dagre = fs.readFileSync(path.join(HERE, "vendor", "dagre.min.js"), "utf8");
  return wrap("dagre", dagre, "LIVEMAP_DEPS") +
         wrap("argdown-live-map.js", readScript("argdown-live-map.js"), "LIVEMAP_DEPS") +
         // The SAME module the Node build uses to place claims in the manuscript. It already
         // publishes itself as `window.ArgdownPositions`, so inlining it is all that is needed
         // and the standalone can do its own locating from dropped source files instead of
         // waiting for a rebuild.
         wrap("argdown-positions.js", readScript("argdown-positions.js"), "LIVEMAP_DEPS") +
         // The shape-of-the-text measure, BEFORE the renderer: argdown-live-map.js reads
         // `ArgdownExposition` at layout time to put a sparkline on every band header, and a
         // classic script that is not there yet is simply undefined.
         wrap("argdown-exposition.js", readScript("argdown-exposition.js"), "LIVEMAP_DEPS") +
         // What a page is made of, so that the page can build one. In EVERY build, and before
         // the main script: `exportPage` asks it which of this page's own sections a copy
         // carries, and a classic script that is not there yet is simply undefined.
         wrap("argdown-page.js", readScript("argdown-page.js"), "LIVEMAP_DEPS") +
         // The one-file container. 5 KB, and in EVERY build including the read-only ones,
         // because opening a bundle is the common case now: it is what gets emailed. A viewer
         // that could not open one would be a viewer that could not open the file it was sent.
         wrap("argdown-bundle.js", readScript("argdown-bundle.js"), "LIVEMAP_DEPS") +
         // The desktop host adapter. In a browser it detects no host and every existing path
         // runs unchanged, so the SAME single file is the web app and the app's frontend --
         // which is the property that stopped this becoming two codebases.
         wrap("argdown-host.js", readScript("argdown-host.js"), "LIVEMAP_DEPS") +
         markdownBundle();
}

/** Bundle @argdown/core + the shared adapter into one IIFE exposing __ARGDOWN_PARSE__. */
function parserBundle() {
  const entry = path.join(HERE, ".viewer-entry.mjs");
  const out = path.join(HERE, ".viewer-bundle.js");
  fs.writeFileSync(entry, `
import { argdown } from "@argdown/core";
import { toGraph, RUN, metadataProblems, parseProblems, withComment } from "./argdown-graph.mjs";
// The text surgery for adding and removing comments, so the page can edit a file without
// anyone having to know that a metadata block is YAML.
window.__ARGDOWN_COMMENT__ = { withComment: withComment };
// A NAMED import: js-yaml\'s .mjs build exports "load" and friends but no default, so a
// default import fails the bundle outright. (Node\'s side of this uses require, above.)
import { load as yamlLoad } from "js-yaml";
// THE BRACES ARE CHECKED BEFORE THE PARSE, because the parser will not tell anyone: a broken
// {…} makes Argdown drop every claim after the fault and report success. See metadataProblems.
window.__ARGDOWN_METADATA_CHECK__ = function (source) {
  return metadataProblems(source, yamlLoad);
};
window.__ARGDOWN_PARSE__ = function (source) {
  const bad = metadataProblems(source, yamlLoad);
  if (bad.length) {
    const first = bad[0];
    const e = new Error("Broken metadata at line " + first.line + ", column " + first.column +
                        ": " + first.message);
    e.metadata = bad;
    throw e;
  }
  const res = argdown.run({ input: source, ...RUN });
  // A SYNTAX ERROR IS RETURNED, NOT THROWN. Unread, it left a truncated document behind and the
  // map came out empty with nothing said. The old guard on a missing map caught some of these
  // and said only that there was no map, which tells a reader nothing they can act on; this
  // names the line. (No back-ticks in this comment: it is injected into a template literal.)
  const broke = parseProblems(res, source);
  if (broke.length) {
    const first = broke[0];
    const e = new Error("Syntax error at line " + first.line + ", column " + first.column +
                        ": " + first.message);
    e.parse = broke;
    throw e;
  }
  if (!res.map) throw new Error("Argdown produced no map for this input");
  return toGraph(res);
};
`);
  try {
    bundle({ entryPoints: [entry], outfile: out,
             define: { "process.env.NODE_ENV": '"production"' } });
  } finally {
    fs.rmSync(entry, { force: true });
  }
  const js = fs.readFileSync(out, "utf8");
  fs.rmSync(out, { force: true });
  return wrap("@argdown/core, bundled for the browser", js, "PARSER");
}

/** CodeMirror and the Argdown mode, for the builds that can edit.
 *
 *  BEHIND ITS OWN MARKER so the viewer does not carry it. The editor is 346 KB — half again as
 *  much as everything else in the page — and most of the time a map is read, not written. One
 *  source tree, two builds: `--standalone` is the reader, `--standalone --editor` is the
 *  workbench, and neither is a fork of the other.
 */
function editorBundle() {
  const out = path.join(HERE, ".editor-bundle.js");
  bundle({ entryPoints: ["argdown-editor.src.mjs"], outfile: out });
  const js = fs.readFileSync(out, "utf8");
  fs.rmSync(out, { force: true });
  return wrap("CodeMirror 6 + the Argdown mode", js, "EDITOR");
}

/** The annotated-manuscript export: the `docx` package plus the module that drives it.
 *
 *  350 KB bundled, 101 KB gzipped -- worth carrying where comments are actually written, and not
 *  worth adding to twelve read-only maps that have no marginalia to export. So the caller decides,
 *  and passes `false` for a map with nothing to say.
 */
function exportBundle() {
  const out = path.join(HERE, ".export-bundle.js");
  bundle({ entryPoints: ["argdown-export.src.mjs"], outfile: out });
  const js = fs.readFileSync(out, "utf8");
  fs.rmSync(out, { force: true });
  return wrap("the .docx export (docx 9.x)", js, "EXPORTER");
}

/** Who and what this build is, for the About page.
 *
 *  WORTH HAVING BECAUSE "WHICH VERSION AM I LOOKING AT" IS OTHERWISE UNANSWERABLE. Two copies of
 *  a self-contained HTML file are indistinguishable once they are on disk, and two copies of an
 *  .app are worse — they can both be registered with the OS at once. The stamp is read at build
 *  time from `argdown-tools/VERSION`, which is the single source: `build_desktop.mjs` copies it
 *  into tauri.conf.json so the app bundle cannot drift from the page inside it.
 */
/** The How-to-use text, inlined as Markdown rather than baked in as HTML.
 *
 *  IT IS PROSE, AND PROSE GETS REVISED. Kept as markup in the template it could only be edited
 *  by someone willing to hand-write `<dl>` inside a 3,000-line file; as Markdown it is a
 *  document, and the contents list is derived from its `##` headings rather than maintained
 *  beside it.
 */
function helpPart() {
  const md = fs.readFileSync(path.join(HERE, "help.md"), "utf8");
  const about = fs.readFileSync(path.join(HERE, "about.md"), "utf8");
  // THE FILE A NEW RECONSTRUCTION STARTS FROM, and it rides in this section because it is the
  // same kind of thing as the other two: prose that ships with the build and gets revised as
  // prose. Keeping it as a real .argdown rather than a string in the template is what lets the
  // test suite parse it — a starter file that does not parse would teach the syntax wrongly to
  // the one person guaranteed not to spot it.
  const starter = fs.readFileSync(path.join(HERE, "new-reconstruction.argdown"), "utf8");
  return wrap("help.md", `window.__HELP_MD__ = ${safeJSON(md)};`, "HELP") +
         wrap("about.md", `window.__ABOUT_MD__ = ${safeJSON(about)};`, "HELP") +
         wrap("new-reconstruction.argdown",
              `window.__STARTER_ARGDOWN__ = ${safeJSON(starter)};`, "HELP");
}

function buildStamp() {
  const version = fs.readFileSync(path.join(HERE, "VERSION"), "utf8").trim();
  const deps = JSON.parse(fs.readFileSync(path.join(HERE, "package-lock.json"), "utf8")).packages || {};
  const at = (name) => (deps["node_modules/" + name] || {}).version || null;
  const stamp = {
    version,
    built: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    // Recorded rather than hard-coded in the About text, so a credit cannot claim a version
    // the build does not actually carry.
    deps: {
      "@argdown/core": at("@argdown/core"),
      "@dagrejs/dagre": at("@dagrejs/dagre"),
      "codemirror": at("codemirror"),
      "markdown-it": at("markdown-it"),
      "docx": at("docx"),
      "esbuild": at("esbuild")
    }
  };
  return wrap("build stamp", `window.__IPSISSIMA__ = ${safeJSON(stamp)};`, "STAMP");
}

/** The page's own template, carried as text so that a BROWSER can build one of these.
 *
 *  THE REASON IS THE STUDENT. A tutor's comments are no use to someone who has to be talked
 *  through unzipping a folder and pointing an app at it, and a bundle file — one .argdown with
 *  the essay inside — still assumes they have a viewer to open it with. The artifact with no
 *  instructions attached is a single HTML file they double-click, and until now only Node could
 *  make one. With the template in hand the page can: every script it needs is already inlined
 *  in it, tagged by `data-part`, so exporting a copy is choosing which of those to carry and
 *  substituting a fresh payload.
 *
 *  Verbatim, INCLUDING its own `INLINE:SHELL` marker, so an exported workbench can export in
 *  turn. Nothing recurses: the marker sits inside a JSON string, and `fill` does not rescan what
 *  it has already substituted.
 *
 *  ~145 KB on the two standalone builds. Not carried by a per-file build, which is already the
 *  single file this exists to produce.
 */
function shellPart() {
  // THE RAW TEMPLATE, with `__ARGVU_WOFF2__` still a placeholder. Carrying the substituted copy
  // put a second 252 KB of base64 into every build — the font once in the stylesheet and again
  // inside the shell string. The page fills the placeholder at export time by reading the
  // typeface back out of its own stylesheet, so a file contains exactly one copy of it.
  const html = fs.readFileSync(TEMPLATE, "utf8");
  return wrap("the page template, so this page can export a copy of itself",
              `window.__ARGDOWN_SHELL__ = ${safeJSON(html)};`, "SHELL");
}

/** Locate every claim in the manuscript and hang the position on its node.
 *
 *  Computed here, at build time, and never written back into the .argdown: a stored line
 *  number is an assertion about a manuscript still being edited and goes quietly wrong the
 *  first time a paragraph moves. Baking it into the viewer has the same staleness as the
 *  graph beside it, which the viewer already handles by showing the source it was built from.
 */
function attachPositions(graph, root, argdownPath, attached) {
  const P = require(path.join(BUILD, "argdown-positions.js"));
  // A BUNDLE IS ITS OWN SOURCE ROOT. Someone sent this file precisely because they could not
  // send a folder, so refusing to build from it unless a folder is produced would be asking for
  // the thing that does not exist. The folder still wins where there is one: a file on disk is
  // live, and the copy inside a bundle is a snapshot of when it was made.
  const inFile = {};
  for (const f of (attached ? attached.files : [])) inFile[f.path] = f.text;
  const readSource = (rel) => {
    if (root) {
      const p = path.join(root, rel);
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    }
    return inFile[rel] != null ? inFile[rel] : null;
  };
  const sources = {};
  for (const n of graph.nodes) {
    if (!n.chapter || n.chapter in sources) continue;
    sources[n.chapter] = readSource(n.chapter);
  }
  // A PROJECT FILE IS OPTIONAL, and for one paper it is pointless. This used to throw without
  // `_quarto.yml`, so reconstructing a single article — the common case — could not build a
  // viewer at all without writing a config file to state the reading order of one file.
  //
  // `argdown-project.yml` is the native name; `_quarto.yml` is still read so existing Quarto
  // projects keep working. With neither, the order is the one the reconstruction itself cites,
  // which is exactly right for a single source and is the reconstructor's own sequence for
  // several — better than sorting paths, since alphabetical order is not reading order.
  const PROJECT_FILES = ["argdown-project.yml", "argdown_project.yml",
                         "argdown-project.yaml", "argdown_project.yaml", "_quarto.yml"];
  const projectName = PROJECT_FILES.find(f => readSource(f) != null);
  let projectText = projectName ? readSource(projectName) : "";
  if (!P.readingOrder(projectText).length) {
    // Synthesise one in the same shape, from the chapters the map cites, in citation order.
    const cited = [];
    for (const n of graph.nodes) if (n.chapter && !cited.includes(n.chapter)) cited.push(n.chapter);
    projectText = "chapters:\n" + cited.map(c => `  - "${c}"`).join("\n") + "\n";
    if (cited.length) console.log(`  no project file: reading order taken from the ` +
                                  `${cited.length} chapter(s) the map cites`);
  } else {
    console.log(`  reading order from ${projectName}`);
  }
  // FIDELITY IS CHECKED, NOT BELIEVED — and the check lives in Python, deliberately.
  //
  // `quotation` is the one fidelity level with a fact of the matter: either the claim's own
  // words are in the source or they are not. Declared by hand it was wrong 38 times in 126
  // across the reference maps, always in the same direction, and a solid border then tells a
  // reader of the map that they are looking at the author's words when they are looking at a
  // summary. That is the misleading this override exists to stop.
  //
  // The rule is NOT reimplemented here, and the reason given for that HAS EXPIRED — read this
  // before deciding where the rule should live.
  //
  // It used to say: "it leans on difflib's near-match, which has no clean JavaScript
  // equivalent". That was true of the rule this replaced, which accepted anything scoring 0.75
  // similarity over a window. `_is_verbatim` in argdown_provenance.py has since been tightened
  // to a CONTIGUOUS RUN — fold whitespace and case, strip punctuation, ask whether the claim is
  // a substring of the source — and touches difflib nowhere. See its own docstring, which says
  // so; only these comments still describe the old rule.
  //
  // Measured 27 Aug 2026: the JavaScript equivalent is four lines on top of
  // `ArgdownPositions.normalise`, which is ALREADY inlined into every build and already
  // cross-checked against the Python by test_argdown_positions.mjs. Run over the whole published
  // corpus it agreed with this checker on 251 of 251 adjudicated claims — 79 quotation, 172
  // paraphrase, no disagreements.
  //
  // Why that matters more than the tidiness: this call is the ONLY place fidelity is ever
  // derived, and it runs only for a per-file build given `--source-root`. A folder opened in the
  // app, a folder dropped on the standalone, and a bundle built without a folder all draw
  // borders exactly as the file declares them — which on this corpus was wrong 6 times. The
  // status line says "borders as declared, not checked" in those cases, honestly, but honesty
  // about an unchecked border is not the same as a checked one.
  //
  // Only `quotation` and `paraphrase` are ever adjudicated. `interpretation` and `imputation`
  // are judgements about the READING, not facts about the words, and nothing here may touch
  // them. Nothing is written back to the .argdown either: it is the reconstructor's file, the
  // correction is reported by the checker, and a value stored here would go stale the moment
  // the source is edited.
  if (argdownPath && root) {   // a bundle has no folder for the checker to read
    try {
      const py = spawnSync("python3", [
        path.join(HERE, "..", "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
        argdownPath, "--source-root", root, "--derive-fidelity"], { encoding: "utf8" });
      const derived = JSON.parse((py.stdout || "{}").trim() || "{}");
      let changed = 0;
      for (const n of graph.nodes) {
        const d = derived[n.label] || derived[n.id];
        if (d && n.fidelity !== d) { n.fidelity = d; changed++; }
      }
      if (changed) console.log(`  fidelity: ${changed} border(s) corrected against the source`);
    } catch (e) {
      console.warn("  could not derive fidelity from the source (" + e.message + "); " +
                   "the borders are as declared");
    }
  }

  // THE ENCLOSING HEADING, baked in so the by-position view can lane by section. A chapter is
  // too coarse a lane for a long article: this paper is ONE file with eight numbered sections,
  // so every claim landed in a single lane and the section structure the author navigates by was
  // invisible. Sub-headings deliberately do not get their own lane — that would fragment the
  // picture without helping anyone find their place.
  //
  // `positions` works it out; this used to work it out AGAIN, filtering headings to level 1.
  // That is right for a source converted from a PDF and wrong for one converted from a
  // publisher's HTML, where `#` is the article title and `##` are its sections — so a build of
  // such a paper had no sections at all. The rule moved to `bandLevel` and this copy did not
  // move with it, which is the whole argument for there not being a copy.
  const { byId } = P.positions(graph.nodes, sources, projectText);
  let placed = 0;
  for (const n of graph.nodes) if (byId[n.id]) { n.pos = byId[n.id]; placed++; }
  // HOW LONG IS EACH PART OF IT. The retired structure browser reported these and nothing else
  // did; they belong beside the claims rather than in a separate page, so they are baked in here
  // and drawn on the bands of the by-position view.
  graph.words = P.wordCounts(sources);

  const missingFiles = Object.keys(sources).filter(c => sources[c] == null);
  // THE MANUSCRIPT ITSELF, so the viewer can show the passage a claim came from rather than
  // only asserting where it is. In reading order, which is the order the source pane lists the
  // chapters in — `positions` has already worked that out and it must not be worked out twice.
  const order = P.readingOrder(projectText);
  const rank = new Map(order.map((c, i) => [c, i]));
  const chapters = Object.keys(sources)
    .filter(c => sources[c] != null)
    .sort((a, b) => (rank.has(a) ? rank.get(a) : 1e9) - (rank.has(b) ? rank.get(b) : 1e9))
    .map(c => ({ path: c, text: sources[c] }));
  const bytes = chapters.reduce((a, c) => a + c.text.length, 0);
  return { placed, missingFiles, manuscript: { chapters }, bytes };
}

/** The template, with the things that are not markers already substituted.
 *
 *  ONE PLACE, because the template is read TWICE — once to build the page and once to be carried
 *  inside it as `__ARGDOWN_SHELL__`, so that the page can export a copy of itself. Substituting
 *  the font only on the way out would give every exported page an unfilled `__ARGVU_WOFF2__`
 *  placeholder and no typeface, and nothing would report it: the CSS would simply fail to load a
 *  font and fall back to the system monospace.
 */
let TEMPLATE_TEXT = null;
function templateText() {
  if (TEMPLATE_TEXT) return TEMPLATE_TEXT;
  const html = fs.readFileSync(TEMPLATE, "utf8");
  const woff2 = path.join(HERE, "vendor", "ArgVu", "ArgVuSansMono-Regular.woff2");
  if (!fs.existsSync(woff2))
    throw new Error("ArgVu is missing: " + woff2 + "\n  regenerate it with vendor/ArgVu/make.mjs");
  const b64 = fs.readFileSync(woff2).toString("base64");
  if (!html.includes("__ARGVU_WOFF2__"))
    throw new Error("the template has no __ARGVU_WOFF2__ slot — the @font-face rule was lost");
  // THE TEMPLATE AND THE SECTION LIST HAVE TO AGREE, and this is the only moment either is
  // read. A marker added to the HTML without being added to `PARTS` would be filled here (the
  // builder enumerates its own parts object) and dropped by the page's export (which asks
  // argdown-page.js what a copy carries) -- so the section would be missing from the file
  // somebody was SENT and present in every file built here, which is the shape of the bug this
  // whole arrangement exists to make impossible. Better no artifact than a lying one.
  const wrong = PAGE.checkTemplate(html);
  if (wrong.length)
    throw new Error("the template and argdown-page.js disagree about what a page is made of:\n" +
                    wrong.map(w => "  " + w).join("\n"));
  TEMPLATE_TEXT = html.replace("__ARGVU_WOFF2__", () => b64);
  return TEMPLATE_TEXT;
}

function fill(parts) {
  const r = PAGE.fill(templateText(), parts);
  if (r.missing.length)
    throw new Error(`template has no INLINE:${r.missing.join(", INLINE:")} marker`);
  return r.html;
}

async function main() {
  const argv = process.argv.slice(2);
  const standalone = argv.includes("--standalone");
  const oi = argv.findIndex(a => a === "-o" || a === "--output");
  const ri = argv.findIndex(a => a === "--source-root");
  const outArg = oi >= 0 ? argv[oi + 1] : null;
  const rootArg = ri >= 0 ? argv[ri + 1] : null;
  // Only mask a flag's own slots when the flag is actually present: with `oi === -1`,
  // `oi + 1` is 0, which masks the input file itself and makes the command print its usage.
  const taken = new Set();
  for (const i of [oi, ri]) if (i >= 0) { taken.add(i); taken.add(i + 1); }
  const input = argv.find((a, i) => !a.startsWith("-") && !taken.has(i));

  if (!standalone && !input) {
    console.error(
      "usage:\n" +
      "  node build_argdown_viewer.mjs FILE.argdown [-o OUT.html] [--source-root DIR]\n" +
      "  node build_argdown_viewer.mjs --standalone [-o OUT.html]\n" +
      "\n" +
      "  --source-root is the manuscript folder. Given it, the viewer gains the\n" +
      "  exposition-order toggle: the same claims laid out by where they appear in\n" +
      "  the text rather than by what supports what.");
    process.exit(1);
  }
  if (standalone && rootArg) {
    console.error("--source-root does not apply to --standalone: the drop-anything viewer takes\n" +
                  "its manuscript from whatever folder is dropped on it, at the moment of the drop.");
    process.exit(1);
  }

  const parts = { LIVEMAP_DEPS: liveMapDeps(), PARSER: "", EDITOR: "", EXPORTER: "",
                  PAYLOAD: "", SHELL: "", STAMP: buildStamp(), HELP: helpPart() };
  // The editor needs a parser to draw anything from what is typed, so it implies one.
  const wantsEditor = argv.includes("--editor");
  let outPath;

  if (wantsEditor) parts.EDITOR = editorBundle();
  if (standalone) {
    parts.PARSER = parserBundle();
    // A standalone viewer can be handed any file, including one full of comments, so it carries
    // the exporter whether or not this build knows of any.
    parts.EXPORTER = exportBundle();
    // And the template, so it can hand a reader a self-contained copy with the reconstruction
    // baked in. Both standalone builds: a bundle can be opened in the Viewer too, and whoever
    // opened it may be the one who needs to pass it on.
    parts.SHELL = shellPart();
    // The repository root, not this folder: these two files are the product, and someone who
    // has just built them should find them without going digging.
    outPath = outArg ? path.resolve(outArg)
                     : path.resolve(HERE, "..", "Ipsissima Reader.html");
  } else {
    const src = path.resolve(input);
    const raw = fs.readFileSync(src, "utf8");
    // THE ATTACHMENT IS NOT PART OF THE RECONSTRUCTION and must not be baked in as if it were:
    // the Argdown pane shows exactly this string, and a reader scrolling past the whole essay
    // to reach the claims would rightly think the file was broken.
    const attached = BUNDLE.detach(raw);
    const source = attached ? attached.argdown : raw;
    if (attached)
      console.error(`  ${path.basename(src)} is a bundle: ${attached.files.length} file(s) ` +
                    `travelling inside it` + (attached.truncated ? " (TRUNCATED)" : ""));
    // A BROKEN `{…}` STOPS THE BUILD. The parser will not complain — it drops every claim after
    // the fault and reports success — so a viewer built from such a file is a confident picture
    // of half a reconstruction. Better no artifact than a lying one.
    const bad = metadataProblems(source, yaml.load);
    if (bad.length) {
      console.error(`\n  ${path.basename(src)} has ${bad.length} broken metadata block(s).`);
      console.error("  Argdown will not report this: it silently drops every claim after the");
      console.error("  first one, so the map would be built from a truncated file.\n");
      for (const b of bad) {
        console.error(`    line ${b.line}, column ${b.column}: ${b.message}`);
        console.error(`      ${b.text}`);
      }
      console.error("\n  Nothing was written.");
      process.exit(1);
    }
    const res = await argdown.runAsync({ input: source, ...RUN });
    // AND A SYNTAX ERROR STOPS IT TOO, for the reason the braces do. The parser reports these
    // by returning them rather than raising, so an unread `parserErrors` meant a file with one
    // bad line built an 875 KB page saying `0 nodes, 0 edges` and exited 0. Better no artifact
    // than a lying one.
    const broke = parseProblems(res, source);
    if (broke.length) {
      console.error(`\n  ${path.basename(src)} has ${broke.length} syntax error(s).`);
      console.error("  Argdown reports these by returning them rather than raising, so the");
      console.error("  document is truncated at the fault and the map would be built from");
      console.error("  whatever survived.\n");
      for (const b of broke) {
        console.error(`    line ${b.line}, column ${b.column}: ${b.message}`);
        if (b.text) console.error(`      ${b.text}`);
      }
      console.error("\n  Nothing was written.");
      process.exit(1);
    }
    if (!res.map) throw new Error(`Argdown produced no map for ${input}`);
    if (wantsEditor && !parts.PARSER) parts.PARSER = parserBundle();
    // CARRIED ONLY WHERE THERE IS SOMETHING TO EXPORT. 350 KB is worth it on a map whose margins
    // hold a tutor's COMMENTS -- the thing the annotated essay exists to carry back to a student
    // -- and pure weight on a reconstruction that has none.
    //
    // Gated on `comment:` and not on `note:` on purpose. Notes are the RECONSTRUCTOR's own
    // marginalia and every one of the sample reconstructions has seven to sixteen of them, so
    // including notes would put the bundle in all twelve built maps, four megabytes of it, to
    // serve a feature none of them uses. The editor implies it either way, because comments can
    // be written after the build -- which is exactly how they get written.
    //
    // Matched anywhere in the line, not just at its start: metadata is written inline inside
    // `{...}` blocks, so an anchored pattern found nothing at all.
    const hasComments = /(^|[{,\s])comment\s*:/m.test(source);
    if (wantsEditor || hasComments) parts.EXPORTER = exportBundle();
    const graph = toGraph(res);
    let located = null;
    if (rootArg || attached)
      located = attachPositions(graph, rootArg ? path.resolve(rootArg) : null, input, attached);
    parts.PAYLOAD = wrap("baked graph",
      `window.__ARGDOWN_PAYLOAD__ = ${safeJSON({ name: path.basename(src), source, graph,
                                                 manuscript: located && located.manuscript || null })};`,
      "PAYLOAD");
    outPath = outArg ? path.resolve(outArg)
                     : src.replace(/\.argdown$/i, "") + " (map).html";
    console.error(`  ${graph.nodes.length} nodes, ${graph.edges.length} edges, ` +
                  `${graph.groups.length} sections`);
    if (located) {
      console.error(`  ${located.placed} of ${graph.nodes.length} located in the manuscript` +
                    `; ${graph.nodes.length - located.placed} will sit in the no-position lane`);
      // A cited file that is not there is a defect in the reconstruction, not in the build,
      // and it is worth saying out loud rather than letting the claims quietly go unplaced.
      for (const f of located.missingFiles)
        console.error(`  ! cited file not found: ${f}`);
      // Said out loud because it is the one thing that makes a viewer noticeably bigger, and a
      // reader who finds a 1 MB HTML file should be able to see where it went.
      if (located.bytes)
        console.error(`  manuscript baked in for the source pane: ` +
                      `${located.manuscript.chapters.length} file(s), ` +
                      `${Math.round(located.bytes / 1024)} KB`);
    }
  }

  fs.writeFileSync(outPath, fill(parts), "utf8");
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.error(`wrote ${outPath} (${kb} KB)`);
}

main().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
