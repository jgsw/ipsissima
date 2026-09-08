#!/usr/bin/env node
/* argdown-pandoc — a Pandoc JSON filter that renders Argdown blocks with the Ipsissima
 * viewer, so an exported document shows the same map its author saw.
 *
 *   pandoc paper.md --filter argdown-pandoc -o paper.html
 *
 *   ```{.argdown-map}                 ⟵ or .argdown-live; synonyms
 *   [claim]: The thing argued for.
 *       + [reason]: Something that supports it.
 *   ```
 *
 * WHAT EACH OUTPUT GETS
 *   html / revealjs      the live map, embedded in the page/slide: pan, zoom, fold, the
 *                        control bar, and the ⊞ explode panel for compound arguments.
 *   docx / odt / pptx…   a standalone SVG of the same map, rendered headlessly in Chromium
 *                        by the same layout code, at the same fold state, with every claim
 *                        in full (claims="short" restores the clipping).
 *   latex / pdf / beamer the SVG again, printed to a vector PDF by Chromium so LaTeX can
 *                        place it — no rsvg-convert or other system tool needed.
 *   anything else        passed through untouched.
 *
 * A bare ```argdown block is shown as source, retagged `markdown` for the highlighter.
 *
 * EMBEDDING A FILE instead of pasting source (the alt text becomes the caption; a path
 * with spaces goes in angle brackets — that is pandoc's own syntax for such targets):
 *
 *   ![The paper's argument](maps/paper.argdown)
 *   ![](<maps/my paper.argdown>){fold="ipsfold1 ..." height="500px"}
 *   ```{.argdown-map src="maps/paper.argdown"}
 *
 * FOLDING. Every block opens at the fold the Ipsissima App would open this map at. To open
 * at a SPECIFIC state, copy a fold state identifier from the App onto the block:
 *
 *   ```{.argdown-map fold="ipsfold1 map=6b2c91e4 view=arg depth=2 folds=n12"}
 *
 * The identifier is checked against the map's fingerprint at export time, so a state from a
 * different (or since-edited) file fails the export loudly instead of drawing nonsense.
 * Coarser overrides: depth=N, folded="g1,g2" (ignored when fold= is given).
 *
 * OTHER ATTRIBUTES: controls="false"; caption="…"; title="…"; claims="full"|"short";
 * height="460px" — and on reveal.js a map fills the slide below it by default, while
 * height="screen" lays it over the whole window for as long as its slide is current.
 * Static-image attributes (width, …) pass through to the Image element.
 *
 * Static formats need Playwright's Chromium:
 *   npm install playwright && npx playwright install chromium
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { buildGraph, foldOptions, renderSvg, svgToPdf, closeBrowser, rendererScripts }
  from "../lib/render.mjs";

const FORMAT = process.argv[2] || "";
const IS_HTML = /^(html|html4|html5|revealjs|s5|slidy|slideous|dzslides)$/.test(FORMAT);
const IS_STATIC = /^(docx|latex|pdf|beamer|odt|rtf|epub|epub3|context|pptx|typst|ms)$/.test(FORMAT);
const NEEDS_PDF = /^(latex|pdf|beamer|context|ms)$/.test(FORMAT);
const DEFAULT_HEIGHT = FORMAT === "revealjs" ? "440px" : "480px";
const MAP_CLASSES = ["argdown-map", "argdown-live"];

/* ------------------------------------------------------------------ AST helpers */

const attrsOf = a => Object.fromEntries((a[2] || []).map(([k, v]) => [k, v]));
const isMap = b => b && b.t === "CodeBlock" && (b.c[0][1] || []).some(c => MAP_CLASSES.includes(c));
const isSource = b => b && b.t === "CodeBlock" && (b.c[0][1] || []).includes("argdown") && !isMap(b);

const isArgdownTarget = t => /\.(argdown|ad)$/i.test(String(t || "").split(/[?#]/)[0]
  .replace(/(%22|%27|["'])+$/g, ""));

const soleImage = inlines => {
  const real = (inlines || []).filter(i => i.t !== "Space" && i.t !== "SoftBreak");
  return real.length === 1 && real[0].t === "Image" ? real[0] : null;
};

/** The block-level shapes a lone image arrives in: a bare paragraph, or the Figure that
 *  pandoc's implicit_figures wraps one in. Returns { img, captionInlines } or null. */
function argdownImageOf(b) {
  if (b && (b.t === "Para" || b.t === "Plain")) {
    const img = soleImage(b.c);
    if (img && isArgdownTarget(img.c[2][0])) return { img, captionInlines: img.c[1] };
  }
  if (b && b.t === "Figure") {
    const inner = b.c[2];
    if (inner.length === 1 && (inner[0].t === "Plain" || inner[0].t === "Para")) {
      const img = soleImage(inner[0].c);
      if (img && isArgdownTarget(img.c[2][0])) {
        const capBlocks = (b.c[1] && b.c[1][1]) || [];
        return { img, captionInlines: capBlocks.length ? capBlocks : img.c[1] };
      }
    }
  }
  return null;
}

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

function textOf(inlines) {
  let s = "";
  walk(inlines, x => {
    if (x && x.t === "Str") { s += x.c; return x; }
    if (x && (x.t === "Space" || x.t === "SoftBreak")) { s += " "; return x; }
  });
  return s.replace(/\s+/g, " ").trim();
}

function readArgdownFile(target) {
  let p = decodeURIComponent(String(target));
  // Forgive the natural mistakes for a path with spaces: quotes wrapped round it (pandoc
  // encodes them into the target) and a file:// prefix. The syntax that needs no
  // forgiveness is angle brackets:  ![](</path/with spaces/map.argdown>)
  p = p.replace(/^["']+/, "").replace(/["']+$/, "").replace(/^file:\/\//, "");
  if (p.startsWith("~/")) p = path.join(os.homedir(), p.slice(2));
  const cand = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  if (!fs.existsSync(cand))
    throw new Error("cannot find the Argdown file \"" + target + "\" (looked at " + cand +
      "; relative paths are resolved against pandoc's working directory, and a " +
      "path containing spaces should be written in angle brackets: ![](<" +
      (path.isAbsolute(p) ? p : "maps/my map.argdown") + ">) )");
  return fs.readFileSync(cand, "utf8");
}

function fail(msg) {
  process.stderr.write("\nArgdown could not render a block:\n" +
    String(msg).replace(/\x1b\[[0-9;]*m/g, "") + "\n\n");
  process.exit(1);
}

/* ------------------------------------------------------------------ live (html / revealjs) */

const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function figure(graph, attrs, id) {
  const json = JSON.stringify(graph).replace(/<\//g, "<\\/");
  // On a slide the map fills the rest of the canvas by default: the boot script measures
  // how far down the slide the figure sits and gives it everything below. An explicit
  // height= turns that off; height="full" asks for it anywhere; height="screen" (reveal
  // only) lays the map over the whole window while its slide is current.
  const screen = attrs.height === "screen" && FORMAT === "revealjs";
  const fill = !screen &&
    (attrs.height === "full" || attrs.height === "screen" ||
     (FORMAT === "revealjs" && !attrs.height));
  const height = (attrs.height && attrs.height !== "full" && attrs.height !== "screen")
    ? attrs.height : DEFAULT_HEIGHT;
  const cap = attrs.caption
    ? `<figcaption class="argdown-live-caption">${esc(attrs.caption)}</figcaption>` : "";
  const opts = JSON.stringify(Object.assign(
    { controls: attrs.controls !== "false", fill: fill || undefined,
      screen: screen || undefined,
      allText: attrs.claims === "full" || undefined },
    foldOptions(graph, attrs)));
  return `<figure class="argdown-live-figure">` +
    `<div class="argdown-live"${id ? ` id="${esc(id)}"` : ""} ` +
    `style="height:${esc(height)}" data-opts='${esc(opts)}'>` +
    `<script type="application/json" class="argdown-live-data">${json}</script>` +
    `</div>${cap}</figure>`;
}

/* The map module, the staircase module, and a boot script, inlined once per document.
 * Booting is deferred until the container has a size: a reveal.js slide that is not
 * current measures 0x0 at load. */
function runtime() {
  const mods = rendererScripts();
  const boot = `
(function(){
  /* The explode panel: the same staircase the App opens, in a minimal dialog this page
   * owns. ArgdownStaircase draws the content; this builds the chrome around it. */
  function explodeOpen(graph, node, map){
    ArgdownStaircase.injectStyle();
    var onMap = {};
    (graph.nodes || []).forEach(function(x){ if (x.label) onMap[x.label] = x.id; });
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:60;background:rgba(20,24,34,.38);" +
      "display:grid;place-items:center;padding:2rem";
    var card = document.createElement("div");
    card.style.cssText = "background:#fff;color:#1a222e;border:1px solid #c9ced8;" +
      "border-radius:12px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;" +
      "box-shadow:0 18px 50px rgba(0,0,0,.28);overflow:hidden;" +
      "font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px";
    var head = document.createElement("header");
    // margin:0 and explicit display, because this dialog lives inside someone else's page:
    // a pandoc template is free to style header/footer, and one did (a 56px margin).
    head.style.cssText = "display:flex;align-items:center;gap:.5rem;padding:.5rem .7rem;" +
      "border-bottom:1px solid #c9ced8;margin:0;width:auto";
    var ttl = document.createElement("b"); ttl.textContent = node.label || "";
    var grow = document.createElement("span"); grow.style.flex = "1";
    function btn(label, title){
      var b = document.createElement("button");
      b.textContent = label; if (title) b.title = title;
      b.style.cssText = "border:1px solid #c9ced8;background:transparent;font:inherit;" +
        "font-size:.82em;padding:.12rem .6rem;cursor:pointer;border-radius:6px";
      return b;
    }
    var bStair = btn("Full text"), bCompact = btn("Compact");
    var bSvg = btn("SVG", "Save the staircase as an SVG");
    var bPng = btn("PNG", "Save the staircase as a PNG");
    var bX = btn("\\u00d7", "Close (Esc)");
    head.append(ttl, grow, bStair, bCompact, bSvg, bPng, bX);
    var body = document.createElement("div");
    body.style.cssText = "overflow:auto;padding:.9rem 1rem;margin:0;flex:1 1 auto";
    var foot = document.createElement("footer");
    foot.style.cssText = "padding:.45rem .8rem;border-top:1px solid #c9ced8;" +
      "font-size:.82em;opacity:.75;margin:0;width:auto";
    card.append(head, body, foot);
    ov.appendChild(card);
    document.body.appendChild(ov);

    var mode = "stair";
    function close(){ document.body.removeChild(ov); document.removeEventListener("keydown", onKey); }
    function onKey(e){ if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    ov.addEventListener("click", function(e){ if (e.target === ov) close(); });
    bX.onclick = close;

    function save(blob, name){
      var a = document.createElement("a");
      var url = URL.createObjectURL(blob);
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    }
    function draw(){
      var steps = ArgdownStaircase.steps(node.pcs || []);
      card.style.width = Math.min(ArgdownStaircase.cardWidth(steps),
                                  window.innerWidth - 64) + "px";
      ArgdownStaircase.draw(node.pcs || [], body, {
        mode: mode,
        onMap: function(t){ return !!onMap[t]; },
        onGo: map ? function(t){ close(); map.markClaims([onMap[t]]); } : null
      });
      foot.textContent = (steps.length === 1 ? "One step, with every line in full"
                                             : steps.length + " steps") +
        ". Click any claim to show it on the map. Esc closes.";
      bStair.style.background = mode === "stair" ? "#3a7bd5" : "transparent";
      bStair.style.color = mode === "stair" ? "#fff" : "inherit";
      bCompact.style.background = mode === "compact" ? "#3a7bd5" : "transparent";
      bCompact.style.color = mode === "compact" ? "#fff" : "inherit";
    }
    bStair.onclick = function(){ mode = "stair"; draw(); };
    bCompact.onclick = function(){ mode = "compact"; draw(); };
    bSvg.onclick = function(){
      var svg = ArgdownStaircase.buildSVG(body, card);
      if (svg) save(new Blob([svg], { type: "image/svg+xml" }),
                    ArgdownStaircase.fileName(node.label, mode, "svg"));
    };
    bPng.onclick = function(){
      ArgdownStaircase.pngFromSvg(ArgdownStaircase.buildSVG(body, card),
        ArgdownStaircase.fileName(node.label, mode, "png"),
        { save: save, onError: function(m){ console.error(m); } });
    };
    draw();
  }

  function boot(el){
    if (el.__almBooted) return true;
    var d = el.querySelector("script.argdown-live-data");
    if (!d) return true;
    var opts = {};
    try { opts = JSON.parse(el.getAttribute("data-opts") || "{}"); } catch (e) {}
    // screen: lift the map out of the slide and lay it over the WHOLE window, shown only
    // while its slide is current. Moved to document.body because position:fixed inside
    // reveal's scaled slides is fixed to the transform, not to the viewport. This must
    // happen BEFORE the size gate below: inside a non-current slide the element measures
    // 0x0 and would otherwise never be lifted at all.
    if (opts.screen && window.Reveal && !el.__almScreen) {
      el.__almScreen = true;
      var sect0 = el.closest("section");
      var fig0 = el.closest("figure.argdown-live-figure");
      document.body.appendChild(el);
      el.style.position = "fixed";
      el.style.left = "0"; el.style.top = "0"; el.style.right = "0"; el.style.bottom = "0";
      el.style.width = "auto"; el.style.height = "auto";
      el.style.zIndex = "40"; el.style.background = "#fff";
      el.style.border = "0"; el.style.borderRadius = "0";
      if (fig0 && fig0.parentNode) fig0.parentNode.removeChild(fig0);
      var vis = function(){
        el.style.display = (sect0 && sect0.classList.contains("present")) ? "block" : "none";
      };
      if (Reveal.on) { Reveal.on("slidechanged", vis); Reveal.on("ready", vis); }
      vis();
    }
    if (!el.clientWidth || !el.clientHeight) return false;
    var graph;
    try { graph = JSON.parse(d.textContent); } catch (e) { return true; }
    // groupFolded rode over as [key, [ids]] pairs; the map wants a Map of Sets.
    if (opts.groupFolded)
      opts.groupFolded = new Map(opts.groupFolded.map(function(p){ return [p[0], new Set(p[1])]; }));
    // fill: give the map everything below it. On a reveal slide that is measured against
    // the deck's fixed canvas (layout pixels; the scaling transform does not touch them),
    // elsewhere against the viewport.
    if (opts.fill) {
      try {
        var sect = el.closest("section");
        var deck = document.querySelector(".reveal .slides");
        var H = (sect && deck) ? deck.clientHeight
              : (window.innerHeight || document.documentElement.clientHeight);
        var y = 0, n = el;
        while (n && n !== sect && n !== document.body) { y += n.offsetTop || 0; n = n.offsetParent; }
        var room = H - y - 16;
        if (el.parentElement && el.parentElement.querySelector("figcaption")) room -= 34;
        if (room > 240) el.style.height = room + "px";
      } catch (e) {}
    }
    el.__almBooted = true;
    var m;
    opts.onExplode = function(node){ explodeOpen(graph, node, m); };
    m = ArgdownLiveMap.createLiveMap(el, graph, opts);
    // spine is not an option createLiveMap reads at construction; hand it in afterwards.
    if (opts.spine != null) { try { m.setState({ spine: opts.spine }); } catch (e) {} }
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
    `<style>${css}</style>\n<script>${mods.liveMap}</script>\n` +
    `<script>${mods.staircase}</script>\n<script>${boot}</script>`] };
}

/* ------------------------------------------------------------------ static (docx / latex) */

/** Writes the rendered map to a stable temp location and returns the Pandoc block.
 *  The files are NOT deleted here: pandoc reads images while WRITING the document,
 *  after this filter has exited. The OS owns the temp dir's lifetime. */
async function staticBlock(graph, attrs, id) {
  // Full claims by default: a printed page has no way to click "more", so a clipped claim
  // with a dead chip is worse than a bigger box. claims="short" restores the clipping.
  const svg = await renderSvg(graph, Object.assign(
    { allText: attrs.claims !== "short" }, foldOptions(graph, attrs)));
  const dir = path.join(os.tmpdir(), "argdown-pandoc");
  fs.mkdirSync(dir, { recursive: true });
  const stem = crypto.createHash("sha1").update(svg).digest("hex").slice(0, 16);
  let file = path.join(dir, stem + ".svg");
  fs.writeFileSync(file, svg);
  if (NEEDS_PDF) {
    const pdf = path.join(dir, stem + ".pdf");
    fs.writeFileSync(pdf, await svgToPdf(svg));
    file = pdf;
  }
  const title = attrs.title || "Argdown argument map";
  const passthrough = Object.entries(attrs)
    .filter(([k]) => !["fold", "folded", "depth", "caption", "title",
                       "controls", "height", "src", "claims"].includes(k));
  const image = { t: "Image", c: [[id || "", [], passthrough],
                                  [{ t: "Str", c: title }], [file, title]] };
  if (attrs.caption) {
    return { t: "Figure", c: [["", [], []],
      [null, [{ t: "Plain", c: [{ t: "Str", c: attrs.caption }] }]],
      [{ t: "Plain", c: [image] }]] };
  }
  return { t: "Para", c: [image] };
}

/* ------------------------------------------------------------------ main */

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const doc = JSON.parse(await readStdin());

  // Bare .argdown blocks: show the source, retagged for the highlighter. Done for every
  // format so no writer ever chokes on an unknown language.
  walk(doc.blocks, b => isSource(b)
    ? { t: "CodeBlock", c: [[b.c[0][0], ["markdown"], []], b.c[1]] } : undefined);

  if (!IS_HTML && !IS_STATIC) { process.stdout.write(JSON.stringify(doc)); return; }

  const jobs = [];
  walk(doc.blocks, b => {
    if (isMap(b)) { jobs.push({ b, attr: b.c[0], src: b.c[1] }); return; }
    const im = argdownImageOf(b);
    if (im) jobs.push({ b, attr: im.img.c[0], file: im.img.c[2][0],
                        captionInlines: im.captionInlines });
  });
  if (!jobs.length) { process.stdout.write(JSON.stringify(doc)); return; }

  const built = new Map();
  try {
    for (const { b, attr, src, file, captionInlines } of jobs) {
      const id = attr[0];
      const attrs = attrsOf(attr);
      try {
        const text = file != null ? readArgdownFile(file)
                   : attrs.src ? readArgdownFile(attrs.src)
                   : src;
        if (captionInlines && !attrs.caption) {
          const cap = textOf(captionInlines);
          if (cap) attrs.caption = cap;
        }
        const graph = await buildGraph(text);
        built.set(b, IS_HTML
          ? { t: "RawBlock", c: ["html", figure(graph, attrs, id)] }
          : await staticBlock(graph, attrs, id));
      } catch (err) {
        // Fail loudly, because a silently missing diagram ships.
        fail(err && err.message || err);
      }
    }
  } finally {
    await closeBrowser();
  }

  walk(doc.blocks, b => built.get(b));
  if (IS_HTML) doc.blocks.push(runtime());
  process.stdout.write(JSON.stringify(doc));
}

main().catch(err => {
  process.stderr.write("argdown-pandoc: " + (err && err.stack || err) + "\n");
  process.exit(1);
});
