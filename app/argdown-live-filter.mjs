#!/usr/bin/env node
/* argdown-live-filter.mjs — a Pandoc filter that turns
 *
 *     ```{.argdown-live caption="..." height="460px"}
 *     [claim]: ...
 *         + [reason]: ...
 *     ```
 *
 * into a map that RE-LAYS-OUT in the browser: fold a Part and the rest moves to fill the gap.
 * That is the thing the official filter cannot do — it ships a Graphviz SVG whose geometry was
 * fixed at export time, so hiding a node leaves a hole.
 *
 * SCOPE: html and revealjs only. Everything else (latex, docx) is left alone here and picked up
 * by the Lua filter in Zettlr's lua-filter/, which renders `.argdown-live` as a static image —
 * a Word document has no JavaScript, and duplicating the static path here would mean two
 * renderers to keep in step.
 *
 * `.argdown-map` is deliberately NOT touched: the official @argdown/pandoc-filter still handles
 * it, and a fixed picture remains the right choice for a printed figure.
 *
 * Usage:  pandoc … --filter argdown-live-filter.mjs
 */
import { argdown } from "@argdown/node";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.resolve(HERE, "src");
const FORMAT = process.argv[2] || "";
const IS_HTML = /^(html|html4|html5|revealjs|s5|slidy|slideous|dzslides)$/.test(FORMAT);

const CLASS = "argdown-live";
const DEFAULT_HEIGHT = FORMAT === "revealjs" ? "440px" : "480px";

/* ------------------------------------------------------------------ AST helpers */

const attrsOf = a => Object.fromEntries((a[2] || []).map(([k, v]) => [k, v]));
const isLive  = b => b && b.t === "CodeBlock" && (b.c[0][1] || []).includes(CLASS);

/** Depth-first walk that replaces blocks in place. Code blocks can be nested inside divs,
 *  block quotes, list items and so on, so this cannot just scan the top-level array. */
function walk(node, fn) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const out = fn(node[i]);
      if (out !== undefined) node[i] = out; else walk(node[i], fn);
    }
  } else if (node && typeof node === "object") {
    for (const k of Object.keys(node)) walk(node[k], fn);
  }
}

/* ------------------------------------------------------------------ Argdown -> graph */

/* toGraph and RUN now live in argdown-graph.mjs, shared with the two viewers in
 * build_argdown_viewer.mjs, so a file draws identically whichever route it took. */

async function buildGraph(source) {
  const res = await argdown.runAsync({ input: source, ...RUN });
  if (!res.map) throw new Error("Argdown produced no map");
  return toGraph(res);
}

/* ------------------------------------------------------------------ HTML emission */

const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The graph rides in a child <script type="application/json"> rather than a data- attribute:
 *  no attribute-quoting to get wrong, and the payload can be arbitrarily large. */
function figure(graph, attrs, id) {
  const json = JSON.stringify(graph).replace(/<\//g, "<\\/");
  const height = attrs.height || DEFAULT_HEIGHT;
  const cap = attrs.caption
    ? `<figcaption class="argdown-live-caption">${esc(attrs.caption)}</figcaption>` : "";
  const opts = JSON.stringify({
    depth: attrs.depth != null ? Number(attrs.depth) : null,
    collapsedGroups: attrs.folded ? attrs.folded.split(/\s*,\s*/) : [],
    controls: attrs.controls !== "false"
  });
  return `<figure class="argdown-live-figure">` +
    `<div class="${CLASS}"${id ? ` id="${esc(id)}"` : ""} ` +
    `style="height:${esc(height)}" data-opts='${esc(opts)}'>` +
    `<script type="application/json" class="argdown-live-data">${json}</script>` +
    `</div>${cap}</figure>`;
}

/** dagre + the map module + a boot script, inlined once per document.
 *
 *  Booting is deferred until the container actually has a size: on a reveal.js slide that is
 *  not the current one the div measures 0x0 at load, and fitting the map to a zero box would
 *  leave it invisible for the rest of the talk. */
function runtime() {
  const dagre = fs.readFileSync(path.join(HERE, "vendor", "dagre.min.js"), "utf8");
  const mod   = fs.readFileSync(path.join(BUILD, "argdown-live-map.js"), "utf8");
  const boot = `
(function(){
  function boot(el){
    if (el.__almBooted) return true;
    // clientWidth/Height are layout pixels, unaffected by reveal.js's slide scaling.
    if (!el.clientWidth || !el.clientHeight) return false;
    var d = el.querySelector("script.argdown-live-data");
    if (!d) return true;
    var graph, opts = {};
    try { graph = JSON.parse(d.textContent); } catch (e) { return true; }
    try { opts = JSON.parse(el.getAttribute("data-opts") || "{}"); } catch (e) {}
    el.__almBooted = true;
    ArgdownLiveMap.createLiveMap(el, graph, opts);
    return true;
  }
  function scan(){
    document.querySelectorAll(".argdown-live").forEach(function(el){
      if (boot(el) || el.__almWatched) return;
      el.__almWatched = true;
      if (typeof ResizeObserver === "function") {
        var ro = new ResizeObserver(function(){ if (boot(el)) ro.disconnect(); });
        ro.observe(el);
      }
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", scan);
  else scan();
  window.addEventListener("load", scan);
  // reveal.js only gives a slide real dimensions once it is shown.
  if (window.Reveal && Reveal.on) { Reveal.on("ready", scan); Reveal.on("slidechanged", scan); }
  else document.addEventListener("reveal.js-ready", scan);
})();`;
  const css = `
.argdown-live-figure{margin:1em 0}
.argdown-live{width:100%;border:1px solid rgba(128,128,128,.28);border-radius:8px;overflow:hidden}
.argdown-live-caption{font-size:.85em;opacity:.75;margin-top:.4em;text-align:center}
.reveal .argdown-live{background:#fff}
.reveal .argdown-live-caption{color:inherit}`;
  return { t: "RawBlock", c: ["html",
    `<style>${css}</style>\n<script>${dagre}</script>\n<script>${mod}</script>\n<script>${boot}</script>`] };
}

/* ------------------------------------------------------------------ main */

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const doc = JSON.parse(await readStdin());
  if (!IS_HTML) { process.stdout.write(JSON.stringify(doc)); return; }

  // Collect first: the conversion is async, and the walker is not.
  const jobs = [];
  walk(doc.blocks, b => { if (isLive(b)) jobs.push(b); });
  if (!jobs.length) { process.stdout.write(JSON.stringify(doc)); return; }

  const built = new Map();
  for (const b of jobs) {
    const [[id, , kv], text] = b.c;
    try {
      built.set(b, figure(await buildGraph(text), attrsOf(b.c[0]), id));
    } catch (err) {
      // Fail loudly, the way the Lua filter does: a silently missing diagram is worse than a
      // failed export, because it ships.
      const msg = String(err && err.message || err).replace(/\[[0-9;]*m/g, "");
      process.stderr.write(`\nArgdown could not render an .argdown-live block:\n${msg}\n\n`);
      process.exit(1);
    }
  }

  walk(doc.blocks, b => built.has(b) ? { t: "RawBlock", c: ["html", built.get(b)] } : undefined);
  doc.blocks.push(runtime());
  process.stdout.write(JSON.stringify(doc));
}

main().catch(err => {
  process.stderr.write("argdown-live-filter: " + (err && err.stack || err) + "\n");
  process.exit(1);
});
