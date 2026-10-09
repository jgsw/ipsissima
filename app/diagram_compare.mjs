#!/usr/bin/env node
/* SPDX-License-Identifier: MIT */
/* diagram_compare.mjs — hold a reconstruction's mechanism against the author's own diagram.
 *
 *   node app/diagram_compare.mjs FOLDER/figures.yaml            # measures, printed
 *   node app/diagram_compare.mjs FOLDER/figures.yaml --html OUT  # and a page: each figure beside its table
 *   node app/diagram_compare.mjs FOLDER/figures.yaml --propose   # suggest an `align:` for a figure that has none
 *
 * THE AUTHOR'S DIAGRAM AS AN ANSWER KEY (James's proposal, 8 Oct 2026; the plan is in the private
 * folder's diagram-comparison/PLAN.md). A text that sets out a mechanism and also draws it gives two
 * accounts of one thing. The map is made first, blind -- from a source with the figures' words left
 * out (`ingest.py --figures omit`) -- and the figure is then recorded as YAML: its boxes, its arrows
 * (flow, information or causal, with a sign where it draws one), its loops and how it is drawn. This
 * tool pairs each of the figure's nodes with a state of the map (the record's `align:`, which a person
 * confirms; `--propose` suggests one from shared words) and says, link by link, what the map has:
 *
 *   direct    a step of the map's own runs from the one to the other (a co-cause counts);
 *   route     the map reaches it through states between (up to four steps);
 *   reversed  the map has the step the other way round;
 *   missing   neither;
 *
 * and, for what the blind comparisons of 9 Oct 2026 showed a map says in other ways:
 *
 *   moderates    the map has the one as a moderator of a step into the other (tried first where the
 *                figure draws a moderator: a thin arrow onto an arrow);
 *   null         the map says the one makes no difference to the other (a figure's dead end);
 *   association  the map relates the two without a direction (a dashed macro-level association);
 *   by a part    the step runs from or to a `part_of` the paired state, or a box the figure draws with
 *                parts inside it (`inside:`) is read through them;
 *   summary      (beside the links) a map step stated `via` others summarises a route, no arrow of its own.
 *
 * and, beside that, which figure links are flows the map marks `on: stock`, which of the figure's
 * loops the map closes and with what polarity, and what the map has among the aligned states that the
 * figure does not draw. Each difference is then classed by hand (A-E in PLAN.md); the measures say
 * where to look, never what a difference means.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const MV = require(path.join(HERE, "src", "argdown-mechanism.js"));

const STOP = new Set("a an and the of to in on for by with from as at is are be it its that this or than between".split(" "));
const words = s => new Set(String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
  .filter(w => w.length > 2 && !STOP.has(w)).map(w => w.replace(/(ies|es|s|ing|ed)$/, "")));
const overlap = (a, b) => { const A = words(a), B = words(b); let n = 0; A.forEach(w => { if (B.has(w)) n++; });
  return n / Math.max(1, Math.min(A.size, B.size)); };

/** The map's own causal steps, as the census walks them: the text's layer, nulls, selections and
 *  associations left out, a co-cause and a blocker each a cause of the step's end. */
export function mapEdges(M, chain) {
  const out = [];
  M.steps.forEach(s => {
    if (s.layer !== "text" || s.isNull || s.selects || s.assoc) return;
    if (chain && !(s.chain || []).includes(chain)) return;
    // A step stated through named states ("only through T": `via`) summarises a route; it is no arrow of its own.
    out.push({ from: s.from, to: s.to, sign: s.sign || null, on: s.on || null, ...((s.statedVia || []).length ? { via: s.statedVia } : {}) });
    (s.jointly || []).concat(s.unless || []).forEach(j => out.push({ from: j, to: s.to, sign: (s.unless || []).includes(j) ? "-" : s.sign || null, on: null, side: true }));
    // A moderator is in the chain, but carries no route: it changes a step, it is not a cause of its end.
    (s.modifies || []).forEach(m => { if (m.by) out.push({ from: m.by, to: s.to, sign: null, on: null, moderates: true }); });
  });
  return out;
}
const mul = (a, b) => (a === "+" || a === "-") && (b === "+" || b === "-") ? (a === b ? "+" : "-") : null;

/** The shortest directed route from a to b through the map's steps, up to `max` steps: [{from,to,sign}] or null. */
export function route(edges, a, b, max = 4) {
  const prev = { [a]: null }, q = [[a, 0]];
  while (q.length) {
    const [v, d] = q.shift();
    if (v === b && d > 0) break;
    if (d >= max) continue;
    edges.filter(e => e.from === v && !e.moderates).forEach(e => { if (!(e.to in prev)) { prev[e.to] = e; q.push([e.to, d + 1]); } });
  }
  if (!(b in prev) || a === b) return null;
  const run = []; let v = b;
  while (v !== a) { const e = prev[v]; run.unshift(e); v = e.from; }
  return run;
}

/** Every measure for one figure against the map. */
export function compare(M, fig) {
  const align = fig.align || {};
  const edges = mapEdges(M, null), chainEdges = fig.chain ? mapEdges(M, fig.chain) : edges;
  const nodes = (fig.nodes || []).map(n => ({ ...n, state: align[n.id] || null }));
  // A box with no state of its own is read through the parts the figure draws inside it (Wimmer's
  // "Field characteristics" round institutional order, power and networks), each with the map's own parts.
  const self = v => [v].concat(Object.keys(M.states).filter(p => (M.states[p] || {}).part_of === v));
  const inner = id => (fig.nodes || []).filter(n => n.inside === id && align[n.id]).flatMap(n => self(align[n.id]));
  const links = (fig.links || []).map(l => {
    const A = align[l.from], B = align[l.to];
    if (!A || !B) {
      const As = A ? self(A) : inner(l.from), Bs = B ? self(B) : inner(l.to);
      const e = As.length && Bs.length && edges.find(e => !e.moderates && As.includes(e.from) && Bs.includes(e.to));
      const r = !e && As.length && Bs.length && As.map(a => Bs.map(b => route(edges, a, b)).find(x => x)).find(x => x);
      if (e) return { ...l, verdict: "by a part", via: [A ? e.to : e.from], mapSign: e.sign || null, signAgrees: null };
      if (r) return { ...l, verdict: "route", via: [r[0].from].concat(r.slice(0, -1).map(x => x.to), [r[r.length - 1].to]), mapSign: null, signAgrees: null };
      return { ...l, verdict: "unaligned" };
    }
    // A link the figure draws as a moderator (a thin arrow onto another arrow: Marti and Gond's
    // boundary conditions) is matched first against the map's moderators.
    if (l.kind === "moderator" && edges.some(e => e.from === A && e.to === B && e.moderates)) return { ...l, verdict: "moderates" };
    const d = edges.filter(e => e.from === A && e.to === B && !e.moderates);
    if (d.length) {
      const sign = d.map(e => e.sign).find(x => x) || null;
      return { ...l, verdict: "direct", mapSign: sign, stock: d.some(e => e.on === "stock"),
               signAgrees: l.sign && sign ? l.sign === sign : null };
    }
    // The map says the one makes no difference to the other: a figure's dead end (Marti and Gond's D4).
    if (M.steps.some(s => s.isNull && s.layer === "text" && s.from === A && s.to === B)) return { ...l, verdict: "null" };
    const r = route(edges, A, B);
    if (r) {
      const sign = r.reduce((s, e) => s === undefined ? e.sign : mul(s, e.sign), undefined);
      return { ...l, verdict: "route", via: r.slice(0, -1).map(e => e.to), mapSign: sign || null,
               signAgrees: l.sign && sign ? l.sign === sign : null };
    }
    if (edges.some(e => e.from === B && e.to === A && !e.moderates)) return { ...l, verdict: "reversed" };
    if (edges.some(e => e.from === A && e.to === B && e.moderates)) return { ...l, verdict: "moderates" };
    // A step from a part of the one, or to a part of the other (`part_of`): the figure's arrow runs
    // whole to whole where the map's runs part to part (the boat's macro corner, Wimmer's compartments).
    const byPart = edges.find(e => !e.moderates && self(A).includes(e.from) && self(B).includes(e.to));
    if (byPart) return { ...l, verdict: "by a part", via: [byPart.from === A ? byPart.to : byPart.from],
                         mapSign: byPart.sign || null, signAgrees: l.sign && byPart.sign ? l.sign === byPart.sign : null };
    // An association the map draws between the two, either way round: the figure's dashed "arrow 4"
    // (Hedström and Ylikoski's boat), which no causal step should stand in for.
    if (M.steps.some(s => s.assoc && s.layer === "text" && (s.from === A && s.to === B || s.from === B && s.to === A)))
      return { ...l, verdict: "association" };
    return { ...l, verdict: "missing" };
  });
  // THE LOOPS: one the map closes through the aligned states, and its polarity by the census's own count.
  const loops = (fig.loops || []).map(L => {
    const st = L.nodes.map(n => align[n]).filter(Boolean);
    // A loop with a node no state stands for cannot be looked for: any loop through the rest would
    // pass (Meadows's fishery, whose depreciation the prose never names, 9 Oct 2026).
    if (st.length < L.nodes.length) return { ...L, closed: null, polarity: null, agrees: null };
    const hit = (M.profile.loops_text || []).find(ml => st.every(v => ml.states.includes(v)));
    const pol = hit ? hit.polarity : null;
    const want = L.label === "B" ? "balancing" : L.label === "R" ? "reinforcing" : null;
    return { ...L, closed: !!hit, polarity: pol, agrees: hit && want ? pol === want : null };
  });
  // WHAT THE MAP HAS THAT THE FIGURE DOES NOT DRAW: steps among the aligned states, and the states no
  // figure node is paired with -- the chain's, where the figure names one; otherwise those a step away
  // from a paired state (the whole map is no measure of one small DAG among many: Bright et al.).
  const aligned = new Set(Object.values(align));
  const drawn = new Set((fig.links || []).map(l => align[l.from] + "\u0000" + align[l.to]));
  const extra = chainEdges.filter(e => !e.moderates && aligned.has(e.from) && aligned.has(e.to) && !drawn.has(e.from + "\u0000" + e.to));
  const extraSteps = extra.filter(e => !e.via), summaries = extra.filter(e => e.via);
  const near = fig.chain ? chainEdges : chainEdges.filter(e => aligned.has(e.from) || aligned.has(e.to));
  const chainStates = new Set(near.flatMap(e => [e.from, e.to]));
  const extraStates = [...chainStates].filter(v => !aligned.has(v));
  return { nodes, links, loops, extraSteps, summaries, extraStates };
}

/** A first `align:` from shared words: each figure node to the state whose label it most shares,
 *  where it shares enough. For a person to confirm, never to be taken as read. */
export function propose(M, fig) {
  const out = {};
  (fig.nodes || []).forEach(n => {
    let best = null, score = 0;
    M.ids.forEach(v => { const s = overlap(n.label, (M.states[v] || {}).label || v); if (s > score) { score = s; best = v; } });
    if (best && score >= 0.34) out[n.id] = best;
  });
  return out;
}

function report(M, fig, R) {
  const L = s => (M.states[s] || {}).label || s;
  const lines = [`${fig.id}${fig.page ? ` (p. ${fig.page})` : ""}${fig.chain ? ` against chain ${fig.chain}` : ""}`];
  const found = R.nodes.filter(n => n.state).length;
  lines.push(`  nodes   ${found} of ${R.nodes.length} paired with a state` +
             (found < R.nodes.length ? `; not: ${R.nodes.filter(n => !n.state).map(n => n.label).join("; ")}` : ""));
  const count = v => R.links.filter(l => l.verdict === v).length;
  lines.push(`  links   ${R.links.length}: ${count("direct")} direct, ${count("route")} by a route, ${count("moderates")} as a moderator, ${count("association")} as an association, ${count("by a part")} by a part, ${count("null")} as no effect, ${count("reversed")} reversed, ` +
             `${count("missing")} missing, ${count("unaligned")} with an end unpaired`);
  R.links.forEach(l => {
    const fl = l.kind === "flow" ? (l.stock ? " [flow; the map marks it on: stock]" : " [flow; the map does NOT mark it on: stock]") : "";
    const sg = l.signAgrees === false ? ` [sign: figure ${l.sign}, map ${l.mapSign}]` : "";
    lines.push(`          ${l.verdict.padEnd(9)} ${l.from} -> ${l.to}` + (l.via ? ` via ${l.via.join(", ")}` : "") + fl + sg);
  });
  R.loops.forEach(lp => lines.push(`  loop    ${lp.label || ""} ${lp.nodes.join(" -> ")}: ` +
    (lp.closed === null ? "a node has no state: not looked for" : lp.closed ? `closed in the map, ${lp.polarity}` + (lp.agrees === false ? " -- AGAINST the figure's mark" : "") : "NOT closed in the map")));
  if (R.extraSteps.length) lines.push(`  extra   ${R.extraSteps.length} step(s) of the map among the paired states the figure does not draw: ` +
    R.extraSteps.map(e => `${e.from} -> ${e.to}`).join("; "));
  if (R.summaries.length) lines.push(`  summary ${R.summaries.length} step(s) of the map stated through others (\`via\`), not drawn as arrows: ` +
    R.summaries.map(e => `${e.from} -> ${e.to} via ${e.via.join(", ")}`).join("; "));
  if (R.extraStates.length) lines.push(`  beyond  ${R.extraStates.length} state(s) of the map${fig.chain ? "'s chain" : " a step from the figure's"} the figure does not draw: ` +
    R.extraStates.map(L).join("; "));
  return lines.join("\n");
}

function html(rec, dir, parts) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const body = parts.map(([fig, text]) => {
    const img = fig.image && fs.existsSync(path.join(dir, fig.image))
      ? `<img alt="${esc(fig.id)}" src="data:image/png;base64,${fs.readFileSync(path.join(dir, fig.image)).toString("base64")}">` : "";
    return `<section><h2>${esc(fig.id)}${fig.caption ? ": " + esc(fig.caption) : ""}</h2>${img}<pre>${esc(text)}</pre>` +
      (fig.drawing ? `<h3>How the figure is drawn</h3><ul>${Object.entries(fig.drawing).map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v)}</li>`).join("")}</ul>` : "") + `</section>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><title>${esc(rec.text || "Diagram comparison")}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 16px}img{max-width:100%;border:1px solid #ccc}
pre{white-space:pre-wrap;background:#f6f6f4;padding:10px;border-radius:6px}</style><h1>${esc(rec.text || "")}</h1>
<p>The map: ${esc(rec.map)}. The figures recorded after the blind reconstruction; the measures from app/diagram_compare.mjs.</p>${body}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const recPath = argv.find(a => !a.startsWith("--"));
  if (!recPath) { console.error("usage: node app/diagram_compare.mjs FOLDER/figures.yaml [--html OUT] [--propose]"); process.exit(2); }
  const dir = path.dirname(path.resolve(recPath));
  const rec = /** @type {any} */ (yaml.load(fs.readFileSync(recPath, "utf8")));
  const M = MV.model(toGraph(argdown.run({ input: fs.readFileSync(path.join(dir, rec.map), "utf8"), ...RUN })));
  if (!M) { console.error("the map declares no mechanism"); process.exit(1); }
  const parts = [];
  for (const fig of rec.figures || []) {
    if (!(fig.links || []).length) {
      const text = `${fig.id}${fig.page ? ` (p. ${fig.page})` : ""}: not a diagram of steps` + (fig.kind ? ` (${fig.kind})` : "") +
        (fig.note ? ` -- ${fig.note}` : "") + ((fig.cases || fig.chains) ? " -- its cases are listed in the record, to be read against the map by hand" : "");
      console.log(text + "\n"); parts.push([fig, text]); continue;
    }
    if (argv.includes("--propose") || !fig.align) {
      console.log(`${fig.id}: a proposed align, to confirm by hand:\n    align: ${JSON.stringify(propose(M, fig))}`);
      if (!fig.align) continue;
    }
    const text = report(M, fig, compare(M, fig));
    console.log(text + "\n");
    parts.push([fig, text]);
  }
  const at = argv.indexOf("--html");
  if (at >= 0) { fs.writeFileSync(argv[at + 1], html(rec, dir, parts)); console.log("wrote " + argv[at + 1]); }
}
