/* argdown-accounts.js — accounts against evidence, and claims that cannot all hold.
 *
 * James's go, 18 Oct 2026 (the follow-up to the Mechanism think piece, "structures to do things
 * with": the table as the next form, judged by what a reader can do with it). Two structures the
 * Reasons view already records, set out so that a reader can ask a question of them and check it:
 *
 *  - ACCOUNTS AGAINST EVIDENCE. Where the text reports a rival account (#reported or #contested)
 *    and sets it against one of its own, the reasons the map gives for or against each, as a table:
 *    one row a reason, one column an account. A row TELLS THEM APART where it bears on two accounts
 *    differently; it bears on them ALIKE where it bears on both the same way; and where it bears on
 *    one only, the text does not say what the other would make of it -- which is the reader's to
 *    ask (Henne's framing question), and the commonest case: of 98 such pairs across the corpus on
 *    18 Oct 2026, 15 shared any reason. Direct reasons only: a reason for a reason is not a row.
 *  - A SET THAT CANNOT ALL HOLD. Claims the map marks `inconsistent: <name>` (a trilemma, an aporia,
 *    a trade-off), and each contradictory or contrary pair the map draws. Which to give up is the
 *    reader's; what each costs the rest of the argument the page works out with argdown-suppose.js.
 *
 * Pure: a graph in (argdown-graph.mjs's toGraph), tables out. Report, not evaluate: nothing here says
 * which account is better. View-only, so there is no Python twin.
 */
(function (global) {
"use strict";

var ATTACKS = ["attack", "undercut", "contradictory", "contrary"];
function isAppraisal(n) { return (n.tags || []).indexOf("appraisal") >= 0; }
function isRival(n) { return (n.tags || []).some(function (t) { return t === "reported" || t === "contested"; }); }
function byOrder(byId) { return function (a, b) { var x = byId[a], y = byId[b];
  return (x.docLine || 0) - (y.docLine || 0) || String(x.label).localeCompare(String(y.label)); }; }

function nodesOf(graph, opts) {
  var byId = {};
  ((graph && graph.nodes) || []).forEach(function (n) {
    if (n.kind !== "statement" && n.kind !== "argument") return;
    if (!(opts && opts.appraisal) && isAppraisal(n)) return;
    byId[n.id] = n;
  });
  return byId;
}

/** The accounts the text sets against each other, with the reasons that bear on them. Returns
 *  [{ id, accounts: [{ id, label, own }], rows: [{ id, label, cells: { account: "for" | "against" },
 *     kind: "apart" | "alike" | "one" }], between: [{ from, to, type }] }], one per account of the
 *  text's own that a rival is set against (its rivals beside it), in the order of the file. */
function accountSets(graph, opts) {
  var byId = nodesOf(graph, opts), edges = ((graph && graph.edges) || []).filter(function (e) { return byId[e.from] && byId[e.to]; });
  // WHICH CLAIM A RIVAL IS SET AGAINST: the one it attacks. A claim of the text's that attacks a rival
  // is the text's reason against it -- a row, not an account -- unless the rival attacks nothing of the
  // text's and that claim has reasons of its own: then it is the account the text answers it with.
  var rivalsOf = {}, between = {}, paired = {};
  var pair = function (own, rival, e) {
    var l = rivalsOf[own] = rivalsOf[own] || [];
    if (l.indexOf(rival) < 0) l.push(rival);
    paired[rival] = true;
    (between[own] = between[own] || []).push({ from: e.from, to: e.to, type: e.type });
  };
  var supported = {};
  edges.forEach(function (e) { if (e.type === "support") supported[e.to] = true; });
  edges.forEach(function (e) {
    if (ATTACKS.indexOf(e.type) >= 0 && isRival(byId[e.from]) && !isRival(byId[e.to])) pair(e.to, e.from, e);
  });
  edges.forEach(function (e) {
    if (ATTACKS.indexOf(e.type) < 0 || isRival(byId[e.from]) || !isRival(byId[e.to])) return;
    if (rivalsOf[e.from] && rivalsOf[e.from].indexOf(e.to) >= 0) { between[e.from].push({ from: e.from, to: e.to, type: e.type }); return; }
    if (!paired[e.to] && supported[e.from]) pair(e.from, e.to, e);
  });
  return Object.keys(rivalsOf).sort(byOrder(byId)).map(function (own) {
    var accs = [own].concat(rivalsOf[own].sort(byOrder(byId)));
    var isAcc = {}; accs.forEach(function (a) { isAcc[a] = true; });
    var cells = {};
    edges.forEach(function (e) {
      if (!isAcc[e.to] || isAcc[e.from]) return;
      var v = e.type === "support" ? "for" : ATTACKS.indexOf(e.type) >= 0 ? "against" : null;
      if (!v) return;
      var c = cells[e.from] = cells[e.from] || {};
      // A reason both for and against one account (two relations drawn) is said as it is drawn.
      c[e.to] = c[e.to] && c[e.to] !== v ? "both" : v;
    });
    var rows = Object.keys(cells).sort(byOrder(byId)).map(function (x) {
      var vals = accs.filter(function (a) { return cells[x][a]; }).map(function (a) { return cells[x][a]; });
      var kind = vals.length < 2 ? "one" : vals.every(function (v) { return v === vals[0] && v !== "both"; }) ? "alike" : "apart";
      return { id: x, label: byId[x].label, cells: cells[x], kind: kind };
    });
    return { id: own, accounts: accs.map(function (a) { return { id: a, label: byId[a].label, own: a === own }; }),
             rows: rows, between: between[own] };
  });
}

/** Sets of claims that cannot all hold: those the map names with `inconsistent:`, and each
 *  contradictory or contrary pair it draws between two statements not already in one named set.
 *  Returns [{ name, members: [id], declared, type }]. */
function inconsistentSets(graph, opts) {
  var byId = nodesOf(graph, opts), named = {}, order = [];
  Object.keys(byId).forEach(function (id) {
    (byId[id].inconsistent || []).forEach(function (nm) {
      if (!named[nm]) { named[nm] = []; order.push(nm); }
      if (named[nm].indexOf(id) < 0) named[nm].push(id);
    });
  });
  var out = order.filter(function (nm) { return named[nm].length > 1; })
    .map(function (nm) { return { name: nm, members: named[nm].sort(byOrder(byId)), declared: true, type: "set" }; });
  var inSet = function (a, b) { return out.some(function (s) { return s.members.indexOf(a) >= 0 && s.members.indexOf(b) >= 0; }); };
  var seen = {};
  ((graph && graph.edges) || []).forEach(function (e) {
    if ((e.type !== "contradictory" && e.type !== "contrary") || !byId[e.from] || !byId[e.to]) return;
    if (byId[e.from].kind !== "statement" || byId[e.to].kind !== "statement") return;
    var k = [e.from, e.to].sort().join("|");
    if (seen[k] || inSet(e.from, e.to)) return;
    seen[k] = true;
    out.push({ name: null, members: [e.from, e.to].sort(byOrder(byId)), declared: false, type: e.type });
  });
  return out;
}

/** The sets (of either kind) a node is in, as indices into the list given. */
function containing(list, id, key) {
  var out = [];
  (list || []).forEach(function (s, i) {
    var ids = key === "accounts" ? s.accounts.map(function (a) { return a.id; }) : s.members;
    if (ids.indexOf(id) >= 0) out.push(i);
  });
  return out;
}

var API = { accountSets: accountSets, inconsistentSets: inconsistentSets, containing: containing };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownAccounts = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
