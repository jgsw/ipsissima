/* argdown-diagnostics.js — where to look: the places a map shows its argument is thin by its own lights.
 *
 * James, 19 Nov 2026, on the appraisal plan (OneDrive "Appraisal on request/APPRAISAL-PLAN.md", and
 * the appraisal trial it rests on): "Let's try including the computed diagnostics unasked. I can see
 * if they seem useful and/or if they seem to overstep too far into evaluation." So this is a TRIAL of
 * offering them unasked, and every item is worded as a fact about the map, never a verdict on the
 * text: "the map records no reply to it", not "the author fails to answer it".
 *
 * WHY THEY EXIST. The trial found that a map does not make an appraiser find stronger objections, and
 * that declaring a text's comparisons and mechanism did not prompt any critique of them (comparisons
 * were assessed slightly WORSE with the map). What a map can do that a reading cannot is compute the
 * questions -- which claim the most rests on, which concession is never answered, which causal step
 * is only asserted, which rival accounts no reason tells apart -- and put them in front of the reader
 * or the appraiser. That is this module.
 *
 * ONE IMPLEMENTATION, TWO HOSTS. The page's "Where to look" panel calls it, and so does the MCP
 * server's `argdown_audit`, through the bundled parser (argdown-shim.src.mjs, command `audit`), so
 * the two can never disagree. It is built from the page's own modules -- Study's cost measure,
 * ArgdownSuppose, ArgdownAccounts, ArgdownMechanism, ArgdownTables -- passed in as `deps`, or found
 * on the global object in the page.
 *
 * Pure: a graph in (argdown-graph.mjs's toGraph), a list out:
 *   [{ kind: "argument"|"mechanism"|"comparison", check, says, ids: [nodeId], titles: [title] }]
 * The appraisal layer is left out unless `opts.appraisal`; diagnostics are about the author's map.
 */
(function (global) {
"use strict";

function isAppraisal(n) { return (n.tags || []).indexOf("appraisal") >= 0; }
function hasTag(n, t) { return (n.tags || []).indexOf(t) >= 0; }
function isRival(n) { return hasTag(n, "reported") || hasTag(n, "contested"); }
var ATTACKS = ["attack", "undercut", "contradictory", "contrary"];
function q(s) { return "‹" + s + "›"; }
function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }

function depsOf(opts) {
  var d = (opts && opts.deps) || {};
  var G = /** @type {any} */ (global || {});
  return { suppose: d.suppose || G.ArgdownSuppose || null, accounts: d.accounts || G.ArgdownAccounts || null,
           mechanism: d.mechanism || G.ArgdownMechanism || null, tables: d.tables || G.ArgdownTables || null };
}

/** The author's nodes, by id: the appraisal layer left out unless asked for. */
function authorNodes(graph, opts) {
  var byId = {};
  ((graph && graph.nodes) || []).forEach(function (n) {
    if (!(opts && opts.appraisal) && isAppraisal(n)) return;
    byId[n.id] = n;
  });
  return byId;
}

/* ---- the cost measure, Study's own (moved here 19 Nov 2026 so Study and this agree) ---------- */

/** The map's main claims: its contentions, and every statement that has support and supports nothing.
 *  Never an appraisal claim, whatever the switch: the appraisal has no main claims of the author's. */
function mains(graph, opts) {
  var byId = authorNodes(graph, {});
  var outSup = {}, inSup = {};
  ((graph && graph.edges) || []).forEach(function (e) {
    if (e.type !== "support" || !byId[e.from] || !byId[e.to]) return;
    outSup[e.from] = true; inSup[e.to] = true;
  });
  var out = {};
  Object.keys(byId).forEach(function (id) { var n = byId[id]; if (n.kind === "statement" && inSup[id] && !outSup[id]) out[id] = true; });
  ((graph && graph.contentions) || []).forEach(function (id) { if (id) out[id] = true; });
  return out;
}

/** What supposing one statement false costs: how many claims lose the map's support, main claims among them. */
function claimCost(graph, n, mainSet, opts, S, index) {
  var r = S.suppose(graph || {}, { "false": [n.id], holds: [], cut: [], choice: {}, keep: [] },
                    { appraisal: !!(opts && opts.appraisal), index: index });
  var lost = r.lost.filter(function (x) { return x.indexOf("#") < 0; });
  var lostMains = lost.filter(function (x) { return mainSet[x]; });
  return { id: n.id, label: n.label, lost: lost.length, mains: lostMains.length, mainIds: lostMains, lostIds: lost };
}

/** Every statement beneath a main claim, costliest first: main claims taken, then claims lost. */
function costRank(graph, opts) {
  var S = depsOf(opts).suppose;
  if (!S) return [];
  // CANDIDATES ARE THE AUTHOR'S CLAIMS ALONE, as in Study; the switch only lets the appraisal's
  // relations count in what supposing a claim false takes with it.
  var byId = authorNodes(graph, {}), mainSet = mains(graph, opts);
  var ix = S.index ? S.index(graph, { appraisal: !!(opts && opts.appraisal) }) : null;  // built once, shared
  var out = [];
  Object.keys(byId).forEach(function (id) {
    var n = byId[id];
    if (n.kind !== "statement" || mainSet[id]) return;
    out.push(claimCost(graph, n, mainSet, opts, S, ix));
  });
  out.sort(function (a, b) { return b.mains - a.mains || b.lost - a.lost || String(a.label).localeCompare(String(b.label)); });
  return out;
}

/* ---- the argument ------------------------------------------------------------------------------ */

function restsOn(graph, opts, byId) {
  var R = costRank(graph, opts).filter(function (x) { return x.mains > 0 || x.lost >= 2; });
  if (!R.length) return [];
  var top = R[0], level = R.filter(function (x) { return x.mains === top.mains && x.lost === top.lost; });
  var pick = (level.length > 3 ? level : R).slice(0, 3);
  return pick.map(function (x) {
    return { kind: "argument", check: "rests-on", ids: [x.id], titles: [x.label],
             says: "If " + q(x.label) + " were false, " + plural(x.lost, "claim") + " would lose the map’s support" +
                   (x.mains ? ", " + (x.mains === 1 ? "a main claim" : x.mains + " main claims") + " among them." : ".") };
  });
}

/** Premises the reconstruction had to supply, on which something the author asserts depends. */
function unstated(graph, opts, byId) {
  var feeds = {};
  ((graph && graph.edges) || []).forEach(function (e) {
    if (byId[e.from] && byId[e.to] && (e.type === "support" || e.type === "premise")) feeds[e.from] = true;
  });
  return Object.keys(byId).filter(function (id) {
    var n = byId[id];
    return n.kind === "statement" && n.fidelity === "imputation" && !isRival(n) && feeds[id];
  }).map(function (id) {
    var n = byId[id];
    return { kind: "argument", check: "unstated", ids: [id], titles: [n.label],
             says: "The text does not state " + q(n.label) + "; the reconstruction supplied it because the argument needs it" +
                   (n.warrant ? " (" + n.warrant + ")." : ".") };
  });
}

/** Is a node answered from the author's side (not a rival's, not the appraisal's)? Directly, or
 *  through what it feeds: an objection is usually answered where it lands. Enoch's challenge is met
 *  at its fifth premise, not at its conclusion, and Street's counterfactual is a reason for the
 *  "remaining miracle" worry that Enoch then answers. So: the node, or anything it supports or is a
 *  premise of, up to three steps on, attacked by a claim of the author's. */
function answered(graph, byId, id) {
  var edges = (graph && graph.edges) || [];
  var attacked = {};
  edges.forEach(function (e) {
    if (ATTACKS.indexOf(e.type) >= 0 && byId[e.from] && !isRival(byId[e.from])) attacked[e.to] = true;
  });
  var seen = {}, frontier = [id];
  for (var depth = 0; depth <= 3 && frontier.length; depth++) {
    var next = [];
    for (var i = 0; i < frontier.length; i++) {
      var x = frontier[i];
      if (seen[x]) continue; seen[x] = true;
      if (attacked[x]) return true;
      edges.forEach(function (e) {
        if (e.from === x && ATTACKS.indexOf(e.type) < 0 && byId[e.to]) next.push(e.to);
      });
    }
    frontier = next;
  }
  // AND UPSTREAM, ONE ARGUMENT DEEP: an objection that is the conclusion of an argument is answered
  // where that argument is undercut or one of its premises attacked (Enoch's challenge, at premise 5).
  return edges.some(function (e) {
    if (e.to !== id || e.type !== "support" || !byId[e.from] || byId[e.from].kind !== "argument") return false;
    var arg = e.from;
    return attacked[arg] || edges.some(function (p) { return p.to === arg && p.type === "support" && attacked[p.from]; });
  });
}

function unanswered(graph, opts, byId) {
  var out = [];
  Object.keys(byId).forEach(function (id) {
    var n = byId[id];
    if (hasTag(n, "conceded") && !answered(graph, byId, id))
      out.push({ kind: "argument", check: "conceded", ids: [id], titles: [n.label],
                 says: "The author grants " + q(n.label) + " against their own case, and the map records no reply to it." });
    else if (hasTag(n, "contested") && !answered(graph, byId, id))
      out.push({ kind: "argument", check: "objection", ids: [id], titles: [n.label],
                 says: "The text voices the objection " + q(n.label) + ", and the map records no reply to it." });
  });
  return out;
}

function inconsistent(graph, opts, byId) {
  var A = depsOf(opts).accounts;
  if (!A) return [];
  return A.inconsistentSets(graph, { appraisal: !!(opts && opts.appraisal) }).map(function (s) {
    var labels = s.members.map(function (m) { return (byId[m] || {}).label || m; });
    return { kind: "argument", check: "inconsistent", ids: s.members.slice(), titles: labels,
             says: (s.declared ? "The map marks these as not all holding" + (s.name ? " (" + s.name + ")" : "")
                               : "The map draws these as " + (s.type === "contrary" ? "contraries" : "contradictories")) +
                   ": " + labels.map(q).join(", ") + "." };
  });
}

/* ---- the mechanism ------------------------------------------------------------------------------ */

function mechanism(graph, opts, byId) {
  var MV = depsOf(opts).mechanism;
  if (!MV || !graph || !graph.mechanism) return [];
  var M = MV.model(graph);
  if (!M) return [];
  var out = [];
  var label = function (v) { var s = M.states[v]; return (s && s.label != null) ? String(s.label) : String(v); };
  var text = M.steps.filter(function (s) { return s.layer === "text" && !s.isNull && !s.selects && !s.assoc; });
  // ONE ITEM A STEP: asserted, put as a possibility, or both. Keyed by the step, not the claim, since
  // one claim may state several steps.
  var seen = {};
  text.forEach(function (s) {
    var asserted = s.tier === "asserted", hedged = !!s.hedged;
    if (!asserted && !hedged) return;
    var k = s.from + "\u0000" + s.to; if (seen[k]) return; seen[k] = true;
    var step = q(label(s.from)) + " to " + q(label(s.to));
    out.push({ kind: "mechanism", check: asserted ? (hedged ? "asserted-hedged" : "asserted") : "hedged",
               ids: s.claim.id ? [s.claim.id] : [], titles: [s.claim.title],
               says: asserted ? step + " is asserted" + (hedged ? ", and put as a possibility" : "") +
                                ": the map records neither an argument for this step nor evidence."
                              : "The text puts " + step + " as a possibility, not as happening." });
  });
  ((M.profile && M.profile.gaps) || []).forEach(function (g) {
    var msg = String(g && g.message != null ? g.message : g);
    // The chain's own messages name states by id, in back-ticks: the reader knows them by label.
    msg = msg.replace(/`([^`]+)`/g, function (_, id) { return M.states[id] ? q(label(id)) : id; });
    out.push({ kind: "mechanism", check: "gap", ids: [], titles: [], says: "In the chain: " + msg + (/[.!?]$/.test(msg) ? "" : ".") });
  });
  // A BRIDGE'S QUESTIONS that the map records nothing on: the scheme's own critical questions.
  if (MV.bridgeQuestions && MV.bridgeScheme) (graph.mechanism.inferences || []).forEach(function (inf) {
    var sch = MV.bridgeScheme(inf.rules || []);
    if (!sch) return;
    var qs = MV.bridgeQuestions(M, { argument: inf.argument, step: inf.step, scheme: sch.name, inputs: inf.inputs || [],
                                     draft: M.draft, taken: M.taken });
    var open = qs.filter(function (x) { return x.status !== "recorded"; });
    if (!open.length) return;
    var argNode = Object.keys(byId).map(function (id) { return byId[id]; })
      .filter(function (n) { return n.kind === "argument" && n.label === inf.argument; })[0];
    out.push({ kind: "mechanism", check: "bridge", ids: argNode ? [argNode.id] : [], titles: [inf.argument],
               says: q(inf.argument) + " is a causal move (" + sch.name + "). The map records nothing on: " +
                     open.map(function (x) { return x.question; }).join(" ") });
  });
  return out;
}

/* ---- the comparisons ------------------------------------------------------------------------------ */

function comparisons(graph, opts, byId) {
  var D = depsOf(opts), out = [];
  // DECLARED RIVAL ACCOUNTS ONLY. The derived sets the Weigh panel also shows are mostly a claim and
  // the objections set against it (James, 30 Oct: "a worry and its answer is not a set"), and saying
  // of a thesis and its objection that nothing "tells them apart" says nothing.
  if (D.accounts) D.accounts.accountSets(graph, { appraisal: !!(opts && opts.appraisal) }).forEach(function (s) {
    if (!s.declared) return;
    // A RIVAL THAT IS ONLY A DENIAL is not an account to tell apart (argdown-accounts.js, 19 Oct).
    var accs = (s.accounts || []).filter(function (a) { return !a.denial; });
    var rows = s.rows || [];
    var names = accs.map(function (a) { return a.label; });
    if (names.length < 2) return;
    if (!rows.some(function (r) { return r.kind === "apart"; }))
      out.push({ kind: "comparison", check: "not-told-apart", ids: accs.map(function (a) { return a.id; }), titles: names,
                 says: (s.label ? q(s.label) + ": " : "") +
                       (rows.length ? "no reason the map records bears on more than one of " + names.map(q).join(", ") +
                                      " differently. Each is argued for or against on its own, so the map does not say how each fares on the others\u2019 reasons."
                                    : "no reason the map records bears on " + names.map(q).join(", ") + ".") });
  });
  if (D.tables) D.tables.caseTables(graph).forEach(function (t) {
    var total = (t.rows || []).length * (t.columns || []).length;
    if (t.empty && t.empty.length && total)
      out.push({ kind: "comparison", check: "empty-cells", ids: [], titles: [t.label],
                 says: q(t.label) + ": the text places nothing in " + t.empty.length + " of its " + total + " cells." });
    var rowLabel = function (id) { var r = (t.rows || []).filter(function (x) { return x.id === id; })[0]; return r && r.label != null ? r.label : id; };
    (t.alike || []).forEach(function (p) {
      var a = rowLabel(p.a), b = rowLabel(p.b);
      out.push({ kind: "comparison", check: "alike-but-judged-apart", ids: [], titles: [t.label],
                 says: q(t.label) + ": " + q(a) + " and " + q(b) + " are alike on every dimension the text states, yet given different verdicts." });
    });
  });
  return out;
}

/** Everything, in reading order: the argument, then the mechanism, then the comparisons. */
function diagnose(graph, opts) {
  opts = opts || {};
  var byId = authorNodes(graph, opts);
  var parts = [restsOn, unstated, unanswered, inconsistent, mechanism, comparisons];
  var out = [];
  parts.forEach(function (f) {
    try { out = out.concat(f(graph, opts, byId)); }
    catch (e) { out.push({ kind: "note", check: "error", ids: [], titles: [], says: "One kind of diagnostic could not be computed: " + (e && e.message || e) }); }
  });
  return out;
}

var API = { diagnose: diagnose, costRank: costRank, mains: mains, claimCost: claimCost };
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (global) /** @type {any} */ (global).ArgdownDiagnostics = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
