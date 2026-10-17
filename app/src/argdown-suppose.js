/* argdown-suppose.js — the reader's suppositions in the Reasons view, and contraposition.
 *
 * James's go, 17 Oct 2026 ("Proposal — supposing in the Reasons view, and contraposition", every
 * recommendation taken). The map reports and does not evaluate, so nothing here says which side of
 * a dispute wins. A reader may SUPPOSE: that a claim is false, that an objection holds, that an
 * argument's step fails. This works out what then loses the support the map gives it, read off the
 * map's own support structure, and, for a denied conclusion, what must give for it to be false.
 *
 *  - LOSES ITS SUPPORT, NOT FALSE. A claim whose every line of support in the map runs through
 *    something supposed false, or through a step supposed to fail, has lost the support the map
 *    gives it. That does not make it false. A convergent reason survives on its own; a linked
 *    argument needs every premise and its step; a basic premise stands as given unless denied.
 *  - ATTACKS DO NOTHING UNTIL THE READER TURNS THEM ON. Not Dung's acceptability semantics, which
 *    names winners and turns on a reconstruction's completeness. Supposing an objection holds
 *    denies what it attacks or contradicts, or cuts the step it undercuts. The text's replies to
 *    it are named, never resolved.
 *  - AN ATTACK ON A WHOLE ARGUMENT does not say whether it denies a premise or the step, so the
 *    reader is asked (`choice`), and until then it is listed as waiting.
 *  - CONTRAPOSITION ("deny the conclusion") walks back through the argument to the premises it
 *    rests on. On a deductive step, keeping all but one premise forces the last; on any other
 *    step, the step itself is among what may give. Where the steps are formalized and valid, the
 *    page's own decision procedure (argdown-validity.js) says exactly which premises are forced.
 *
 * Pure: a graph in (argdown-graph.mjs's toGraph), statuses and reasons out. View-only, so there is
 * no Python twin.
 */
(function (global) {
"use strict";

/** The canonical deductive rules, as validity.py names them. A name of the reconstructor's own is
 *  a label, not a claim to deductive validity. */
var DEDUCTIVE = ["modus ponens", "modus tollens", "hypothetical syllogism", "disjunctive syllogism",
  "constructive dilemma", "destructive dilemma", "simplification", "conjunction", "addition",
  "double negation", "de morgan", "contraposition", "biconditional elimination",
  "universal instantiation", "universal generalisation", "universal generalization",
  "existential instantiation", "existential generalisation", "existential generalization",
  "reductio ad absurdum", "reductio"];
var ATTACKS = ["attack", "undercut", "contradictory", "contrary"];

function canon(s) { return String(s || "").toLowerCase().replace(/[’']/g, " ").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim(); }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function set(xs) { var o = {}; (xs || []).forEach(function (x) { o[x] = true; }); return o; }
function isAppraisal(n) { return (n.tags || []).indexOf("appraisal") >= 0; }

/** What a step claims about itself:
 *   "valid"      formalized and decided valid by the page;
 *   "invalid"    formalized and decided invalid (a countermodel);
 *   "named"      names a deductive rule, not (or not yet) checked;
 *   "defeasible" names a causal or practical scheme (a bridge);
 *   "conductive" names nothing: weighs considerations, claims no validity. */
function stepKind(rule, verdict) {
  if (verdict && verdict.state === "valid") return "valid";
  if (verdict && verdict.state === "invalid") return "invalid";
  if (!rule) return "conductive";
  var names = String(rule).split(",").map(canon).filter(Boolean);
  if (names.length && names.every(function (n) { return DEDUCTIVE.indexOf(n) >= 0; })) return "named";
  return "defeasible";
}
function deductive(kind) { return kind === "valid" || kind === "named"; }

/** The map's support structure, once. `opts.appraisal` keeps the reconstructor's appraisal in. */
function index(graph, opts) {
  opts = opts || {};
  var nodes = (graph && graph.nodes) || [], edges = (graph && graph.edges) || [];
  var byId = {}, byLabel = {};
  nodes.forEach(function (n) {
    if (n.kind !== "statement" && n.kind !== "argument") return;
    if (!opts.appraisal && isAppraisal(n)) return;
    byId[n.id] = n;
    if (n.kind === "statement" && n.label != null && !has(byLabel, n.label)) byLabel[n.label] = n.id;
  });
  var args = {};
  nodes.forEach(function (n) {
    if (!byId[n.id] || n.kind !== "argument") return;
    var lines = n.pcs || [];
    var byN = {}; lines.forEach(function (l) { byN[l.n] = l; });
    var steps = [], stepOf = {};
    lines.forEach(function (l) {
      if (l.role === "premise") return;
      // A step's inputs as argdown-graph.mjs's verdictOf reads them: its `uses`, or the step's own
      // premises and the conclusions of the step before.
      var inputs = l.uses ? l.uses.map(Number)
        : lines.filter(function (x) { return x.step === l.step && x.role === "premise"; }).map(function (x) { return x.n; })
               .concat(l.step > 0 ? lines.filter(function (x) { return x.step === l.step - 1 && x.role !== "premise"; }).map(function (x) { return x.n; }) : []);
      var st = { k: l.step, conc: l.n, inputs: inputs, rule: l.rule || null, verdict: l.verdict || null,
                 kind: stepKind(l.rule, l.verdict) };
      steps.push(st); stepOf[l.n] = st;
    });
    var main = lines.filter(function (l) { return l.role === "main-conclusion"; })[0] || lines[lines.length - 1] || null;
    // AN ARGUMENT DRAWN WITHOUT A PREMISE-CONCLUSION STRUCTURE: the statements supporting it are its
    // premises, linked, and it concludes what it supports.
    var sketched = !lines.length;
    args[n.id] = { id: n.id, label: n.label, lines: lines, byN: byN, steps: steps, stepOf: stepOf,
                   main: main ? main.n : null, sketched: sketched,
                   premIds: sketched ? edges.filter(function (e) { return e.type === "support" && e.to === n.id && byId[e.from]; }).map(function (e) { return e.from; }) : [] };
  });
  // SUPPORT INTO EACH STATEMENT: from a statement (a convergent reason) or from an argument's line.
  var supportIn = {}, out = {}, into = {};
  edges.forEach(function (e) {
    if (!byId[e.from] || !byId[e.to]) return;
    (out[e.from] = out[e.from] || []).push(e);
    (into[e.to] = into[e.to] || []).push(e);
    if (e.type !== "support" || byId[e.to].kind !== "statement") return;
    var l = supportIn[e.to] = supportIn[e.to] || [];
    if (byId[e.from].kind === "argument") {
      var a = args[e.from];
      var line = a.sketched ? null : e.concludes != null
        ? (a.steps.filter(function (s) { return s.k === e.concludes; }).map(function (s) { return s.conc; })[0] || a.main) : a.main;
      // A premise of the argument is drawn to it, not from it: an edge from an argument to a
      // statement is what the argument concludes.
      l.push({ arg: e.from, line: line });
    } else l.push({ from: e.from });
  });
  return { byId: byId, byLabel: byLabel, args: args, supportIn: supportIn, out: out, into: into };
}

/** Where a line of an argument stands for a drawn statement. */
function lineStmt(ix, a, n) { var l = a.byN[n]; return l && l.title != null && has(ix.byLabel, l.title) ? ix.byLabel[l.title] : null; }

/** What holds, given what is denied (F), held (T) and which steps are cut (CUT: "arg#k", or
 *  "from>to" for a reason between statements). Least fixed point: a statement holds where it is
 *  held, or is basic and not denied, or some line of its support delivers. */
function evaluate(ix, F, T, CUT) {
  var H = {};
  function lineHolds(a, n, seen) {
    var key = a.id + "#" + n, l = a.byN[n], sid = lineStmt(ix, a, n);
    if (F[key] || (sid && F[sid])) return false;
    if (T[key] || (sid && T[sid])) return true;
    if (!l) return false;
    if (l.role === "premise") return sid ? !!H[sid] : true;
    var st = a.stepOf[n];
    if (!st || CUT[a.id + "#" + st.k] || seen[n]) return false;
    seen[n] = true;
    return st.inputs.every(function (m) { return lineHolds(a, m, seen); });
  }
  // AN ARGUMENT GOES THROUGH where its premises hold and its steps are not cut, whatever is
  // supposed of its conclusion: denying the conclusion of an argument that goes through is what
  // contraposition is about, not a loss of the argument.
  function argGoes(a) {
    if (a.sketched) return !CUT[a.id + "#0"] && a.premIds.every(function (p) { return !!H[p]; });
    var st = a.main != null ? a.stepOf[a.main] : null;
    return !!st && !CUT[a.id + "#" + st.k] && st.inputs.every(function (m) { return lineHolds(a, m, {}); });
  }
  function stmtHolds(sid) {
    if (F[sid]) return false;
    if (T[sid]) return true;
    var src = ix.supportIn[sid] || [];
    if (!src.length) return true;
    return src.some(function (s) {
      if (s.arg) { var a = ix.args[s.arg]; return a.sketched || s.line == null ? argGoes(a) : lineHolds(a, s.line, {}); }
      return !CUT[s.from + ">" + sid] && !!H[s.from];
    });
  }
  var ids = Object.keys(ix.byId).filter(function (id) { return ix.byId[id].kind === "statement"; });
  var grew = true;
  while (grew) {
    grew = false;
    ids.forEach(function (sid) { if (!H[sid] && stmtHolds(sid)) { H[sid] = true; grew = true; } });
  }
  var A = {};
  Object.keys(ix.args).forEach(function (id) { if (argGoes(ix.args[id])) A[id] = true; });
  return { holds: H, goes: A };
}

/** The reader's suppositions, closed under what the objections they grant do. `sup` is
 *  { false: [id or "arg#n"], holds: [id], cut: ["arg#k" or "from>to"], choice: {"from>to": "step" | "premise:n"} }.
 *  Returns F, T, CUT, why (each denial's reason), waiting (attacks on a whole argument with no
 *  choice made) and replies (the text's answers to an objection supposed to hold). */
function close(ix, sup) {
  sup = sup || {};
  var F = set(sup["false"]), T = set(sup.holds), CUT = set(sup.cut), why = {}, waiting = [], replies = [];
  Object.keys(F).forEach(function (x) { why[x] = { by: "you" }; });
  Object.keys(CUT).forEach(function (x) { why[x] = { by: "you" }; });
  var choice = sup.choice || {};
  var label = function (id) { var n = ix.byId[id]; return n ? n.label : id; };
  Object.keys(T).forEach(function (x) {
    (ix.out[x] || []).forEach(function (e) {
      if (ATTACKS.indexOf(e.type) < 0) return;
      var t = ix.byId[e.to];
      if (t.kind === "argument") {
        var a = ix.args[e.to], last = a.steps.length ? a.steps[a.steps.length - 1].k : 0;
        if (e.type === "undercut") { CUT[e.to + "#" + last] = true; why[e.to + "#" + last] = { by: "undercut", from: x }; return; }
        var c = choice[x + ">" + e.to];
        if (c === "step") { CUT[e.to + "#" + last] = true; why[e.to + "#" + last] = { by: "objection", from: x }; }
        else if (c && /^premise:\d+$/.test(c)) {
          var n = +c.split(":")[1], sid = lineStmt(ix, a, n), k = sid || e.to + "#" + n;
          F[k] = true; why[k] = { by: "objection", from: x };
        } else waiting.push({ from: x, to: e.to, premises: a.lines.filter(function (l) { return l.role === "premise"; }).map(function (l) { return l.n; }) });
        return;
      }
      if (T[e.to]) return;     // the reader holds both: said, not resolved
      F[e.to] = true; why[e.to] = { by: e.type === "attack" ? "rebuttal" : e.type, from: x };
    });
    // A CONTRADICTORY RUNS BOTH WAYS: held here, its partner drawn into it is false too.
    (ix.into[x] || []).forEach(function (e) {
      if (e.type !== "contradictory" || T[e.from] || !ix.byId[e.from] || ix.byId[e.from].kind !== "statement") return;
      F[e.from] = true; why[e.from] = { by: "contradictory", from: x };
    });
    // THE TEXT'S REPLIES TO WHAT THE READER GRANTS: named, never resolved.
    (ix.into[x] || []).forEach(function (e) {
      if (ATTACKS.indexOf(e.type) >= 0 && e.type !== "contradictory") replies.push({ objection: x, reply: e.from, label: label(e.from) });
    });
  });
  // A CONTRADICTORY PAIR: one false, the other true; one true, the other false (above).
  Object.keys(F).forEach(function (x) {
    (ix.out[x] || []).concat(ix.into[x] || []).forEach(function (e) {
      if (e.type !== "contradictory") return;
      var y = e.from === x ? e.to : e.from;
      if (ix.byId[y] && ix.byId[y].kind === "statement" && !F[y] && !T[y]) { T[y] = true; why[y] = { by: "contradictory", from: x, holds: true }; }
    });
  });
  return { F: F, T: T, CUT: CUT, why: why, waiting: waiting, replies: replies };
}

/** Suppose: what each supposition costs. Returns
 *   { lost: [id], denied: [id], held: [id], cut: [key], why, owing: {id: [supposition]},
 *     waiting, replies, before, after } */
function suppose(graph, sup, opts) {
  var ix = (opts && opts.index) || index(graph, opts);
  var C = close(ix, sup);
  var before = evaluate(ix, {}, {}, {}), after = evaluate(ix, C.F, C.T, C.CUT);
  var lost = [];
  Object.keys(ix.byId).forEach(function (id) {
    var n = ix.byId[id];
    var was = n.kind === "argument" ? before.goes[id] : before.holds[id], now = n.kind === "argument" ? after.goes[id] : after.holds[id];
    if (was && !now && !C.F[id]) lost.push(id);
  });
  // WHICH OF THE READER'S SUPPOSITIONS TOOK EACH ONE'S SUPPORT: taking that supposition alone back
  // gives it back.
  var mine = [].concat((sup && sup["false"] || []).map(function (x) { return ["false", x]; }),
                       (sup && sup.holds || []).map(function (x) { return ["holds", x]; }),
                       (sup && sup.cut || []).map(function (x) { return ["cut", x]; }));
  var owing = {};
  if (mine.length > 1) mine.forEach(function (m) {
    var less = { "false": (sup["false"] || []).slice(), holds: (sup.holds || []).slice(), cut: (sup.cut || []).slice(), choice: sup.choice };
    less[m[0]] = less[m[0]].filter(function (x) { return x !== m[1]; });
    var C2 = close(ix, less), E2 = evaluate(ix, C2.F, C2.T, C2.CUT);
    lost.forEach(function (id) {
      var back = ix.byId[id].kind === "argument" ? E2.goes[id] : E2.holds[id];
      if (back) (owing[id] = owing[id] || []).push(m[1]);
    });
  });
  else if (mine.length === 1) lost.forEach(function (id) { owing[id] = [mine[0][1]]; });
  return { lost: lost, denied: Object.keys(C.F), held: Object.keys(C.T), cut: Object.keys(C.CUT), why: C.why, owing: owing,
           waiting: C.waiting, replies: C.replies, before: before, after: after, index: ix };
}

/** DENY THE CONCLUSION: for a statement (or an argument's conclusion) to be false, what must give.
 *  `keep` lists what the reader keeps: statement ids, or "arg#n" for a premise drawn only inside
 *  its argument. Returns
 *   { claim, reasons: [ { kind: "reason", from } | { kind: "argument", arg, leaves: [{n, sid, title, kept}],
 *       steps: [{k, kind, rule, verdict}], all: "valid"|"named"|..., forced: [{n, sid, title}] | null,
 *       contradiction: bool, orStep: [k], objections: [id], formal: {...} | null } ],
 *     none: bool }
 *  Every reason the map gives the claim must fail. */
function deny(graph, id, keep, opts) {
  var ix = (opts && opts.index) || index(graph, opts);
  var K = set(keep);
  var V = (opts && opts.validity) || /** @type {any} */ (global).ArgdownValidity || null;
  var target = id, src = [];
  if (ix.byId[id] && ix.byId[id].kind === "argument") {
    var a0 = ix.args[id], sid0 = a0.main != null ? lineStmt(ix, a0, a0.main) : null;
    src = [{ arg: id, line: a0.main }]; target = sid0 || id;
  } else src = ix.supportIn[id] || [];
  var reasons = src.map(function (s) {
    if (!s.arg) return { kind: "reason", from: s.from };
    var a = ix.args[s.arg];
    if (a.sketched) return { kind: "argument", arg: a.id, leaves: a.premIds.map(function (p) { return { n: null, sid: p, title: ix.byId[p].label, kept: !!K[p] }; }),
                             steps: [{ k: 0, kind: "conductive", rule: null, verdict: null }], all: "conductive", forced: null, contradiction: false,
                             orStep: [0], objections: objectionsTo(ix, a.id), formal: null };
    // WALK BACK from the line to the premises it rests on, through every step on the way.
    var leaves = [], steps = [], seen = {};
    (function back(n) {
      if (seen[n]) return; seen[n] = true;
      var l = a.byN[n]; if (!l) return;
      if (l.role === "premise") { var sid = lineStmt(ix, a, n); leaves.push({ n: n, sid: sid, title: l.title, kept: !!(sid ? K[sid] : K[a.id + "#" + n]) }); return; }
      var st = a.stepOf[n]; if (!st) return;
      steps.push(st);
      st.inputs.forEach(back);
    })(s.line);
    leaves.sort(function (x, y) { return x.n - y.n; });
    steps.sort(function (x, y) { return x.k - y.k; });
    var kinds = steps.map(function (st) { return st.kind; });
    var all = kinds.every(deductive) ? (kinds.every(function (k) { return k === "valid"; }) ? "valid" : "named")
            : kinds.indexOf("invalid") >= 0 ? "invalid" : kinds.some(function (k) { return k === "defeasible"; }) ? "defeasible" : "conductive";
    var orStep = steps.filter(function (st) { return !deductive(st.kind); }).map(function (st) { return st.k; });
    var open = leaves.filter(function (x) { return !x.kept; });
    var forced = null, contradiction = false;
    if (!orStep.length) {
      if (open.length === 1) forced = [open[0]];
      if (!open.length) contradiction = true;
    } else if (open.length === 1) forced = [open[0]];   // forced unless a step gives: said with orStep
    // DECIDED, WHERE EVERY STEP IS FORMALIZED AND VALID: which premises the kept ones and the
    // conclusion's denial force, and the least that must be given up.
    var formal = null;
    if (V && all === "valid") {
      var form = function (n) { return a.byN[n] && a.byN[n].form; };
      var concl = form(s.line), forms = leaves.map(function (x) { return form(x.n); });
      if (concl && forms.every(Boolean)) {
        var read = function (f) { return V.parse(f); };
        try {
          var notC = { t: "not", a: read(concl) };
          var kept = leaves.filter(function (x) { return x.kept; }).map(function (x) { return read(form(x.n)); });
          var sat = function (fs) { var r = V.satisfiable(fs); return r.supported ? r.model !== null : null; };
          var fForced = leaves.filter(function (x) { return !x.kept && sat(kept.concat([notC, read(form(x.n))])) === false; });
          var minimal = [], L = leaves.length;
          if (L <= 10) for (var mask = 1; mask < (1 << L); mask++) {
            var giveUp = leaves.filter(function (x, i) { return mask & (1 << i); });
            if (giveUp.some(function (x) { return x.kept; })) continue;
            if (minimal.some(function (m) { return m.every(function (x) { return giveUp.indexOf(x) >= 0; }); })) continue;
            var rest = leaves.filter(function (x, i) { return !(mask & (1 << i)); }).map(function (x) { return read(form(x.n)); });
            if (sat(rest.concat([notC])) === true) minimal.push(giveUp);
          }
          formal = { forced: fForced, minimal: minimal, consistent: sat(kept.concat([notC])) };
        } catch (e) { formal = null; }
      }
    }
    return { kind: "argument", arg: a.id, line: s.line, leaves: leaves, steps: steps.map(function (st) { return { k: st.k, kind: st.kind, rule: st.rule, verdict: st.verdict }; }),
             all: all, forced: forced, contradiction: contradiction, orStep: orStep, objections: objectionsTo(ix, a.id), formal: formal };
  });
  return { claim: target, reasons: reasons, none: !reasons.length };
}
function objectionsTo(ix, argId) {
  return (ix.into[argId] || []).filter(function (e) { return e.type === "undercut" || e.type === "attack"; }).map(function (e) { return e.from; });
}

var API = { index: index, evaluate: evaluate, close: close, suppose: suppose, deny: deny, stepKind: stepKind, DEDUCTIVE: DEDUCTIVE };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownSuppose = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
