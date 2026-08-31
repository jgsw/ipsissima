/* argdown-validity.js — does the step do what its rule name says it does?
 *
 * An Argdown inference line may name a rule -- `-- Modus ponens {uses: [1, 2]} --` -- and until
 * now nothing checked it. This decides, for a step whose premises and conclusion carry
 * `formalization:`, whether the conclusion actually follows. It is the JS half of a pair;
 * `ipsissima_mcp/validity.py` is the other, and `tests/validity-vectors.json` is the shared
 * file both must agree on. See `docs/VALIDITY-PLAN.md` for why this is written here rather
 * than delegated to a solver.
 *
 * WHY NOT Z3. Measured: its WebAssembly build is 33 MB against a 2.5 MB page, and it requires
 * SharedArrayBuffer, which needs COOP/COEP headers that a `file://` load does not have. The
 * page is the file people email each other. So a solver cannot run here at all, and the
 * fragment that named rules actually use is decidable by a textbook algorithm anyway.
 *
 * WHAT IS DECIDED, AND WHAT IS NOT:
 *   propositional          complete. Truth table over the atoms.
 *   monadic predicate      complete for the fragment WITHOUT equality and without function
 *                          symbols. Monadic logic has the finite model property: elements
 *                          sharing a type (the set of predicates they satisfy) are
 *                          indistinguishable to a monadic formula, so a model with one element
 *                          per occupied type suffices, and there are only 2^k types.
 *   anything else          reported unsupported, never guessed at. A relation, an arity above
 *                          one, equality, too many predicates: `supported: false` and a reason.
 *
 * The last row is the point. An honest "I cannot decide this" is a different thing from
 * "invalid", and a checker that conflated them would be worse than no checker.
 */
(function (global) {
"use strict";

/* ---- the formula language -------------------------------------------------------------
 *
 * NLTK's syntax, because that is what `debatelab/argdown-feedback` parses (through
 * `nltk.sem.logic.Expression.fromstring`) and a formalization should mean the same thing in
 * both tools. Negation is `-` or `!`.
 *
 * `~` IS REJECTED, DELIBERATELY. NLTK reads `~p` as an ATOM NAMED "~p", not as a negation --
 * verified, it comes back a ConstantExpression -- so a step written with `~` is satisfiable
 * for the wrong reason and an invalid argument passes silently. Accepting `~` as negation here
 * would be worse: the same file would then mean different things in the two tools. So it is an
 * error with a message naming the fix.
 */
var TOKEN = /\s*(<->|->|<=>|=>|&&|\|\||[&|()\.,\-!~]|[A-Za-z_][A-Za-z0-9_]*)/y;

function lex(src) {
  var out = [], i = 0;
  while (i < src.length) {
    TOKEN.lastIndex = i;
    var m = TOKEN.exec(src);
    if (!m) {
      if (!src.slice(i).trim()) break;
      throw new Error("cannot read `" + src.slice(i).trim().slice(0, 12) + "`");
    }
    i = TOKEN.lastIndex;
    if (m[1] === "~")
      throw new Error("`~` is not negation -- NLTK reads `~p` as an atom called \"~p\". "
                    + "Write `-p` or `!p`.");
    out.push(m[1] === "&&" ? "&" : m[1] === "||" ? "|"
           : m[1] === "=>" ? "->" : m[1] === "<=>" ? "<->" : m[1]);
  }
  return out;
}

/** Recursive descent, lowest precedence first: <-> then -> (right) then | then & then unary. */
function parse(src) {
  var ts = lex(src), p = 0;
  function peek() { return ts[p]; }
  function eat(t) {
    if (ts[p] !== t) throw new Error("expected `" + t + "`, found " + (ts[p] ? "`" + ts[p] + "`" : "end"));
    return ts[p++];
  }
  function isName(t) { return t != null && /^[A-Za-z_]/.test(t); }

  function iff() {
    var a = imp();
    while (peek() === "<->") { p++; a = { t: "iff", a: a, b: imp() }; }
    return a;
  }
  function imp() {
    var a = or_();
    if (peek() === "->") { p++; return { t: "imp", a: a, b: imp() }; }   // right associative
    return a;
  }
  function or_() {
    var a = and_();
    while (peek() === "|") { p++; a = { t: "or", a: a, b: and_() }; }
    return a;
  }
  function and_() {
    var a = unary();
    while (peek() === "&") { p++; a = { t: "and", a: a, b: unary() }; }
    return a;
  }
  function unary() {
    var t = peek();
    if (t === "-" || t === "!") { p++; return { t: "not", a: unary() }; }
    if (t === "all" || t === "exists") {
      p++;
      var v = peek();
      if (!isName(v)) throw new Error("expected a variable after `" + t + "`");
      p++; eat(".");
      return { t: t === "all" ? "all" : "exists", v: v, a: unary() };
    }
    if (t === "(") { p++; var e = iff(); eat(")"); return e; }
    if (isName(t)) {
      p++;
      if (peek() === "(") {
        p++;
        var args = [];
        for (;;) {
          var a = peek();
          if (!isName(a)) throw new Error("expected a term inside `" + t + "(...)`");
          args.push(a); p++;
          if (peek() === ",") { p++; continue; }
          break;
        }
        eat(")");
        return { t: "pred", name: t, args: args };
      }
      return { t: "atom", name: t };
    }
    throw new Error(t == null ? "formula ended early" : "unexpected `" + t + "`");
  }
  var e = iff();
  if (p !== ts.length) throw new Error("trailing `" + ts[p] + "`");
  return e;
}

/* ---- what a set of formulas is made of ------------------------------------------------- */

var MAX_PREDICATES = 4;          // 2^(2^4) = 65536 type-subsets; 2^(2^5) is not a search
var MAX_MODELS = 400000;         // beyond this, say so rather than take a second on a keystroke

function survey(formulas) {
  var atoms = {}, preds = {}, consts = {}, bad = null;
  function walk(n, bound) {
    switch (n.t) {
      case "atom": atoms[n.name] = 1; return;
      case "pred":
        if (n.args.length !== 1 && !bad)
          bad = "`" + n.name + "` takes " + n.args.length + " arguments; only one-place "
              + "predicates are decided here";
        preds[n.name] = 1;
        for (var i = 0; i < n.args.length; i++)
          if (!bound[n.args[i]]) consts[n.args[i]] = 1;
        return;
      case "not": return walk(n.a, bound);
      case "all": case "exists": {
        var b = Object.create(bound); b[n.v] = 1; return walk(n.a, b);
      }
      default: walk(n.a, bound); walk(n.b, bound);
    }
  }
  for (var i = 0; i < formulas.length; i++) walk(formulas[i], {});
  return { atoms: Object.keys(atoms).sort(), preds: Object.keys(preds).sort(),
           consts: Object.keys(consts).sort(), bad: bad };
}

/* ---- evaluation ------------------------------------------------------------------------ */

function evaluate(n, m, g) {
  switch (n.t) {
    case "atom":   return !!m.props[n.name];
    case "pred":   return m.preds[n.name].has(term(n.args[0], m, g));
    case "not":    return !evaluate(n.a, m, g);
    case "and":    return evaluate(n.a, m, g) && evaluate(n.b, m, g);
    case "or":     return evaluate(n.a, m, g) || evaluate(n.b, m, g);
    case "imp":    return !evaluate(n.a, m, g) || evaluate(n.b, m, g);
    case "iff":    return evaluate(n.a, m, g) === evaluate(n.b, m, g);
    case "all":
      for (var i = 0; i < m.domain.length; i++) {
        var g1 = Object.create(g); g1[n.v] = m.domain[i];
        if (!evaluate(n.a, m, g1)) return false;
      }
      return true;
    case "exists":
      for (var j = 0; j < m.domain.length; j++) {
        var g2 = Object.create(g); g2[n.v] = m.domain[j];
        if (evaluate(n.a, m, g2)) return true;
      }
      return false;
  }
  throw new Error("unknown node " + n.t);
}
function term(name, m, g) {
  if (Object.prototype.hasOwnProperty.call(g, name) || g[name] !== undefined) return g[name];
  return m.consts[name];
}

/* ---- the model search -------------------------------------------------------------------
 *
 * ONE ELEMENT PER OCCUPIED TYPE. A "type" is a set of predicates, so with k predicates there
 * are 2^k of them. Two elements of the same type satisfy exactly the same monadic formulas, so
 * a model that repeats a type decides nothing a model with one of each does not -- which is
 * why searching the 2^(2^k) subsets is a decision procedure and not a sampling.
 *
 * This is where equality would break it: `exists x. exists y. -(x = y)` distinguishes models
 * this search deliberately identifies. Equality is not in the accepted syntax for that reason.
 */
function models(sur, visit) {
  var atoms = sur.atoms, preds = sur.preds, consts = sur.consts;
  var k = preds.length, nTypes = 1 << k;
  var typeSets = k === 0 ? [null] : [];
  if (k > 0) for (var s = 1; s < (1 << nTypes); s++) typeSets.push(s);

  for (var ti = 0; ti < typeSets.length; ti++) {
    var domain = [], predSets = {};
    if (k === 0) { domain = [0]; }
    else {
      var mask = typeSets[ti];
      for (var ty = 0; ty < nTypes; ty++) if (mask & (1 << ty)) domain.push(ty);
      for (var pi = 0; pi < k; pi++) {
        var set = new Set();
        for (var di = 0; di < domain.length; di++) if (domain[di] & (1 << pi)) set.add(domain[di]);
        predSets[preds[pi]] = set;
      }
    }
    for (var av = 0; av < (1 << atoms.length); av++) {
      var props = {};
      for (var ai = 0; ai < atoms.length; ai++) props[atoms[ai]] = !!(av & (1 << ai));
      var total = Math.pow(domain.length, consts.length);
      for (var cv = 0; cv < total; cv++) {
        var cmap = {}, rest = cv;
        for (var ci = 0; ci < consts.length; ci++) {
          cmap[consts[ci]] = domain[rest % domain.length];
          rest = Math.floor(rest / domain.length);
        }
        if (visit({ domain: domain, preds: predSets, props: props, consts: cmap,
                    types: preds })) return true;
      }
    }
  }
  return false;
}

function searchSize(sur) {
  var k = sur.preds.length;
  var subsets = k === 0 ? 1 : Math.pow(2, 1 << k) - 1;
  var worstDomain = k === 0 ? 1 : (1 << k);
  return subsets * Math.pow(2, sur.atoms.length) * Math.pow(worstDomain, sur.consts.length);
}

/** Is this set of formulas satisfiable? Returns a model when it is, `null` when it is not. */
function satisfiable(formulas) {
  var sur = survey(formulas);
  if (sur.bad) return { supported: false, reason: sur.bad };
  if (sur.preds.length > MAX_PREDICATES)
    return { supported: false, reason: sur.preds.length + " predicates is beyond the bounded "
             + "search (limit " + MAX_PREDICATES + ")" };
  if (searchSize(sur) > MAX_MODELS)
    return { supported: false, reason: "the search space is too large to decide here" };
  var found = null;
  models(sur, function (m) {
    for (var i = 0; i < formulas.length; i++) if (!evaluate(formulas[i], m, {})) return false;
    found = m; return true;
  });
  return { supported: true, model: found };
}

function describe(m) {
  if (!m) return null;
  var out = {};
  Object.keys(m.props).sort().forEach(function (a) { out[a] = m.props[a]; });
  if (m.types && m.types.length) {
    out["domain"] = m.domain.map(function (_, i) { return "e" + i; });
    m.types.forEach(function (p, pi) {
      out[p] = m.domain.filter(function (d) { return d & (1 << pi); })
                       .map(function (d) { return "e" + m.domain.indexOf(d); });
    });
    Object.keys(m.consts).sort().forEach(function (c) {
      out[c] = "e" + m.domain.indexOf(m.consts[c]);
    });
  }
  return out;
}

/* ---- the three questions a named rule invites -------------------------------------------- */

/** Parse a formalization, returning `{ok, ast}` or `{ok:false, error}`. */
function read(src) {
  try { return { ok: true, ast: parse(String(src)) }; }
  catch (e) { return { ok: false, error: e.message }; }
}

/**
 * Decide a step. `premises` and `conclusion` are formalization STRINGS.
 *
 * Returns `{supported, valid, countermodel, irrelevant, consistent, error}`. `supported:false`
 * with a reason is a real answer and must never be shown as invalid.
 */
function checkStep(premises, conclusion) {
  var asts = [], i;
  for (i = 0; i < premises.length; i++) {
    var r = read(premises[i]);
    if (!r.ok) return { supported: false, error: "premise " + (i + 1) + ": " + r.error };
    asts.push(r.ast);
  }
  var rc = read(conclusion);
  if (!rc.ok) return { supported: false, error: "conclusion: " + rc.error };

  var negated = { t: "not", a: rc.ast };
  var v = satisfiable(asts.concat([negated]));
  if (!v.supported) return { supported: false, error: v.reason };

  var out = { supported: true, valid: v.model === null,
              countermodel: v.model ? describe(v.model) : null };

  // PREMISES THAT DO NO WORK, and premises that cannot all hold. Both are only worth asking
  // once the step is valid: of an invalid step they say nothing a reader can act on.
  if (out.valid) {
    out.irrelevant = [];
    for (i = 0; i < asts.length; i++) {
      var without = asts.slice(0, i).concat(asts.slice(i + 1), [negated]);
      var w = satisfiable(without);
      if (w.supported && w.model === null) out.irrelevant.push(i + 1);
    }
    var c = satisfiable(asts);
    out.consistent = !c.supported ? null : c.model !== null;
  }
  return out;
}

var API = { parse: parse, lex: lex, satisfiable: satisfiable, checkStep: checkStep,
            survey: survey, describe: describe,
            MAX_PREDICATES: MAX_PREDICATES, MAX_MODELS: MAX_MODELS };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownValidity = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
