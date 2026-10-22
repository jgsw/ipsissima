/* argdown-tables.js — the comparisons a text makes, set out as tables a reader can work.
 *
 * A trial, 20 Oct 2026 (ipsissima-mcp docs/tabulation-pass.md; the census "what twelve texts
 * compare"). A map records what supports what; `frames:` and `about:` record what each claim is
 * ABOUT -- which case, and what the text says of it on which dimension. From those this module
 * builds:
 *
 *  - CASE TABLES: one per `case` frame, its cases as rows and the dimensions (and verdict) the
 *    claims place them on as columns. Each cell holds the value(s) the text gives and the claims
 *    that give them. With the table come the moves a reader makes on it, worked out so the page can
 *    check a guess: the cells the text leaves empty; pairs of rows alike in every dimension but one
 *    (the method of difference); pairs alike in every stated dimension yet given different
 *    verdicts; rows that meet a stated rule and get another verdict (Gettier's
 *    cases against definition (a)); and, on dimensions the text ranks (`ordered`), a case worse on
 *    every count than another. Nothing is totalled and no empty cell is filled.
 *  - CROSS TABLES: where claims name two `case` frames at once (Bates's studies against the
 *    questions they answer), one frame's cases as rows and the other's as columns, the claims in
 *    the cells.
 *
 * Pure: a graph in (argdown-graph.mjs's toGraph, which carries `frames`), tables out. Report, not
 * evaluate. View-only, so there is no Python twin; the checker sizes the same tables in its census.
 */
(function (global) {
"use strict";

function framesOf(graph) { return (graph && graph.frames) || null; }
function same(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

/** One value or none: a cell the text gives two values is not compared, only shown. */
function single(cell) { return cell && cell.values.length === 1 ? cell.values[0] : null; }

/** WHAT THE TEXT SAYS OF A CELL INSTEAD OF A VALUE (profile 1.23): that it cannot occur, or cannot be
 *  told. It fills the cell -- the text is not silent there -- and is never compared: a row that
 *  "cannot" have a value differs from no other row on it, and meets no rule. Twin of
 *  argdown-graph.mjs's RESERVED_VALUES. */
var RESERVED = ["impossible", "indeterminate"];
function isSaid(v) { return RESERVED.indexOf(v) >= 0; }

function ruleOf(f) {
  var r = f && f.rule;
  if (!r || typeof r !== "object" || !r.when || typeof r.when !== "object" || r.then == null) return null;
  var when = {};
  Object.keys(r.when).forEach(function (k) { when[k] = String(r.when[k]); });
  return { then: String(r.then), when: when, claim: r.claim == null ? null : String(r.claim) };
}

/** The case tables, one per `case` frame that has values placed on it. */
function caseTables(graph) {
  var F = framesOf(graph);
  if (!F) return [];
  var byId = {};
  F.frames.forEach(function (f) { byId[f.id] = f; });
  var out = [];
  F.frames.forEach(function (rf) {
    if (rf.kind !== "case") return;
    var cells = {}, colSeen = {};
    rf.values.forEach(function (v) { cells[v.id] = {}; });
    F.cells.forEach(function (c) {
      var row = c.coords[rf.id];
      if (row == null || !cells[row]) return;
      Object.keys(c.coords).forEach(function (k) {
        var f = byId[k];
        if (!f || (f.kind !== "dimension" && f.kind !== "verdict")) return;
        colSeen[k] = true;
        var cell = cells[row][k] = cells[row][k] || { values: [], claims: [] };
        if (cell.values.indexOf(c.coords[k]) < 0) cell.values.push(c.coords[k]);
        if (!cell.claims.some(function (x) { return x.title === c.title; }))
          cell.claims.push({ id: c.id, title: c.title, text: c.text, value: c.coords[k] });
      });
    });
    // Columns in declaration order, verdicts last: the others decide them.
    var cols = F.frames.filter(function (f) { return colSeen[f.id] && f.kind === "dimension"; })
      .concat(F.frames.filter(function (f) { return colSeen[f.id] && f.kind === "verdict"; }));
    if (!cols.length) return;
    var rows = rf.values;
    var dims = cols.filter(function (f) { return f.kind === "dimension"; });
    var verdicts = cols.filter(function (f) { return f.kind === "verdict"; });
    var get = function (r, k) { var v = single(cells[r][k]); return v == null || isSaid(v) ? null : v; };

    var empty = [];
    rows.forEach(function (r) { cols.forEach(function (c) { if (!cells[r.id][c.id]) empty.push({ row: r.id, column: c.id }); }); });

    // THE METHOD OF DIFFERENCE: two rows with every dimension stated, alike in all but one.
    var apart = [], alike = [];
    for (var i = 0; i < rows.length; i++) for (var j = i + 1; j < rows.length; j++) {
      // Only where the table has a verdict, and two dimensions or more: the method of difference
      // explains an outcome, and between rows of a classification with none (Stone's stories), or
      // with one dimension only (Valentino's threats, each with its own check), the pairs were noise.
      var a = rows[i].id, b = rows[j].id, diff = [], comparable = dims.length > 1 && verdicts.length > 0;
      dims.forEach(function (d) {
        var x = get(a, d.id), y = get(b, d.id);
        if (x == null || y == null) comparable = false; else if (x !== y) diff.push(d.id);
      });
      if (!comparable) continue;
      // ALIKE IN EVERY STATED DIMENSION AND NOT IN THE VERDICT: something the dimensions miss
      // decides it (the Gettier lesson, between two rows rather than against a rule).
      if (!diff.length) {
        verdicts.forEach(function (v) {
          var x = get(a, v.id), y = get(b, v.id);
          if (x != null && y != null && x !== y) alike.push({ a: a, b: b, verdict: v.id, values: [x, y] });
        });
        continue;
      }
      if (diff.length !== 1) continue;
      var vd = verdicts.map(function (v) {
        var x = get(a, v.id), y = get(b, v.id);
        return { verdict: v.id, a: x, b: y, differ: x != null && y != null && x !== y };
      });
      apart.push({ a: a, b: b, dimension: diff[0], verdicts: vd });
    }

    // A ROW AGAINST A STATED RULE: it meets the rule's conditions and gets another verdict, or
    // gets the rule's verdict without meeting them.
    var againstRule = [];
    verdicts.forEach(function (v) {
      var rule = ruleOf(v);
      if (!rule) return;
      rows.forEach(function (r) {
        var got = get(r.id, v.id);
        if (got == null) return;
        var known = Object.keys(rule.when).every(function (k) { return get(r.id, k) != null; });
        if (!known) return;
        var meets = Object.keys(rule.when).every(function (k) { return get(r.id, k) === rule.when[k]; });
        if (meets && got !== rule.then) againstRule.push({ row: r.id, verdict: v.id, meets: true, got: got, rule: rule });
        if (!meets && got === rule.then) againstRule.push({ row: r.id, verdict: v.id, meets: false, got: got, rule: rule });
      });
    });

    // WORSE ON EVERY COUNT the text ranks: only where both rows are stated on every ranked dimension.
    var ranked = dims.filter(function (d) { return d.ordered; });
    var dominated = [];
    if (ranked.length >= 2) {
      var rank = function (d, v) { return d.values.map(function (x) { return x.id; }).indexOf(v); };
      rows.forEach(function (r) { rows.forEach(function (s) {
        if (r.id === s.id) return;
        var all = ranked.every(function (d) { return get(r.id, d.id) != null && get(s.id, d.id) != null; });
        if (!all) return;
        var noBetter = ranked.every(function (d) { return rank(d, get(r.id, d.id)) >= rank(d, get(s.id, d.id)); });
        var worse = ranked.some(function (d) { return rank(d, get(r.id, d.id)) > rank(d, get(s.id, d.id)); });
        if (noBetter && worse) dominated.push({ worse: r.id, better: s.id, on: ranked.map(function (d) { return d.id; }) });
      }); });
    }

    var said = [];
    rows.forEach(function (r) { cols.forEach(function (c) {
      var cell = cells[r.id][c.id];
      if (cell) cell.values.forEach(function (v) { if (isSaid(v)) said.push({ row: r.id, column: c.id, value: v }); });
    }); });

    out.push({ frame: rf.id, label: rf.label, pinpoint: rf.pinpoint, rows: rows, columns: cols, cells: cells,
               empty: empty, said: said, apart: apart, alike: alike, againstRule: againstRule, dominated: dominated,
               filled: rows.length * cols.length - empty.length });
  });
  return out;
}

/** Tables where claims name two `case` frames at once: rows of the first declared, columns of the other. */
function crossTables(graph) {
  var F = framesOf(graph);
  if (!F) return [];
  var byId = {}, order = {};
  F.frames.forEach(function (f, i) { byId[f.id] = f; order[f.id] = i; });
  var pairs = {};
  F.cells.forEach(function (c) {
    var cs = Object.keys(c.coords).filter(function (k) { return byId[k].kind === "case"; })
      .sort(function (x, y) { return order[x] - order[y]; });
    for (var i = 0; i < cs.length; i++) for (var j = i + 1; j < cs.length; j++) {
      var key = cs[i] + "|" + cs[j];
      var p = pairs[key] = pairs[key] || { rows: byId[cs[i]], columns: byId[cs[j]], cells: {} };
      var r = c.coords[cs[i]], col = c.coords[cs[j]];
      var cell = (p.cells[r] = p.cells[r] || {})[col] = p.cells[r][col] || [];
      var also = {};
      Object.keys(c.coords).forEach(function (k) { if (byId[k].kind !== "case") also[k] = c.coords[k]; });
      if (!cell.some(function (x) { return x.title === c.title; })) cell.push({ id: c.id, title: c.title, text: c.text, values: also });
    }
  });
  return Object.keys(pairs).map(function (k) {
    var p = pairs[k], n = 0;
    p.rows.values.forEach(function (r) { p.columns.values.forEach(function (c) { if (p.cells[r.id] && p.cells[r.id][c.id]) n++; }); });
    return { rowsFrame: p.rows.id, columnsFrame: p.columns.id, label: p.rows.label + " × " + p.columns.label,
             rows: p.rows.values, columns: p.columns.values, cells: p.cells, filled: n,
             size: p.rows.values.length * p.columns.values.length };
  });
}

/** AN ACCOUNT SET'S ROWS GROUPED BY CASE (Bates, tabulation trial): a study that found a screening
 *  effect and no commitment effect is two claims, so two rows that each bear on one account; grouped
 *  by the study the claims are `about`, it is one row that tells the accounts apart -- which is what
 *  the text says the study was designed to do. `set` is one of argdown-accounts.js's accountSets.
 *  Returns [{ frame, value, label, rows: [row ids], cells: { account: "for"|"against"|"both" }, kind }]
 *  for every case value two rows or more share, plus single rows, in the set's own order. */
function accountRowsByCase(graph, set) {
  var F = framesOf(graph);
  if (!F || !set) return [];
  var byFrame = {}, caseOf = {};
  F.frames.forEach(function (f) { byFrame[f.id] = f; });
  F.cells.forEach(function (c) {
    if (c.id == null) return;
    Object.keys(c.coords).forEach(function (k) {
      if (byFrame[k].kind === "case" && caseOf[c.id] == null) caseOf[c.id] = { frame: k, value: c.coords[k] };
    });
  });
  var groups = [], at = {};
  set.rows.forEach(function (r) {
    var c = caseOf[r.id], key = c ? c.frame + "|" + c.value : "row|" + r.id;
    if (at[key] == null) {
      var label = c ? (byFrame[c.frame].values.filter(function (v) { return v.id === c.value; })[0] || {}).label : r.label;
      at[key] = groups.length;
      groups.push({ frame: c ? c.frame : null, value: c ? c.value : null, label: label || r.label, rows: [], cells: {} });
    }
    var g = groups[at[key]];
    g.rows.push(r.id);
    Object.keys(r.cells).forEach(function (a) {
      var v = r.cells[a];
      g.cells[a] = g.cells[a] && g.cells[a] !== v ? "both" : v;
    });
  });
  var accs = set.accounts.map(function (a) { return a.id; });
  groups.forEach(function (g) {
    var vals = accs.filter(function (a) { return g.cells[a]; }).map(function (a) { return g.cells[a]; });
    g.kind = vals.length < 2 ? "one" : vals.every(function (v) { return v === vals[0] && v !== "both"; }) ? "alike" : "apart";
  });
  return groups;
}

/** The account frames, as the accounts they name: [{ frame, label, pinpoint, accounts: [{ id, label, claim, claimId }] }]. */
function declaredAccounts(graph) {
  var F = framesOf(graph);
  if (!F) return [];
  return F.frames.filter(function (f) { return f.kind === "account"; })
    .map(function (f) { return { frame: f.id, label: f.label, pinpoint: f.pinpoint, accounts: f.values }; });
}

/** The claims the text says do not tell an account set's accounts apart (`about: {<account frame>:
 *  indeterminate}`): [{ frame, id, title }]. */
function undecided(graph) { var F = framesOf(graph); return (F && F.undecided) || []; }

var API = { caseTables: caseTables, crossTables: crossTables, declaredAccounts: declaredAccounts, accountRowsByCase: accountRowsByCase,
            undecided: undecided, RESERVED: RESERVED, isSaid: isSaid };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownTables = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
