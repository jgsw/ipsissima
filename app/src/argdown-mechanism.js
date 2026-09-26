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
  // A CONCLUSION INSIDE A PREMISE-CONCLUSION STRUCTURE IS ARGUED FOR: its premises infer it. An
  // intermediary conclusion is never a drawn node, so no drawn edge reaches it, and the J-PAL
  // sample's "Giving away yields more social benefit" read as asserted here and argued in the
  // checker, whose edges come from the structure itself (26 Sep 2026). Keyed by title for that
  // reason; the appraisal's own arguments are excepted, as its edges are above.
  var concluded = {};
  (graph.nodes || []).forEach(function (n) {
    if ((n.tags || []).indexOf("appraisal") >= 0) return;
    var seen = false;
    (n.pcs || []).forEach(function (l) {
      if (l.role === "premise") { seen = true; return; }
      if (seen && l.title) concluded[l.title] = true;
    });
  });

  var steps = [], appraisalClaims = 0;
  (m.claims || []).forEach(function (c) {
    var tags = c.tags || [];
    var layer = tags.indexOf("appraisal") >= 0 ? "appraisal"
              : tags.indexOf("reported") >= 0 ? "rival" : "text";
    if (layer === "appraisal") appraisalClaims++;
    var supports = (c.id != null ? (supportsOf[c.id] || 0) : 0) + (concluded[c.title] ? 1 : 0);
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

// COL leaves 132px between columns. At 82px (the first build) an arrow between neighbouring
// columns in different lanes was nearly vertical, its arrowhead still pointing sideways, and every
// chip on it sat beside some other arrow's head (J-PAL sample, 26 Sep 2026).
// LANE HEADS ARE A STRIP ABOVE THE BOXES, not a column beside them: the actors' names ran under
// the first column's boxes whenever they were longer than the gutter.
var BW = 168, BH = 56, COL = 300, GUT = 40, ROW = 80, PADY = 16, TOP = 34, HEAD = 26, STUB = 12;

/** A point at `t` along a cubic. */
function bez(p0, p1, p2, p3, t) { var u = 1 - t; return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3; }
function overlap(a, b) {
  var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
/** THE WORDS ON A CHIP. "+" and "-" say support and attack everywhere else on this page; here a
 *  sign is a direction of effect, as in a causal loop diagram. Words say which without a key. */
function signWord(signs) {
  if (!signs.length) return "link";
  if (signs.length > 1) return "mixed";
  return signs[0] === "+" ? "raises" : signs[0] === "-" ? "lowers" : signs[0] === "0" ? "no effect" : signs[0];
}

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
    var rows = 0;
    ids.forEach(function (v) { if (levelOf(v) === lv) rows = Math.max(rows, slots[lv + "|" + rank[v]].length); });
    // A level nothing in the text reaches is a thin strip that says so, not an empty band.
    var h = rows ? HEAD + rows * ROW + PADY : HEAD + 4;
    lanes.push({ level: lv, y: y, h: h, empty: !rows,
                 actors: Object.keys(M.actors).filter(function (a) { return obj(M.actors[a]).level === lv; })
                           .map(function (a) { return obj(M.actors[a]).label || a; }) });
    y += h;
  });
  var nodes = {}, maxRank = 0;
  ids.forEach(function (v) {
    var li = M.levels.indexOf(levelOf(v)), k = levelOf(v) + "|" + rank[v];
    nodes[v] = { x: GUT + rank[v] * COL, y: lanes[li].y + HEAD + PADY / 2 + slots[k].indexOf(v) * ROW, w: BW, h: BH };
    maxRank = Math.max(maxRank, rank[v]);
  });

  // One drawn edge per (from, to, layer): the claims behind it are listed on the chip.
  var groups = {}, order = [];
  // One drawn edge per (from, to, layer, kind): a null finding and a selection link are never
  // folded into the causal arrow beside them, or the drawing would say the opposite of the text.
  var kindOf = function (s) { return s.isNull ? "null" : s.selects ? "selection" : "step"; };
  // AND BY SIGN. One arrow labelled "mixed" hid the FAST trial's story: the authors hold that
  // exercise lowers falls, and report an earlier trial where it raised them (26 Sep 2026). Two
  // findings with opposite signs are two arrows, as the checker already counts them.
  M.steps.forEach(function (s) {
    var k = s.from + "\u0000" + s.to + "\u0000" + s.layer + "\u0000" + kindOf(s) + "\u0000" + (kindOf(s) === "step" ? s.sign : "");
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(s);
  });
  // PORTS. Every arrow leaving a state used to leave from the middle of its right side, and the
  // J-PAL intervention, with a dozen steps out of it, sent them all from one point: a knot no one
  // could follow. Now each arrow has its own point on the side, in the order of where it is going,
  // so arrows leave and arrive already sorted and cross as little as the layout allows.
  var isBackKey = {};
  order.forEach(function (k) { isBackKey[k] = groups[k].some(function (s) { return back[s.id]; }); });
  var outs = {}, ins = {};
  order.forEach(function (k) {
    if (isBackKey[k]) return;
    var s0 = groups[k][0];
    (outs[s0.from] = outs[s0.from] || []).push(k);
    (ins[s0.to] = ins[s0.to] || []).push(k);
  });
  var cyOf = function (v) { return nodes[v].y + BH / 2; };
  var portY = {}, portIn = {}, portSide = {}, portX = {};
  // AN ARROW TO A STATE WELL BELOW OR ABOVE LEAVES FROM THE BOX'S BOTTOM OR TOP. Seven arrows
  // leaving the FAST intervention's right side and dropping into the lane below ran as one tight
  // bundle, their chips unattributable. From the bottom they fan like a tree: the arrow going
  // furthest leaves from furthest left, so none crosses another.
  Object.keys(outs).forEach(function (v) {
    var n = nodes[v], below = [], above = [], side = [];
    // Only where the way down (or up) is clear: a box stacked above or below it in its own column
    // would have the arrows run straight through it.
    var blocked = function (toward) {
      return Object.keys(nodes).some(function (w) {
        var m = nodes[w];
        return w !== v && m.x === n.x && (toward > 0 ? m.y > n.y && m.y < n.y + toward + BH
                                                     : m.y < n.y && m.y > n.y + toward - BH);
      });
    };
    outs[v].forEach(function (k) {
      var t = groups[k][0].to, dy = cyOf(t) - cyOf(v);
      if (dy > BH + 12 && nodes[t].x > n.x && !blocked(dy)) below.push(k);
      else if (dy < -(BH + 12) && nodes[t].x > n.x && !blocked(dy)) above.push(k);
      else side.push(k);
    });
    var fan = function (list, where) {
      list.sort(function (p, q) {
        var a = cyOf(groups[p][0].to), b = cyOf(groups[q][0].to);
        return (where === "bottom" ? b - a : a - b) || (p < q ? -1 : p > q ? 1 : 0);
      });
      list.forEach(function (k, i) { portSide[k] = where; portX[k] = n.x + 14 + (BW - 28) * (i + 0.5) / list.length; });
    };
    fan(below, "bottom"); fan(above, "top");
    outs[v] = side;
  });
  var spread = function (list, key, other, into) {
    list.sort(function (p, q) {
      var a = groups[p][0], b = groups[q][0];
      return cyOf(a[other]) - cyOf(b[other]) || nodes[a[other]].x - nodes[b[other]].x || (p < q ? -1 : p > q ? 1 : 0);
    });
    list.forEach(function (k, i) { into[k] = nodes[groups[k][0][key]].y + 8 + (BH - 16) * (i + 0.5) / list.length; });
  };
  Object.keys(outs).forEach(function (v) { spread(outs[v], "from", "to", portY); });
  Object.keys(ins).forEach(function (v) { spread(ins[v], "to", "from", portIn); });

  var edges = order.map(function (k) {
    var ss = groups[k], s0 = ss[0], a = nodes[s0.from], b = nodes[s0.to];
    var isBack = isBackKey[k];
    var kind = kindOf(s0);
    var off = s0.layer === "rival" ? 10 : s0.layer === "appraisal" ? -10 : kind === "null" ? 20 : kind === "selection" ? -20 : 0;
    var tier = kind !== "step" && s0.layer !== "appraisal" ? kind
             : s0.layer !== "text" ? s0.layer
             : ss.map(function (s) { return s.tier; })
                 .sort(function (p, q) { return TIERS.indexOf(p) - TIERS.indexOf(q); })[0];
    // THE ARROWHEAD RIDES A SHORT SOLID STUB at the end of the path. On a dashed line the head sat
    // wherever the dash pattern happened to end -- often after a gap, floating off its line.
    var d, stub, P;
    if (isBack) {
      var x1 = a.x + BW / 2 + off, y1 = a.y + BH, x2 = b.x + BW / 2 + off, y2 = b.y + BH;
      var dip = Math.max(y1, y2) + 46 + Math.abs(off) * 2;
      P = [[x1, y1], [x1, dip], [x2, dip], [x2, y2 + STUB + 2]];
      stub = "M" + x2 + "," + (y2 + STUB + 2) + " L" + x2 + "," + (y2 + 2);
    } else {
      var X2 = b.x - 2, Y2 = portIn[k], XE = X2 - STUB;
      if (portSide[k]) {
        var BX = portX[k], BY = portSide[k] === "bottom" ? a.y + BH : a.y;
        var c2 = Math.max(30, (XE - BX) / 2);
        P = [[BX, BY], [BX, BY + (Y2 - BY) * 0.75], [XE - c2, Y2], [XE, Y2]];
      } else {
        var X1 = a.x + BW, Y1 = portY[k], c = Math.max(40, (XE - X1) / 2);
        P = [[X1, Y1], [X1 + c, Y1], [XE - c, Y2], [XE, Y2]];
      }
      stub = "M" + XE + "," + Y2 + " L" + X2 + "," + Y2;
    }
    d = "M" + P[0][0] + "," + P[0][1] + " C" + P[1][0] + "," + P[1][1] + " " + P[2][0] + "," + P[2][1] + " " + P[3][0] + "," + P[3][1];
    // A null finding has no head, so no stub: its line runs all the way in.
    if (kind === "null") { d += " L" + (isBack ? P[3][0] + "," + (P[3][1] - STUB) : (P[3][0] + STUB) + "," + P[3][1]); stub = null; }
    var signs = [];
    ss.forEach(function (s) { if (s.sign && signs.indexOf(s.sign) < 0) signs.push(s.sign); });
    var given = ss.some(function (s) { return s.given.length > 0; });
    var label = kind === "null" ? "no effect" + (ss.length > 1 ? " ×" + ss.length : "")
              : kind === "selection" ? "selection" :
                signWord(signs) + (ss.length > 1 ? " ×" + ss.length : "") +
                (given ? " ◇" : "") + (isBack ? " ↻" : "");
    return { key: k, from: s0.from, to: s0.to, layer: s0.layer, kind: kind, tier: tier, back: isBack,
             steps: ss, path: d, stub: stub, curve: P,
             chip: { x: 0, y: 0, w: label.length * 6.6 + 14, h: 18, label: label } };
  });
  placeChips(edges, nodes, lanes);
  return { width: GUT + maxRank * COL + BW + 40, height: y + 70, lanes: lanes, nodes: nodes,
           edges: edges, box: { w: BW, h: BH } };
}

/** WHERE EACH CHIP GOES. The first build put every chip at a fixed point along its arrow, and on
 *  the J-PAL sample chips sat under other arrows' heads, on top of each other where arrows
 *  converge, and over boxes. Now each is tried at a run of points along its own curve and takes the
 *  first clear of every box, every arrowhead and every chip already placed -- the text's
 *  best-backed steps first, so they get the clearest places -- or the least crowded if none is
 *  clear. Deterministic: the same chain places its chips the same way. */
var CHIP_T = [0.5, 0.4, 0.6, 0.3, 0.7, 0.45, 0.55, 0.22, 0.78, 0.35, 0.65, 0.15, 0.85, 0.1, 0.9];
var CHIP_DY = [0, -13, 13, -24, 24, -36, 36];
function placeChips(edges, nodes, lanes) {
  var fixed = [];
  (lanes || []).forEach(function (ln) { fixed.push({ x: 0, y: ln.y, w: 100000, h: HEAD - 2 }); });
  Object.keys(nodes).forEach(function (v) { var n = nodes[v]; fixed.push({ x: n.x - 6, y: n.y - 6, w: n.w + 12, h: n.h + 12 }); });
  edges.forEach(function (e) {
    if (!e.stub) return;
    var P = e.curve, x = P[3][0], y = P[3][1];
    fixed.push(e.back ? { x: x - 9, y: y - STUB - 12, w: 18, h: STUB + 14 } : { x: x - 4, y: y - 9, w: STUB + 12, h: 18 });
  });
  var rankOf = function (e) {
    return (e.layer === "text" ? 0 : e.layer === "rival" ? 10 : 20) +
           (e.kind === "step" ? TIERS.indexOf(e.tier) : 5);
  };
  var order = edges.map(function (e, i) { return i; })
                   .sort(function (i, j) { return rankOf(edges[i]) - rankOf(edges[j]) || i - j; });
  var placed = [];
  order.forEach(function (i) {
    var e = edges[i], P = e.curve, best = null, bestCost = Infinity;
    // On the line first, at every point tried; only then a step above or below it, which still
    // reads as the arrow's own label where the line is crowded.
    for (var k = 0; k < CHIP_T.length * CHIP_DY.length; k++) {
      var t = CHIP_T[k % CHIP_T.length], dy = CHIP_DY[Math.floor(k / CHIP_T.length)];
      var cx = bez(P[0][0], P[1][0], P[2][0], P[3][0], t), cy = bez(P[0][1], P[1][1], P[2][1], P[3][1], t) + dy;
      var box = { x: cx - e.chip.w / 2, y: cy - e.chip.h / 2, w: e.chip.w, h: e.chip.h };
      var cost = 0;
      fixed.forEach(function (f) { cost += overlap(box, f); });
      placed.forEach(function (f) { cost += 2 * overlap(box, { x: f.x - 3, y: f.y - 3, w: f.w + 6, h: f.h + 6 }); });
      if (cost < bestCost) { best = { x: cx, y: cy, box: box }; bestCost = cost; }
      if (!cost) break;
    }
    e.chip.x = Math.round(best.x * 10) / 10; e.chip.y = Math.round(best.y * 10) / 10;
    placed.push(best.box);
  });
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
    ".amech .lane-l{font-size:12px;font-weight:600;fill:var(--fg-dim,#666);paint-order:stroke;stroke:var(--bg,#fff);stroke-width:5px;stroke-linejoin:round}",
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
    ".amech .dim{opacity:.1}.amech .faint{opacity:.35}",
    ".amech-legend{display:grid;gap:3px;margin:0 0 8px}.amech-legend div{display:flex;align-items:center;gap:8px}",
    ".amech-tog select{font:inherit;font-size:12.5px;border:0;background:none;color:inherit}",
    ".amech-tog.fit{font:inherit;font-size:13px;color:inherit}",
    ".amech-focus{margin:0 0 8px;padding:6px 9px;border-radius:6px;border:1px solid var(--mv-sel);font-size:12.5px}",
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
  // WHAT IS SHOWN. "tested" keeps only the steps the text backs with a study, statistics or a
  // model -- nulls included, since a null is a finding -- so the evidence can be read on its own.
  var show = "all", fit = false;
  var anyUntested = G.edges.some(function (e) { return !e.steps.some(function (x) { return x.tier === "evidence"; }); });

  var bar = document.createElement("div"); bar.className = "amech-bar";
  bar.innerHTML =
    '<div class="amech-q">' + esc(M.question) + '</div>' +
    (M.profile.rival_steps ? '<label class="amech-tog rival"><input type="checkbox" data-layer="rival" checked>' +
      '<span class="sw"></span><span>Rival views</span><span class="aside">as the text reports them</span></label>' : '') +
    (M.appraisalClaims ? '<label class="amech-tog appr"><input type="checkbox" data-layer="appraisal">' +
      '<span class="sw"></span><span>Reconstructor’s appraisal</span><span class="aside amech-acount"></span></label>' : '') +
    (anyUntested ? '<label class="amech-tog">Show <select data-show><option value="all">every step</option>' +
      '<option value="tested">only what the text tested</option></select></label>' : '') +
    '<button type="button" class="amech-tog fit" data-fit>Fit to width</button>';
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
  });
  // THREE LAYERS, and the chips on top. Each arrow carries a 14px invisible hit stroke so it can
  // be clicked at all, and where arrows run close -- a rival view beside the text's own step --
  // one arrow's stroke lay over the other's chip: driving the page with real clicks, the "x7"
  // chip of the text's busiest step opened the RIVAL arrow instead. The chip is the unambiguous
  // target, so every chip is drawn above every stroke. The lanes' headings sit between the two,
  // on a halo, so an arrow crossing a heading never runs through its words.
  var gE = el("g", {}, svg), gH = el("g", {}, svg), gC = el("g", {}, svg), gN = el("g", {}, svg);
  G.lanes.forEach(function (ln) {
    var head = el("text", { x: 12, y: ln.y + 17, "class": "lane-l" }, gH);
    head.textContent = ln.level.toUpperCase();
    var who = el("tspan", { "class": "actor-l", dx: 10 }, head);
    who.textContent = ln.empty ? "nothing in the text at this level" : ln.actors.join(" · ");
  });
  el("text", { x: GUT, y: 22, "class": "actor-l" }, svg).textContent = "in sequence, left to right →";

  var drawnEdges = [], drawnNodes = {};
  function visible(e) {
    if (e.layer !== "text" && !layers[e.layer]) return false;
    if (show === "tested" && !e.steps.some(function (x) { return x.tier === "evidence"; })) return false;
    return true;
  }
  function drawEdges() {
    // FILTER AT DRAW TIME, DO NOT HIDE. An appraisal element that is merely display:none is
    // still in the DOM, and "off means off" is a promise about what the page carries.
    while (gE.firstChild) gE.removeChild(gE.firstChild);
    while (gC.firstChild) gC.removeChild(gC.firstChild);
    drawnEdges = [];
    G.edges.forEach(function (e) {
      if (!visible(e)) return;
      var st = TIER_STYLE[e.tier], col = "var(--mv-" + e.tier + ")";
      var g = el("g", { "data-layer": e.layer, "data-edge": e.from + ">" + e.to, "data-kind": e.kind }, gE);
      var p = el("path", { d: e.path, "class": "ed", stroke: col, "stroke-width": st.width,
                           "stroke-dasharray": st.dash }, g);
      if (e.stub) el("path", { d: e.stub, "class": "ed stub", stroke: col, "stroke-width": st.width,
                               "marker-end": "url(#amech-ar-" + e.tier + ")" }, g);
      el("path", { d: e.path, "class": "hit" }, g);
      var chip = el("g", { "class": "chip", style: "color:" + col, "data-layer": e.layer,
                           "data-edge": e.from + ">" + e.to, "data-kind": e.kind }, gC);
      var tw = e.chip.w;
      el("rect", { x: e.chip.x - tw / 2, y: e.chip.y - 9, width: tw, height: 18, rx: 9 }, chip);
      el("text", { x: e.chip.x, y: e.chip.y + 4, "text-anchor": "middle" }, chip).textContent = e.chip.label;
      var title = el("title", {}, g);
      title.textContent = e.steps.length + " claim" + (e.steps.length === 1 ? "" : "s") + " — click to see";
      var pick = function (ev) { ev.stopPropagation(); select({ edge: e, path: p }); };
      g.addEventListener("click", pick);
      chip.addEventListener("click", pick);
      chip.setAttribute("cursor", "pointer");
      drawnEdges.push({ e: e, p: p, g: g, chip: chip });
      if (selected && selected.edge && selected.edge.key === e.key) { p.classList.add("sel"); selected.path = p; }
    });
  }
  function drawNodes() {
    while (gN.firstChild) gN.removeChild(gN.firstChild);
    drawnNodes = {};
    Object.keys(G.nodes).forEach(function (v) {
      var s = obj(M.states[v]), p = G.nodes[v];
      if (s.appraisal && !layers.appraisal) return;
      var cls = "st" + (s.role ? " " + s.role : "") + (s.appraisal ? " appraisal" : "");
      var g = el("g", { "class": cls, "data-layer": s.appraisal ? "appraisal" : "text", "data-state": v,
                        transform: "translate(" + p.x + "," + p.y + ")" }, gN);
      if (s.role === "outcome") el("rect", { "class": "outer", x: -4, y: -4, width: p.w + 8, height: p.h + 8, rx: 9 }, g);
      el("rect", { "class": "box", width: p.w, height: p.h, rx: 7 }, g);
      var lines = wrapWords(s.label || v, 24);
      lines.forEach(function (t, i) {
        el("text", { x: p.w / 2, y: p.h / 2 + (i - (lines.length - 1) / 2) * 14 + 4, "text-anchor": "middle" }, g).textContent = t;
      });
      var tt = el("title", {}, g); tt.textContent = (s.label || v) + " — click to see only the paths through it";
      drawnNodes[v] = g;
      if (s.role === "intervention" && !M.steps.some(function (x) { return x.from === v && x.layer === "text"; }))
        el("text", { x: p.w + 10, y: p.h / 2 + 4, "class": "gapmark" }, g).textContent = "✕ no link in the text";
      g.addEventListener("click", function (ev) { ev.stopPropagation(); select({ state: v }); });
    });
  }

  /** FOCUS, the arrangement's folding. A busy chain is read a state at a time: choosing one fades
   *  everything that is not on a path through it -- what leads to it and what it leads to -- and
   *  choosing an arrow fades all but that step. Nothing is re-laid out, so the reader's bearings
   *  hold when they go back to the whole. */
  function focusSets() {
    var vis = drawnEdges.map(function (d) { return d.e; });
    if (!selected) return null;
    if (selected.edge) {
      var k = {}; k[selected.edge.from] = k[selected.edge.to] = true;
      return { nodes: k, edge: function (e) { return e.key === selected.edge.key; } };
    }
    var v = selected.state, up = {}, down = {};
    var walk = function (seed, dir, into) {
      var stack = [seed];
      while (stack.length) {
        var x = stack.pop();
        vis.forEach(function (e) {
          var from = dir > 0 ? e.from : e.to, to = dir > 0 ? e.to : e.from;
          if (from === x && !into[to] && to !== v) { into[to] = true; stack.push(to); }
        });
      }
    };
    walk(v, 1, down); walk(v, -1, up);
    var nodes = {}; nodes[v] = true;
    Object.keys(up).forEach(function (x) { nodes[x] = true; });
    Object.keys(down).forEach(function (x) { nodes[x] = true; });
    return { nodes: nodes, edge: function (e) {
      return (up[e.from] && (up[e.to] || e.to === v)) || ((e.from === v || down[e.from]) && down[e.to]);
    } };
  }
  function applyFocus() {
    var f = focusSets(), lit = {};
    drawnEdges.forEach(function (d) {
      var on = !f || f.edge(d.e);
      d.g.classList.toggle("dim", !on); d.chip.classList.toggle("dim", !on);
      if (on) { lit[d.e.from] = lit[d.e.to] = true; }
    });
    Object.keys(drawnNodes).forEach(function (v) {
      var g = drawnNodes[v];
      g.classList.toggle("dim", !!f && !f.nodes[v]);
      // With some steps hidden, a state no shown step touches is faded rather than left looking
      // like a gap in the text.
      g.classList.toggle("faint", !f && show !== "all" && !lit[v]);
    });
  }

  function claimHTML(s) {
    var c = s.claim, how = "";
    if (s.how) {
      how = '<div class="amech-how"><b>How</b> ' + ["actor", "situation", "habit", "response"].filter(function (k) { return s.how[k]; })
        .map(function (k) { var v = k === "actor" ? (obj(M.actors[s.how[k]]).label || s.how[k]) : s.how[k];
          return '<div><span class="k">' + k + '</span> ' + esc(v) + '</div>'; }).join("") + '</div>';
    }
    var meta = ['<span class="amech-pill">' + esc(s.isNull ? "no effect" : s.selects ? "selection" : signWord(s.sign ? [s.sign] : [])) + '</span>',
                '<span class="amech-pill">' + esc(c.fidelity || "compression") + '</span>',
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
  /** THE KEY, DRAWN. Line weight and dash carry what the text offers for each step, and a
   *  paragraph describing them asked the reader to translate; a sample of each line, beside its
   *  meaning, does not. Only the kinds this chain uses are listed. */
  function legendHTML() {
    var used = {};
    G.edges.forEach(function (e) { used[e.tier] = true; });
    var rows = [["evidence", "tested: a study, statistics or a model"], ["argued", "argued for in the text"],
                ["asserted", "asserted only"], ["imputed", "supplied by the reconstructor"],
                ["rival", "a rival view the text reports"], ["null", "no effect found"],
                ["selection", "selection, not an effect"], ["appraisal", "the reconstructor’s appraisal"]];
    return '<div class="amech-legend">' + rows.filter(function (r) { return used[r[0]]; }).map(function (r) {
      var st = TIER_STYLE[r[0]];
      return '<div><svg width="46" height="12" aria-hidden="true"><line x1="2" y1="6" x2="44" y2="6" stroke="var(--mv-' + r[0] +
        ')" stroke-width="' + st.width + '" stroke-dasharray="' + st.dash + '"/></svg><span>' + esc(r[1]) + '</span></div>';
    }).join("") + '</div>';
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
      '<h3>Key</h3>' + legendHTML() + '<div class="amech-q">An arrow says the text holds that one state brings about a change in another: ' +
      '“raises” (more of the first, more of the second) or “lowers” (more of the first, less of the second). ' +
      'These are effects, not the support and attack of the Reasons map. ' +
      '×n: claims behind one arrow. ◇: conditions stated. ↻: closes a loop. ' +
      'Click a state to see only the paths through it.</div>' +
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
        '<div class="amech-focus">Showing only the paths through this state: what leads to it, and what it leads to.</div>' +
        '<div class="amech-row"><span class="k">actor</span><span>' + esc(a.label || s.actor || "") + (a.level ? ' (' + esc(a.level) + ')' : '') + '</span></div>' +
        (s.role ? '<div class="amech-row"><span class="k">role</span><span>' + esc(s.role) + '</span></div>' : '') +
        (s.measured ? '<div class="amech-row"><span class="k">measured</span><span>' + esc(s.measured) + '</span></div>' : '') +
        (s.appraisal ? '<div class="amech-row"><span class="k">layer</span><span>the reconstructor’s appraisal: not in the text</span></div>' : '') +
        '<h3>&nbsp;</h3><button type="button" data-back="1">Show the whole chain</button>';
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
    applyFocus();
  }
  svg.addEventListener("click", function () { select(null); });

  var acount = bar.querySelector(".amech-acount");
  function apply() {
    if (acount) acount.textContent = "not in the text · " + M.appraisalClaims + (layers.appraisal ? " shown" : " hidden");
    banner.hidden = !layers.appraisal;
    // A selection that the switch has just taken off the page goes with it.
    if (selected && selected.edge && selected.edge.layer !== "text" && !layers[selected.edge.layer]) selected = null;
    if (selected && selected.state && obj(M.states[selected.state]).appraisal && !layers.appraisal) selected = null;
    if (selected && selected.edge && !visible(selected.edge)) selected = null;
    drawEdges(); drawNodes(); renderSide(); applyFocus();
    if (opts.onLayers) opts.onLayers({ rival: layers.rival, appraisal: layers.appraisal });
  }
  Array.prototype.forEach.call(bar.querySelectorAll("input[data-layer]"), function (inp) {
    inp.addEventListener("change", function () { layers[inp.getAttribute("data-layer")] = inp.checked; apply(); });
  });
  var showSel = /** @type {HTMLSelectElement|null} */ (bar.querySelector("select[data-show]"));
  if (showSel) showSel.addEventListener("change", function () { show = showSel.value; apply(); });
  var fitBtn = /** @type {HTMLElement} */ (bar.querySelector("[data-fit]"));
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  fitBtn.addEventListener("click", function () {
    fit = !fit;
    // Style over the attributes: the drawing's own size stays what the layout says.
    var sv = /** @type {SVGElement} */ (svg);
    sv.style.width = fit ? "100%" : ""; sv.style.height = fit ? "auto" : "";
    fitBtn.textContent = fit ? "Actual size" : "Fit to width";
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
    setShow: function (v) { show = v === "tested" ? "tested" : "all"; if (showSel) showSel.value = show; apply(); },
    destroy: function () { container.innerHTML = ""; container.classList.remove("amech"); }
  };
}

var API = { model: model, layout: layout, create: create, TIERS: TIERS, BASES: BASES };
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (global) /** @type {any} */ (global).ArgdownMechanism = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
