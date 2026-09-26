/* argdown-mechanism.js — the third arrangement: what the text says HAPPENS.
 *
 * WHAT THIS ANSWERS. Reasons asks what holds a claim up; Exposition asks where the reader meets
 * it. Mechanism asks what the text says happens, and to whom: the chain of steps it sets out from
 * a cause (often the action it recommends) to the outcomes it cares about -- which actors, at
 * which levels of social complexity, in what order, under what conditions -- and which of those
 * steps the text actually BACKS. Ruled 26 Sep 2026; the notation and every rule are in
 * ipsissima-mcp's mechanism.py, and this module is its drawing half.
 *
 * GROSS, NOT PEARL. The chain is Gross's (Sociological Theory 36, 2018): mechanisms enacted by
 * actors at levels, linked in sequence, with loops allowed and drawn as loops. So levels are the
 * vertical axis (macro at the top, the shape of Coleman's boat), sequence is the horizontal one,
 * and every arrow is one or more CLAIMS in the map, shaded by what the text offers for it --
 * Gross's light and shadow: evidence, argued, asserted only, imputed.
 *
 * THE APPRAISAL IS OFF UNTIL ASKED FOR, AND OFF MEANS OFF EVERYWHERE. Claims tagged #appraisal
 * are the reconstructor's own reading of the text against the world. Their control says how many
 * are hidden; switched on, a banner stays across the view and the layer is drawn hatched in
 * violet; switched off, no appraisal element, count excepted, is in the DOM at all -- the panel
 * included, which the prototype got wrong.
 *
 * LAID OUT ONCE, OVER EVERY LAYER. Switching a layer on or off never moves anything else: the
 * geometry is computed from the whole chain and the layers are filtered at draw time, the rule the
 * live map already follows.
 *
 * Classic script, no build step: sets window.ArgdownMechanism and exports for Node, so the page
 * and the tests share one implementation. The model is a port of mechanism.py's `analyse`, and
 * test_mechanism_view.mjs holds the two to the same answers on the same file.
 */
/** @param {any} global */
(function (global) {
"use strict";

var DEFAULT_LEVELS = ["macro", "meso", "micro"];
var BASES = ["study", "statistics", "model", "example", "testimony", "asserted"];
var TIERS = ["evidence", "argued", "asserted", "imputed"];
var TIER_OF_BASIS = { study: "evidence", statistics: "evidence", model: "evidence",
                      example: "argued", testimony: "argued", asserted: "asserted" };
var ROUTE_CAP = 200, LOOP_CAP = 50;

function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

/* ============================================================ the model */

/** The chain as the renderer and the profile need it, from a toGraph graph. Null when the map
 *  declares no chain. Steps that name an undeclared state are dropped from the drawing (the
 *  checker names them as faults); everything else is kept, layer by layer. */
function model(graph) {
  var m = graph && graph.mechanism;
  if (!m) return null;
  var block = obj(m.block);
  var levels = Array.isArray(block.levels) && block.levels.length ? block.levels.map(String)
                                                                   : DEFAULT_LEVELS.slice();
  var actors = obj(block.actors), states = obj(block.states);
  var ids = Object.keys(states);

  // Supports into each claim, from the map's own edges, the appraisal's excepted -- so that an
  // asserted step the author argues for reads as argued, as the checker has it.
  var tagsOfId = {};
  (graph.nodes || []).forEach(function (n) { tagsOfId[n.id] = n.tags || []; });
  var supportsOf = {};
  (graph.edges || []).forEach(function (e) {
    if (e.type !== "support") return;
    if ((tagsOfId[e.from] || []).indexOf("appraisal") >= 0) return;
    supportsOf[e.to] = (supportsOf[e.to] || 0) + 1;
  });

  var steps = [], appraisalClaims = 0;
  (m.claims || []).forEach(function (c) {
    var tags = c.tags || [];
    var layer = tags.indexOf("appraisal") >= 0 ? "appraisal"
              : tags.indexOf("reported") >= 0 ? "rival" : "text";
    if (layer === "appraisal") appraisalClaims++;
    var supports = c.id != null ? (supportsOf[c.id] || 0) : 0;
    (c.causes || []).forEach(function (raw, i) {
      raw = obj(raw);
      var tier = c.fidelity === "imputation" ? "imputed"
               : (TIER_OF_BASIS[raw.basis] || "asserted");
      if (tier === "asserted" && supports) tier = "argued";
      var given = raw.given == null ? [] : (Array.isArray(raw.given) ? raw.given : [raw.given]);
      var sign = raw.sign == null ? "" : String(raw.sign);
      steps.push({
        id: c.title + "#" + i, claim: c, layer: layer, from: raw.from, to: raw.to,
        sign: sign, basis: raw.basis || null, tier: tier,
        // A NULL FINDING (sign 0) and a SELECTION LINK are reported, never walked: see mechanism.py.
        isNull: sign === "0", selects: !!raw.selects, hedged: !!raw.hedged,
        lag: raw.lag == null ? "" : String(raw.lag), given: given.map(String),
        how: raw.how && typeof raw.how === "object" ? raw.how : null,
        reflexive: !!raw.reflexive, supports: supports
      });
    });
  });
  var ok = steps.filter(function (s) { return has(states, s.from) && has(states, s.to); });
  return { levels: levels, actors: actors, states: states, ids: ids, steps: ok,
           dropped: steps.length - ok.length, appraisalClaims: appraisalClaims,
           question: block.question == null ? "" : String(block.question),
           profile: profile(levels, actors, states, ids, ok,
                            m.appraisal != null ? m.appraisal : appraisalClaims) };
}

function reach(start, edges) {
  var seen = {}; seen[start] = true;
  var q = [start];
  while (q.length) {
    var v = q.pop();
    edges.forEach(function (e) { if (e[0] === v && !seen[e[1]]) { seen[e[1]] = true; q.push(e[1]); } });
  }
  return seen;
}

/** Every simple cycle, in order along the loop, listed once from its first state -- cycles, not
 *  strongly connected components, for the reason mechanism.py gives. */
function loops(ids, edges) {
  var order = {}; ids.forEach(function (v, i) { order[v] = i; });
  var adj = {};
  edges.forEach(function (e) { (adj[e[0]] = adj[e[0]] || []).push(e[1]); });
  var out = [];
  function walk(start, v, path) {
    (adj[v] || []).forEach(function (w) {
      if (out.length >= LOOP_CAP) return;
      if (w === start) out.push(path.slice());
      else if (has(order, w) && order[w] > order[start] && path.indexOf(w) < 0) {
        path.push(w); walk(start, w, path); path.pop();
      }
    });
  }
  ids.forEach(function (s) { walk(s, s, [s]); });
  return out;
}

function routes(start, goal, edges) {
  var adj = {};
  edges.forEach(function (e) { (adj[e[0]] = adj[e[0]] || []).push(e[1]); });
  var lengths = [];
  function walk(v, seen) {
    (adj[v] || []).forEach(function (w) {
      if (lengths.length >= ROUTE_CAP) return;
      if (w === goal) lengths.push(seen.length);
      else if (seen.indexOf(w) < 0) walk(w, seen.concat([w]));
    });
  }
  walk(start, [start]);
  return lengths.length ? { routes: lengths.length, shortest: Math.min.apply(null, lengths),
                            longest: Math.max.apply(null, lengths) } : null;
}

function uniqEdges(steps) {
  var seen = {}, out = [];
  steps.forEach(function (s) { var k = s.from + "\u0000" + s.to;
    if (!seen[k]) { seen[k] = true; out.push([s.from, s.to]); } });
  return out;
}

/** Gross's dimensions and the light and shadow, in the text's own layer -- mechanism.py's
 *  profile, field for field, so the census and the page cannot disagree. */
function profile(levels, actors, states, ids, steps, appraisalClaims) {
  var causal = steps.filter(function (s) { return !s.isNull && !s.selects; });
  var textAll = steps.filter(function (s) { return s.layer === "text"; });
  var text = causal.filter(function (s) { return s.layer === "text"; });
  var edges = uniqEdges(text);
  var role = function (i) { return obj(states[i]).role; };
  var interventions = ids.filter(function (i) { return role(i) === "intervention"; });
  var outcomes = ids.filter(function (i) { return role(i) === "outcome"; });
  var from = {}, to = {};
  edges.forEach(function (e) { from[e[0]] = true; to[e[1]] = true; });
  var entrySet = {};
  interventions.forEach(function (i) { if (from[i]) entrySet[i] = true; });
  ids.forEach(function (i) { if (from[i] && !to[i]) entrySet[i] = true; });
  var entries = Object.keys(entrySet).sort();
  var reached = {};
  entries.forEach(function (e) { var r = reach(e, edges); for (var k in r) reached[k] = true; });
  var used = {}; edges.forEach(function (e) { used[e[0]] = used[e[1]] = true; });

  var gaps = [];
  interventions.forEach(function (i) {
    if (!from[i]) gaps.push({ kind: "unlinked-intervention", state: i,
      message: "the intervention `" + i + "` has no step in the text: nothing says how it " +
               "brings about anything" });
  });
  outcomes.forEach(function (o) {
    if (!reached[o]) gaps.push({ kind: "unreached-outcome", state: o,
      message: "the outcome `" + o + "` is not reached by the text's steps from where its " +
               "chain starts" });
  });
  ids.forEach(function (i) {
    if (used[i] && outcomes.indexOf(i) < 0 && !obj(states[i]).appraisal && !from[i])
      gaps.push({ kind: "dead-end", state: i,
                  message: "`" + i + "` leads nowhere in the text: the chain stops there" });
  });

  // Keyed by SIGN as well: fee -> health (-) and (+, under a condition) are two steps.
  var best = {};
  text.forEach(function (s) {
    var k = s.from + "\u0000" + s.to + "\u0000" + s.sign;
    if (!has(best, k) || TIERS.indexOf(s.tier) < TIERS.indexOf(best[k])) best[k] = s.tier;
  });
  var tiers = {}; TIERS.forEach(function (t) { tiers[t] = 0; });
  for (var k in best) tiers[best[k]]++;

  function isReflexive(loop, pool) {
    var hop = {};
    loop.forEach(function (v, i) { hop[v + "\u0000" + loop[(i + 1) % loop.length]] = true; });
    return pool.some(function (s) { return s.reflexive && hop[s.from + "\u0000" + s.to]; });
  }
  var pool = causal.filter(function (s) { return s.layer !== "rival"; });
  var rs = [];
  entries.forEach(function (e) { outcomes.forEach(function (o) {
    var r = routes(e, o, edges);
    if (r) rs.push({ start: e, outcome: o, routes: r.routes, shortest: r.shortest, longest: r.longest });
  }); });
  var levelOf = function (i) { return obj(actors[obj(states[i]).actor]).level; };
  var spanned = {}; Object.keys(used).forEach(function (i) { spanned[levelOf(i)] = true; });
  var lags = {}; text.forEach(function (s) { if (s.lag) lags[s.lag] = true; });
  var claimTitles = {}; text.forEach(function (s) { claimTitles[s.claim.title] = true; });
  return {
    levels: levels,
    levels_spanned: levels.filter(function (lv) { return spanned[lv]; }),
    states: ids.length, steps: Object.keys(best).length,
    claims: Object.keys(claimTitles).length,
    lags: Object.keys(lags).sort(), entries: entries, routes: rs,
    loops_text: loops(ids, edges).map(function (l) {
      return { states: l, reflexive: isReflexive(l, text) }; }),
    loops_with_appraisal: loops(ids, uniqEdges(pool)).map(function (l) {
      return { states: l, reflexive: isReflexive(l, pool) }; }),
    tiers: tiers, gaps: gaps,
    rival_steps: steps.filter(function (s) { return s.layer === "rival"; }).length,
    null_steps: nullsOf(textAll, steps),
    selection_steps: (function () {
      var seen = {}, out = [];
      textAll.forEach(function (s) { var k = s.from + "\u0000" + s.to;
        if (s.selects && !seen[k]) { seen[k] = true; out.push([s.from, s.to]); } });
      return out.sort(function (a, b) { return (a[0] + "\u0000" + a[1]) < (b[0] + "\u0000" + b[1]) ? -1 : 1; });
    })(),
    hedged: textAll.filter(function (s) { return s.hedged; }).length,
    appraisal_claims: appraisalClaims,
    appraisal_steps: steps.filter(function (s) { return s.layer === "appraisal"; }).length,
    with_how: text.filter(function (s) { return !!s.how; }).length,
    with_given: text.filter(function (s) { return s.given.length > 0; }).length
  };
}

function nullsOf(textAll, steps) {
  var out = [], seen = {};
  textAll.forEach(function (s) {
    var k = s.from + "\u0000" + s.to;
    if (!s.isNull || seen[k]) return;
    seen[k] = true;
    var against = {};
    steps.forEach(function (r) {
      if (r.layer === "rival" && !r.isNull && r.from === s.from && r.to === s.to && r.sign) against[r.sign] = true;
    });
    out.push({ from: s.from, to: s.to, basis: s.basis, refutes: Object.keys(against).sort() });
  });
  return out;
}

/* ============================================================ the layout, pure */

var BW = 168, BH = 56, COL = 250, GUT = 150, ROW = 80, PADY = 22, TOP = 34;

/** Geometry for the whole chain, every layer included. Pure: the same model gives the same
 *  numbers, and nothing the reader switches changes them. */
function layout(M) {
  var used = {};
  M.steps.forEach(function (s) { used[s.from] = used[s.to] = true; });
  M.ids.forEach(function (i) { if (obj(M.states[i]).role === "intervention") used[i] = true; });
  var ids = M.ids.filter(function (i) { return used[i]; });

  // Back edges by depth-first search from the interventions first, so a loop is drawn as a loop
  // returning to where the chain began, not as the chain's first step.
  var out = {};
  M.steps.forEach(function (s) { (out[s.from] = out[s.from] || []).push(s); });
  var back = {}, mark = {};
  function dfs(v) {
    mark[v] = 1;
    (out[v] || []).forEach(function (s) {
      if (mark[s.to] === 1) back[s.id] = true;
      else if (!mark[s.to]) dfs(s.to);
    });
    mark[v] = 2;
  }
  ids.filter(function (i) { return obj(M.states[i]).role === "intervention"; }).forEach(function (i) { if (!mark[i]) dfs(i); });
  ids.forEach(function (i) { if (!mark[i]) dfs(i); });
  var rank = {};
  function r(v, seen) {
    if (has(rank, v)) return rank[v];
    if (seen[v]) return 0;
    seen[v] = true;
    var best = 0;
    M.steps.forEach(function (s) { if (s.to === v && !back[s.id]) best = Math.max(best, r(s.from, seen) + 1); });
    return (rank[v] = best);
  }
  ids.forEach(function (v) { r(v, {}); });

  var levelOf = function (i) {
    var lv = obj(M.actors[obj(M.states[i]).actor]).level;
    return M.levels.indexOf(lv) >= 0 ? lv : M.levels[M.levels.length - 1];
  };
  var slots = {};
  ids.forEach(function (v) { var k = levelOf(v) + "|" + rank[v]; (slots[k] = slots[k] || []).push(v); });
  var lanes = [], y = TOP;
  M.levels.forEach(function (lv) {
    var rows = 1;
    ids.forEach(function (v) { if (levelOf(v) === lv) rows = Math.max(rows, slots[lv + "|" + rank[v]].length); });
    var h = rows * ROW + PADY * 2;
    lanes.push({ level: lv, y: y, h: h,
                 actors: Object.keys(M.actors).filter(function (a) { return obj(M.actors[a]).level === lv; })
                           .map(function (a) { return obj(M.actors[a]).label || a; }) });
    y += h;
  });
  var nodes = {}, maxRank = 0;
  ids.forEach(function (v) {
    var li = M.levels.indexOf(levelOf(v)), k = levelOf(v) + "|" + rank[v];
    nodes[v] = { x: GUT + rank[v] * COL, y: lanes[li].y + PADY + slots[k].indexOf(v) * ROW, w: BW, h: BH };
    maxRank = Math.max(maxRank, rank[v]);
  });

  // One drawn edge per (from, to, layer): the claims behind it are listed on the chip.
  var groups = {}, order = [];
  // One drawn edge per (from, to, layer, kind): a null finding and a selection link are never
  // folded into the causal arrow beside them, or the drawing would say the opposite of the text.
  var kindOf = function (s) { return s.isNull ? "null" : s.selects ? "selection" : "step"; };
  M.steps.forEach(function (s) {
    var k = s.from + "\u0000" + s.to + "\u0000" + s.layer + "\u0000" + kindOf(s);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(s);
  });
  var edges = order.map(function (k) {
    var ss = groups[k], s0 = ss[0], a = nodes[s0.from], b = nodes[s0.to];
    var isBack = ss.some(function (s) { return back[s.id]; });
    var kind = kindOf(s0);
    var off = s0.layer === "rival" ? 10 : s0.layer === "appraisal" ? -10 : kind === "null" ? 20 : kind === "selection" ? -20 : 0;
    var tier = kind !== "step" && s0.layer !== "appraisal" ? kind
             : s0.layer !== "text" ? s0.layer
             : ss.map(function (s) { return s.tier; })
                 .sort(function (p, q) { return TIERS.indexOf(p) - TIERS.indexOf(q); })[0];
    var d, cx, cy;
    if (isBack) {
      var x1 = a.x + BW / 2 + off, y1 = a.y + BH, x2 = b.x + BW / 2 + off, y2 = b.y + BH;
      var dip = Math.max(y1, y2) + 46 + Math.abs(off) * 2;
      d = "M" + x1 + "," + y1 + " C" + x1 + "," + dip + " " + x2 + "," + dip + " " + x2 + "," + (y2 + 6);
      cx = (x1 + x2) / 2; cy = dip - 12;
    } else {
      var X1 = a.x + BW, Y1 = a.y + BH / 2 + off, X2 = b.x - 4, Y2 = b.y + BH / 2 + off;
      var c = Math.max(40, (X2 - X1) / 2);
      d = "M" + X1 + "," + Y1 + " C" + (X1 + c) + "," + Y1 + " " + (X2 - c) + "," + Y2 + " " + X2 + "," + Y2;
      // The chip sits near the TARGET, so arrows fanning out of one state keep their labels apart;
      // and the layers' chips stand at different points along their arrows, because parallel
      // arrows run only 10px apart and chips at the same point sat on top of one another -- on the
      // spike the rival view's "+ x2" hid the text's own "- x7" at the step that matters most.
      var t = kind === "null" ? 0.5 : kind === "selection" ? 0.4
            : s0.layer === "text" ? 0.84 : s0.layer === "rival" ? 0.6 : 0.72, u = 1 - t;
      var bz = function (p0, p1, p2, p3) { return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3; };
      cx = bz(X1, X1 + c, X2 - c, X2); cy = bz(Y1, Y1, Y2, Y2);
    }
    var signs = [];
    ss.forEach(function (s) { if (s.sign && signs.indexOf(s.sign) < 0) signs.push(s.sign); });
    var given = ss.some(function (s) { return s.given.length > 0; });
    var label = kind === "null" ? "0 no effect" + (ss.length > 1 ? " ×" + ss.length : "")
              : kind === "selection" ? "selection" :
                (signs.join("/") || "·") + (ss.length > 1 ? " ×" + ss.length : "") +
                (given ? " ◇" : "") + (isBack ? " ↻" : "");
    return { key: k, from: s0.from, to: s0.to, layer: s0.layer, kind: kind, tier: tier, back: isBack,
             steps: ss, path: d, chip: { x: cx, y: cy, label: label } };
  });
  return { width: GUT + (maxRank + 1) * COL, height: y + 70, lanes: lanes, nodes: nodes,
           edges: edges, box: { w: BW, h: BH } };
}

/* ============================================================ drawing */

var NS = "http://www.w3.org/2000/svg";
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
}
function el(name, attrs, parent) {
  var e = document.createElementNS(NS, name);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function wrapWords(s, n) {
  var words = String(s).split(/\s+/), lines = [], cur = "";
  words.forEach(function (w) {
    if ((cur + " " + w).trim().length > n) { if (cur.trim()) lines.push(cur.trim()); cur = w; }
    else cur += " " + w;
  });
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = lines[2].replace(/\s*\S*$/, "") + "…"; }
  return lines;
}

var styled = false;
function injectStyle() {
  if (styled || document.getElementById("amech-style")) { styled = true; return; }
  styled = true;
  var s = document.createElement("style");
  s.id = "amech-style";
  s.textContent = [
    ".amech{position:relative;width:100%;height:100%;display:flex;flex-direction:column;",
    "  --mv-evidence:#1f3a5f;--mv-argued:#3f6f9f;--mv-asserted:#7d8b99;--mv-imputed:#9a7b2f;",
    "  --mv-rival:#b03030;--mv-appraisal:#6d5ba3;--mv-appraisal-bg:#f1eefa;--mv-gap:#c2410c;",
    "  --mv-null:#8a8f98;--mv-selection:#2f8f83;",
    "  --mv-lane-a:rgba(0,0,0,.035);--mv-lane-b:rgba(0,0,0,.015);--mv-sel:#e0a800}",
    "@media (prefers-color-scheme:dark){.amech{",
    "  --mv-evidence:#9cc3ef;--mv-argued:#7fa7d1;--mv-asserted:#8d99a6;--mv-imputed:#d9b45a;",
    "  --mv-rival:#ef7a7a;--mv-appraisal:#b3a4e6;--mv-appraisal-bg:#2a2638;--mv-gap:#f08a4b;",
    "  --mv-null:#9aa0a8;--mv-selection:#5fc2b5;",
    "  --mv-lane-a:rgba(255,255,255,.04);--mv-lane-b:rgba(255,255,255,.015);--mv-sel:#f5c542}}",
    ".amech[hidden]{display:none}",
    ".amech-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px;",
    "  border-bottom:1px solid var(--line,#ddd)}",
    ".amech-q{flex:1 1 260px;color:var(--fg-dim,#666);font-size:13px;min-width:0}",
    ".amech-tog{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line,#ddd);",
    "  border-radius:7px;padding:4px 9px;background:var(--panel,#fff);cursor:pointer;font-size:13px;user-select:none}",
    ".amech-tog input{margin:0}",
    ".amech-tog .sw{width:20px;height:0;border-top:2px dashed var(--mv-rival)}",
    ".amech-tog.appr{border-style:dashed;border-color:var(--mv-appraisal)}",
    ".amech-tog.appr .sw{height:9px;border:0;border-radius:2px;",
    "  background:repeating-linear-gradient(45deg,var(--mv-appraisal) 0 2px,transparent 2px 5px)}",
    ".amech-tog .aside{color:var(--fg-dim,#666);font-size:12px}",
    ".amech-banner{margin:8px 12px 0;padding:7px 11px;border-radius:7px;font-size:13px;",
    "  background:var(--mv-appraisal-bg);border:1px dashed var(--mv-appraisal)}",
    ".amech-banner[hidden]{display:none}",
    ".amech-body{flex:1 1 auto;display:flex;min-height:0}",
    ".amech-stage{flex:1 1 auto;overflow:auto;min-width:0}",
    ".amech-side{flex:0 0 320px;overflow:auto;border-left:1px solid var(--line,#ddd);padding:10px 14px;font-size:13px}",
    "@media (max-width:760px){.amech-body{flex-direction:column}.amech-side{flex:0 0 auto;max-height:45%;border-left:0;border-top:1px solid var(--line,#ddd)}}",
    ".amech-side h3{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--fg-dim,#666);margin:10px 0 6px;font-weight:600}",
    ".amech-side h3:first-child{margin-top:0}",
    ".amech-row{display:grid;grid-template-columns:78px 1fr;gap:6px;padding:2px 0}",
    ".amech-row .k{color:var(--fg-dim,#666)}",
    ".amech-barline{display:flex;height:9px;border-radius:3px;overflow:hidden;margin:4px 0}",
    ".amech-gaps{margin:0;padding-left:16px}.amech-gaps li{color:var(--mv-gap);margin:2px 0}",
    ".amech-claim{border-top:1px solid var(--line,#ddd);padding:7px 0}",
    ".amech-claim:first-of-type{border-top:0}",
    ".amech-claim .t{font-weight:600}",
    ".amech-claim .m{color:var(--fg-dim,#666);font-size:12px;margin-top:2px}",
    ".amech-claim.appr{background:var(--mv-appraisal-bg);margin:0 -14px;padding:7px 14px}",
    ".amech-claim button{font:inherit;font-size:12px;margin-top:4px;background:none;border:1px solid var(--line,#ddd);",
    "  border-radius:5px;padding:1px 7px;cursor:pointer;color:var(--fg,#1a1a1a)}",
    ".amech-pill{display:inline-block;font-size:11px;padding:0 6px;border-radius:9px;border:1px solid var(--line,#ddd);margin-right:4px}",
    ".amech-how{border:1px solid var(--line,#ddd);border-radius:6px;padding:5px 7px;margin-top:5px;font-size:12px}",
    ".amech svg text{fill:var(--fg,#1a1a1a)}",
    ".amech .lane-l{font-size:12px;font-weight:600;fill:var(--fg-dim,#666)}",
    ".amech .actor-l{font-size:11px;fill:var(--fg-dim,#666)}",
    ".amech .st rect.box{fill:var(--alm-node-bg,#fff);stroke:var(--fg,#1a1a1a);stroke-width:1}",
    ".amech .st.intervention rect.box{fill:var(--mv-evidence);stroke:var(--mv-evidence)}",
    ".amech .st.intervention text{fill:var(--alm-node-bg,#fff)}",
    ".amech .st.outcome rect.outer{fill:none;stroke:var(--fg,#1a1a1a)}",
    ".amech .st.appraisal rect.box{fill:url(#amech-hatch);stroke:var(--mv-appraisal);stroke-dasharray:4 3}",
    ".amech .st{cursor:pointer}.amech .st text{font-size:12px}",
    ".amech .ed{fill:none;cursor:pointer}.amech .hit{fill:none;stroke:transparent;stroke-width:14;cursor:pointer}",
    ".amech .chip rect{fill:var(--panel,#fff);stroke:currentColor}.amech .chip text{font-size:11px;fill:currentColor;font-weight:600}",
    ".amech .sel{stroke:var(--mv-sel)!important;stroke-width:4!important}",
    ".amech .st.intervention text.gapmark,.amech .gapmark{fill:var(--mv-gap);font-size:11px;font-weight:600}"
  ].join("\n");
  document.head.appendChild(s);
}

var TIER_STYLE = {
  evidence:  { dash: "",    width: 3 },
  argued:    { dash: "",    width: 2 },
  asserted:  { dash: "7 5", width: 1.6 },
  imputed:   { dash: "2 4", width: 1.6 },
  rival:     { dash: "8 4", width: 1.8 },
  appraisal: { dash: "3 4", width: 1.8 },
  // No effect found: faint, no arrowhead, and a chip that says so.
  "null":    { dash: "2 6", width: 1.4 },
  // Who ends up on each side, not what brings what about.
  selection: { dash: "10 3 2 3", width: 1.4 }
};

/** Draw the chain into `container`. `opts.onClaim(claim)` is called when the reader asks to see
 *  a claim -- the host takes it to the claim's passage. Returns a small controller. */
function create(container, graph, opts) {
  opts = opts || {};
  injectStyle();
  var M = model(graph);
  container.innerHTML = "";
  container.classList.add("amech");
  if (!M) { container.textContent = "This map declares no mechanism."; return null; }
  var G = layout(M);
  // Off unless the host says the page's switch is already on: the view reports its layers back
  // as soon as it is drawn, and starting from `false` regardless would have turned off, on first
  // entry, an appraisal the reader had switched on in Reasons.
  var layers = { rival: true, appraisal: !!opts.appraisal };
  var selected = null;

  var bar = document.createElement("div"); bar.className = "amech-bar";
  bar.innerHTML =
    '<div class="amech-q">' + esc(M.question) + '</div>' +
    (M.profile.rival_steps ? '<label class="amech-tog rival"><input type="checkbox" data-layer="rival" checked>' +
      '<span class="sw"></span><span>Rival views</span><span class="aside">as the text reports them</span></label>' : '') +
    (M.appraisalClaims ? '<label class="amech-tog appr"><input type="checkbox" data-layer="appraisal">' +
      '<span class="sw"></span><span>Reconstructor’s appraisal</span><span class="aside amech-acount"></span></label>' : '');
  container.appendChild(bar);
  var banner = document.createElement("div"); banner.className = "amech-banner"; banner.hidden = true;
  banner.innerHTML = '<b>Appraisal layer on.</b> ' + M.appraisalClaims + ' addition' +
    (M.appraisalClaims === 1 ? '' : 's') + ' by the reconstructor, drawn hatched in violet. ' +
    'They are not claims the text makes: each is a reading of the text against the world, with its warrant.';
  container.appendChild(banner);
  var body = document.createElement("div"); body.className = "amech-body";
  var stage = document.createElement("div"); stage.className = "amech-stage";
  var side = document.createElement("div"); side.className = "amech-side";
  body.appendChild(stage); body.appendChild(side); container.appendChild(body);

  var svg = el("svg", { width: G.width, height: G.height, viewBox: "0 0 " + G.width + " " + G.height,
                        role: "img", "aria-label": "The mechanism the text asserts" }, stage);
  var defs = el("defs", {}, svg);
  var pat = el("pattern", { id: "amech-hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse",
                            patternTransform: "rotate(45)" }, defs);
  el("rect", { width: 6, height: 6, fill: "var(--mv-appraisal-bg)" }, pat);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "var(--mv-appraisal)", "stroke-width": 1, opacity: 0.35 }, pat);
  Object.keys(TIER_STYLE).forEach(function (t) {
    var mk = el("marker", { id: "amech-ar-" + t, viewBox: "0 0 10 10", refX: 9, refY: 5,
                            markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--mv-" + t + ")" }, mk);
  });
  G.lanes.forEach(function (ln, i) {
    el("rect", { x: 0, y: ln.y, width: G.width, height: ln.h, fill: i % 2 ? "var(--mv-lane-b)" : "var(--mv-lane-a)" }, svg);
    el("text", { x: 12, y: ln.y + 20, "class": "lane-l" }, svg).textContent = ln.level.toUpperCase();
    ln.actors.forEach(function (a, j) { el("text", { x: 12, y: ln.y + 38 + j * 14, "class": "actor-l" }, svg).textContent = a; });
  });
  el("text", { x: GUT, y: 22, "class": "actor-l" }, svg).textContent = "sequence →";

  // THREE LAYERS, and the chips on top. Each arrow carries a 14px invisible hit stroke so it can
  // be clicked at all, and where arrows run close -- a rival view beside the text's own step --
  // one arrow's stroke lay over the other's chip: driving the page with real clicks, the "x7"
  // chip of the text's busiest step opened the RIVAL arrow instead. The chip is the unambiguous
  // target, so every chip is drawn above every stroke.
  var gE = el("g", {}, svg), gC = el("g", {}, svg), gN = el("g", {}, svg);
  var drawnEdges = [];
  function drawEdges() {
    // FILTER AT DRAW TIME, DO NOT HIDE. An appraisal element that is merely display:none is
    // still in the DOM, and "off means off" is a promise about what the page carries.
    while (gE.firstChild) gE.removeChild(gE.firstChild);
    while (gC.firstChild) gC.removeChild(gC.firstChild);
    drawnEdges = [];
    G.edges.forEach(function (e) {
      if (e.layer !== "text" && !layers[e.layer]) return;
      var st = TIER_STYLE[e.tier], col = "var(--mv-" + e.tier + ")";
      var g = el("g", { "data-layer": e.layer, "data-edge": e.from + ">" + e.to, "data-kind": e.kind }, gE);
      var p = el("path", { d: e.path, "class": "ed", stroke: col, "stroke-width": st.width,
                           "stroke-dasharray": st.dash }, g);
      if (e.kind !== "null") p.setAttribute("marker-end", "url(#amech-ar-" + e.tier + ")");
      el("path", { d: e.path, "class": "hit" }, g);
      var chip = el("g", { "class": "chip", style: "color:" + col, "data-layer": e.layer,
                           "data-edge": e.from + ">" + e.to, "data-kind": e.kind }, gC);
      var tw = e.chip.label.length * 6.6 + 12;
      el("rect", { x: e.chip.x - tw / 2, y: e.chip.y - 9, width: tw, height: 18, rx: 9 }, chip);
      el("text", { x: e.chip.x, y: e.chip.y + 4, "text-anchor": "middle" }, chip).textContent = e.chip.label;
      var title = el("title", {}, g);
      title.textContent = e.steps.length + " claim" + (e.steps.length === 1 ? "" : "s") + " — click to see";
      var pick = function (ev) { ev.stopPropagation(); select({ edge: e, path: p }); };
      g.addEventListener("click", pick);
      chip.addEventListener("click", pick);
      chip.setAttribute("cursor", "pointer");
      drawnEdges.push({ e: e, p: p });
      if (selected && selected.edge && selected.edge.key === e.key) { p.classList.add("sel"); selected.path = p; }
    });
  }
  function drawNodes() {
    while (gN.firstChild) gN.removeChild(gN.firstChild);
    Object.keys(G.nodes).forEach(function (v) {
      var s = obj(M.states[v]), p = G.nodes[v];
      if (s.appraisal && !layers.appraisal) return;
      var cls = "st" + (s.role ? " " + s.role : "") + (s.appraisal ? " appraisal" : "");
      var g = el("g", { "class": cls, "data-layer": s.appraisal ? "appraisal" : "text",
                        transform: "translate(" + p.x + "," + p.y + ")" }, gN);
      if (s.role === "outcome") el("rect", { "class": "outer", x: -4, y: -4, width: p.w + 8, height: p.h + 8, rx: 9 }, g);
      el("rect", { "class": "box", width: p.w, height: p.h, rx: 7 }, g);
      var lines = wrapWords(s.label || v, 24);
      lines.forEach(function (t, i) {
        el("text", { x: p.w / 2, y: p.h / 2 + (i - (lines.length - 1) / 2) * 14 + 4, "text-anchor": "middle" }, g).textContent = t;
      });
      var tt = el("title", {}, g); tt.textContent = s.label || v;
      if (s.role === "intervention" && !M.steps.some(function (x) { return x.from === v && x.layer === "text"; }))
        el("text", { x: p.w + 10, y: p.h / 2 + 4, "class": "gapmark" }, g).textContent = "✕ no link in the text";
      g.addEventListener("click", function (ev) { ev.stopPropagation(); select({ state: v }); });
    });
  }

  function claimHTML(s) {
    var c = s.claim, how = "";
    if (s.how) {
      how = '<div class="amech-how"><b>How</b> ' + ["actor", "situation", "habit", "response"].filter(function (k) { return s.how[k]; })
        .map(function (k) { var v = k === "actor" ? (obj(M.actors[s.how[k]]).label || s.how[k]) : s.how[k];
          return '<div><span class="k">' + k + '</span> ' + esc(v) + '</div>'; }).join("") + '</div>';
    }
    var meta = ['<span class="amech-pill">' + esc(c.fidelity || "compression") + '</span>',
                '<span class="amech-pill">' + esc(s.basis || (s.tier === "imputed" ? "imputed" : "asserted")) + '</span>']
      .join("") + (c.pinpoint ? esc(c.pinpoint) : "") + (s.lag ? " · lag: " + esc(s.lag) : "") +
      (s.given.length ? " · given: " + s.given.map(esc).join("; ") : "") +
      (s.isNull ? " · <b>the text finds no effect</b>" : "") +
      (s.selects ? " · <b>a selection link, not an effect</b>" : "") +
      (s.hedged ? " · hedged: the text says it may" : "") +
      (s.supports ? " · " + s.supports + " supporting claim" + (s.supports === 1 ? "" : "s") + " in the map" : "");
    return '<div class="amech-claim' + (s.layer === "appraisal" ? " appr" : "") + '">' +
      '<div class="t">' + esc(c.title) + '</div><div>' + esc(c.text) + '</div>' +
      '<div class="m">' + meta + '</div>' +
      (c.warrant ? '<div class="m">warrant: ' + esc(c.warrant) + '</div>' : '') + how +
      (c.id != null && opts.onClaim ? '<button type="button" data-claim="' + esc(c.title) + '">Show in the text</button>' : '') +
      '</div>';
  }
  function profileHTML() {
    var P = M.profile, T = P.tiers, tot = 0;
    TIERS.forEach(function (t) { tot += T[t]; });
    tot = tot || 1;
    var label = function (i) { return obj(M.states[i]).label || i; };
    var loopText = P.loops_text.length ? P.loops_text.map(function (l) { return esc(l.states.concat(l.states[0]).map(label).join(" → ")); }).join("<br>")
                                       : "none closed in the text";
    var gapText = function (g) {
      var s = g.state ? "“" + label(g.state) + "”" : "";
      return g.kind === "unlinked-intervention" ? "The intervention " + s + " has no link in the text: nothing says how it brings about anything."
           : g.kind === "unreached-outcome" ? s + " is not reached by the text’s links from where its chain starts."
           : s + " leads nowhere in the text: the chain stops there.";
    };
    return '<h3>The chain</h3>' +
      '<div class="amech-row"><span class="k">steps</span><span>' + P.steps + ' distinct, asserted by ' + P.claims + ' claim' + (P.claims === 1 ? '' : 's') + '</span></div>' +
      '<div class="amech-row"><span class="k">height</span><span>' + P.levels_spanned.length + ' of ' + P.levels.length + ' levels' +
        (P.levels_spanned.length ? ': ' + esc(P.levels_spanned.join(", ")) : '') + '</span></div>' +
      '<div class="amech-row"><span class="k">length</span><span>' + (P.lags.length ? 'lags stated: ' + P.lags.map(esc).join("; ") : 'no timing stated') + '</span></div>' +
      '<div class="amech-row"><span class="k">loops</span><span>' + loopText + '</span></div>' +
      (P.null_steps.length ? '<div class="amech-row"><span class="k">no effect</span><span>' +
        P.null_steps.map(function (n) { return esc(label(n.from) + " \u2192 " + label(n.to)) +
          (n.refutes.length ? ' <span class="amech-q">(against the rival view)</span>' : ""); }).join("<br>") + '</span></div>' : '') +
      (P.selection_steps.length ? '<div class="amech-row"><span class="k">selection</span><span>' +
        P.selection_steps.map(function (x) { return esc(label(x[0]) + " \u2192 " + label(x[1])); }).join("<br>") +
        ' <span class="amech-q">(not effects)</span></span></div>' : '') +
      '<h3>Light and shadow</h3><div class="amech-barline">' +
      TIERS.map(function (t) { return '<span style="width:' + (100 * T[t] / tot) + '%;background:var(--mv-' + t + ')"></span>'; }).join("") +
      '</div><div class="amech-q">' + T.evidence + ' backed by a study or statistics · ' + T.argued + ' argued · ' +
      T.asserted + ' asserted only · ' + T.imputed + ' imputed</div>' +
      (P.gaps.length ? '<h3>Gaps</h3><ul class="amech-gaps">' + P.gaps.map(function (g) { return '<li>' + esc(gapText(g)) + '</li>'; }).join("") + '</ul>' : '') +
      '<h3>Key</h3><div class="amech-q">Heavy line: backed by a study or statistics. Line: argued. Dashed: asserted only. ' +
      'Dotted gold: imputed. Dashed red: a rival view the text reports. Faint grey “0 no effect”: the text ' +
      'finds no effect. Teal “selection”: who ends up on each side, not an effect. ×n: claims behind one arrow. ' +
      '◇: conditions stated. ↻: closes a loop.</div>' +
      (M.dropped ? '<div class="amech-q" style="color:var(--mv-gap)">' + M.dropped + ' step(s) name an undeclared state and are not drawn; the checker names them.</div>' : '');
  }
  function renderSide() {
    if (selected && selected.edge) {
      var e = selected.edge;
      side.innerHTML = '<h3>' + esc(obj(M.states[e.from]).label || e.from) + ' → ' + esc(obj(M.states[e.to]).label || e.to) + '</h3>' +
        e.steps.map(claimHTML).join("") +
        // OFF MEANS OFF IN THE PANEL TOO: the appraisal's view of a text step is named only while
        // the layer is on.
        (layers.appraisal ? appraisalNotes(e) : '') +
        '<h3>&nbsp;</h3><button type="button" data-back="1">Back to the chain</button>';
    } else if (selected && selected.state) {
      var s = obj(M.states[selected.state]), a = obj(M.actors[s.actor]);
      side.innerHTML = '<h3>' + esc(s.label || selected.state) + '</h3>' +
        '<div class="amech-row"><span class="k">actor</span><span>' + esc(a.label || s.actor || "") + (a.level ? ' (' + esc(a.level) + ')' : '') + '</span></div>' +
        (s.role ? '<div class="amech-row"><span class="k">role</span><span>' + esc(s.role) + '</span></div>' : '') +
        (s.measured ? '<div class="amech-row"><span class="k">measured</span><span>' + esc(s.measured) + '</span></div>' : '') +
        (s.appraisal ? '<div class="amech-row"><span class="k">layer</span><span>the reconstructor’s appraisal: not in the text</span></div>' : '') +
        '<h3>&nbsp;</h3><button type="button" data-back="1">Back to the chain</button>';
    } else {
      side.innerHTML = profileHTML();
    }
  }
  function appraisalNotes(e) {
    var on = G.edges.filter(function (x) { return x.layer === "appraisal" && x.from === e.from && x.to === e.to; });
    if (!on.length || e.layer === "appraisal") return "";
    return '<h3>The appraisal on this step</h3>' + on[0].steps.map(claimHTML).join("");
  }
  side.addEventListener("click", function (ev) {
    var t = /** @type {Element} */ (ev.target);
    if (t.getAttribute && t.getAttribute("data-back")) { select(null); return; }
    var title = t.getAttribute && t.getAttribute("data-claim");
    if (title && opts.onClaim) {
      var hit = null;
      M.steps.forEach(function (s) { if (s.claim.title === title) hit = s.claim; });
      if (hit) opts.onClaim(hit);
    }
  });
  function select(x) {
    if (selected && selected.path) selected.path.classList.remove("sel");
    selected = x;
    if (x && x.path) x.path.classList.add("sel");
    renderSide();
  }
  svg.addEventListener("click", function () { select(null); });

  var acount = bar.querySelector(".amech-acount");
  function apply() {
    if (acount) acount.textContent = "not in the text · " + M.appraisalClaims + (layers.appraisal ? " shown" : " hidden");
    banner.hidden = !layers.appraisal;
    // A selection that the switch has just taken off the page goes with it.
    if (selected && selected.edge && selected.edge.layer !== "text" && !layers[selected.edge.layer]) selected = null;
    if (selected && selected.state && obj(M.states[selected.state]).appraisal && !layers.appraisal) selected = null;
    drawEdges(); drawNodes(); renderSide();
    if (opts.onLayers) opts.onLayers({ rival: layers.rival, appraisal: layers.appraisal });
  }
  Array.prototype.forEach.call(bar.querySelectorAll("input[data-layer]"), function (inp) {
    inp.addEventListener("change", function () { layers[inp.getAttribute("data-layer")] = inp.checked; apply(); });
  });
  apply();

  return {
    model: M, geometry: G,
    setLayer: function (name, on) {
      layers[name] = !!on;
      var inp = /** @type {HTMLInputElement|null} */ (bar.querySelector('input[data-layer="' + name + '"]'));
      if (inp) inp.checked = !!on;
      apply();
    },
    getLayers: function () { return { rival: layers.rival, appraisal: layers.appraisal }; },
    destroy: function () { container.innerHTML = ""; container.classList.remove("amech"); }
  };
}

var API = { model: model, layout: layout, create: create, TIERS: TIERS, BASES: BASES };
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (global) /** @type {any} */ (global).ArgdownMechanism = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
