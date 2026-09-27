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
/** THE FIDELITY LADDER, closest first, with the Reasons map's own border patterns. "Fidelity is
 *  pattern; relation is colour" (brand/README.md, F5): an arrow here is drawn in the pattern of the
 *  claims behind it, exactly as a box there is, so solidity means closeness to the words in this
 *  arrangement too. The first build spent pattern on what the text offers for a step instead. */
var FIDELITY = ["quotation", "paraphrase", "compression", "interpretation", "imputation"];
var FIDELITY_DASH = { quotation: "", paraphrase: "6 2", compression: "4 3", interpretation: "2 3",
                      imputation: "7 2 1.5 2" };
/** WHAT THE TEXT OFFERS, as weight: Gross's light and shadow. */
var TIER_WIDTH = { evidence: 3.2, argued: 2, asserted: 1.2, imputed: 1.2 };

function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
/** The roles a state declares -- `role` may be one name or a list (profile 1.1): Merton's
 *  prejudice is both what his remedy is for and where his circle begins. As mechanism.py. */
function rolesOf(state) {
  var r = obj(state).role;
  if (r == null) return [];
  return (Array.isArray(r) ? r : [r]).map(String);
}
function hasRole(state, name) { return rolesOf(state).indexOf(name) >= 0; }
/** Where a chain may start: what the text recommends, or a condition it sets out from. */
function isStart(state) { return hasRole(state, "intervention") || hasRole(state, "condition"); }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function asList(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]).map(String); }

/** The levels a state is drawn across: its own `levels:` (profile 1.4) where it declares them,
 *  otherwise its actor's level -- mechanism.py's levels_of. */
function levelsOf(state, actors, levels) {
  var own = {};
  asList(obj(state).levels).forEach(function (lv) { if (levels.indexOf(lv) >= 0) own[lv] = true; });
  var list = levels.filter(function (lv) { return own[lv]; });
  if (list.length) return list;
  var lv = obj(actors[obj(state).actor]).level;
  return lv ? [lv] : [];
}

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
        sign: sign, basis: raw.basis || null, tier: tier, fidelity: FIDELITY.indexOf(c.fidelity) >= 0 ? c.fidelity : "compression",
        // A NULL FINDING (sign 0) and a SELECTION LINK are reported, never walked: see mechanism.py.
        isNull: sign === "0", selects: !!raw.selects, hedged: !!raw.hedged,
        lag: raw.lag == null ? "" : String(raw.lag), given: given.map(String),
        how: raw.how && typeof raw.how === "object" ? raw.how : null,
        reflexive: !!raw.reflexive, supports: supports,
        // JOINTLY (profile 1.4): the states together with which alone the step holds.
        jointly: asList(raw.jointly),
        // CHAIN (profile 1.5): which of the text's chains the step belongs to.
        chain: asList(raw.chain)
      });
    });
  });
  var ok = steps.filter(function (s) { return has(states, s.from) && has(states, s.to); });
  var chains = chainsOf(block), kinds = kindsOf(block);
  return { levels: levels, actors: actors, states: states, ids: ids, steps: ok,
           dropped: steps.length - ok.length, appraisalClaims: appraisalClaims,
           question: block.question == null ? "" : String(block.question), chains: chains, kinds: kinds,
           profile: profile(levels, actors, states, ids, ok,
                            m.appraisal != null ? m.appraisal : appraisalClaims, chains, kinds) };
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
/** Successors of each state in DECLARED ORDER, as mechanism.py's `_adjacency`: past a cap, which
 *  routes and loops are found depends on the order they are walked, and checker and page must walk
 *  the same way to agree. */
function adjacency(edges, ids) {
  var rank = {}; ids.forEach(function (v, i) { rank[v] = i; });
  var key = function (v) { return has(rank, v) ? rank[v] : ids.length; };
  var adj = {};
  edges.forEach(function (e) { var l = adj[e[0]] = adj[e[0]] || []; if (l.indexOf(e[1]) < 0) l.push(e[1]); });
  Object.keys(adj).forEach(function (a) {
    adj[a].sort(function (p, q) { return key(p) - key(q) || (p < q ? -1 : p > q ? 1 : 0); });
  });
  return adj;
}

/** The feedback systems (Tarjan): states each reachable from every other, two or more. */
function systems(ids, edges) {
  var adj = adjacency(edges, ids), index = {}, low = {}, on = {}, stack = [], out = [], n = 0;
  var pos = function (v) { return ids.indexOf(v); };
  function strong(v) {
    index[v] = low[v] = n++; stack.push(v); on[v] = true;
    (adj[v] || []).forEach(function (w) {
      if (!has(index, w)) { strong(w); low[v] = Math.min(low[v], low[w]); }
      else if (on[w]) low[v] = Math.min(low[v], index[w]);
    });
    if (low[v] === index[v]) {
      var comp = [], w;
      do { w = stack.pop(); on[w] = false; comp.push(w); } while (w !== v);
      if (comp.length > 1) out.push(comp.sort(function (a, b) { return pos(a) - pos(b); }));
    }
  }
  ids.forEach(function (v) { if (!has(index, v)) strong(v); });
  return out.sort(function (a, b) { return pos(a[0]) - pos(b[0]); });
}

/** The k shortest loops through a system, by breadth-first search from each of its states. */
function shortestLoops(comp, edges, ids, k) {
  var inC = {}; comp.forEach(function (v) { inC[v] = true; });
  var rank = {}; ids.forEach(function (v, i) { rank[v] = i; });
  var adj = adjacency(edges.filter(function (e) { return inC[e[0]] && inC[e[1]]; }), ids);
  var found = {}, list = [];
  comp.forEach(function (v) {
    var prev = {}; prev[v] = null;
    var q = [v], hit = null;
    while (q.length && hit === null) {
      var nq = [];
      for (var i = 0; i < q.length && hit === null; i++) {
        var x = q[i], succ = adj[x] || [];
        for (var j = 0; j < succ.length; j++) {
          var w = succ[j];
          if (w === v) { hit = x; break; }
          if (!has(prev, w)) { prev[w] = x; nq.push(w); }
        }
      }
      q = nq;
    }
    if (hit === null) return;
    var path = [], x2 = hit;
    while (x2 !== null) { path.push(x2); x2 = prev[x2]; }
    path.reverse();
    var at = 0; path.forEach(function (s2, i2) { if (rank[s2] < rank[path[at]]) at = i2; });
    var loop = path.slice(at).concat(path.slice(0, at)), key = loop.join("\u0000");
    if (!found[key]) { found[key] = true; list.push(loop); }
  });
  return list.sort(function (a, b) {
    if (a.length !== b.length) return a.length - b.length;
    for (var i = 0; i < a.length; i++) if (rank[a[i]] !== rank[b[i]]) return rank[a[i]] - rank[b[i]];
    return 0;
  }).slice(0, k);
}

function loops(ids, edges) {
  var order = {}; ids.forEach(function (v, i) { order[v] = i; });
  var adj = adjacency(edges, ids);
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

function routes(start, goal, edges, ids) {
  var adj = adjacency(edges, ids);
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

/** The chains a block declares (profile 1.5), in declared order -- mechanism.py's _chains. */
function chainsOf(block) {
  var raw = obj(block.chains), out = [];
  Object.keys(raw).forEach(function (id) {
    var c = obj(raw[id]);
    out.push({ id: String(id), label: c.label == null ? null : String(c.label),
               question: c.question == null ? null : String(c.question), roles: obj(c.roles) });
  });
  return out;
}

/** The kinds a block declares (profile 1.6), in declared order -- mechanism.py's _kinds, less the
 *  states, which `profile` counts from whatever states it is given. */
function kindsOf(block) {
  var raw = obj(block.kinds);
  return Object.keys(raw).map(function (id) {
    var k = obj(raw[id]);
    return { id: String(id), label: k.label == null ? null : String(k.label),
             general: k.general == null ? null : String(k.general) };
  });
}

/** Each state's kind, where it names a declared one. */
function kindMap(kinds, states, ids) {
  var known = {}, out = {};
  (kinds || []).forEach(function (k) { known[k.id] = true; });
  ids.forEach(function (i) { var k = obj(states[i]).kind; if (k != null && known[String(k)]) out[i] = String(k); });
  return out;
}

/** THE SAME STEP IN TWO CASES -- mechanism.py's _akin_steps: two steps whose ends are each the
 *  same state or states of one kind, and which are not one step. Nothing is walked between them. */
function akinSteps(edges, kindOf, general, chainsOf) {
  var alike = function (x, y) { return x === y || (kindOf[x] != null && kindOf[x] === kindOf[y]); };
  // A GENERAL STEP AND ITS CASE (profile 1.7) -- mechanism.py's `over`.
  general = general || {};
  // TWO CASES ARE TWO CHAINS -- mechanism.py's one_case.
  chainsOf = chainsOf || {};
  var oneCase = function (e, f) { var a = chainsOf[e[0] + "\u0000" + e[1]] || [], b = chainsOf[f[0] + "\u0000" + f[1]] || [];
    return a.some(function (c) { return b.indexOf(c) >= 0; }); };
  var over = function (e, f) { return [0, 1].every(function (p) { return e[p] === f[p] || general[kindOf[f[p]]] === e[p]; }); };
  var seen = {}, es = [];
  edges.forEach(function (e) { var k = e[0] + "\u0000" + e[1]; if (!seen[k]) { seen[k] = true; es.push(e); } });
  es.sort(function (p, q) { return p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : p[1] < q[1] ? -1 : p[1] > q[1] ? 1 : 0; });
  var akin = [], instances = [];
  for (var i = 0; i < es.length; i++)
    for (var j = i + 1; j < es.length; j++) {
      if (!(alike(es[i][0], es[j][0]) && alike(es[i][1], es[j][1]))) continue;
      if (over(es[i], es[j])) instances.push([es[i], es[j]]);
      else if (over(es[j], es[i])) instances.push([es[j], es[i]]);
      else if (!oneCase(es[i], es[j])) akin.push([es[i], es[j]]);
    }
  var key = function (pr) { return [pr[0][0], pr[0][1], pr[1][0], pr[1][1]]; };
  instances.sort(function (p, q) { var a = key(p), b = key(q);
    for (var k = 0; k < 4; k++) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1; return 0; });
  return { akin: akin, instances: instances };
}

/** Where a chain starts, what it reaches, its gaps and its routes -- mechanism.py's _walk, run
 *  on the whole text's chain and, since profile 1.5, on each of its chains. */
function walkChain(ids, states, edges) {
  var interventions = ids.filter(function (i) { return hasRole(states[i], "intervention"); });
  var conditions = ids.filter(function (i) { return hasRole(states[i], "condition"); });
  var outcomes = ids.filter(function (i) { return hasRole(states[i], "outcome"); });
  var from = {}, to = {};
  edges.forEach(function (e) { from[e[0]] = true; to[e[1]] = true; });
  var entrySet = {};
  interventions.concat(conditions).forEach(function (i) { if (from[i]) entrySet[i] = true; });
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
  conditions.forEach(function (c) {
    if (!from[c]) gaps.push({ kind: "unlinked-condition", state: c,
      message: "the condition `" + c + "` has no step in the text: nothing says what it " +
               "brings about" });
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
  // As the checker: a chain with no stated cause, or nothing it is for, says so.
  if (!interventions.length && !conditions.length)
    gaps.push({ kind: "no-intervention", state: null,
                message: "no state has `role: intervention` or `role: condition`, so the chain has " +
                         "no stated cause to run from" });
  if (!outcomes.length)
    gaps.push({ kind: "no-outcome", state: null,
                message: "no state has `role: outcome`, so nothing says what the chain is for" });
  var rs = [];
  entries.forEach(function (e) { outcomes.forEach(function (o) {
    if (o === e) return;          // both where the circle starts and what it explains
    var r = routes(e, o, edges, ids);
    if (r) rs.push({ start: e, outcome: o, routes: r.routes, shortest: r.shortest, longest: r.longest });
  }); });
  return { entries: entries, gaps: gaps, used: used, outcomes: outcomes, routes: rs };
}

/** A co-cause is a cause: the steps' edges, with each co-cause's edge to the step's `to`. */
function edgesWithCoCauses(steps, states) {
  var edges = uniqEdges(steps);
  var seenEdge = {}; edges.forEach(function (e) { seenEdge[e[0] + "\u0000" + e[1]] = true; });
  steps.forEach(function (s) { (s.jointly || []).forEach(function (j) {
    var k = j + "\u0000" + s.to;
    if (has(states, j) && j !== s.to && !seenEdge[k]) { seenEdge[k] = true; edges.push([j, s.to]); } }); });
  return edges;
}

/** A chain's states, each in the role the chain gives it where it gives one. */
function chainStates(c, states, cids) {
  var out = {};
  cids.forEach(function (i) {
    if (has(c.roles, i)) { var copy = {}; for (var k in obj(states[i])) copy[k] = states[i][k]; copy.role = c.roles[i]; out[i] = copy; }
    else out[i] = states[i];
  });
  return out;
}

/** The states a chain touches: those its steps run through (a co-cause among them), with any
 *  state it gives a role to, in declared order. */
function chainIds(c, states, ids, mine) {
  var touched = {};
  edgesWithCoCauses(mine, states).forEach(function (e) { touched[e[0]] = touched[e[1]] = true; });
  Object.keys(c.roles).forEach(function (k) { if (has(states, k)) touched[k] = true; });
  return ids.filter(function (i) { return touched[i]; });
}

/** Each chain walked on its own steps with its own roles, what it shares, and how many of the
 *  text's steps sit in no chain -- mechanism.py's _chain_profiles. */
function chainProfiles(chains, states, ids, text, isReflexive, kindOf, instances) {
  var out = [], member = {};
  chains.forEach(function (c) {
    var mine = text.filter(function (s) { return s.chain.indexOf(c.id) >= 0; });
    var edges = edgesWithCoCauses(mine, states);
    var cids = chainIds(c, states, ids, mine);
    var cstates = chainStates(c, states, cids);
    var W = walkChain(cids, cstates, edges);
    var best = {}, titles = {};
    mine.forEach(function (s) { best[s.from + "\u0000" + s.to + "\u0000" + s.sign] = true; titles[s.claim.title] = true; });
    var roles = {};
    cids.forEach(function (i) { var r = rolesOf(cstates[i]).slice().sort(); if (r.length) roles[i] = r; });
    out.push({ id: c.id, label: c.label, question: c.question,
               steps: Object.keys(best).length, claims: Object.keys(titles).length, states: cids,
               roles: roles, entries: W.entries, routes: W.routes,
               loops: loops(cids, edges).map(function (l) { return { states: l, reflexive: isReflexive(l, mine) }; }),
               gaps: W.gaps.map(function (g) { return g.message; }), shared: [] });
    cids.forEach(function (i) { (member[i] = member[i] || []).push(c.id); });
  });
  out.forEach(function (cp) {
    cp.shared = cp.states.filter(function (i) { return member[i].length > 1; })
      .map(function (i) { return [i, member[i].filter(function (o) { return o !== cp.id; })]; });
  });
  // AND WHAT IS AKIN (profile 1.6): a state whose kind a different state has in another chain.
  kindOf = kindOf || {};
  out.forEach(function (cp) {
    cp.akin = [];
    cp.states.forEach(function (i) {
      if (kindOf[i] == null) return;
      var there = [];
      out.forEach(function (o) { if (o.id === cp.id) return;
        o.states.forEach(function (j) { if (j !== i && kindOf[j] === kindOf[i]) there.push([o.id, j]); }); });
      if (there.length) cp.akin.push([i, kindOf[i], there]);
    });
  });
  // A CHAIN THAT IS A CASE OF ANOTHER (profile 1.7): how many of its steps are cases of a general
  // step in each other chain.
  var edgesOf = {};
  chains.forEach(function (c) { edgesOf[c.id] = {};
    text.forEach(function (s) { if (s.chain.indexOf(c.id) >= 0) edgesOf[c.id][s.from + "\u0000" + s.to] = true; }); });
  out.forEach(function (cp) {
    cp.case_of = [];
    out.forEach(function (o) {
      if (o.id === cp.id) return;
      var n = {};
      (instances || []).forEach(function (pr) {
        var g = pr[0][0] + "\u0000" + pr[0][1], c = pr[1][0] + "\u0000" + pr[1][1];
        if (edgesOf[cp.id][c] && edgesOf[o.id][g]) n[c] = true; });
      if (Object.keys(n).length) cp.case_of.push([o.id, Object.keys(n).length]);
    });
  });
  var loose = {};
  if (chains.length) text.forEach(function (s) { if (!s.chain.length) loose[s.from + "\u0000" + s.to + "\u0000" + s.sign] = true; });
  return { chains: out, unchained: Object.keys(loose).length };
}

function uniqEdges(steps) {
  var seen = {}, out = [];
  steps.forEach(function (s) { var k = s.from + "\u0000" + s.to;
    if (!seen[k]) { seen[k] = true; out.push([s.from, s.to]); } });
  return out;
}

/** Gross's dimensions and the light and shadow, in the text's own layer -- mechanism.py's
 *  profile, field for field, so the census and the page cannot disagree. */
function profile(levels, actors, states, ids, steps, appraisalClaims, chains, kinds) {
  var causal = steps.filter(function (s) { return !s.isNull && !s.selects; });
  var textAll = steps.filter(function (s) { return s.layer === "text"; });
  var text = causal.filter(function (s) { return s.layer === "text"; });
  // A CO-CAUSE IS A CAUSE, as the checker has it: routes, loops and dead ends run through it.
  var edges = edgesWithCoCauses(text, states);
  var W = walkChain(ids, states, edges);
  var entries = W.entries, used = W.used, gaps = W.gaps;

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
  var loopsText = loops(ids, edges);
  var rs = W.routes;
  var kindOf = kindMap(kinds, states, ids);
  var kindList = (kinds || []).map(function (k) {
    var members = ids.filter(function (i) { return kindOf[i] === k.id; });
    return { id: k.id, label: k.label, states: members,
             general: k.general != null && members.indexOf(k.general) >= 0 ? k.general : null }; });
  var generalOf = {};
  kindList.forEach(function (k) { if (k.general) generalOf[k.id] = k.general; });
  var chainsOfEdge = {};
  text.forEach(function (s) { var k = s.from + "\u0000" + s.to, l = chainsOfEdge[k] = chainsOfEdge[k] || [];
    s.chain.forEach(function (c) { if (l.indexOf(c) < 0) l.push(c); }); });
  var AK = akinSteps(uniqEdges(text), kindOf, generalOf, chainsOfEdge);
  var CP = chainProfiles(chains || [], states, ids, text, isReflexive, kindOf, AK.instances);
  var spanned = {};
  Object.keys(used).forEach(function (i) {
    levelsOf(states[i], actors, levels).forEach(function (lv) { spanned[lv] = true; }); });
  var lags = {}; text.forEach(function (s) { if (s.lag) lags[s.lag] = true; });
  var claimTitles = {}; text.forEach(function (s) { claimTitles[s.claim.title] = true; });
  return {
    levels: levels,
    levels_spanned: levels.filter(function (lv) { return spanned[lv]; }),
    states: ids.length, steps: Object.keys(best).length,
    claims: Object.keys(claimTitles).length,
    lags: Object.keys(lags).sort(), entries: entries, routes: rs,
    loops_text: loopsText.map(function (l) {
      return { states: l, reflexive: isReflexive(l, text) }; }),
    feedback: systems(ids, edges).map(function (comp) {
      var inC = {}; comp.forEach(function (v) { inC[v] = true; });
      var inside = loopsText.filter(function (l) { return l.every(function (v) { return inC[v]; }); });
      return { states: comp, loops: inside.length, capped: loopsText.length >= LOOP_CAP,
               shortest: shortestLoops(comp, edges, ids, 3).map(function (l) {
                 return { states: l, reflexive: isReflexive(l, text) }; }) };
    }),
    wholes: (function () {
      var w = {};
      ids.forEach(function (sid) { var p = obj(states[sid]).part_of;
        if (p != null && has(states, p) && p !== sid) (w[p] = w[p] || []).push(sid); });
      return Object.keys(w).sort().map(function (k) { return [k, w[k].sort()]; });
    })(),
    joint: (function () {
      var seen = {}, out = [];
      text.forEach(function (s) { if (!s.jointly.length) return;
        var row = [s.from, s.to, s.sign, s.jointly.slice()], k = [s.from, s.to, s.sign].concat(s.jointly).join("\u0000");
        if (!seen[k]) { seen[k] = true; out.push([k, row]); } });
      return out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; })
                .map(function (r) { return r[1]; });
    })(),
    spanning: ids.slice().sort().filter(function (i) { return levelsOf(states[i], actors, levels).length > 1; })
                 .map(function (i) { return [i, levelsOf(states[i], actors, levels)]; }),
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
    with_given: text.filter(function (s) { return s.given.length > 0; }).length,
    chains: CP.chains, unchained: CP.unchained,
    kinds: kindList, akin_steps: AK.akin, instances: AK.instances
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
  return signs[0] === "+" ? "raises" : signs[0] === "-" ? "lowers" : signs[0] === "0" ? "no effect"
       : signs[0] === "which" ? "decides which" : signs[0];
}

/** Geometry for the whole chain, every layer included. Pure: the same model gives the same
 *  numbers, and nothing the reader switches changes them. */
function layout(M, opts) {
  opts = opts || {};
  // A CO-CAUSE ORDERS THE CHAIN AS A CAUSE DOES (profile 1.4): "belief moves people to act only
  // with a wish to fit in" puts the wish before the act, as the checker's routes have it. So the
  // columns, the systems and the depth-first walk see each co-cause as a step of its own; only
  // the drawing keeps it one arrow, with a stem.
  var ordering = M.steps.slice();
  M.steps.forEach(function (s) {
    (s.jointly || []).forEach(function (j) {
      if (has(M.states, j) && j !== s.to) ordering.push({ id: s.id + " & " + j, from: j, to: s.to, layer: s.layer,
                                                          isNull: s.isNull, selects: s.selects });
    });
  });
  var used = {};
  ordering.forEach(function (s) { used[s.from] = used[s.to] = true; });
  M.ids.forEach(function (i) { if (isStart(M.states[i])) used[i] = true; });
  var ids = M.ids.filter(function (i) { return used[i]; });

  // Back edges by depth-first search from the interventions first, so a loop is drawn as a loop
  // returning to where the chain began, not as the chain's first step.
  var out = {};
  ordering.forEach(function (s) { (out[s.from] = out[s.from] || []).push(s); });
  var back = {}, mark = {};
  function dfs(v) {
    mark[v] = 1;
    (out[v] || []).forEach(function (s) {
      if (mark[s.to] === 1) back[s.id] = true;
      else if (!mark[s.to]) dfs(s.to);
    });
    mark[v] = 2;
  }
  ids.filter(function (i) { return hasRole(M.states[i], "intervention"); }).forEach(function (i) { if (!mark[i]) dfs(i); });
  ids.filter(function (i) { return hasRole(M.states[i], "condition"); }).forEach(function (i) { if (!mark[i]) dfs(i); });
  ids.forEach(function (i) { if (!mark[i]) dfs(i); });
  var rank = {};
  function r(v, seen) {
    if (has(rank, v)) return rank[v];
    if (seen[v]) return 0;
    seen[v] = true;
    var best = 0;
    ordering.forEach(function (s) { if (s.to === v && !back[s.id]) best = Math.max(best, r(s.from, seen) + 1); });
    return (rank[v] = best);
  }
  ids.forEach(function (v) { r(v, {}); });

  // SEQUENCE BETWEEN SYSTEMS, A BLOCK WITHIN ONE. Left to right means "comes after" -- which is
  // true between feedback systems and meaningless inside one, where every state reaches every
  // other and the depth-first order above only decides where each loop is cut. Laid out by that
  // order alone, Wimmer's one system of 17 states ran across a dozen columns and 3,848 pixels
  // (26 Sep 2026). So the columns are worked out on the chain with each system as ONE node, and
  // a system's states keep their order inside it but are packed into a block about as many
  // columns wide as the square root of its size.
  // Every step orders the columns; only the TEXT's own causal steps make a system a block -- the
  // systems the census reports. Taken from every layer, a loop closed only by the reconstructor's
  // appraisal packed the text's own "orders lower reoffending" into one column and drew it as a
  // returning arc; the appraisal must never reshape what the text says.
  var pairs = [], seenPair = {}, textPairs = [];
  ordering.forEach(function (s) {
    var k = s.from + "\u0000" + s.to;
    if (!used[s.from] || !used[s.to] || s.from === s.to) return;
    if (!seenPair[k]) { seenPair[k] = true; pairs.push([s.from, s.to]); }
    if (s.layer === "text" && !s.isNull && !s.selects) textPairs.push([s.from, s.to]);
  });
  var comps = systems(ids, textPairs), unitOf = {}, span = {}, local = {};
  ids.forEach(function (v) { unitOf[v] = v; span[v] = 1; local[v] = 0; });
  comps.forEach(function (c, ci) {
    var u = "\u0000system" + ci, lo = Infinity, hi = 0;
    c.forEach(function (v) { lo = Math.min(lo, rank[v]); hi = Math.max(hi, rank[v]); });
    var width = Math.min(hi - lo + 1, Math.max(2, Math.ceil(Math.sqrt(c.length))));
    c.forEach(function (v) { unitOf[v] = u; local[v] = Math.floor((rank[v] - lo) * width / (hi - lo + 1)); });
    span[u] = width;
  });
  // Between units, only the steps the depth-first walk above does not mark as closing a loop set
  // the order: a loop the TEXT closes is inside one unit already, but one closed only by a rival
  // view or the appraisal is not, and following it round put the fixture's `order` after the
  // step it starts.
  var preds = {};
  ordering.forEach(function (st) {
    if (back[st.id] || !used[st.from] || !used[st.to]) return;
    var a = unitOf[st.from], b = unitOf[st.to];
    if (a !== b) (preds[b] = preds[b] || []).push(a);
  });
  var start = {};
  function offset(u, guard) {
    if (has(start, u)) return start[u];
    if (guard[u]) return 0;
    guard[u] = true;
    var best = 0;
    (preds[u] || []).forEach(function (p) { best = Math.max(best, offset(p, guard) + span[p]); });
    return (start[u] = best);
  }
  var col = {};
  ids.forEach(function (v) { col[v] = offset(unitOf[v], {}) + local[v]; });

  // A STATE ACROSS LEVELS (profile 1.4) is one box running down through every lane from its top
  // level to its bottom one: the Coleman boat's shared expectation, at once many people's belief
  // and a macro fact. It takes a row in each lane it crosses: the LAST row of its top lane and the
  // FIRST of its bottom one, so the states of its column sit above it and below it, never under it.
  // (Put first everywhere, as it was, the Coleman-boat reading's two spanning boxes covered six
  // states of the top lane that came after them in their column.) A lane it runs right through is
  // its alone in that column; spanning states that share a column share its width, side by side.
  var laneRange = function (i) {
    var lvs = levelsOf(M.states[i], M.actors, M.levels).filter(function (lv) { return M.levels.indexOf(lv) >= 0; });
    if (!lvs.length) return [M.levels.length - 1, M.levels.length - 1];
    return [M.levels.indexOf(lvs[0]), M.levels.indexOf(lvs[lvs.length - 1])];
  };
  var range = {};
  ids.forEach(function (v) { range[v] = laneRange(v); });
  var spans = function (v) { return range[v][1] > range[v][0]; };
  var slots = {};
  var place = function (v, li) { var k = M.levels[li] + "|" + col[v]; (slots[k] = slots[k] || []).push(v); };
  M.levels.forEach(function (lv, li) {
    // Ending here (from above) first, then this lane's own states, then those going on below.
    ids.forEach(function (v) { if (spans(v) && range[v][1] === li) place(v, li); });
    ids.forEach(function (v) { if (spans(v) && range[v][0] < li && range[v][1] > li) place(v, li); });
    ids.forEach(function (v) { if (!spans(v) && range[v][0] === li) place(v, li); });
    ids.forEach(function (v) { if (spans(v) && range[v][0] === li) place(v, li); });
  });
  var lanes = [], y = TOP;
  M.levels.forEach(function (lv) {
    var rows = 0;
    Object.keys(slots).forEach(function (k) { if (k.slice(0, lv.length + 1) === lv + "|") rows = Math.max(rows, slots[k].length); });
    // A level nothing in the text reaches is a thin strip that says so, not an empty band.
    var h = rows ? HEAD + rows * ROW + PADY : HEAD + 4;
    lanes.push({ level: lv, y: y, h: h, empty: !rows,
                 actors: Object.keys(M.actors).filter(function (a) { return obj(M.actors[a]).level === lv; })
                           .map(function (a) { return obj(M.actors[a]).label || a; }) });
    y += h;
  });
  var nodes = {}, maxRank = 0;
  ids.forEach(function (v) {
    var rowY = function (li) { return lanes[li].y + HEAD + PADY / 2 + slots[M.levels[li] + "|" + col[v]].indexOf(v) * ROW; };
    var top = rowY(range[v][0]), bottom = rowY(range[v][1]) + BH;
    nodes[v] = { x: GUT + col[v] * COL, y: top, w: BW, h: bottom - top };
    if (spans(v)) nodes[v].levels = M.levels.slice(range[v][0], range[v][1] + 1);
    maxRank = Math.max(maxRank, col[v]);
  });
  // Spanning boxes in one column whose heights meet stand side by side, each a share of the width.
  var spanCols = {};
  ids.filter(spans).forEach(function (v) { (spanCols[col[v]] = spanCols[col[v]] || []).push(v); });
  Object.keys(spanCols).forEach(function (c) {
    var list = spanCols[c], groups2 = [];
    list.forEach(function (v) {
      var g = groups2.filter(function (gr) { return gr.some(function (w) {
        return nodes[w].y < nodes[v].y + nodes[v].h && nodes[v].y < nodes[w].y + nodes[w].h; }); })[0];
      if (g) g.push(v); else groups2.push([v]);
    });
    groups2.forEach(function (gr) {
      if (gr.length < 2) return;
      var w = (BW - 8 * (gr.length - 1)) / gr.length;
      gr.forEach(function (v, i) { nodes[v].x += i * (w + 8); nodes[v].w = w; });
    });
  });

  // FOLDING DRAWS, IT DOES NOT MOVE. Every state keeps the place the whole chain gives it (F3: a
  // folded view is a projection of one fixed order); a folded state is simply not drawn, and the
  // arrows through it are drawn from where they start to where they end.
  var drawn = foldSteps(M, opts.folded || {}, nodes);
  drawn.steps.forEach(function (s) { if (s.parts) s.back = nodes[s.to].x <= nodes[s.from].x; });
  // THE ENDS: only the intervention's routes to the outcomes. Folding every state between them was
  // not enough on the J-PAL sample, which names four other causes and six places its chain stops:
  // their routes still filled the page. Everything off that line is set aside -- not drawn, and
  // counted in the panel -- and comes back with Unfold all.
  var setAside = [], offMain = 0, noLine = false;
  var startOf = function (v) { return isStart(M.states[v]); };
  var endOf = function (v) { return hasRole(M.states[v], "outcome"); };
  var hasEnds = M.ids.some(startOf) && M.ids.some(endOf);
  var main = opts.ends && hasEnds ? drawn.steps.filter(function (s) { return startOf(s.from) && endOf(s.to) && s.from !== s.to; }) : [];
  // A text whose chain never runs from its intervention to an outcome has no line to show: that
  // is a finding (the gaps say so), and setting everything aside would draw an empty page.
  noLine = !!(opts.ends && hasEnds && !main.length);
  if (opts.ends && hasEnds && main.length) {
    offMain = drawn.steps.length - main.length;
    drawn.steps = main;
    var touched = {};
    main.forEach(function (s) { touched[s.from] = touched[s.to] = true;
                                (s.jointly || []).forEach(function (j) { touched[j] = true; }); });
    Object.keys(nodes).forEach(function (v) {
      if (!drawn.folded[v] && !touched[v] && !startOf(v) && !endOf(v)) setAside.push(v);
    });
  }

  // One drawn edge per (from, to, layer, kind): a null finding and a selection link are never
  // folded into the causal arrow beside them, or the drawing would say the opposite of the text.
  var groups = {}, order = [];
  var kindOf = function (s) { return s.isNull ? "null" : s.selects ? "selection" : "step"; };
  // AND BY SIGN. One arrow labelled "mixed" hid the FAST trial's story: the authors hold that
  // exercise lowers falls, and report an earlier trial where it raised them (26 Sep 2026). Two
  // findings with opposite signs are two arrows, as the checker already counts them. A route
  // through folded states is never merged with a step the text states outright.
  // AT THE TEXT'S OWN BOXES, ONE ARROW PER PAIR AND DIRECTION. Collapsing Wimmer's parts into
  // Fig. 2's boxes turned seventeen part-to-part steps into seventeen parallel arrows between the
  // same two boxes, kept apart by sign and kind -- right when every state is drawn, and noise at the
  // level of the text's own diagram (F7). There, the steps of one voice between two boxes are one
  // arrow whose label counts what it holds and whose panel lists them apart; nothing is merged in
  // the full view, where the separation says something the file says.
  var merge = !!M.collapsed;
  drawn.steps.forEach(function (s) {
    var k = merge ? s.from + "\u0000" + s.to + "\u0000" + s.layer + "\u0000\u0000\u0000" + (s.parts ? "route" : "")
                  : s.from + "\u0000" + s.to + "\u0000" + s.layer + "\u0000" + kindOf(s) + "\u0000" +
            (kindOf(s) === "step" ? s.sign : "") + "\u0000" + (s.parts ? "route" : "") +
            // "raises" and "raises only together with a wish" say different things: two arrows.
            ((s.jointly || []).length ? "\u0000&" + s.jointly.join(",") : "");
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(s);
  });
  // PORTS. Every arrow leaving a state used to leave from the middle of its right side, and the
  // J-PAL intervention, with a dozen steps out of it, sent them all from one point: a knot no one
  // could follow. Now each arrow has its own point on the side, in the order of where it is going,
  // so arrows leave and arrive already sorted and cross as little as the layout allows.
  var isBackKey = {};
  // An arrow that does not run rightwards returns: drawn as an arc under the boxes. With systems
  // laid out as blocks that happens only inside a feedback system, where every step is on a loop.
  // STACKED IN ONE COLUMN, AN ARROW RUNS STRAIGHT BETWEEN THE BOXES. Merton's in-group defining
  // the out-group, and the out-group's defensive response to it, sat one above the other in a
  // feedback block; each step was drawn as a returning arc from a box's bottom, both down the same
  // line and through the lower box, and the reader saw one arrow of a two-way loop (26 Sep 2026).
  // Where nothing stands between them, each step is a straight arrow from facing edge to facing
  // edge, and a pair running both ways is drawn side by side. Where a box does stand between them
  // (Merton's case: the exclusion from unions sat between the two), a step runs down beside the
  // column's left edge or up beside its right, so a pair both ways reads as one circuit.
  var between = function (a, b) {
    var lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
    return Object.keys(nodes).some(function (w) { var m = nodes[w];
      return m !== a && m !== b && m.x === a.x && m.y > lo && m.y < hi; });
  };
  var isVertKey = {}, isSideKey = {}, pairKeys = {}, sideKeys = {};
  order.forEach(function (k) {
    var s0 = groups[k][0], a = nodes[s0.from], b = nodes[s0.to];
    var column = s0.from !== s0.to && a.x === b.x;
    isVertKey[k] = column && !between(a, b);
    isSideKey[k] = column && !isVertKey[k];
    isBackKey[k] = !column && b.x <= a.x;
    if (isSideKey[k]) (sideKeys[a.x + (b.y > a.y ? "L" : "R")] = sideKeys[a.x + (b.y > a.y ? "L" : "R")] || []).push(k);
    if (isVertKey[k]) (pairKeys[[s0.from, s0.to].sort().join("\u0000")] = pairKeys[[s0.from, s0.to].sort().join("\u0000")] || []).push(k);
  });
  var outs = {}, ins = {};
  order.forEach(function (k) {
    if (isBackKey[k] || isVertKey[k] || isSideKey[k]) return;
    var s0 = groups[k][0];
    (outs[s0.from] = outs[s0.from] || []).push(k);
    (ins[s0.to] = ins[s0.to] || []).push(k);
  });
  var cyOf = function (v) { return nodes[v].y + nodes[v].h / 2; };
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
        return w !== v && m.x === n.x && (toward > 0 ? m.y > n.y && m.y < n.y + toward + n.h
                                                     : m.y < n.y && m.y > n.y + toward - n.h);
      });
    };
    outs[v].forEach(function (k) {
      var t = groups[k][0].to, dy = cyOf(t) - cyOf(v);
      var clear = (n.h + nodes[t].h) / 2 + 12;
      if (dy > clear && nodes[t].x > n.x && !blocked(dy)) below.push(k);
      else if (dy < -clear && nodes[t].x > n.x && !blocked(dy)) above.push(k);
      else side.push(k);
    });
    var fan = function (list, where) {
      list.sort(function (p, q) {
        var a = cyOf(groups[p][0].to), b = cyOf(groups[q][0].to);
        return (where === "bottom" ? b - a : a - b) || (p < q ? -1 : p > q ? 1 : 0);
      });
      list.forEach(function (k, i) { portSide[k] = where; portX[k] = n.x + 14 + (n.w - 28) * (i + 0.5) / list.length; });
    };
    fan(below, "bottom"); fan(above, "top");
    outs[v] = side;
  });
  var spread = function (list, key, other, into) {
    list.sort(function (p, q) {
      var a = groups[p][0], b = groups[q][0];
      return cyOf(a[other]) - cyOf(b[other]) || nodes[a[other]].x - nodes[b[other]].x || (p < q ? -1 : p > q ? 1 : 0);
    });
    list.forEach(function (k, i) { var n = nodes[groups[k][0][key]]; into[k] = n.y + 8 + (n.h - 16) * (i + 0.5) / list.length; });
  };
  Object.keys(outs).forEach(function (v) { spread(outs[v], "from", "to", portY); });
  Object.keys(ins).forEach(function (v) { spread(ins[v], "to", "from", portIn); });

  var edges = order.map(function (k) {
    var ss = groups[k], s0 = ss[0], a = nodes[s0.from], b = nodes[s0.to];
    var isBack = isBackKey[k];
    // A merged arrow is a null or a selection only if everything in it is; otherwise it is a step.
    var kinds = {}; ss.forEach(function (x) { kinds[kindOf(x)] = true; });
    var kind = Object.keys(kinds).length === 1 ? kindOf(s0) : "step";
    var wordOf = function (x) { return x.isNull ? "no effect" : x.selects ? "selection" : signWord(x.sign ? [x.sign] : []); };
    var tally = {}; ss.forEach(function (x) { tally[wordOf(x)] = (tally[wordOf(x)] || 0) + 1; });
    var breakdown = Object.keys(tally).map(function (w) { return { word: w, count: tally[w] }; })
      .sort(function (p, q) { return q.count - p.count || (p.word < q.word ? -1 : p.word > q.word ? 1 : 0); });
    var off = s0.layer === "rival" ? 10 : s0.layer === "appraisal" ? -10 : kind === "null" ? 20 : kind === "selection" ? -20 : 0;
    // THREE CHANNELS, ONE MEANING EACH (F5). Weight: the best the text offers for the step.
    // Pattern: the closest any of its claims stands to the words. Colour: whose step, and what kind.
    var tier = ss.map(function (s) { return s.tier; })
                 .sort(function (p, q) { return TIERS.indexOf(p) - TIERS.indexOf(q); })[0];
    var fidelity = ss.map(function (s) { return s.fidelity; })
                     .sort(function (p, q) { return FIDELITY.indexOf(p) - FIDELITY.indexOf(q); })[0];
    var ink = s0.layer !== "text" ? s0.layer : kind === "selection" ? "selection" : "text";   // kind is "step" when mixed
    // THE ARROWHEAD RIDES A SHORT SOLID STUB at the end of the path. On a dashed line the head sat
    // wherever the dash pattern happened to end -- often after a gap, floating off its line.
    var d, stub, P;
    if (isVertKey[k]) {
      // Downward arrows to the left of the centre, upward ones to the right, spread if several.
      var down = b.y > a.y, mine = pairKeys[[s0.from, s0.to].sort().join("\u0000")];
      var ways = mine.filter(function (q) { return (nodes[groups[q][0].to].y > nodes[groups[q][0].from].y) === down; });
      var both = mine.length > ways.length;
      var vx = a.x + a.w / 2 + (both ? (down ? -14 : 14) : 0) + (ways.indexOf(k) - (ways.length - 1) / 2) * 10 * (down ? -1 : 1);
      var vy1 = down ? a.y + a.h : a.y, vy2 = down ? b.y - 2 : b.y + b.h + 2, vyE = down ? vy2 - STUB : vy2 + STUB;
      P = [[vx, vy1], [vx, vy1 + (vyE - vy1) / 3], [vx, vy1 + 2 * (vyE - vy1) / 3], [vx, vyE]];
      stub = "M" + vx + "," + vyE + " L" + vx + "," + vy2;
    } else if (isSideKey[k]) {
      var goesDown = b.y > a.y, lane = sideKeys[a.x + (goesDown ? "L" : "R")];
      var bulge = 26 + lane.indexOf(k) * 12, sgn = goesDown ? -1 : 1;
      var ex = goesDown ? a.x : a.x + a.w, ya = a.y + a.h / 2 + (goesDown ? 8 : -8), yb = b.y + b.h / 2 + (goesDown ? -8 : 8);
      var sx2 = goesDown ? b.x - 2 : b.x + b.w + 2, sxE = sx2 + sgn * STUB;
      P = [[ex, ya], [ex + sgn * bulge, ya], [sxE + sgn * (bulge - STUB), yb], [sxE, yb]];
      stub = "M" + sxE + "," + yb + " L" + sx2 + "," + yb;
    } else if (isBack) {
      var x1 = a.x + a.w / 2 + off, y1 = a.y + a.h, x2 = b.x + b.w / 2 + off, y2 = b.y + b.h;
      var dip = Math.max(y1, y2) + 46 + Math.abs(off) * 2;
      P = [[x1, y1], [x1, dip], [x2, dip], [x2, y2 + STUB + 2]];
      stub = "M" + x2 + "," + (y2 + STUB + 2) + " L" + x2 + "," + (y2 + 2);
    } else {
      var X2 = b.x - 2, Y2 = portIn[k], XE = X2 - STUB;
      if (portSide[k]) {
        var BX = portX[k], BY = portSide[k] === "bottom" ? a.y + a.h : a.y;
        var c2 = Math.max(30, (XE - BX) / 2);
        P = [[BX, BY], [BX, BY + (Y2 - BY) * 0.75], [XE - c2, Y2], [XE, Y2]];
      } else {
        var X1 = a.x + a.w, Y1 = portY[k], c = Math.max(40, (XE - X1) / 2);
        P = [[X1, Y1], [X1 + c, Y1], [XE - c, Y2], [XE, Y2]];
      }
      stub = "M" + XE + "," + Y2 + " L" + X2 + "," + Y2;
    }
    d = "M" + P[0][0] + "," + P[0][1] + " C" + P[1][0] + "," + P[1][1] + " " + P[2][0] + "," + P[2][1] + " " + P[3][0] + "," + P[3][1];
    // A null finding has no head, so no stub: its line runs all the way in.
    if (kind === "null") { d += " L" + (isVertKey[k] ? P[3][0] + "," + (P[3][1] + (b.y > a.y ? STUB : -STUB))
                                        : isSideKey[k] ? (P[3][0] + (b.y > a.y ? STUB : -STUB)) + "," + P[3][1]
                                        : isBack ? P[3][0] + "," + (P[3][1] - STUB) : (P[3][0] + STUB) + "," + P[3][1]); stub = null; }
    var signs = [];
    ss.forEach(function (s) { if (s.sign && signs.indexOf(s.sign) < 0) signs.push(s.sign); });
    // ↻ marks the step that closes a loop: an arc that returns, or a step in one column that the
    // depth-first walk found closing one.
    var closes = isBack || ((isVertKey[k] || isSideKey[k]) && ss.some(function (x) { return back[x.id]; }));
    var given = ss.some(function (s) { return s.given.length > 0; });
    var viaName = function (v) { var t = String(obj(M.states[v]).label || v); return t.length > 22 ? t.slice(0, 21) + "…" : t; };
    var route = s0.parts ? (ss.length === 1 ? " · via " + viaName(s0.via[0]) + (s0.via.length > 1 ? " +" + (s0.via.length - 1) : "")
                                            : " · " + ss.length + " routes") : "";
    var label = breakdown.length > 1
              ? breakdown.slice(0, 2).map(function (b) { return b.word + " ×" + b.count; }).join(" · ") +
                (breakdown.length > 2 ? " · +" + (breakdown.length - 2) + " more" : "") +
                (given ? " ◇" : "") + (closes ? " ↻" : "")
              : kind === "null" ? "no effect" + (ss.length > 1 ? " ×" + ss.length : "")
              : kind === "selection" ? "selection" :
                signWord(signs) + (route || (ss.length > 1 ? " ×" + ss.length : "")) +
                (given ? " ◇" : "") + (closes ? " ↻" : "");
    var jointly = [];
    ss.forEach(function (x) { (x.jointly || []).forEach(function (j) {
      if (has(M.states, j) && nodes[j] && j !== s0.to && jointly.indexOf(j) < 0) jointly.push(j); }); });
    return { key: k, from: s0.from, to: s0.to, layer: s0.layer, kind: kind, tier: tier, fidelity: fidelity, jointly: jointly, stems: [], junction: /** @type {null | {x:number,y:number,bar:string}} */ (null),
             ink: ink, route: !!s0.parts, back: isBack, vertical: !!isVertKey[k], side: !!isSideKey[k], mixed: breakdown.length > 1, breakdown: breakdown,
             steps: ss, path: d, stub: stub, curve: P,
             chip: { x: 0, y: 0, w: label.length * 6.6 + 14, h: 18, label: label } };
  });
  var shown = {};
  Object.keys(nodes).forEach(function (v) { if (!drawn.folded[v] && setAside.indexOf(v) < 0) shown[v] = nodes[v]; });
  edges.forEach(function (e) { stemsOf(e, shown); });
  placeChips(edges, shown, lanes);
  return { width: GUT + maxRank * COL + BW + 40, height: y + 70, lanes: lanes, nodes: nodes,
           edges: edges, box: { w: BW, h: BH },
           folded: Object.keys(drawn.folded).sort(), hidden: drawn.hidden,
           ends: !!(opts.ends && hasEnds && !noLine), noLine: noLine, setAside: setAside.sort(), offMain: offMain };
}

/** PATH FOLDING. A folded state is taken out of the chain and every pair of steps through it --
 *  into it, then out of it -- becomes one route from where the first starts to where the second
 *  ends. What a route says is fixed by what it is made of, never improved by the folding:
 *
 *   - its sign is the product of its steps' (raises then lowers is lowers);
 *   - its backing is its WEAKEST step's, since every step must hold (Gross's point about length);
 *   - its pattern is its most distant claim's, since the route is only as close to the words;
 *   - it keeps its layer, and steps of different layers are never joined: a rival view's step and
 *     the text's own do not make a route either party asserts.
 *
 *  What cannot be carried is counted, not dropped silently: a null finding or a selection link
 *  touching a folded state (neither is a step to walk), a loop that folding would close on a
 *  single state, and a pair of steps from different layers. The panel says how many. */
var FOLD_CAP = 2000;
function mulSign(a, b) {
  if (!a || !b) return "";
  // A route through a step that decides WHICH alternative follows is itself a matter of which.
  if (a === "which" || b === "which") return "which";
  if (a === "0" || b === "0") return "0";
  return a === b ? "+" : "-";
}
function foldSteps(M, folded, nodes) {
  var fold = {}, hidden = { findings: 0, loops: 0, crossLayer: 0, stranded: 0 };
  Object.keys(folded).forEach(function (v) { if (folded[v] && nodes[v]) fold[v] = true; });
  var cur = [];
  M.steps.forEach(function (s) {
    if ((s.isNull || s.selects) && (fold[s.from] || fold[s.to])) { hidden.findings++; return; }
    cur.push(s);
  });
  // Folded in the order the chain lays them out, so the same folds make the same routes.
  var seq = Object.keys(fold).sort(function (a, b) { return nodes[a].x - nodes[b].x || nodes[a].y - nodes[b].y || (a < b ? -1 : 1); });
  seq.forEach(function (v) {
    var ins = [], outs = [], rest = [];
    cur.forEach(function (s) { (s.to === v ? ins : s.from === v ? outs : rest).push(s); });
    // A step into the folded state with nothing of its own voice leaving it (or out of it with
    // nothing coming in) has no route to join: it goes, and is counted.
    var sameLayer = function (list, l) { return list.some(function (x) { return x.layer === l; }); };
    ins.forEach(function (i) { if (!sameLayer(outs, i.layer)) hidden.stranded++; });
    outs.forEach(function (o) { if (!sameLayer(ins, o.layer)) hidden.stranded++; });
    ins.forEach(function (i) {
      outs.forEach(function (o) {
        if (i.layer !== o.layer) { hidden.crossLayer++; return; }
        if (i.from === o.to) { hidden.loops++; return; }
        if (rest.length > FOLD_CAP) return;
        var parts = (i.parts || [i]).concat(o.parts || [o]);
        rest.push({
          id: i.id + " > " + o.id, from: i.from, to: o.to, layer: i.layer, parts: parts,
          via: (i.via || []).concat([v], o.via || []),
          sign: mulSign(i.sign, o.sign), isNull: false, selects: false,
          tier: TIERS[Math.max(TIERS.indexOf(i.tier), TIERS.indexOf(o.tier))],
          fidelity: FIDELITY[Math.max(FIDELITY.indexOf(i.fidelity), FIDELITY.indexOf(o.fidelity))],
          hedged: i.hedged || o.hedged, given: i.given.concat(o.given),
          lag: [i.lag, o.lag].filter(Boolean).join("; "), how: null, reflexive: i.reflexive || o.reflexive,
          // A route holds only with every co-cause of every step on it.
          jointly: (i.jointly || []).concat((o.jointly || []).filter(function (j) { return (i.jointly || []).indexOf(j) < 0; }))
                     .filter(function (j) { return j !== o.to; }),
          claim: null
        });
      });
    });
    cur = rest;
  });
  return { steps: cur, folded: fold, hidden: hidden };
}
/** The states folding can take out: those the text's chain runs into AND out of. An
 *  intervention or an outcome is where a route starts or ends, so it is never one. */
function foldable(M, voice) {
  // ONE VOICE MUST RUN BOTH WAYS. On the planted fixture a state the text's chain starts from had
  // only an appraisal step into it; offered for folding, it took the text's whole chain with it,
  // since steps of different voices are never joined into a route.
  var into = {}, from = {}, out = [];
  M.steps.forEach(function (s) {
    if (s.isNull || s.selects) return;
    into[s.to + "\u0000" + s.layer] = true; from[s.from + "\u0000" + s.layer] = true;
  });
  M.ids.forEach(function (v) {
    if (rolesOf(M.states[v]).length) return;      // an end of the chain is never folded away
    if ((voice ? [voice] : ["text", "rival", "appraisal"]).some(function (l) { return into[v + "\u0000" + l] && from[v + "\u0000" + l]; })) out.push(v);
  });
  return out;
}

/** WHERE EACH CHIP GOES. The first build put every chip at a fixed point along its arrow, and on
 *  the J-PAL sample chips sat under other arrows' heads, on top of each other where arrows
 *  converge, and over boxes. Now each is tried at a run of points along its own curve and takes the
 *  first clear of every box, every arrowhead and every chip already placed -- the text's
 *  best-backed steps first, so they get the clearest places -- or the least crowded if none is
 *  clear. Deterministic: the same chain places its chips the same way. */
var CHIP_T = [0.5, 0.4, 0.6, 0.3, 0.7, 0.45, 0.55, 0.22, 0.78, 0.35, 0.65, 0.15, 0.85, 0.1, 0.9];
var CHIP_DY = [0, -13, 13, -24, 24, -36, 36];
/** JOINT CAUSES, DRAWN AS THE REASONS MAP DRAWS LINKED PREMISES. Each co-cause sends a stem to a
 *  bar across the arrow near its head: the effect passes the bar only with every stem in. Drawn
 *  only from a co-cause on the page; the panel names every one whatever is drawn. */
var JUNCTION_T = 0.8;
function stemsOf(e, shown) {
  if (!e.jointly.length) return;
  var P = e.curve, t = e.back ? 0.5 : JUNCTION_T;
  var at = function (u) { return [bez(P[0][0], P[1][0], P[2][0], P[3][0], u), bez(P[0][1], P[1][1], P[2][1], P[3][1], u)]; };
  var J = at(t), J1 = at(t - 0.02), J2 = at(Math.min(1, t + 0.02));
  var dx = J2[0] - J1[0], dy = J2[1] - J1[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = -dy / len * 8, ny = dx / len * 8;
  e.junction = { x: J[0], y: J[1], bar: "M" + (J[0] - nx) + "," + (J[1] - ny) + " L" + (J[0] + nx) + "," + (J[1] + ny) };
  // THE STEM GOES ROUND, NOT THROUGH. On the planted boat the wish sat in the row of the belief it
  // joins, one column back, and a stem from its right side ran straight through the belief's box.
  // Three ways are tried -- from the side, under the row, over it -- and the first that crosses
  // no box is taken, else the one that crosses least.
  var others = Object.keys(shown).filter(function (v) { return v !== e.to; });
  e.jointly.forEach(function (j) {
    var n = shown[j];
    if (!n) return;
    var cands = [];
    var sx = n.x + n.w, sy = n.y + n.h / 2;
    if (sx + 20 < J[0]) cands.push([[sx, sy], [sx + Math.max(30, (J[0] - sx) / 2), sy], [J[0], J[1] + (sy < J[1] ? -12 : 12)]]);
    var low = Math.max(n.y + n.h, J[1]) + 28, high = Math.min(n.y, J[1]) - 28;
    cands.push([[n.x + n.w / 2, n.y + n.h], [n.x + n.w / 2, low], [J[0], low]]);
    cands.push([[n.x + n.w / 2, n.y], [n.x + n.w / 2, high], [J[0], high]]);
    var best = cands[0], bestHits = Infinity;
    cands.forEach(function (c) {
      var hits = 0;
      for (var i = 1; i < 20; i++) {
        var u = i / 20, px = bez(c[0][0], c[1][0], c[2][0], J[0], u), py = bez(c[0][1], c[1][1], c[2][1], J[1], u);
        others.forEach(function (v) { var m = shown[v];
          if (px > m.x + 2 && px < m.x + m.w - 2 && py > m.y + 2 && py < m.y + m.h - 2) hits++; });
      }
      if (hits < bestHits) { best = c; bestHits = hits; }
    });
    e.stems.push({ state: j, path: "M" + best[0][0] + "," + best[0][1] + " C" + best[1][0] + "," + best[1][1] + " " +
                                   best[2][0] + "," + best[2][1] + " " + J[0] + "," + J[1] });
  });
}

function placeChips(edges, nodes, lanes) {
  var fixed = [];
  (lanes || []).forEach(function (ln) { fixed.push({ x: 0, y: ln.y, w: 100000, h: HEAD - 2 }); });
  Object.keys(nodes).forEach(function (v) { var n = nodes[v]; fixed.push({ x: n.x - 6, y: n.y - 6, w: n.w + 12, h: n.h + 12 }); });
  edges.forEach(function (e) {
    if (!e.stub) return;
    var P = e.curve, x = P[3][0], y = P[3][1];
    fixed.push(e.vertical ? { x: x - 9, y: Math.min(y, P[0][1] < y ? y : y - STUB) - 2, w: 18, h: STUB + 6 }
             : e.back ? { x: x - 9, y: y - STUB - 12, w: 18, h: STUB + 14 } : { x: x - 4, y: y - 9, w: STUB + 12, h: 18 });
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
      // Never off the drawing: a route's chip was pushed past the left edge when folding sent
      // it out of the bottom of a box in the first column.
      var cost = box.x < 4 ? 1e6 : 0;
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
    // COLOUR IS WHOSE STEP, AND WHAT KIND (F5). The text's own steps in the identity's navy; a
    // rival view the text reports in slate, NOT red -- red is attack everywhere else on the page;
    // the appraisal in the violet the Reasons map gives it; selection, a different relation, teal.
    // The light-and-shadow bar is shades of the one navy, as its lines are weights of it.
    "  --mv-cond-bg:#dfe7f3;--mv-text:#203a6a;--mv-rival:#7f8a9a;--mv-appraisal:#6d5ba3;--mv-appraisal-bg:#f1eefa;--mv-gap:#c2410c;",
    "  --mv-selection:#2f8f83;",
    "  --mv-evidence:#203a6a;--mv-argued:#5a78a8;--mv-asserted:#a7b6cf;--mv-imputed:#dde2ea;",
    "  --mv-lane-a:rgba(0,0,0,.035);--mv-lane-b:rgba(0,0,0,.015);--mv-sel:#e0a800}",
    "@media (prefers-color-scheme:dark){.amech{",
    "  --mv-cond-bg:#23324a;--mv-text:#9cc3ef;--mv-rival:#9aa4b3;--mv-appraisal:#b3a4e6;--mv-appraisal-bg:#2a2638;--mv-gap:#f08a4b;",
    "  --mv-selection:#5fc2b5;",
    "  --mv-evidence:#9cc3ef;--mv-argued:#6f93bf;--mv-asserted:#4d6484;--mv-imputed:#334155;",
    "  --mv-lane-a:rgba(255,255,255,.04);--mv-lane-b:rgba(255,255,255,.015);--mv-sel:#f5c542}}",
    ".amech[hidden]{display:none}",
    ".amech-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px;",
    "  border-bottom:1px solid var(--line,#ddd)}",
    ".amech-q{flex:1 1 260px;color:var(--fg-dim,#666);font-size:13px;min-width:0}",
    ".amech-tog{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line,#ddd);",
    "  border-radius:7px;padding:4px 9px;background:var(--panel,#fff);cursor:pointer;font-size:13px;user-select:none}",
    ".amech-tog input{margin:0}",
    ".amech-tog .sw{width:20px;height:0;border-top:2px solid var(--mv-rival)}",
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
    ".amech .st.intervention rect.box{fill:var(--mv-text);stroke:var(--mv-text)}",
    ".amech .st.intervention text{fill:var(--alm-node-bg,#fff)}",
    ".amech .st.outcome rect.outer{fill:none;stroke:var(--fg,#1a1a1a)}",
    // A CONDITION is a starting point the text does not recommend: the intervention's navy, but
    // as a tint, so what the text would DO and what it takes as given read apart at a glance.
    ".amech .st.condition rect.box{fill:var(--mv-cond-bg);stroke:var(--mv-text)}",
    ".amech .loopmark{cursor:pointer}.amech .loopmark circle{fill:var(--panel,#fff);stroke:var(--mv-text);stroke-width:1.4}",
    ".amech .loopmark text{font-size:10.5px;font-weight:700;fill:var(--mv-text)}",
    ".amech-loop{display:block;text-align:left;font:inherit;background:none;border:1px solid var(--line,#ddd);border-radius:6px;",
    "  padding:3px 7px;margin:0 0 4px;cursor:pointer;color:var(--fg,#1a1a1a);width:100%}",
    ".amech-loop:hover{border-color:var(--mv-text)}",
    ".amech .st.appraisal rect.box{fill:url(#amech-hatch);stroke:var(--mv-appraisal);stroke-dasharray:4 3}",
    ".amech .st{cursor:pointer}.amech .st text{font-size:12px}",
    ".amech .ed{fill:none;cursor:pointer}.amech .junction{fill:none;stroke-linecap:butt}.amech .hit{fill:none;stroke:transparent;stroke-width:14;cursor:pointer}",
    ".amech .chip rect{fill:var(--panel,#fff);stroke:currentColor}.amech .chip text{font-size:11px;fill:currentColor;font-weight:600}",
    ".amech .sel{stroke:var(--mv-sel)!important;stroke-width:4!important}",
    ".amech .dim{opacity:.1}.amech .faint{opacity:.35}",
    ".amech-legend{display:grid;gap:3px;margin:0 0 8px}.amech-legend div{display:flex;align-items:center;gap:8px}",
    ".amech-legend .g{color:var(--fg-dim,#666);font-size:11.5px;margin-top:4px}",
    ".amech-route{border:1px solid var(--line,#ddd);border-radius:7px;padding:6px 9px;margin:6px 0}",
    ".amech-route>.t{font-weight:600}.amech-fold{display:flex;flex-wrap:wrap;gap:4px;align-items:center}",
    ".amech-fold button,.amech-state-act button{font:inherit;font-size:12px;background:none;border:1px solid var(--line,#ddd);",
    "  border-radius:5px;padding:1px 7px;cursor:pointer;color:var(--fg,#1a1a1a)}",
    ".amech-tog select{font:inherit;font-size:12.5px;border:0;background:none;color:inherit}",
    ".amech-tog.fit{font:inherit;font-size:13px;color:inherit}",
    ".amech-focus{margin:0 0 8px;padding:6px 9px;border-radius:6px;border:1px solid var(--mv-sel);font-size:12.5px}",
    ".amech .st.intervention text.gapmark,.amech .gapmark{fill:var(--mv-gap);font-size:11px;font-weight:600}"
  ].join("\n");
  document.head.appendChild(s);
}

var INKS = ["text", "rival", "appraisal", "selection"];
/** How an arrow is drawn: weight from what the text offers, pattern from how close its claims
 *  stand to the words, colour from whose step it is. A null finding is drawn thin whatever backs
 *  it -- its chip and its bar say what it is. */
function edgeStyle(e) {
  return { color: "var(--mv-" + e.ink + ")", width: e.kind === "null" ? 1.4 : TIER_WIDTH[e.tier],
           dash: FIDELITY_DASH[e.fidelity] || "" };
}

/** Past this many loops, a feedback system is shown as one system, not loop by loop (as
 *  mechanism.py's LOOPS_LISTED). */
var LOOPS_LISTED = 4;

function outermost(states, v) {
  var seen = {};
  for (;;) {
    var p = obj(states[v]).part_of;
    if (p == null || !has(states, p) || p === v || seen[p]) return v;
    seen[v] = true; v = p;
  }
}
/** THE TEXT'S OWN BOXES. A state declared `part_of` another is drawn inside it: every step from or
 *  to a part becomes the whole's, and a step between two parts of one whole is not drawn (it is
 *  counted). Wimmer's five strategies are parts of his Fig. 2's strategies box, and at that level
 *  his 21 states are the handful of boxes he drew himself -- the right level to open at (F7). */
function collapseModel(M) {
  var top = {};
  M.ids.forEach(function (v) { top[v] = outermost(M.states, v); });
  var ids = M.ids.filter(function (v) { return top[v] === v; });
  var states = {}; ids.forEach(function (v) { states[v] = M.states[v]; });
  var inside = 0, steps = [];
  M.steps.forEach(function (s) {
    var a = top[s.from], b = top[s.to];
    if (a === b && (a !== s.from || b !== s.to)) { inside++; return; }
    var c = {}; for (var k in s) if (has(s, k)) c[k] = s[k];
    c.from = a; c.to = b;
    c.jointly = [];
    (s.jointly || []).forEach(function (j) { var t = has(top, j) ? top[j] : j;
      if (t !== b && c.jointly.indexOf(t) < 0) c.jointly.push(t); });
    if (a !== s.from || b !== s.to) { c.partFrom = s.from; c.partTo = s.to; }
    steps.push(c);
  });
  return { levels: M.levels, actors: M.actors, states: states, ids: ids, steps: steps,
           dropped: M.dropped, appraisalClaims: M.appraisalClaims, question: M.question,
           profile: profile(M.levels, M.actors, states, ids, steps, M.appraisalClaims),
           chains: [], chain: M.chain, kinds: M.kinds,
           collapsed: { inside: inside, parts: M.ids.length - ids.length,
                        wholes: M.profile.wholes.length } };
}

/** ONE OF THE TEXT'S CHAINS (profile 1.5), as a model of its own: the states its steps touch, each
 *  in the role the chain gives it, and its steps -- the text's own marked with it, and a rival's or
 *  the appraisal's marked with it or, unmarked, running between two of its states. Laid out on its
 *  own: the Coleman-boat paper's six cases drawn together were a thicket, and each is a question
 *  the text answers apart (F7). `chain.shared` says, for each state, which other chains it is in. */
function chainModel(M, id) {
  var c = (M.chains || []).filter(function (x) { return x.id === id; })[0];
  if (!c) return M;
  var text = M.steps.filter(function (s) { return s.layer === "text" && !s.isNull && !s.selects && s.chain.indexOf(id) >= 0; });
  var inIds = {};
  chainIds(c, M.states, M.ids, text).forEach(function (i) { inIds[i] = true; });
  M.steps.forEach(function (s) { if (s.chain.indexOf(id) >= 0) {
    inIds[s.from] = inIds[s.to] = true; (s.jointly || []).forEach(function (j) { if (has(M.states, j)) inIds[j] = true; }); } });
  var ids = M.ids.filter(function (i) { return inIds[i]; });
  var steps = M.steps.filter(function (s) {
    return s.chain.indexOf(id) >= 0 || (s.layer !== "text" && !s.chain.length && inIds[s.from] && inIds[s.to]); });
  var states = chainStates(c, M.states, ids);
  var appr = {};
  steps.forEach(function (s) { if (s.layer === "appraisal") appr[s.claim.title] = true; });
  var shared = {};
  var mine = M.profile.chains.filter(function (x) { return x.id === id; })[0];
  (mine ? mine.shared : []).forEach(function (sh) { shared[sh[0]] = sh[1]; });
  // Only the actors its states name: the lanes' headings list who acts at each level, and above
  // the Kenya chain they listed the fisheries' and Madagascar's actors too.
  var actors = {};
  ids.forEach(function (i) { var a = obj(M.states[i]).actor; if (has(M.actors, a)) actors[a] = M.actors[a]; });
  (steps || []).forEach(function (x) { var a = x.how && x.how.actor; if (a && has(M.actors, a)) actors[a] = M.actors[a]; });
  return { levels: M.levels, actors: actors, states: states, ids: ids, steps: steps,
           dropped: 0, appraisalClaims: Object.keys(appr).length,
           question: c.question || M.question, chains: [], kinds: M.kinds,
           chain: { id: c.id, label: c.label || c.id, shared: shared },
           profile: profile(M.levels, actors, states, ids, steps, Object.keys(appr).length, [], M.kinds) };
}

/** Draw the chain into `container`. `opts.onClaim(claim)` is called when the reader asks to see
 *  a claim -- the host takes it to the claim's passage. Returns a small controller. */
function create(container, graph, opts) {
  opts = opts || {};
  injectStyle();
  var FULL = model(graph);
  container.innerHTML = "";
  container.classList.add("amech");
  if (!FULL) { container.textContent = "This map declares no mechanism."; return null; }
  // A SHELL AND A MOUNT. What persists across the two levels of detail -- the layer switches, and
  // which level is showing -- lives here; everything drawn from one model lives in `mount`, and
  // moving between the text's own boxes and every state mounts afresh. The host holds this one
  // controller throughout.
  var hasWholes = FULL.profile.wholes.length > 0;
  // SEVERAL CHAINS OPEN AT THE FIRST (F7), each laid out on its own; "every chain together" is
  // one choice away.
  var CHAINS = FULL.chains || [];
  var keep = { boxes: hasWholes, rival: true, appraisal: !!opts.appraisal,
               chain: CHAINS.length ? CHAINS[0].id : null, then: null };
  // THE SAME KIND ACROSS CASES (profile 1.6): each state's kin -- other states of its kind -- and
  // which chains each is in, read off the whole file whatever is being shown.
  var KINDS = FULL.profile.kinds || [];
  var kindOfState = function (v) { var k = obj(FULL.states[v]).kind;
    return k != null && KINDS.some(function (x) { return x.id === String(k); }) ? String(k) : null; };
  var kinOf = function (v) { var k = kindOfState(v); if (!k) return [];
    return KINDS.filter(function (x) { return x.id === k; })[0].states.filter(function (w) { return w !== v; }); };
  var chainsOfState = function (v) { return FULL.profile.chains.filter(function (c) { return c.states.indexOf(v) >= 0; })
    .map(function (c) { return c.id; }); };
  var generalOfKind = function (k) { var x = KINDS.filter(function (y) { return y.id === k; })[0]; return x ? x.general : null; };
  var chainLabel = function (id) { var c = CHAINS.filter(function (x) { return x.id === id; })[0]; return c && c.label || id; };
  var cur = null;
  function remount() {
    container.innerHTML = "";
    var base = keep.chain ? chainModel(FULL, keep.chain) : FULL;
    cur = mount(keep.boxes ? collapseModel(base) : base);
    // Arriving from another chain at a state, or at a kind, shows it there.
    if (keep.then) { var t = keep.then; keep.then = null; cur.select(t); }
  }
  remount();
  return {
    get model() { return cur.model; },
    // A getter: folding replaces the geometry, and a copy taken at creation would go stale.
    get geometry() { return cur.geometry; },
    setLayer: function (name, on) { keep[name] = !!on; cur.setLayer(name, on); },
    getLayers: function () { return cur.getLayers(); },
    setShow: function (v) { cur.setShow(v); },
    setFolded: function (list) { cur.setFolded(list); },
    getFolded: function () { return cur.getFolded(); },
    setBoxes: function (on) { keep.boxes = !!on && hasWholes; remount(); },
    getBoxes: function () { return keep.boxes; },
    setChain: function (id) { keep.chain = CHAINS.some(function (c) { return c.id === id; }) ? id : null; remount(); },
    getChain: function () { return keep.chain; },
    destroy: function () { container.innerHTML = ""; container.classList.remove("amech"); }
  };

  function mount(M) {
  // FOLDED STATES. Folding re-draws the arrows and never moves a box: `layout` places every state
  // from the whole chain whatever is folded.
  // "Intervention -> outcomes" folds what lies between in the TEXT's own chain, and is offered
  // only where the map declares both ends -- a label that names an intervention and outcomes must
  // not be offered on a chain that has neither (F2). A single state may be folded wherever any
  // voice runs through it.
  var hasIntervention = M.ids.some(function (v) { return hasRole(M.states[v], "intervention"); });
  var hasEnds = M.ids.some(function (v) { return isStart(M.states[v]); }) &&
                M.ids.some(function (v) { return hasRole(M.states[v], "outcome"); });
  // What the ends are called follows what the text has: a recommendation's intervention, or the
  // conditions an explanation starts from.
  var endsLabel = (hasIntervention ? "Intervention" : "Conditions") + " → outcomes";
  var folded = {}, canFold = foldable(M), toEnds = hasEnds ? foldable(M, "text") : [];
  var ends = false;
  var G = layout(M, { folded: folded, ends: ends });
  // Off unless the host says the page's switch is already on: the view reports its layers back
  // as soon as it is drawn, and starting from `false` regardless would have turned off, on first
  // entry, an appraisal the reader had switched on in Reasons.
  var layers = { rival: keep.rival, appraisal: keep.appraisal };
  var selected = null;
  // THE LOOPS AND THE SYSTEMS the text closes, in its own voice. A few loops are listed and marked
  // one by one, in order; a system with more than a reader can follow is marked as ONE system,
  // with its shortest loops offered -- Wimmer's feedback came to 50+ loops and 410 badges.
  var SYS = M.profile.feedback.filter(function (f) { return f.loops > LOOPS_LISTED; });
  var inBig = function (l) { return SYS.some(function (f) { return l.states.every(function (v) { return f.states.indexOf(v) >= 0; }); }); };
  var LOOPS = M.profile.loops_text.filter(function (l) { return !inBig(l); });
  var sysName = function (i) { return String.fromCharCode(65 + i); };
  function loopNames(l) {
    return l.states.concat(l.states[0]).map(function (v) { return obj(M.states[v]).label || v; }).join(" → ");
  }
  // WHAT IS SHOWN. "tested" keeps only the steps the text backs with a study, statistics or a
  // model -- nulls included, since a null is a finding -- so the evidence can be read on its own.
  var show = "all", fit = false;
  var anyUntested = G.edges.some(function (e) { return !e.steps.some(function (x) { return x.tier === "evidence"; }); });

  var bar = document.createElement("div"); bar.className = "amech-bar";
  bar.innerHTML =
    (CHAINS.length ? '<label class="amech-tog chain" title="The text answers several questions, each with a chain of its own">Chain <select data-chain>' +
      CHAINS.map(function (c) { return '<option value="' + esc(c.id) + '"' + (keep.chain === c.id ? ' selected' : '') + '>' +
        esc(c.label || c.id) + '</option>'; }).join("") +
      '<option value=""' + (keep.chain ? '' : ' selected') + '>Every chain together</option></select></label>' : '') +
    '<div class="amech-q">' + esc(M.question) + '</div>' +
    (M.profile.rival_steps ? '<label class="amech-tog rival"><input type="checkbox" data-layer="rival" checked>' +
      '<span class="sw"></span><span>Rival views</span><span class="aside">as the text reports them</span></label>' : '') +
    (M.appraisalClaims ? '<label class="amech-tog appr"><input type="checkbox" data-layer="appraisal">' +
      '<span class="sw"></span><span>Reconstructor’s appraisal</span><span class="aside amech-acount"></span></label>' : '') +
    (anyUntested ? '<label class="amech-tog">Show <select data-show><option value="all">every step</option>' +
      '<option value="tested">only what the text tested</option></select></label>' : '') +
    // Offered only where there is something to fold (F2: a control is a promise).
    // NAMED FOR WHAT THE READER GETS, not for the operation: "Fold to the ends" described the
    // mechanics, and the author could not tell from it what the button would show (26 Sep 2026).
    (toEnds.length ? '<button type="button" class="amech-tog fold" data-foldall title="Show only the routes from where the chain starts to its outcomes: the states between are folded, and what lies off that line is set aside">' + endsLabel + '</button>' : '') +
    // Offered only where the map declares wholes (F2). Named for what a click will show.
    (hasWholes ? '<button type="button" class="amech-tog boxes" data-boxes title="Parts drawn inside the boxes the text itself draws, or every state apart">' +
      (keep.boxes ? "Show every state" : "The text’s own boxes") + '</button>' : '') +
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
  INKS.forEach(function (t) {
    var mk = el("marker", { id: "amech-ar-" + t, viewBox: "0 0 10 10", refX: 9, refY: 5,
                            markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--mv-" + t + ")" }, mk);
    // A NULL FINDING ENDS IN A BAR: the line reaches the state and nothing passes.
    var bar = el("marker", { id: "amech-bar-" + t, viewBox: "0 0 4 12", refX: 2, refY: 6,
                             markerWidth: 4, markerHeight: 12, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
    el("rect", { x: 0.5, y: 0, width: 3, height: 12, fill: "var(--mv-" + t + ")" }, bar);
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
      var st = edgeStyle(e), col = st.color;
      var g = el("g", { "data-layer": e.layer, "data-edge": e.from + ">" + e.to, "data-kind": e.kind,
                        "data-fidelity": e.fidelity, "data-tier": e.tier }, gE);
      if (e.route) g.setAttribute("data-route", "1");
      var p = el("path", { d: e.path, "class": "ed", stroke: col, "stroke-width": st.width }, g);
      if (st.dash) p.setAttribute("stroke-dasharray", st.dash);
      if (e.kind === "null") p.setAttribute("marker-end", "url(#amech-bar-" + e.ink + ")");
      if (e.stub) el("path", { d: e.stub, "class": "ed stub", stroke: col, "stroke-width": st.width,
                               "marker-end": "url(#amech-ar-" + e.ink + ")" }, g);
      el("path", { d: e.path, "class": "hit" }, g);
      e.stems.forEach(function (sm) {
        if (obj(M.states[sm.state]).appraisal && !layers.appraisal) return;
        var sp = el("path", { d: sm.path, "class": "ed stem", stroke: col, "stroke-width": st.width, "data-stem": sm.state }, g);
        if (st.dash) sp.setAttribute("stroke-dasharray", st.dash);
        el("path", { d: sm.path, "class": "hit" }, g);
      });
      if (e.junction) el("path", { d: e.junction.bar, "class": "junction", stroke: col, "stroke-width": st.width + 2 }, g);
      var chip = el("g", { "class": "chip", style: "color:" + col, "data-layer": e.layer,
                           "data-edge": e.from + ">" + e.to, "data-kind": e.kind }, gC);
      var tw = e.chip.w;
      el("rect", { x: e.chip.x - tw / 2, y: e.chip.y - 9, width: tw, height: 18, rx: 9 }, chip);
      el("text", { x: e.chip.x, y: e.chip.y + 4, "text-anchor": "middle" }, chip).textContent = e.chip.label;
      var title = el("title", {}, g);
      title.textContent = e.steps.length + " claim" + (e.steps.length === 1 ? "" : "s") +
        (e.jointly.length ? ", holding only together with " + e.jointly.map(function (j) { return obj(M.states[j]).label || j; }).join(" and ") : "") +
        " — click to see";
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
      if (G.folded.indexOf(v) >= 0 || G.setAside.indexOf(v) >= 0) return;
      var cls = "st" + rolesOf(s).map(function (r) { return " " + r; }).join("") + (s.appraisal ? " appraisal" : "");
      var g = el("g", { "class": cls, "data-layer": s.appraisal ? "appraisal" : "text", "data-state": v,
                        transform: "translate(" + p.x + "," + p.y + ")" }, gN);
      if (hasRole(s, "outcome")) el("rect", { "class": "outer", x: -4, y: -4, width: p.w + 8, height: p.h + 8, rx: 9 }, g);
      el("rect", { "class": "box", width: p.w, height: p.h, rx: 7 }, g);
      var lines = wrapWords(s.label || v, Math.max(8, Math.round(24 * p.w / BW)));
      lines.forEach(function (t, i) {
        el("text", { x: p.w / 2, y: p.h / 2 + (i - (lines.length - 1) / 2) * 14 + 4, "text-anchor": "middle" }, g).textContent = t;
      });
      var tt = el("title", {}, g); tt.textContent = (s.label || v) + " — click to see only the paths through it";
      drawnNodes[v] = g;
      // A LOOP IS MARKED ON EVERY STATE IN IT, not only on the arrow that closes it: the closing
      // arc alone was easy to miss, and a reader tracing Merton's circle across the page could
      // not tell where it began. The badge is also a control (F2): it shows that loop alone.
      var inLoops = [];
      LOOPS.forEach(function (l, li) { if (l.states.indexOf(v) >= 0) inLoops.push(li); });
      inLoops.forEach(function (li, j) {
        var mk = el("g", { "class": "loopmark", "data-loop": li, transform: "translate(" + (p.w - 10 - j * 26) + ",-5)" }, g);   // on the border, clear of the label
        el("circle", { r: 10 }, mk);
        el("text", { "text-anchor": "middle", y: 4 }, mk).textContent = "↻" + (LOOPS.length > 1 ? li + 1 : "");
        el("title", {}, mk).textContent = "In loop " + (li + 1) + ": " + loopNames(LOOPS[li]) + " — click to see it alone";
        mk.addEventListener("click", function (ev) { ev.stopPropagation(); select({ cycle: LOOPS[li], name: "Loop " + (li + 1) }); });
      });
      var sysOf = [];
      SYS.forEach(function (f, fi) { if (f.states.indexOf(v) >= 0) sysOf.push(fi); });
      sysOf.forEach(function (fi, j) {
        var mk = el("g", { "class": "loopmark sys", "data-system": fi,
                           transform: "translate(" + (p.w - 10 - (inLoops.length + j) * 26) + ",-5)" }, g);
        el("circle", { r: 10 }, mk);
        el("text", { "text-anchor": "middle", y: 4 }, mk).textContent = "⟳" + sysName(fi);
        el("title", {}, mk).textContent = "In feedback system " + sysName(fi) + ": " + SYS[fi].states.length +
          " states, " + SYS[fi].loops + (SYS[fi].capped ? "+" : "") + " loops — click to see it alone";
        mk.addEventListener("click", function (ev) { ev.stopPropagation(); select({ system: fi }); });
      });
      // WHAT COUPLES THE CHAINS (profile 1.5): a state this chain shares with another carries ⇄ at
      // its left corner; a click opens the other chain, where the state plays its part there.
      var elsewhere = M.chain && M.chain.shared[v];
      if (elsewhere && elsewhere.length) {
        var other = CHAINS.filter(function (c) { return c.id === elsewhere[0]; })[0];
        var sh = el("g", { "class": "loopmark shared", "data-shared": elsewhere[0], transform: "translate(10,-5)" }, g);
        el("circle", { r: 10 }, sh);
        el("text", { "text-anchor": "middle", y: 4 }, sh).textContent = "⇄";
        el("title", {}, sh).textContent = "Also in " + elsewhere.map(function (o) {
          var x = CHAINS.filter(function (c) { return c.id === o; })[0]; return "“" + (x && x.label || o) + "”"; }).join(" and ") +
          " — click to see " + (other && other.label || elsewhere[0]);
        sh.addEventListener("click", function (ev) { ev.stopPropagation(); keep.chain = elsewhere[0]; keep.then = { state: v }; remount(); });
      }
      // ITS KIN (profile 1.6): ≈ where another state, here or in another chain, is of its kind.
      var kin = kinOf(v);
      if (kin.length) {
        var km = el("g", { "class": "loopmark kin", "data-kind": kindOfState(v),
                           transform: "translate(" + (elsewhere && elsewhere.length ? 36 : 10) + ",-5)" }, g);
        el("circle", { r: 10 }, km);
        el("text", { "text-anchor": "middle", y: 4 }, km).textContent = "≈";
        var gk = generalOfKind(kindOfState(v));
        el("title", {}, km).textContent = (gk === v ? "The general case of which these are cases: " : gk ? "A case of the general " +
          "“" + (obj(FULL.states[gk]).label || gk) + "”; the same kind of thing as " : "The same kind of thing as ") + kin.map(function (w) {
          var cs = chainsOfState(w); return "“" + (obj(FULL.states[w]).label || w) + "”" + (cs.length ? " (" + cs.map(chainLabel).join(", ") + ")" : ""); }).join(" and ") +
          " — a different state, in a different case; click to see them";
        km.addEventListener("click", function (ev) { ev.stopPropagation(); select({ kind: kindOfState(v) }); });
      }
      // A co-cause is linked: its step is the one it joins (profile 1.4).
      if (isStart(s) && !M.steps.some(function (x) { return (x.from === v || (x.jointly || []).indexOf(v) >= 0) && x.layer === "text"; }))
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
    if (selected.system != null) {
      var F = SYS[selected.system], inF = {};
      F.states.forEach(function (v) { inF[v] = true; });
      return { nodes: inF, edge: function (e) { return e.layer === "text" && e.kind === "step" && inF[e.from] && inF[e.to]; } };
    }
    if (selected.kind) {
      var inK = {};
      M.ids.forEach(function (v) { if (kindOfState(v) === selected.kind) inK[v] = true; });
      return { nodes: inK, edge: function () { return false; } };
    }
    if (selected.cycle) {
      var L = selected.cycle, hops = {}, ln = {};
      L.states.forEach(function (v, i) { ln[v] = true; hops[v + "\u0000" + L.states[(i + 1) % L.states.length]] = true; });
      return { nodes: ln, edge: function (e) { return e.layer === "text" && e.kind === "step" && !!hops[e.from + "\u0000" + e.to]; } };
    }
    if (selected.edge) {
      var k = {}; k[selected.edge.from] = k[selected.edge.to] = true;
      selected.edge.jointly.forEach(function (j) { k[j] = true; });
      return { nodes: k, edge: function (e) { return e.key === selected.edge.key; } };
    }
    var v = selected.state, up = {}, down = {};
    var walk = function (seed, dir, into) {
      var stack = [seed];
      while (stack.length) {
        var x = stack.pop();
        vis.forEach(function (e) {
          [e.from].concat(e.jointly).forEach(function (src) {
            var from = dir > 0 ? src : e.to, to = dir > 0 ? e.to : src;
            if (from === x && !into[to] && to !== v) { into[to] = true; stack.push(to); }
          });
        });
      }
    };
    walk(v, 1, down); walk(v, -1, up);
    var nodes = {}; nodes[v] = true;
    Object.keys(up).forEach(function (x) { nodes[x] = true; });
    Object.keys(down).forEach(function (x) { nodes[x] = true; });
    return { nodes: nodes, edge: function (e) {
      return [e.from].concat(e.jointly).some(function (src) {
        return (up[src] && (up[e.to] || e.to === v)) || ((src === v || down[src]) && down[e.to]); });
    } };
  }
  function applyFocus() {
    var f = focusSets(), lit = {};
    drawnEdges.forEach(function (d) {
      var on = !f || f.edge(d.e);
      d.g.classList.toggle("dim", !on); d.chip.classList.toggle("dim", !on);
      if (on) { lit[d.e.from] = lit[d.e.to] = true; d.e.jointly.forEach(function (j) { lit[j] = true; }); }
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
      ((s.jointly || []).length ? " · <b>only together with</b> " + s.jointly.map(function (j) { return esc(obj(FULL.states[j]).label || j); }).join(" and ") : "") +
      (s.supports ? " · " + s.supports + " supporting claim" + (s.supports === 1 ? "" : "s") + " in the map" : "");
    if (s.partFrom) meta += ' · inside the boxes: ' + esc(obj(FULL.states[s.partFrom]).label || s.partFrom) + ' → ' +
      esc(obj(FULL.states[s.partTo]).label || s.partTo);
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
    var ink = {}, fid = {}, tier = {}, isNull = false, joint = false;
    G.edges.forEach(function (e) {
      if (e.layer !== "text" && !layers[e.layer]) return;
      if (e.stems.length) joint = true;
      ink[e.ink] = true; fid[e.fidelity] = true; if (e.kind === "null") isNull = true; else tier[e.tier] = true;
    });
    var line = function (color, width, dash, cap) {
      return '<svg width="46" height="12" aria-hidden="true"><line x1="2" y1="6" x2="' + (cap ? 40 : 44) + '" y2="6" stroke="' + color +
        '" stroke-width="' + width + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>' +
        (cap ? '<rect x="40" y="0" width="3" height="12" fill="' + color + '"/>' : '') + '</svg>';
    };
    var row = function (svg, text) { return '<div>' + svg + '<span>' + esc(text) + '</span></div>'; };
    var out = '<div class="amech-legend"><div class="g">Weight: what the text offers for the step</div>';
    [["evidence", "tested: a study, statistics or a model"], ["argued", "argued for in the text"],
     ["asserted", "asserted only"], ["imputed", "supplied by the reconstructor"]].forEach(function (r) {
      if (tier[r[0]]) out += row(line("var(--mv-text)", TIER_WIDTH[r[0]], ""), r[1]);
    });
    out += '<div class="g">Pattern: how close its claims stand to the words, as on every box</div>';
    FIDELITY.forEach(function (f) { if (fid[f]) out += row(line("var(--mv-text)", 2, FIDELITY_DASH[f]), f); });
    out += '<div class="g">Colour: whose step, and what kind</div>';
    [["text", "the text’s own"], ["rival", "a rival view the text reports"], ["appraisal", "the reconstructor’s appraisal"],
     ["selection", "selection: who ends up on each side, not an effect"]].forEach(function (r) {
      if (ink[r[0]]) out += row(line("var(--mv-" + r[0] + ")", 2, ""), r[1]);
    });
    if (isNull) out += row(line("var(--mv-text)", 1.4, "", true), "no effect found: nothing passes");
    if (joint) out += row('<svg width="46" height="16" aria-hidden="true"><path d="M2,14 C14,14 20,8 24,8" fill="none" stroke="var(--mv-text)" stroke-width="2"/>' +
      '<line x1="2" y1="8" x2="44" y2="8" stroke="var(--mv-text)" stroke-width="2"/><line x1="24" y1="1" x2="24" y2="15" stroke="var(--mv-text)" stroke-width="4"/></svg>',
      "a stem to a bar: the step holds only together with that state");
    return out + '</div>';
  }
  /** A route through folded states: the states it passes, what it adds up to, and each step's
   *  own claims -- so folding never hides what the text actually says. */
  function stepHTML(s) {
    if (!s.parts) return claimHTML(s);
    var names = [s.from].concat(s.via, [s.to]).map(function (v) { return esc(obj(M.states[v]).label || v); });
    return '<div class="amech-route"><div class="t">' + names.join(" → ") + '</div>' +
      '<div class="m"><span class="amech-pill">' + esc(signWord(s.sign ? [s.sign] : [])) + '</span>' +
      'backed as its weakest step: ' + esc(s.tier === "evidence" ? "tested" : s.tier) + ' · as far from the words as its most distant claim: ' +
      esc(s.fidelity) + '</div>' + s.parts.map(claimHTML).join("") + '</div>';
  }
  function foldedHTML() {
    if (!G.folded.length) return "";
    var H = G.hidden, notes = [];
    if (H.findings) notes.push(H.findings + " finding" + (H.findings === 1 ? "" : "s") + " of no effect or selection touching a folded state");
    if (H.loops) notes.push(H.loops + " loop" + (H.loops === 1 ? "" : "s") + " that folding would close on one state");
    if (H.crossLayer) notes.push(H.crossLayer + " pair" + (H.crossLayer === 1 ? "" : "s") + " of steps from different voices, never joined");
    if (H.stranded) notes.push(H.stranded + " step" + (H.stranded === 1 ? "" : "s") + " running into or out of a folded state and no further in the same voice");
    var aside = G.noLine ? '<div class="amech-q" style="margin:4px 0 6px">No route in the text runs from the intervention to an outcome, so nothing is set aside: the states between are folded, and the rest stays drawn.</div>'
              : G.ends ? '<div class="amech-q" style="margin:4px 0 6px">Showing only the intervention’s routes to the outcomes.' +
      (G.setAside.length ? ' Set aside: ' + esc(G.setAside.map(function (v) { return obj(M.states[v]).label || v; }).join("; ")) + '.' : '') +
      (G.offMain ? ' ' + G.offMain + ' route' + (G.offMain === 1 ? '' : 's') + ' off that line not drawn.' : '') + '</div>' : '';
    return '<h3>Folded</h3>' + aside + '<div class="amech-fold">' + G.folded.map(function (v) {
        return '<button type="button" data-unfold="' + esc(v) + '" title="Unfold">' + esc(obj(M.states[v]).label || v) + ' ✕</button>'; }).join("") +
      '<button type="button" data-unfold="*">Unfold all</button></div>' +
      (notes.length ? '<div class="amech-q">Not drawn while folded: ' + esc(notes.join("; ")) + '.</div>' : '');
  }
  function profileHTML() {
    var P = M.profile, T = P.tiers, tot = 0;
    TIERS.forEach(function (t) { tot += T[t]; });
    tot = tot || 1;
    var label = function (i) { return obj(M.states[i]).label || i; };
    // Each loop is a button that shows it alone.
    var loopText = (LOOPS.length || SYS.length) ? SYS.map(function (f, i) {
        return '<button type="button" class="amech-loop" data-system="' + i + '">⟳' + sysName(i) + ' a feedback system: ' +
          f.states.length + ' states, ' + f.loops + (f.capped ? '+' : '') + ' loops</button>'; }).join("") +
      LOOPS.map(function (l, i) {
        return '<button type="button" class="amech-loop" data-loop="' + i + '">↻' + (LOOPS.length > 1 ? (i + 1) : "") + ' ' +
          esc(l.states.concat(l.states[0]).map(label).join(" → ")) + (l.reflexive ? ' <i>(reflexive)</i>' : '') + '</button>'; }).join("")
                                       : "none closed in the text";
    var gapText = function (g) {
      var s = g.state ? "“" + label(g.state) + "”" : "";
      return g.kind === "unlinked-intervention" ? "The intervention " + s + " has no link in the text: nothing says how it brings about anything."
           : g.kind === "unreached-outcome" ? s + " is not reached by the text’s links from where its chain starts."
           : s + " leads nowhere in the text: the chain stops there.";
    };
    var boxesNote = M.collapsed ? '<div class="amech-focus">Showing the text’s own boxes: ' + M.collapsed.parts + ' state' +
      (M.collapsed.parts === 1 ? '' : 's') + ' drawn inside ' + M.collapsed.wholes + ' of them' +
      (M.collapsed.inside ? '; ' + M.collapsed.inside + ' step' + (M.collapsed.inside === 1 ? '' : 's') + ' between parts of one box not drawn' : '') +
      '. <b>Show every state</b> draws each apart; the counts below are of what is drawn.</div>' : '';
    var chainNote = M.chain ? '<div class="amech-focus">One of the text’s ' + CHAINS.length + ' chains: <b>' + esc(M.chain.label) + '</b>.' +
      (Object.keys(M.chain.shared).length ? ' It shares ' + Object.keys(M.chain.shared).map(function (v) {
        return '“' + esc(label(v)) + '” with ' + M.chain.shared[v].map(function (o) {
          var x = CHAINS.filter(function (c) { return c.id === o; })[0]; return '“' + esc(x && x.label || o) + '”'; }).join(" and "); }).join("; ") +
        ' (⇄ on the state opens the other).' : ' It shares no state with another chain.') + '</div>' : '';
    return chainNote + boxesNote + foldedHTML() + '<h3>The chain</h3>' +
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
      '×n: claims behind one arrow. ◇: conditions stated. ↻: closes a loop. “via”: a route through folded states. ' +
      'Click a state to see only the paths through it, or to fold it into its arrows.</div>' +
      (M.dropped ? '<div class="amech-q" style="color:var(--mv-gap)">' + M.dropped + ' step(s) name an undeclared state and are not drawn; the checker names them.</div>' : '');
  }
  function renderSide() {
    if (selected && selected.edge) {
      var e = selected.edge;
      side.innerHTML = '<h3>' + esc(obj(M.states[e.from]).label || e.from) + ' → ' + esc(obj(M.states[e.to]).label || e.to) + '</h3>' +
        (e.mixed ? e.breakdown.map(function (b) {
            return '<h3>' + esc(b.word) + ' (' + b.count + ')</h3>' + e.steps.filter(function (x) {
              return (x.isNull ? "no effect" : x.selects ? "selection" : signWord(x.sign ? [x.sign] : [])) === b.word;
            }).map(stepHTML).join("");
          }).join("") : e.steps.map(stepHTML).join("")) +
        // OFF MEANS OFF IN THE PANEL TOO: the appraisal's view of a text step is named only while
        // the layer is on.
        (layers.appraisal ? appraisalNotes(e) : '') +
        '<h3>&nbsp;</h3><button type="button" data-back="1">Back to the chain</button>';
    } else if (selected && selected.kind) {
      var K = KINDS.filter(function (x) { return x.id === selected.kind; })[0];
      var touches = function (pr) {
        return [pr[0][0], pr[0][1], pr[1][0], pr[1][1]].some(function (v) { return kindOfState(v) === selected.kind; }); };
      var akin = (FULL.profile.akin_steps || []).filter(touches), inst = (FULL.profile.instances || []).filter(touches);
      var nm = function (v) { return esc(obj(FULL.states[v]).label || v); };
      side.innerHTML = '<h3>' + esc(K.label || K.id) + '</h3>' +
        '<div class="amech-focus">' + K.states.length + ' states of one kind: ' +
        (K.general ? 'a general state and its cases' : 'the same kind of thing in different cases') +
        ', not one state. The text never joins them, so no route runs from one to another.</div>' +
        K.states.filter(function (v) { return !!G.nodes[v]; }).concat(K.states.filter(function (v) { return !G.nodes[v]; })).map(function (v) {
          var cs = chainsOfState(v), here = !!G.nodes[v];
          return '<div class="amech-row"><span class="k">' + (K.general ? (K.general === v ? '<b>general</b>' : 'a case') : (here ? 'shown' : 'elsewhere')) +
            '</span><span>' + nm(v) +
            (cs.length ? ' <span class="amech-q">(' + cs.map(function (c) { return esc(chainLabel(c)); }).join(", ") + ')</span>' : '') +
            (!here && cs.length ? ' <button type="button" data-open-chain="' + esc(cs[0]) + '" data-open-state="' + esc(v) + '">Open ' +
              esc(chainLabel(cs[0])) + '</button>' : '') + '</span></div>'; }).join("") +
        (inst.length ? '<h3>The general step, and its cases</h3>' + inst.map(function (pr) {
          return '<div class="amech-q">' + nm(pr[1][0]) + ' → ' + nm(pr[1][1]) + ' is a case of ' + nm(pr[0][0]) + ' → ' + nm(pr[0][1]) + '</div>'; }).join("") : '') +
        (akin.length ? '<h3>The same step in two cases</h3>' + akin.map(function (pr) {
          return '<div class="amech-q">' + nm(pr[0][0]) + ' → ' + nm(pr[0][1]) + ' ≈ ' + nm(pr[1][0]) + ' → ' + nm(pr[1][1]) + '</div>'; }).join("") : '') +
        '<h3>&nbsp;</h3><button type="button" data-back="1">Show the whole chain</button>';
    } else if (selected && selected.system != null) {
      var F = SYS[selected.system];
      side.innerHTML = '<h3>Feedback system ' + sysName(selected.system) + '</h3>' +
        '<div class="amech-focus">' + F.states.length + ' states, each reachable from every other: ' + F.loops +
        (F.capped ? ' or more' : '') + ' loops run through them. Too many to follow one by one, so the system is shown ' +
        'whole; its shortest loops are below, each shown alone on a click.</div>' +
        '<h3>Its shortest loops</h3>' + F.shortest.map(function (l, j) {
          return '<button type="button" class="amech-loop" data-sys="' + selected.system + '" data-short="' + j + '">' +
            esc(loopNames(l)) + (l.reflexive ? ' <i>(reflexive)</i>' : '') + '</button>'; }).join("") +
        '<h3>Its states</h3><div class="amech-q">' + F.states.map(function (v) { return esc(obj(M.states[v]).label || v); }).join(" · ") + '</div>' +
        '<h3>&nbsp;</h3><button type="button" data-back="1">Show the whole chain</button>';
    } else if (selected && selected.cycle) {
      var L = selected.cycle;
      var hopEdges = L.states.map(function (v, i) {
        var w = L.states[(i + 1) % L.states.length];
        return G.edges.filter(function (e) { return e.layer === "text" && e.kind === "step" && e.from === v && e.to === w; });
      });
      side.innerHTML = '<h3>' + esc(selected.name || "Loop") + '</h3>' +
        '<div class="amech-focus">Showing one loop the text closes: ' + esc(loopNames(L)) + '.' +
        (L.reflexive ? ' It is <b>reflexive</b>: it runs through a belief, a prediction or a classification that the loop itself acts on.' : '') +
        '</div>' +
        hopEdges.map(function (es) { return es.map(function (e) { return e.steps.map(stepHTML).join(""); }).join(""); }).join("") +
        '<h3>&nbsp;</h3><button type="button" data-back="1">Show the whole chain</button>';
    } else if (selected && selected.state) {
      var s = obj(M.states[selected.state]), a = obj(M.actors[s.actor]);
      side.innerHTML = '<h3>' + esc(s.label || selected.state) + '</h3>' +
        '<div class="amech-focus">Showing only the paths through this state: what leads to it, and what it leads to.</div>' +
        '<div class="amech-row"><span class="k">actor</span><span>' + esc(a.label || s.actor || "") + (a.level ? ' (' + esc(a.level) + ')' : '') + '</span></div>' +
        (rolesOf(s).length ? '<div class="amech-row"><span class="k">role</span><span>' + esc(rolesOf(s).join(", ")) + '</span></div>' : '') +
        (function () {
          var parts = FULL.profile.wholes.filter(function (w) { return w[0] === selected.state; })[0];
          var whole = obj(FULL.states[selected.state]).part_of;
          return (parts ? '<div class="amech-row"><span class="k">made of</span><span>' + parts[1].map(function (v) {
                    return esc(obj(FULL.states[v]).label || v); }).join("; ") + '</span></div>' : '') +
                 (whole != null && has(FULL.states, whole) ? '<div class="amech-row"><span class="k">part of</span><span>' +
                    esc(obj(FULL.states[whole]).label || whole) + '</span></div>' : '');
        })() +
        (kinOf(selected.state).length ? '<div class="amech-row"><span class="k">kind</span><span><button type="button" data-kind-show="' +
          esc(kindOfState(selected.state)) + '">' + esc((KINDS.filter(function (x) { return x.id === kindOfState(selected.state); })[0] || {}).label || kindOfState(selected.state)) +
          '</button> <span class="amech-q">' + (generalOfKind(kindOfState(selected.state)) === selected.state ? 'the general, with ' + kinOf(selected.state).length + ' case' + (kinOf(selected.state).length === 1 ? '' : 's')
            : generalOfKind(kindOfState(selected.state)) ? 'a case of the general “' + esc(obj(FULL.states[generalOfKind(kindOfState(selected.state))]).label || '') + '”'
            : 'with ' + kinOf(selected.state).length + ' other state' + (kinOf(selected.state).length === 1 ? '' : 's')) + '</span></span></div>' : '') +
        (s.measured ? '<div class="amech-row"><span class="k">measured</span><span>' + esc(s.measured) + '</span></div>' : '') +
        // WHICH OF THE TEXT'S WORDS WERE READ AS THIS ONE STATE: the decision two annotators most
        // often make differently (mechanism-pass.md), so the reader is shown it.
        (s.note ? '<div class="amech-row"><span class="k">note</span><span>' + esc(s.note) + '</span></div>' : '') +
        (s.appraisal ? '<div class="amech-row"><span class="k">layer</span><span>the reconstructor’s appraisal: not in the text</span></div>' : '') +
        (canFold.indexOf(selected.state) >= 0 ? '<div class="amech-state-act"><button type="button" data-fold="' + esc(selected.state) +
          '">Fold into its arrows</button> <span class="amech-q">draws what leads in and what leads out as routes through it</span></div>' : '') +
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
    var lp = t.closest ? t.closest("[data-loop]") : null;
    if (lp) { var li2 = +lp.getAttribute("data-loop"); select({ cycle: LOOPS[li2], name: "Loop " + (li2 + 1) }); return; }
    var sp = t.closest ? t.closest("[data-short]") : null;
    if (sp) { var fi2 = +sp.getAttribute("data-sys");
      select({ cycle: SYS[fi2].shortest[+sp.getAttribute("data-short")], name: "A loop in feedback system " + sysName(fi2) }); return; }
    var oc = t.getAttribute && t.getAttribute("data-open-chain");
    if (oc) { keep.chain = oc; keep.then = { state: t.getAttribute("data-open-state") }; remount(); return; }
    var ks = t.getAttribute && t.getAttribute("data-kind-show");
    if (ks) { select({ kind: ks }); return; }
    var sy = t.closest ? t.closest("[data-system]") : null;
    if (sy) { select({ system: +sy.getAttribute("data-system") }); return; }
    var fv = t.getAttribute && t.getAttribute("data-fold"), uv = t.getAttribute && t.getAttribute("data-unfold");
    if (fv) { setFolded(fv, true); return; }
    if (uv) { if (uv === "*") { folded = {}; ends = false; } else setFolded(uv, false); refold(); return; }
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
    inp.addEventListener("change", function () {
      layers[inp.getAttribute("data-layer")] = inp.checked; keep[inp.getAttribute("data-layer")] = inp.checked; apply(); });
  });
  var boxesBtn = /** @type {HTMLElement|null} */ (bar.querySelector("[data-boxes]"));
  if (boxesBtn) boxesBtn.addEventListener("click", function () { keep.boxes = !keep.boxes; remount(); });
  var chainSel = /** @type {HTMLSelectElement|null} */ (bar.querySelector("select[data-chain]"));
  if (chainSel) chainSel.addEventListener("change", function () { keep.chain = chainSel.value || null; remount(); });
  var foldAll = /** @type {HTMLElement|null} */ (bar.querySelector("[data-foldall]"));
  function refold() {
    if (!Object.keys(folded).length) ends = false;
    G = layout(M, { folded: folded, ends: ends });
    selected = null;
    if (foldAll) foldAll.textContent = G.folded.length ? "Show the whole chain" : endsLabel;
    apply();
  }
  function setFolded(v, on) { if (on) folded[v] = true; else delete folded[v]; refold(); }
  if (foldAll) foldAll.addEventListener("click", function () {
    if (G.folded.length) { folded = {}; ends = false; }
    else { toEnds.forEach(function (v) { folded[v] = true; }); ends = true; }
    refold();
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
    model: M,
    get geometry() { return G; },
    setLayer: function (name, on) {
      layers[name] = !!on;
      var inp = /** @type {HTMLInputElement|null} */ (bar.querySelector('input[data-layer="' + name + '"]'));
      if (inp) inp.checked = !!on;
      apply();
    },
    getLayers: function () { return { rival: layers.rival, appraisal: layers.appraisal }; },
    setShow: function (v) { show = v === "tested" ? "tested" : "all"; if (showSel) showSel.value = show; apply(); },
    setFolded: function (list) { folded = {}; (list || []).forEach(function (v) { folded[v] = true; }); refold(); },
    getFolded: function () { return G.folded.slice(); },
    select: function (x) { if (x && (x.kind || (x.state && G.nodes[x.state]))) select(x); }
  };
  }
}

var API = { model: model, layout: layout, create: create, foldable: foldable, collapseModel: collapseModel, chainModel: chainModel, TIERS: TIERS, BASES: BASES,
            FIDELITY: FIDELITY, FIDELITY_DASH: FIDELITY_DASH };
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (global) /** @type {any} */ (global).ArgdownMechanism = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
