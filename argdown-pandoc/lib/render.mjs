/* The rendering engine shared by the Pandoc filter and the argdown-map CLI: Argdown source
 * in, the Ipsissima viewer's graph out — plus headless snapshots of the drawn map as
 * standalone SVG, PNG, or PDF for the formats that cannot run it live.
 *
 * The drawing code itself is the App's own (vendor/argdown-live-map.js and friends, synced
 * from the Ipsissima repo's app/), so an exported figure is pixel-for-pixel the map the
 * author saw. Set IPSISSIMA_APP to a checkout's app/ directory to render with a live tree
 * instead of the vendored copies.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);

const APP = process.env.IPSISSIMA_APP || null;
// In the vendor dir the classic scripts are .cjs (see sync-vendor.mjs); in a live app tree
// they are src/*.js under a CommonJS-defaulted package, so require() works either way.
const ASSET = name => APP
  ? path.join(APP, name === "argdown-graph.mjs" ? name
      : path.join("src", name.replace(/\.cjs$/, ".js")))
  : path.join(HERE, "..", "vendor", name);

export const ALM = require(ASSET("argdown-live-map.cjs"));
const { toGraph, RUN } = await import(pathToFileURL(ASSET("argdown-graph.mjs")).href);
const { argdown } = await import("@argdown/node");

export function rendererScripts() {
  return {
    liveMap: fs.readFileSync(ASSET("argdown-live-map.cjs"), "utf8"),
    staircase: fs.readFileSync(ASSET("argdown-staircase.cjs"), "utf8"),
  };
}

/* ------------------------------------------------------------------ graph + fold state */

export async function buildGraph(source) {
  const res = await argdown.runAsync({ input: source, ...RUN });
  if (!res.map) throw new Error("Argdown produced no map");
  // Sanitised HERE, once, so the fold-state fingerprint, the app-default fold and the
  // renderer all speak about the same graph. createLiveMap sanitises again; that pass
  // finds nothing and changes nothing.
  return ALM.sanitiseGraph(toGraph(res)).graph;
}

/* The App's own opening fold, kept in step by hand with argdown-viewer.template.html:
 * a map past 25 claims opens on its spine with the top-level sections folded, and the
 * depth control opens on the deepest rung it owns (0..min(maxDepth,2)) that keeps the
 * OPEN-sections view within the 40-claim budget. */
const OPENING_BUDGET = 40;

function openingDepth(graph) {
  const at = d => {
    try {
      return ALM.filterGraph(graph, {
        collapsedGroups: new Set(), collapsedNodes: new Set(), expandedNodes: new Set(),
        groupFolded: new Map(), collapsedLanes: new Set(), depth: d, facets: null
      }).nodes.length;
    } catch (e) { return null; }
  };
  const whole = at(null);
  if (whole == null || whole <= OPENING_BUDGET) return null;
  const top = Math.min(ALM.maxDepth ? (ALM.maxDepth(graph) || 0) : 0, 2);
  let best = 0;
  for (let d = 0; d <= top; d++) {
    const n = at(d);
    if (n == null) break;
    if (n <= OPENING_BUDGET) best = d; else break;
  }
  return best;
}

export function appDefaultFold(graph) {
  const tops = (graph.groups || []).filter(g => !g.parent).map(g => g.id);
  return {
    collapsedGroups: (graph.nodes || []).length > 25 ? tops : [],
    depth: openingDepth(graph)
  };
}

/** The per-block fold, as plain JSON a browser context can revive and hand to createLiveMap.
 *  Precedence: fold="ipsfold1 …" > depth=/folded= > the App's own opening state.
 *  A fold string is decoded HERE too, purely to fail the export at once with
 *  decodeFoldState's own sentence if it does not belong to this map. */
export function foldOptions(graph, attrs) {
  if (attrs.fold) {
    const st = ALM.decodeFoldState(graph, attrs.fold);   // throws the useful sentence
    return {
      collapsedGroups: [...st.collapsedGroups], collapsedNodes: [...st.collapsedNodes],
      expandedNodes: [...st.expandedNodes],
      groupFolded: [...st.groupFolded].map(([k, v]) => [k, [...v]]),
      collapsedLanes: [...st.collapsedLanes],
      depth: st.depth, spine: st.spine,
      facets: st.facets ? [...st.facets] : null,
      untagged: st.untagged, expositionOrder: st.byText
    };
  }
  const dflt = appDefaultFold(graph);
  return {
    collapsedGroups: attrs.folded ? attrs.folded.split(/\s*,\s*/) : dflt.collapsedGroups,
    depth: attrs.depth != null ? Number(attrs.depth) : dflt.depth
  };
}

/* ------------------------------------------------------------------ headless rendering */

/* Playwright is deliberately NOT a dependency: it downloads a browser at install time, and
 * someone exporting only to HTML never needs one. It is looked for beside this package,
 * in the working directory's node_modules, and globally — and the error says what to run. */
function loadPlaywright() {
  const tries = [
    () => require("playwright"),
    () => createRequire(path.join(process.cwd(), "package.json"))("playwright"),
  ];
  for (const t of tries) { try { return t(); } catch (e) { /* next */ } }
  throw new Error(
    "Rendering a static map needs Playwright's Chromium, which is not installed.\n" +
    "Run:  npm install playwright && npx playwright install chromium\n" +
    "(HTML and reveal.js exports embed the live viewer and do not need it.)");
}

let browserP = null;
export function browser() {
  if (!browserP) {
    const { chromium } = loadPlaywright();
    browserP = chromium.launch();
  }
  return browserP;
}

export async function closeBrowser() {
  if (browserP) { try { (await browserP).close(); } catch (e) {} browserP = null; }
}

/* Runs IN THE PAGE. Chromium draws the map with the App's own code, then the SVG is lifted
 * out: computed styles are inlined onto every element (a standalone SVG has no page
 * stylesheet and no CSS variables) and the camera transform is replaced by one framing the
 * whole drawing at 1:1. */
const SNAPSHOT = async (args) => {
  const { graph, opts } = args;
  const el = document.getElementById("m");
  let o = Object.assign({ fitOnRender: false, duration: 0 }, opts, { controls: false });
  if (o.groupFolded)
    o.groupFolded = new Map(o.groupFolded.map(p => [p[0], new Set(p[1])]));
  const m = ArgdownLiveMap.createLiveMap(el, graph, o);
  if (o.spine != null) { try { m.setState({ spine: o.spine }); } catch (e) {} }
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  // The map fades and glides its nodes in. Transitions are disabled by a page style, but
  // entrance states are also settled across rafs/timeouts, so give the drawing a real
  // moment to reach its final values before reading them.
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise(r => setTimeout(r, 450));
  await new Promise(r => requestAnimationFrame(r));

  const svg = el.querySelector("svg.alm-svg");
  // No pointer will ever click a "more"/"less" chip on paper; a dead control is worse
  // than none. Removed from the live SVG before cloning so the style-inlining loop's
  // element pairing stays exact.
  svg.querySelectorAll(".alm-more").forEach(g => g.remove());
  const viewport = svg.querySelector(".alm-viewport");
  const box = viewport.getBBox();
  const PAD = 12;
  const W = Math.ceil(box.width + 2 * PAD), H = Math.ceil(box.height + 2 * PAD);

  const clone = svg.cloneNode(true);
  const orig = svg.querySelectorAll("*");
  const copy = clone.querySelectorAll("*");
  const PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray",
    "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "font-family",
    "font-size", "font-weight", "font-style", "letter-spacing", "text-anchor",
    "dominant-baseline", "paint-order", "font-variant-numeric",
    "marker-start", "marker-mid", "marker-end"];
  for (let i = 0; i < orig.length; i++) {
    const cs = getComputedStyle(orig[i]);
    if (cs.display === "none") { copy[i].setAttribute("display", "none"); continue; }
    let style = "";
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (!v) continue;
      // "none" is a real value for fill and stroke (an unfilled shape) but for the
      // rest — markers, dasharray — it is just the default, and noise inlined.
      if (v === "none" && p !== "fill" && p !== "stroke") continue;
      style += p + ":" + v + ";";
    }
    copy[i].setAttribute("style", style);
    const t = cs.transform;
    if (t && t !== "none") copy[i].setAttribute("transform", t);
  }
  const mg = clone.querySelector(".alm-measure"); if (mg) mg.remove();
  const cv = clone.querySelector(".alm-viewport");
  cv.setAttribute("transform",
    "translate(" + (PAD - box.x) + "," + (PAD - box.y) + ")");
  cv.removeAttribute("style");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", W); clone.setAttribute("height", H);
  clone.setAttribute("viewBox", "0 0 " + W + " " + H);
  clone.removeAttribute("class");
  clone.setAttribute("style",
    "font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#fff");
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", W); bg.setAttribute("height", H); bg.setAttribute("fill", "#fff");
  clone.insertBefore(bg, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
};

async function withMapPage(fn) {
  const b = await browser();
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    await page.setContent(
      `<!doctype html>` +
      `<style>*{transition:none!important;animation:none!important}</style>` +
      `<body style="margin:0">` +
      `<div id="m" style="width:1400px;height:900px"></div></body>`);
    await page.addScriptTag({ content: rendererScripts().liveMap });
    return await fn(page);
  } finally {
    await page.close();
  }
}

/** The map as a standalone SVG string, at the given fold state. */
export function renderSvg(graph, opts) {
  return withMapPage(page => page.evaluate(SNAPSHOT, { graph, opts }));
}

/** The same picture as a PNG buffer (scale 2 by default: figures are read closer than screens). */
export async function renderPng(graph, opts, scale = 2) {
  const svg = await renderSvg(graph, opts);
  return svgToPng(svg, scale);
}

export async function svgToPng(svg, scale = 2) {
  const b = await browser();
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  const w = m ? +m[1] : 1200, h = m ? +m[2] : 800;
  const page = await b.newPage({
    viewport: { width: Math.min(w, 4000), height: Math.min(h, 4000) },
    deviceScaleFactor: scale
  });
  try {
    await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
    const el = await page.$("svg");
    return await el.screenshot({ type: "png" });
  } finally {
    await page.close();
  }
}

/** The same picture as a single-page PDF buffer, printed by Chromium — vector output, no
 *  rsvg-convert or other system dependency. */
export async function svgToPdf(svg) {
  const b = await browser();
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  const w = m ? +m[1] : 1200, h = m ? +m[2] : 800;
  const page = await b.newPage();
  try {
    await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
    return await page.pdf({
      width: w + "px", height: h + "px",
      pageRanges: "1", printBackground: true
    });
  } finally {
    await page.close();
  }
}
