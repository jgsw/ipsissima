/* argdown-mechanism-lint.js — the mechanism vocabulary, checked and offered where it is written.
 *
 * WHY THIS EXISTS (NOTES-integration.md §3, built 10 Oct 2026). The profile's keys are a vocabulary
 * laid over Argdown's own `{…}` data, and until now the editor knew nothing of it: a misspelt key
 * (`sgn:`), a value not in the list (`on: stocks`) or an undeclared state (`from: droght`) passed
 * in the app without a word, and showed only as a banner in the Mechanism view or in the checker's
 * output over the MCP. Wilson 2023 carries 54 `causes:` blocks; the vocabulary is now large enough
 * that writing it blind is the main cost of a mechanism map.
 *
 * ONE RULE IN ONE PLACE, AS FAR AS IT GOES. The rules here are ipsissima-mcp's mechanism.py --
 * `declared`, `level_order`, `form_of`, `_boundary_problems` and the per-step and per-relation
 * checks of `analyse` -- ported message for message, and test_mechanism_lint.mjs holds the two to
 * the SAME findings, word for word, on every map that has a mechanism. Only the LOCAL rules are
 * here: those a writer can act on where they stand (this key, this state, this chain). The census's
 * questions about the whole chain -- gaps, routes, rival accounts -- stay the checker's; the editor
 * is not a second census. Keys, values and their one-line meanings come from profile.json itself,
 * so a key added to the profile is known here at once.
 *
 * WHERE A FINDING GOES. The checker says which claim, state or chain; the editor needs a place in
 * the text. The locator below reads the text's own structure -- the front matter's YAML outline and
 * each claim's `{…}` block -- well enough to put a mark on the key or the value at fault, and falls
 * back to the claim's line or the `mechanism:` line when it cannot do better. It never decides what
 * the data MEANS: that is the parser's, read off the graph the page already built.
 *
 * Classic script, no build step: sets window.ArgdownMechanismLint and exports for Node.
 */
/** @param {any} global */
(function (global) {
"use strict";

/** The registry. The page carries it as window.IPSISSIMA_PROFILE (the build inlines profile.json);
 *  Node reads the file itself. */
var PROFILE = (global && global.IPSISSIMA_PROFILE) || null;
if (!PROFILE && typeof module !== "undefined" && typeof require === "function") {
  try { PROFILE = require("../../ipsissima-mcp/src/ipsissima_mcp/profile.json"); } catch (e) { PROFILE = null; }
}

// ---------------------------------------------------------------- mechanism.py's vocabulary
var DEFAULT_LEVELS = ["macro", "meso", "micro"];
var STATUSES = ["actual", "possible", "open"];
var ASPECTS = ["quantity", "activity", "development", "event", "condition"];
var BEHAVIOURS = ["grows", "declines", "levels off", "s-shaped", "oscillates", "overshoot and collapse", "steady"];
var ROLES = ["intervention", "condition", "outcome"];
var SHARES = ["entire", "most", "partial", "none"];
var EFFECTS = ["strengthens", "weakens", "reverses", "0"];
var ONS = ["level", "trend", "being", "persistence", "character", "possibility", "chance", "stock"];
var SIGNS = ["+", "-", "0", "which"];
var BASES = ["study", "statistics", "model", "example", "testimony", "asserted"];
var STANCES = ["rejected", "unjudged"];
var ATTRIBUTIONS = ["intentional", "mechanical", "inadvertent", "accidental", "complex"];
var SHAPES = ["peak", "trough"];
var SCOPES = ["singular", "general"];
var EXTENTS = ["partial", "entire"];
var WHOLES = ["aggregate", "organised", "reducible", "mutual"];
var CONSTITUTION_BASES = BASES.concat(["account", "definition"]);
var GOALS = ["explain", "intervene", "predict", "attribute"];
var ACCOUNTS = ["regularity", "manipulability", "mechanism", "counterfactual", "intra-action"];
var CHAIN_ORDERS = ["time", "explanation"];
var DEPTHS = ["full", "sketch", "none"];
var FORMS = ["chain", "cycle"];
var ORDERINGS = { composition: "parts within wholes", space: "regions within regions", authority: "a chain of command",
                  scale: "larger and smaller, not containing", sequence: "an order along a chain",
                  systems: "separate systems", mixed: "more than one ordering", unstated: "an ordering the text does not name" };
var NESTING = ["composition", "space", "authority"];
var ASSOCIATED = /\b(associat(ed|ion|ions)|correlat(ed|es|ion|ions)|linked (to|with)|co-?occur\w*|go(es)? together)\b/;
var NOT_ENOUGH = /\b(itself|by itself|alone|on its own|single-handedly|quietly|entirely|completely|fully|wholly|not enough|not sufficient|insufficient|no guarantee|not guarantee|exorci[sz]ed|cure-all|panacea)\b/i;

// ---------------------------------------------------------------- Python's values, in JS
function isDict(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function has(o, k) { return isDict(o) && Object.prototype.hasOwnProperty.call(o, k); }
/** Python truthiness: an empty list or map is false, as `x or default` reads it. */
function truthy(x) { return Array.isArray(x) ? x.length > 0 : isDict(x) ? Object.keys(x).length > 0 : !!x; }
function or(x, d) { return truthy(x) ? x : d; }
/** str(x) as Python prints it in an f-string, so the messages are the checker's word for word. */
function py(x) {
  if (x === null || x === undefined) return "None";
  if (x === true) return "True";
  if (x === false) return "False";
  if (Array.isArray(x)) return "[" + x.map(pyRepr).join(", ") + "]";
  if (isDict(x)) return "{" + Object.keys(x).map(function (k) { return pyRepr(k) + ": " + pyRepr(x[k]); }).join(", ") + "}";
  return String(x);
}
function pyRepr(x) { return typeof x === "string" ? "'" + x.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'" : py(x); }
function asList(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]).map(py); }
function rolesOf(state) {
  var r = isDict(state) ? state.role : null;
  if (r == null) return [];
  var out = [];
  (Array.isArray(r) ? r : [r]).forEach(function (x) { if (out.indexOf(py(x)) < 0) out.push(py(x)); });
  return out;
}
function str(x) { return x == null ? "" : py(x); }
function sortStr(a) { return a.slice().sort(function (x, y) { return x < y ? -1 : x > y ? 1 : 0; }); }

/** difflib.get_close_matches(word, possibilities, n=1, cutoff=0.6)[0] or null: the checker's "did you
 *  mean". SequenceMatcher's ratio, Ratcliff and Obershelp's matching blocks, ties to the greater word
 *  as heapq.nlargest breaks them. */
function ratio(a, b) {
  var m = 0;
  (function blocks(alo, ahi, blo, bhi) {
    var besti = alo, bestj = blo, bestk = 0, len = {};
    for (var i = alo; i < ahi; i++) {
      var nl = {};
      for (var j = blo; j < bhi; j++) if (a[i] === b[j]) {
        var k = (len[j - 1] || 0) + 1; nl[j] = k;
        if (k > bestk) { besti = i - k + 1; bestj = j - k + 1; bestk = k; }
      }
      len = nl;
    }
    if (!bestk) return;
    m += bestk;
    if (alo < besti && blo < bestj) blocks(alo, besti, blo, bestj);
    if (besti + bestk < ahi && bestj + bestk < bhi) blocks(besti + bestk, ahi, bestj + bestk, bhi);
  })(0, a.length, 0, b.length);
  return a.length + b.length ? 2 * m / (a.length + b.length) : 1;
}
function nearest(word, known) {
  var best = null, score = -1;
  sortStr(known).forEach(function (x) {
    var r = ratio(x, word);   // SequenceMatcher(None, x, word): the possibility first
    if (r >= 0.6 && (r > score || (r === score && x > best))) { best = x; score = r; }
  });
  return best;
}

/** The keys a relation of `kind` may carry, from the registry: mechanism.py's RELATION_KEYS. */
function relationKeys(kind) {
  var p = PROFILE && PROFILE[kind];
  return p ? Object.keys(p).filter(function (k) { return k !== "summary"; }) : null;
}
function unknownKeys(c, kind) {
  var known = relationKeys(kind);
  if (!known || !isDict(c)) return [];
  return Object.keys(c).filter(function (k) { return known.indexOf(k) < 0; })
    .map(function (k) { return [k, nearest(k, known)]; });
}

// ---------------------------------------------------------------- the rules
/** A finding: severity ("!" a fault, "?" a query), the checker's message, and where -- `at` says
 *  what the locator should look for: {fm: path, token} in the front matter, or {claim, rel, i, key,
 *  token} in a claim's `{…}` block. */
function F(sev, msg, at) { return { sev: sev, msg: msg, at: at || {} }; }
/** A finding about the key itself -- one the profile does not know -- is marked on the key. */
function onKey(at) { at.onKey = true; return at; }

function formOf(b, path, tag) {
  b = isDict(b) ? b : {};
  var out = [], form = b.form == null ? "chain" : py(b.form);
  if (FORMS.indexOf(form) < 0) { out.push(F("!", tag + "`form: " + form + "` is not `chain` or `cycle`", { fm: path.concat(["form"]) })); form = "chain"; }
  var st = b.settles;
  if (st != null && typeof st !== "boolean") out.push(F("!", tag + "`settles:` is `true` or `false`, not `" + py(st) + "`", { fm: path.concat(["settles"]) }));
  else if (st != null && form !== "cycle") out.push(F("?", tag + "`settles` says whether a cycle comes to rest, and this is not declared `form: cycle`", { fm: path.concat(["settles"]) }));
  return out;
}

function boundaryProblems(b, path, tag) {
  var raw = isDict(b) ? b.boundary : null;
  if (raw == null) return [];
  var out = [], at = { fm: path.concat(["boundary"]) };
  if (isDict(raw)) {
    var extra = sortStr(Object.keys(raw).filter(function (k) { return k !== "says" && k !== "pinpoint"; }));
    if (extra.length) out.push(F("!", tag + "`boundary:` takes `says` and `pinpoint`, not `" + extra[0] + "`", { fm: path.concat(["boundary", extra[0]]) }));
  } else if (Array.isArray(raw)) {
    out.push(F("!", tag + "`boundary:` is the text's words, or `{says, pinpoint}`", at));
    return out;
  }
  var says = null, pin = null;
  if (!isDict(raw)) says = py(raw).trim() === "" ? null : py(raw);
  else {
    says = raw.says == null || py(raw.says).trim() === "" ? null : py(raw.says);
    pin = raw.pinpoint == null || py(raw.pinpoint).trim() === "" ? null : py(raw.pinpoint);
  }
  if (!says) out.push(F("!", tag + "`boundary:` says nothing: give the text's words", at));
  else if (!pin) out.push(F("?", tag + "`boundary:` has no pinpoint: the words are the text's, so say where", at));
  return out;
}

function levelOrder(block, levels) {
  var out = [], M = ["mechanism"];
  block = isDict(block) ? block : {};
  var raw = block.ordering, kind = null;
  if (isDict(raw)) kind = raw.kind; else if (raw != null) kind = raw;
  if (kind != null) {
    kind = py(kind);
    if (!has(ORDERINGS, kind)) { out.push(F("!", "`ordering: " + kind + "` is not one of " + Object.keys(ORDERINGS).join(", "), { fm: M.concat(["ordering"]), token: kind })); kind = null; }
  }
  var within = block.within, pairs = [];
  if (within != null) {
    if (!isDict(within)) out.push(F("!", "`within:` must map a level to the level it is within", { fm: M.concat(["within"]) }));
    else Object.keys(within).forEach(function (c) {
      var par = py(within[c]);
      var bad = [c, par].filter(function (x) { return levels.indexOf(x) < 0; });
      if (bad.length) { out.push(F("!", "`within: {" + c + ": " + par + "}` names `" + bad[0] + "`, which is not one of the declared levels", { fm: M.concat(["within", c]) })); return; }
      if (c === par) { out.push(F("!", "`within:` puts `" + c + "` within itself", { fm: M.concat(["within", c]) })); return; }
      pairs.push([c, par]);
    });
  }
  var parent = {};
  pairs.forEach(function (q) { parent[q[0]] = q[1]; });
  for (var li = 0; li < levels.length; li++) {
    var seen = {}, p = has(parent, levels[li]) ? parent[levels[li]] : null;
    while (p != null && !seen[p]) { seen[p] = true; p = has(parent, p) ? parent[p] : null; }
    if (p != null) { out.push(F("!", "`within:` runs in a circle through `" + levels[li] + "`", { fm: M.concat(["within"]) })); parent = {}; pairs = []; break; }
  }
  var anc = function (lv) { var r = [], q = has(parent, lv) ? parent[lv] : null; while (q != null && r.length < 50) { r.push(q); q = has(parent, q) ? parent[q] : null; } return r; };
  for (var i = 0; i < levels.length; i++) {
    var lv = levels[i], j = i;
    while (j + 1 < levels.length && anc(levels[j + 1]).indexOf(lv) >= 0) j++;
    if (levels.slice(j + 1).some(function (x) { return anc(x).indexOf(lv) >= 0; })) {
      out.push(F("?", "`within:` puts a level outside the run of its whole: in the order `levels:` lists them the tree cannot be drawn nested", { fm: M.concat(["levels"]) }));
      break;
    }
  }
  if (pairs.length && kind != null && NESTING.indexOf(kind) < 0)
    out.push(F("?", "`within:` says the levels nest, but `ordering: " + kind + "` (" + ORDERINGS[kind] + ") is not a containment", { fm: M.concat(["within"]) }));
  return out;
}

/** mechanism.py's `declared`: what the front matter's `mechanism:` block gets wrong.
 *  Returns {block, levels, actors, states, problems}. */
function declared(m) {
  var M = ["mechanism"];
  if (m == null) return { block: null, levels: DEFAULT_LEVELS, actors: {}, states: {}, problems: [] };
  if (!isDict(m)) return { block: null, levels: DEFAULT_LEVELS, actors: {}, states: {},
    problems: [F("!", "`mechanism:` in the front matter must be a block of `levels`, `actors` and `states`", { fm: M })] };
  var P = [];
  var levels = or(m.levels, DEFAULT_LEVELS);
  if (!Array.isArray(levels)) { P.push(F("!", "`levels:` must be a list, top level first", { fm: M.concat(["levels"]) })); levels = DEFAULT_LEVELS; }
  levels = levels.map(py);
  var actors = or(m.actors, {}), states = or(m.states, {});
  [["actors", actors], ["states", states]].forEach(function (nb) {
    if (!isDict(nb[1])) P.push(F("!", "`" + nb[0] + ":` must map ids to their descriptions", { fm: M.concat([nb[0]]) }));
  });
  actors = isDict(actors) ? actors : {};
  states = isDict(states) ? states : {};
  Object.keys(actors).forEach(function (aid) {
    var a = isDict(actors[aid]) ? actors[aid] : {};
    if (levels.indexOf(a.level) < 0 || typeof a.level !== "string")
      P.push(F("!", "actor `" + aid + "` has level `" + py(a.level) + "`, which is not one of the declared levels (" + levels.join(", ") + ")",
               { fm: M.concat(["actors", aid, "level"]), fallback: M.concat(["actors", aid]) }));
  });
  Object.keys(states).forEach(function (sid) {
    var s = isDict(states[sid]) ? states[sid] : {}, at = function (k, tok) { return { fm: M.concat(["states", sid].concat(k ? [k] : [])), token: tok, fallback: M.concat(["states", sid]) }; };
    var who = asList(s.actor);
    if (!who.length && asList(s.levels).length) { /* a process with no owner (1.11) */ }
    else if (!who.length) P.push(F("!", "state `" + sid + "` names no actor: name one, or give its `levels:` where it is a process with no owner", at(null)));
    who.forEach(function (a) { if (!has(actors, a)) P.push(F("!", "state `" + sid + "` names actor `" + a + "`, which is not declared under `actors:`", at("actor", a))); });
    if (s.status != null && STATUSES.indexOf(py(s.status)) < 0) P.push(F("?", "state `" + sid + "` has `status: " + py(s.status) + "`; the statuses read are " + STATUSES.join(", "), at("status")));
    if (s.aspect != null && ASPECTS.indexOf(py(s.aspect)) < 0) P.push(F("?", "state `" + sid + "` has `aspect: " + py(s.aspect) + "`; the aspects read are " + ASPECTS.join(", "), at("aspect")));
    if (s.behaviour != null && BEHAVIOURS.indexOf(py(s.behaviour)) < 0) P.push(F("!", "state `" + sid + "` has `behaviour: " + py(s.behaviour) + "`; the behaviours read are " + BEHAVIOURS.join(", "), at("behaviour")));
    ["observed", "dead_end"].forEach(function (k) {
      if (s[k] != null && typeof s[k] !== "boolean") P.push(F("!", "state `" + sid + "`: `" + k + ":` is `true` or `false`, not `" + py(s[k]) + "`", at(k)));
    });
    asList(s.levels).forEach(function (lv) { if (levels.indexOf(lv) < 0) P.push(F("!", "state `" + sid + "` names level `" + lv + "`, which is not one of the declared levels", at("levels", lv))); });
    var meas = s.measures;
    if (meas != null && !has(states, meas)) P.push(F("!", "state `" + sid + "` `measures: " + py(meas) + "`, which is not a declared state", at("measures")));
    else if (meas != null && meas === sid) P.push(F("!", "state `" + sid + "` `measures` itself", at("measures")));
    var whole = s.part_of;
    if (whole != null && !has(states, whole)) P.push(F("!", "state `" + sid + "` is `part_of: " + py(whole) + "`, which is not a declared state", at("part_of")));
    else if (whole === sid) P.push(F("!", "state `" + sid + "` is `part_of` itself", at("part_of")));
    var bad = rolesOf(s).filter(function (r) { return ROLES.indexOf(r) < 0; });
    if (bad.length) P.push(F("?", "state `" + sid + "` has role `" + sortStr(bad)[0] + "`; the roles read are `intervention`, `condition` and `outcome`", at("role", sortStr(bad)[0])));
  });
  var kinds = m.kinds;
  if (kinds != null && !isDict(kinds)) P.push(F("!", "`kinds:` must map ids to kinds, each with a `label`", { fm: M.concat(["kinds"]) }));
  kinds = isDict(kinds) ? kinds : {};
  var kindIds = Object.keys(kinds).map(py), ofKind = {};
  Object.keys(states).forEach(function (sid) {
    var k = isDict(states[sid]) ? states[sid].kind : null;
    if (k == null) return;
    if (kindIds.indexOf(py(k)) < 0) P.push(F("!", "state `" + sid + "` is `kind: " + py(k) + "`, which is not declared under `mechanism: kinds:`", { fm: M.concat(["states", sid, "kind"]), fallback: M.concat(["states", sid]) }));
    else (ofKind[py(k)] = ofKind[py(k)] || []).push(sid);
  });
  Object.keys(kinds).forEach(function (kid) {
    var gen = isDict(kinds[kid]) ? kinds[kid].general : null;
    if (gen == null) return;
    var at = { fm: M.concat(["kinds", kid, "general"]), fallback: M.concat(["kinds", kid]) };
    if (!has(states, gen)) P.push(F("!", "kind `" + kid + "` is `general: " + py(gen) + "`, which is not a declared state", at));
    else if ((ofKind[py(kid)] || []).indexOf(gen) < 0) P.push(F("!", "kind `" + kid + "` is `general: " + py(gen) + "`, but `" + py(gen) + "` is not of kind `" + kid + "` -- give it `kind: " + kid + "`", at));
  });
  Object.keys(kinds).forEach(function (kid) {
    var n = (ofKind[py(kid)] || []).length;
    if (n < 2) P.push(F("?", "kind `" + kid + "` has " + n + " state(s): a kind says that two or more states are the same kind of thing", { fm: M.concat(["kinds", kid]) }));
  });
  var chains = m.chains;
  if (chains != null && !isDict(chains)) P.push(F("!", "`chains:` must map ids to chains, each with a `label` and a `question`", { fm: M.concat(["chains"]) }));
  P = P.concat(formOf(m, M, ""));
  var order = function (b) { return isDict(b) && b.order != null ? py(b.order) : null; };
  if (order(m) != null && CHAIN_ORDERS.indexOf(order(m)) < 0) P.push(F("!", "`order: " + order(m) + "` is not one of " + CHAIN_ORDERS.join(", "), { fm: M.concat(["order"]) }));
  if (isDict(m.chains)) Object.keys(m.chains).forEach(function (cid) {
    var o = order(m.chains[cid]);
    if (o != null && CHAIN_ORDERS.indexOf(o) < 0) P.push(F("!", "chain `" + cid + "`: `order: " + o + "` is not one of " + CHAIN_ORDERS.join(", "), { fm: M.concat(["chains", cid, "order"]) }));
  });
  var d = m.depth == null ? "full" : py(m.depth), why = m.depth == null ? null : (m.depth_reason == null ? null : py(m.depth_reason));
  if (DEPTHS.indexOf(d) < 0) P.push(F("!", "`depth: " + d + "` is not one of " + DEPTHS.join(", "), { fm: M.concat(["depth"]) }));
  else if (d !== "full" && !why) P.push(F("?", "`depth: " + d + "` says the mechanism is not mapped in full, and no `depth_reason:` says why", { fm: M.concat(["depth"]) }));
  if (m.goal != null && GOALS.indexOf(py(m.goal)) < 0) P.push(F("?", "`goal: " + py(m.goal) + "` is not one of " + GOALS.join(", "), { fm: M.concat(["goal"]) }));
  asList(m.account).forEach(function (a) { if (ACCOUNTS.indexOf(a) < 0) P.push(F("?", "`account: " + a + "` is not one of " + ACCOUNTS.join(", "), { fm: M.concat(["account"]), token: a })); });
  if (m.channels != null && !isDict(m.channels)) P.push(F("!", "`channels:` maps an id to `{label}`", { fm: M.concat(["channels"]) }));
  P = P.concat(boundaryProblems(m, M, ""));
  if (isDict(chains)) Object.keys(chains).forEach(function (cid) {
    var ch = isDict(chains[cid]) ? chains[cid] : {}, C = M.concat(["chains", cid]), tag = "chain `" + cid + "`: ";
    P = P.concat(boundaryProblems(ch, C, tag));
    var cond = ch.conditioned;
    (Array.isArray(cond) ? cond : asList(cond)).forEach(function (item) {
      (Array.isArray(item) ? item : [item]).forEach(function (sid) {
        if (!has(states, py(sid))) P.push(F("!", "chain `" + cid + "`: `conditioned:` names `" + py(sid) + "`, which is not a declared state", { fm: C.concat(["conditioned"]), token: py(sid) }));
      });
    });
    P = P.concat(formOf(ch, C, tag));
    if (ch.goal != null && GOALS.indexOf(py(ch.goal)) < 0) P.push(F("?", "chain `" + cid + "`: `goal: " + py(ch.goal) + "` is not one of " + GOALS.join(", "), { fm: C.concat(["goal"]) }));
    asList(ch.account).forEach(function (a) { if (ACCOUNTS.indexOf(a) < 0) P.push(F("?", "chain `" + cid + "`: `account: " + a + "` is not one of " + ACCOUNTS.join(", "), { fm: C.concat(["account"]), token: a })); });
    var roles = or(ch.roles, {});
    if (!isDict(roles)) { P.push(F("!", "chain `" + cid + "`: `roles:` must map state ids to roles", { fm: C.concat(["roles"]) })); return; }
    Object.keys(roles).forEach(function (sid) {
      if (!has(states, sid)) P.push(F("!", "chain `" + cid + "` gives a role to `" + sid + "`, which is not a declared state", onKey({ fm: C.concat(["roles", sid]), fallback: C.concat(["roles"]) })));
      var bad = rolesOf({ role: roles[sid] }).filter(function (r) { return ROLES.indexOf(r) < 0; });
      if (bad.length) P.push(F("?", "chain `" + cid + "` gives `" + sid + "` the role `" + sortStr(bad)[0] + "`; the roles read are `intervention`, `condition` and `outcome`", { fm: C.concat(["roles", sid]), token: sortStr(bad)[0], fallback: C.concat(["roles"]) }));
    });
  });
  // KEYS THE PROFILE DOES NOT KNOW, in the block and in each thing it declares (10 Oct 2026).
  var dym = function (near) { return near ? " -- did you mean `" + near + "`?" : ""; };
  var mech = PROFILE && PROFILE.mechanism;
  if (mech) {
    var known = { block: Object.keys(mech).filter(function (k) { return k !== "summary"; }), channels: ["label"] };
    ["states", "actors", "chains", "kinds"].forEach(function (part) { known[part] = Object.keys(mech[part].keys); });
    Object.keys(m).forEach(function (k) {
      if (known.block.indexOf(k) < 0) P.push(F("!", "`" + k + "` is not a key the `mechanism:` block can carry, so it is never read" + dym(nearest(k, known.block)), onKey({ fm: M.concat([k]) })));
    });
    [["states", "state", "a state"], ["actors", "actor", "an actor"], ["chains", "chain", "a chain"], ["kinds", "kind", "a kind"], ["channels", "channel", "a channel"]].forEach(function (pn) {
      var coll = m[pn[0]];
      if (!isDict(coll)) return;
      Object.keys(coll).forEach(function (xid) {
        if (!isDict(coll[xid])) return;
        Object.keys(coll[xid]).forEach(function (k) {
          if (known[pn[0]].indexOf(k) < 0) P.push(F("!", pn[1] + " `" + xid + "`: `" + k + "` is not a key " + pn[2] + " can carry, so it is never read" + dym(nearest(k, known[pn[0]])),
            onKey({ fm: M.concat([pn[0], xid, k]), fallback: M.concat([pn[0], xid]) })));
        });
      });
    });
  }
  Object.keys(states).forEach(function (sid) {
    var seen = {}, cur = isDict(states[sid]) ? states[sid].part_of : null;
    seen[sid] = true;
    while (cur != null && has(states, cur) && isDict(states[cur])) {
      if (seen[cur]) { P.push(F("!", "`part_of` runs in a circle through `" + sid + "`", { fm: M.concat(["states", sid, "part_of"]), fallback: M.concat(["states", sid]) })); break; }
      seen[cur] = true;
      cur = states[cur].part_of;
    }
  });
  return { block: m, levels: levels, actors: actors, states: states, problems: P };
}

/** Every finding the editor shows for a parsed map: mechanism.py's local rules, the checker's
 *  words. `graph` is toGraph's output; its `mechanism` is null on a map with no mechanism, which
 *  hears nothing. `fm` is the parsed front matter, for a `mechanism:` that is not a block. */
function findings(graph) {
  var mech = graph && graph.mechanism;
  if (!mech) return [];
  var D = declared(mech.block === undefined ? null : mech.block);
  var states = D.states, actors = D.actors, block = D.block, out = [];
  var claims = mech.claims || [];
  var steps = [], consts = [];
  claims.forEach(function (c) {
    var tags = c.tags || [];
    var layer = tags.indexOf("appraisal") >= 0 ? "appraisal" : (tags.indexOf("reported") >= 0 || tags.indexOf("contested") >= 0) ? "rival" : "text";
    (c.causes || []).forEach(function (raw, i) { steps.push({ claim: c, i: i, raw: isDict(raw) ? raw : {}, layer: layer }); });
    (c.constitutes || []).forEach(function (raw, i) { consts.push({ claim: c, i: i, raw: isDict(raw) ? raw : {}, layer: layer }); });
  });
  var CC = mech.chainClaims || [];
  if (block == null && !steps.length && !consts.length && !CC.length) return [];
  if (block == null && steps.length)
    out.push(F("!", steps.length + " step(s) are marked with `causes:` but the front matter declares no `mechanism:` block, so no state they name exists",
               { claim: steps[0].claim.title, rel: "causes", i: steps[0].i }));
  out = out.concat(D.problems, levelOrder(block, D.levels));
  if (block == null && consts.length)
    out.push(F("!", consts.length + " relation(s) are marked with `constitutes:` but the front matter declares no `mechanism:` block",
               { claim: consts[0].claim.title, rel: "constitutes", i: consts[0].i }));
  var stateOf = function (sid) { return has(states, sid) ? states[sid] : undefined; };
  var appraisalState = function (sid) { var s = stateOf(sid); return isDict(s) && truthy(s.appraisal); };

  consts.forEach(function (k) {
    var c = k.raw, at = function (key, tok) { return { claim: k.claim.title, rel: "constitutes", i: k.i, key: key, token: tok }; };
    unknownKeys(c, "constitutes").forEach(function (u) {
      out.push(F("!", "`" + u[0] + "` is not a key a constitutive relation can carry, so it is never read" + (u[1] ? " -- did you mean `" + u[1] + "`?" : ""), onKey(at(u[0]))));
    });
    var src = c.from, dst = c.to;
    if (src == null) out.push(F("!", "a constitutive relation has no `from:`", at(null)));
    else if (!has(states, src)) out.push(F("!", "`constitutes: {from: " + py(src) + "}` is not a declared state", at("from")));
    if (dst == null) out.push(F("!", "a constitutive relation has no `to:`", at(null)));
    else if (!has(states, dst) && !has(actors, dst)) out.push(F("!", "`constitutes: {to: " + py(dst) + "}` is neither a declared state nor a declared actor", at("to")));
    else if (dst === src) out.push(F("!", "`" + py(src) + "` is said to constitute itself", at("to")));
    var extent = str(c.extent), whole = str(c.whole), stance = str(c.stance);
    if (extent && EXTENTS.indexOf(extent) < 0) out.push(F("?", "`extent: " + extent + "` is not `partial` or `entire`", at("extent")));
    if (whole && WHOLES.indexOf(whole) < 0) out.push(F("?", "`whole: " + whole + "` is not one of " + WHOLES.join(", "), at("whole")));
    if (c.basis != null && CONSTITUTION_BASES.indexOf(c.basis) < 0) out.push(F("?", "basis `" + py(c.basis) + "` is not one of " + CONSTITUTION_BASES.join(", "), at("basis")));
    if (stance && STANCES.indexOf(stance) < 0) out.push(F("!", "`stance: " + stance + "` is not one of " + STANCES.join(", "), at("stance")));
    else if (stance && k.layer !== "rival") out.push(F("?", "`stance` says where the text stands on a view it reports, and this claim is not tagged #reported or #contested", at("stance")));
    [["from", src], ["to", dst]].forEach(function (e) {
      if (k.layer !== "appraisal" && e[1] != null && has(states, e[1]) && appraisalState(e[1]))
        out.push(F("!", "a relation the text asserts runs through `" + py(e[1]) + "`, which is declared as the appraisal's own state", at(e[0])));
    });
  });

  var chainIds = isDict(block) && isDict(block.chains) ? Object.keys(block.chains).map(py) : [];
  // A CLAIM THAT STANDS FOR A CHAIN (1.20) -- mechanism.py's check in analyse.
  CC.forEach(function (cc) {
    var ch = cc.chain, at = { claim: cc.title, rel: "mechanism", key: null, onValue: true };
    if (block == null)
      out.push(F("!", "`mechanism: " + py(ch) + "` on a claim stands for a chain, and the front matter declares no `mechanism:` block", at));
    else if (ch === true) { /* the whole mechanism */ }
    else if (typeof ch === "boolean" || !(typeof ch === "string" || typeof ch === "number"))
      out.push(F("!", "`mechanism:` on a claim is a chain id, or `true` for the whole mechanism", at));
    else if (chainIds.indexOf(py(ch)) < 0)
      out.push(F("!", chainIds.length ? "`mechanism: " + py(ch) + "` is not one of the chains declared under `mechanism: chains:`"
        : "`mechanism: " + py(ch) + "` names a chain, but the front matter declares no `chains:` -- `mechanism: true` stands for the whole mechanism", at));
  });
  var channels = isDict(block) && isDict(block.channels) ? block.channels : {};
  steps.forEach(function (k) {
    var c = k.raw, title = k.claim.title, at = function (key, tok) { return { claim: title, rel: "causes", i: k.i, key: key, token: tok }; };
    var src = c.from, dst = c.to, ends = [src, dst];
    var sign = c.sign == null ? null : py(c.sign);
    var isNull = sign === "0", selects = truthy(c.selects), assoc = truthy(c.association);
    var reported = k.layer === "rival";
    var on = c.on == null ? "level" : py(c.on);
    var share = c.share != null ? py(c.share) : (c.via != null && truthy(c.via) ? "entire" : "");
    var via = asList(c.via);
    asList(c.chain).forEach(function (ch) {
      if (chainIds.indexOf(ch) < 0)
        out.push(F("!", chainIds.length ? "`chain: " + ch + "` is not one of the chains declared under `mechanism: chains:`"
                                        : "`chain: " + ch + "` names a chain, but the front matter declares no `chains:`", at("chain", ch)));
    });
    via.forEach(function (v) {
      if (!has(states, v)) out.push(F("!", "`via: " + v + "` is not a declared state", at("via", v)));
      else if (ends.indexOf(v) >= 0) out.push(F("?", "`via: " + v + "` names the step's own `from` or `to`", at("via", v)));
    });
    ["unless", "despite"].forEach(function (key) {
      asList(c[key]).forEach(function (u) {
        if (!has(states, u)) out.push(F("!", "`" + key + ": " + u + "` is not a declared state", at(key, u)));
        else if (ends.indexOf(u) >= 0) out.push(F("?", "`" + key + ": " + u + "` names the step's own `from` or `to`", at(key, u)));
      });
    });
    if (share && SHARES.indexOf(share) < 0) out.push(F("!", "`share: " + share + "` is not one of " + SHARES.join(", "), at("share")));
    else if (c.share != null && !via.length) out.push(F("?", "`share` says how much of a step runs by a route, and this step names none in `via`", at("share")));
    var mods = c.modifies;
    (Array.isArray(mods) ? mods : truthy(mods) ? [mods] : []).forEach(function (m) {
      var by = isDict(m) && m.by != null ? py(m.by) : "", effect = isDict(m) && m.effect != null ? py(m.effect) : "";
      if (!by || !has(states, by)) out.push(F("!", "`modifies: {by: " + (by || "?") + "}` is not a declared state", at("modifies", by || null)));
      else if (ends.indexOf(by) >= 0) out.push(F("?", "`modifies: {by: " + by + "}` names the step's own `from` or `to`", at("modifies", by)));
      if (EFFECTS.indexOf(effect) < 0) out.push(F("?", "`effect: " + (effect || "(none)") + "` is not one of strengthens, weakens, reverses or \"0\" (does not moderate)", at("modifies", effect || null)));
    });
    ["necessary", "sufficient"].forEach(function (key) {
      if (c[key] != null && typeof c[key] !== "boolean") out.push(F("!", "`" + key + ":` is `true` or `false`, not `" + py(c[key]) + "`", at(key)));
    });
    if (c.necessary === true && (sign === "-" || sign === "0"))
      out.push(F("?", "a step marked `necessary` says " + py(dst) + " holds only where " + py(src) + " does, which a `" + sign + "` step contradicts", at("necessary")));
    if (c.sufficient === true && sign === "0") out.push(F("?", "a finding of no effect cannot be `sufficient`", at("sufficient")));
    asList(c.measured_by).forEach(function (mb) {
      if (!has(states, mb)) out.push(F("!", "`measured_by: " + mb + "` is not a declared state", at("measured_by", mb)));
      else if (!truthy((stateOf(mb) || {}).measures)) out.push(F("?", "`measured_by: " + mb + "` names a state that `measures` nothing", at("measured_by", mb)));
    });
    var attr = c.attribution, aType = isDict(attr) ? str(attr.type) : str(attr), aBy = isDict(attr) ? str(attr.by) : "";
    if (aBy && !has(actors, aBy)) out.push(F("!", "`attribution: {by: " + aBy + "}` is not a declared actor", at("attribution", aBy)));
    if (aType && ATTRIBUTIONS.indexOf(aType) < 0) out.push(F("?", "`attribution: " + aType + "` is not one of " + ATTRIBUTIONS.join(", "), at("attribution", aType)));
    var stance = str(c.stance);
    if (stance === "endorsed") out.push(F("?", "a report the text endorses is a claim in its own voice, not a stance on someone else's", at("stance")));
    else if (stance && STANCES.indexOf(stance) < 0) out.push(F("!", "`stance: " + stance + "` is not one of " + STANCES.join(", "), at("stance")));
    else if (stance && !reported) out.push(F("?", "`stance` says where the text stands on a view it reports, and this claim is not tagged #reported or #contested", at("stance")));
    if (str(c.design) === "illustration" && ["study", "statistics", "model"].indexOf(c.basis) >= 0)
      out.push(F("?", "`design: illustration` is a hypothetical case, and `basis: " + py(c.basis) + "` says the text tested the step", at("design")));
    var channel = str(c.channel), shape = str(c.shape), mark = str(c.mark);
    if (channel && !has(channels, channel)) out.push(F("!", "`channel: " + channel + "` is not declared under `channels:`", at("channel")));
    if (shape && SHAPES.indexOf(shape) < 0) out.push(F("!", "`shape: " + shape + "` is not one of " + SHAPES.join(", "), at("shape")));
    else if (shape && (sign === "+" || sign === "-" || sign === "0")) out.push(F("!", "`shape: " + shape + "` says the step rises and falls, and `sign: " + sign + "` gives it one direction", at("shape")));
    if (c.net != null && typeof c.net !== "boolean") out.push(F("!", "`net:` is `true` or `false`, not `" + py(c.net) + "`", at("net")));
    else if (truthy(c.net) && on !== "stock") out.push(F("!", "`net: true` is a flow that runs whichever way the gap points, and the step does not flow into a stock", at("net")));
    if (mark.length > 6) out.push(F("?", "`mark: " + mark + "` is drawn in a small circle on the arrow: six characters at most", at("mark")));
    var MAKES = { being: "makes", persistence: "maintains", possibility: "opens", chance: "makes likelier", stock: "flows into" };
    var UNMAKES = { being: "unmakes", persistence: "erodes", possibility: "closes", chance: "makes less likely", stock: "flows out of" };
    if (ONS.indexOf(on) < 0) out.push(F("!", "`on: " + on + "` is not one of " + ONS.join(", "), at("on")));
    else if (on === "character" && (sign === "+" || sign === "-" || sign === "0"))
      out.push(F("?", "`on: character` says the step changes what kind of thing " + py(dst) + " is, not how much of it there is, and `sign: " + sign + "` says how much", at("on")));
    else if (has(MAKES, on) && sign === "which")
      out.push(F("?", "`on: " + on + "` takes `+` (" + MAKES[on] + ") or `-` (" + UNMAKES[on] + "), not `which`", at("on")));
    var given = c.given == null || !truthy(c.given) ? [] : c.given;
    (Array.isArray(given) ? given : [given]).forEach(function (g) {
      if (isDict(g) && !has(states, g.state)) out.push(F("!", "`given: {state: " + py(g.state) + "}` is not a declared state", at("given", g.state == null ? null : py(g.state))));
    });
    asList(c.jointly).forEach(function (j) {
      if (!has(states, j)) out.push(F("!", "`jointly: " + j + "` is not a declared state", at("jointly", j)));
      else if (ends.indexOf(j) >= 0) out.push(F("?", "`jointly: " + j + "` names the step's own `from` or `to`", at("jointly", j)));
    });
    [["from", src], ["to", dst]].forEach(function (e) {
      var sid = e[1];
      if (sid == null) out.push(F("!", "a step has no `" + e[0] + ":`", at(null)));
      else if (!has(states, sid)) out.push(F("!", "`" + e[0] + ": " + py(sid) + "` is not a declared state", at(e[0])));
      else if (k.layer !== "appraisal" && appraisalState(sid))
        out.push(F("!", "a step the text asserts runs through `" + py(sid) + "`, which is declared as the appraisal's own state -- the text cannot assert a step through something only the reconstructor introduced", at(e[0])));
    });
    if (c.basis != null && BASES.indexOf(c.basis) < 0)
      out.push(F("?", "basis `" + py(c.basis) + "` is not one of " + BASES.join(", ") + "; the step is shaded as asserted" +
        (c.basis === "argued" ? ". `argued` is the census's tier for a step whose claim has support in the map, worked out from the map: write what the text offers (`asserted` if it offers nothing more)" : ""), at("basis")));
    unknownKeys(c, "causes").forEach(function (u) {
      out.push(F("!", "`" + u[0] + "` is not a key a step can carry, so it is never read" +
        (u[1] ? " -- did you mean `" + u[1] + "`?" : u[0] === "note" ? " -- a note goes on the claim, beside `fidelity:`, not inside `causes:`" : ""), onKey(at(u[0]))));
    });
    if (sign !== null && SIGNS.indexOf(sign) < 0) out.push(F("?", "sign `" + sign + "` is not `+`, `-`, `0` (no effect) or `which` (decides which)", at("sign")));
    var text = k.claim.joined != null ? k.claim.joined : (k.claim.text || "");
    var ne = isNull ? NOT_ENOUGH.exec(text) : null;
    if (ne) out.push(F("?", "a finding of no effect (" + py(src) + " -> " + py(dst) + "), in words that limit an effect rather than deny it (\"" + ne[0] + "\")", at("sign")));
    if (isNull && selects) out.push(F("?", "a step cannot be both a null finding and a selection link", at("selects")));
    if (assoc && (selects || isNull)) out.push(F("?", "an association is neither a selection link nor a finding of no effect: keep one", at("association")));
    var scope = str(c.scope);
    if (scope && SCOPES.indexOf(scope) < 0) out.push(F("?", "`scope: " + scope + "` is not `singular` or `general`", at("scope")));
    var am = ASSOCIATED.exec(text);
    if (am && !assoc && !isNull && !selects)
      out.push(F("?", py(src) + " -> " + py(dst) + " is a causal step, in words that report an association (\"" + am[0] + "\")", at(null)));
    if (isDict(c.how)) {
      var extra = sortStr(Object.keys(c.how).filter(function (x) { return ["actor", "situation", "habit", "response"].indexOf(x) < 0; }));
      if (extra.length) out.push(F("?", "`how:` reads actor, situation, habit and response; " + extra.join(", ") + " is ignored", at("how")));
      if (truthy(c.how.actor) && !has(actors, c.how.actor)) out.push(F("!", "`how: actor: " + py(c.how.actor) + "` is not a declared actor", at("how", py(c.how.actor))));
    }
  });
  return out;
}

// ---------------------------------------------------------------- the locator
/* A YAML OUTLINE GOOD ENOUGH TO POINT WITH. Front matter is block YAML, often with flow maps on one
 * line (`drought: {label: "...", actor: herders}`); a claim's data is a flow map, or block YAML
 * where its brace stands alone. `entries(text, from, to)` lists the keys directly inside a span,
 * each with where its key and value run; the rest is walking a path down through them. */

function skipWs(t, i, to) { while (i < to && /[ \t\r\n]/.test(t[i])) i++; return i; }
/** The end of a flow value starting at i: balanced brackets and quotes, up to a comma or closer at depth 0. */
function flowEnd(t, i, to) {
  var depth = 0, q = null;
  for (; i < to; i++) {
    var ch = t[i];
    if (q) { if (ch === "\\" && q === '"') { i++; continue; } if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") { if (depth === 0) return i; depth--; if (depth === 0) return i + 1; }
    else if (ch === "," && depth === 0) return i;
    else if (ch === "\n" && depth === 0) return i;
  }
  return to;
}
var KEY_AT = /^([A-Za-z_$][\w$-]*|"[^"\n]*"|'[^'\n]*'|[^\s:{}\[\],#'"][^:{}\[\],\n#]*?)\s*:(?=\s|$)/;
function unq(k) { return /^["']/.test(k) ? k.slice(1, -1) : k.trim(); }

/** Keys directly inside the span [from, to): a flow map `{…}` if the span opens with a brace, else
 *  block YAML. Each: {key, kf, kt, vf, vt}. */
function entries(t, from, to) {
  var out = [], i = skipWs(t, from, to);
  if (t[i] === "{") {
    var end = flowEnd(t, i, to);
    i++;
    while (i < end - 1) {
      i = skipWs(t, i, end);
      if (t[i] === "}" || i >= end) break;
      var m = KEY_AT.exec(t.slice(i, Math.min(end, i + 200)));
      if (!m) { var e0 = flowEnd(t, i, end); i = t[e0] === "," ? e0 + 1 : e0 + 1; continue; }
      var kf = i, kt = i + m[1].length, vf = skipWs(t, i + m[0].length, end);
      var vt = t[vf] === "," || t[vf] === "}" ? vf : flowEnd(t, vf, end);
      out.push({ key: unq(m[1]), kf: kf, kt: kt, vf: vf, vt: vt });
      i = t[vt] === "," ? vt + 1 : vt;
      if (t[i] === "}") break;
    }
    return out;
  }
  // Block YAML: the shallowest indent among the lines in the span is the children's.
  var lines = [], p = from;
  while (p < to) {
    var nl = t.indexOf("\n", p); if (nl < 0 || nl > to) nl = to;
    lines.push([p, nl]); p = nl + 1;
  }
  var ind = function (l) { var k = l[0]; while (k < l[1] && (t[k] === " " || t[k] === "\t")) k++; return k - l[0]; };
  var real = lines.filter(function (l) { var s = t.slice(l[0], l[1]).trim(); return s && s[0] !== "#"; });
  if (!real.length) return out;
  var base = Math.min.apply(null, real.map(ind));
  for (var li = 0; li < lines.length; li++) {
    var l = lines[li], s = t.slice(l[0], l[1]);
    if (!s.trim() || s.trim()[0] === "#" || ind(l) !== base) continue;
    var at = l[0] + base, rest = t.slice(at, l[1]);
    var dash = /^-\s+/.exec(rest); if (dash) { at += dash[0].length; rest = rest.slice(dash[0].length); }
    var km = KEY_AT.exec(rest);
    if (!km) continue;
    var vf2 = skipWs(t, at + km[0].length, l[1]), vt2;
    if (vf2 >= l[1]) {
      // The value is the indented block below, up to the next line at this indent or less.
      var lj = li + 1;
      while (lj < lines.length && (!t.slice(lines[lj][0], lines[lj][1]).trim() || ind(lines[lj]) > base)) lj++;
      vf2 = lj > li + 1 ? lines[li + 1][0] : l[1]; vt2 = lj > li + 1 ? lines[lj - 1][1] : l[1];
    } else if (t[vf2] === "{" || t[vf2] === "[") vt2 = flowEnd(t, vf2, to);
    else vt2 = l[1];
    out.push({ key: unq(km[1]), kf: at, kt: at + km[1].length, vf: vf2, vt: vt2 });
  }
  return out;
}
/** The items of a list value: `[a, {…}]` or block `- …` lines. Each: {f, t}. */
function items(t, from, to) {
  var i = skipWs(t, from, to), out = [];
  if (t[i] === "[") {
    var end = flowEnd(t, i, to); i++;
    while (i < end) {
      i = skipWs(t, i, end);
      if (t[i] === "]" || i >= end) break;
      var e = flowEnd(t, i, end);
      out.push({ f: i, t: e });
      i = t[e] === "," ? e + 1 : e + 1;
    }
    return out;
  }
  if (t[i] === "{") return [{ f: i, t: flowEnd(t, i, to) }];
  var re = /^([ \t]*)-\s+/gm, s = t.slice(from, to), m, starts = [];
  while ((m = re.exec(s))) starts.push(from + m.index + m[0].length);
  if (!starts.length) return [{ f: i, t: to }];
  return starts.map(function (st, k) { return { f: st, t: k + 1 < starts.length ? starts[k + 1] : to }; });
}

/** Where the front matter's YAML runs: between the opening `===` and the next one. */
function frontSpan(t) {
  var m = /^===[ \t]*\r?\n/.exec(t);
  if (!m) return null;
  var e = t.indexOf("\n===", m[0].length - 1);
  return e < 0 ? null : { f: m[0].length, t: e + 1 };
}
/** Walk a key path down the front matter. Returns the deepest entry reached and how far it got. */
function walkFm(t, path) {
  var fs = frontSpan(t);
  if (!fs) return null;
  var span = { f: fs.f, t: fs.t }, hit = null;
  for (var k = 0; k < path.length; k++) {
    var es = entries(t, span.f, span.t), e = null;
    for (var j = 0; j < es.length; j++) if (es[j].key === String(path[k])) { e = es[j]; break; }
    if (!e) break;
    hit = { e: e, depth: k + 1 };
    span = { f: e.vf, t: e.vt };
  }
  return hit;
}

/** The token `tok` as a whole word inside [f, t), or null. */
function findToken(t, f, to, tok) {
  if (tok == null || tok === "") return null;
  var esc = String(tok).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var re = new RegExp("(^|[^\\w-])(" + esc + ")(?![\\w-])", "g"), s = t.slice(f, to), m = re.exec(s);
  return m ? { from: f + m.index + m[1].length, to: f + m.index + m[1].length + m[2].length } : null;
}

/** Every line that defines `title` -- `[title]:` or `<title>:`, after a relation, a number or
 *  indentation -- and the `{…}` block that belongs to it, as {line span, block span}. */
function claimBlocks(t, title) {
  var esc = String(title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var re = new RegExp("^[ \\t]*(?:\\(\\d+\\)[ \\t]*|[+\\-_<>]+[ \\t]*)?(?:\\[" + esc + "\\]|<" + esc + ">)[ \\t]*:", "gm");
  var out = [], m;
  while ((m = re.exec(t))) {
    var ls = m.index, le = t.indexOf("\n", ls); if (le < 0) le = t.length;
    // Its block: on this line, or on the next few lines before anything else.
    var p = ls, open = -1, lines = 0;
    while (p < t.length && lines < 4) {
      var e = t.indexOf("\n", p); if (e < 0) e = t.length;
      var line = t.slice(p, e);
      var o = /\{\s*(?:[A-Za-z_$][\w$-]*|"[^"\n]*")\s*:|^\s*\{\s*$/.exec(line);
      if (o) { open = p + o.index + (line[o.index] === "{" ? 0 : line.indexOf("{", o.index) - o.index); break; }
      if (lines > 0 && line.trim() !== "" && !/^\s*\{/.test(line)) break;
      p = e + 1; lines++;
    }
    var span = null;
    if (open >= 0) {
      var depth = 0, q = null;
      for (var i = open; i < t.length; i++) {
        var ch = t[i];
        if (q) { if (ch === "\\" && q === '"') { i++; continue; } if (ch === q || ch === "\n" && q === "'") q = null; continue; }
        if (ch === '"') q = ch;
        else if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) { span = { f: open, t: i + 1 }; break; } }
      }
    }
    out.push({ line: { from: ls, to: le }, block: span });
  }
  return out;
}

/** The entries of a claim's `{…}` block, brace-alone (block YAML inside) or flow. */
function blockEntries(t, b) {
  var first = t.slice(b.f, t.indexOf("\n", b.f) < 0 ? b.t : Math.min(b.t, t.indexOf("\n", b.f)));
  if (/^\{\s*$/.test(first)) return entries(t, t.indexOf("\n", b.f) + 1, b.t - 1);
  return entries(t, b.f, b.t);
}

/** A fault in a value is marked on the value where it is a short scalar on the key's own line, and on
 *  the key otherwise: a whole nested map underlined says less than its key does. */
function valueOrKey(t, e, at) {
  if (at.onKey || !(e.vt > e.vf)) return { from: e.kf, to: e.kt };
  var v = t.slice(e.vf, e.vt);
  if (/\n/.test(v) || /^[{\[]/.test(v.trim())) return { from: e.kf, to: e.kt };
  return { from: e.vf, to: e.vf + v.replace(/\s+$/, "").length };
}

/** Where a finding goes in the text: {from, to}. Always somewhere -- the line of the claim, the
 *  `mechanism:` key, or the top of the file -- so nothing the checker would say goes unshown. */
function locate(t, at) {
  at = at || {};
  if (at.claim != null) {
    var defs = claimBlocks(t, at.claim);
    var pick = null, rel = null;
    for (var d = 0; d < defs.length && !pick; d++) {
      if (!defs[d].block) continue;
      var es = blockEntries(t, defs[d].block);
      for (var j = 0; j < es.length; j++) if (es[j].key === (at.rel || "causes")) { pick = defs[d]; rel = es[j]; break; }
    }
    if (!pick) return defs.length ? defs[0].line : { from: 0, to: Math.min(t.length, (t.indexOf("\n") + 1 || t.length + 1) - 1) };
    if (at.onValue && rel.vt > rel.vf) return { from: rel.vf, to: rel.vt };
    var its = items(t, rel.vf, rel.vt), it = its[at.i || 0] || its[0];
    if (!it) return { from: rel.kf, to: rel.kt };
    if (at.key == null) return { from: rel.kf, to: rel.kt };
    var kes = entries(t, it.f, it.t), ke = null;
    for (var k = 0; k < kes.length; k++) if (kes[k].key === at.key) { ke = kes[k]; break; }
    if (!ke) return { from: rel.kf, to: rel.kt };
    var tok = at.token != null ? findToken(t, ke.vf, ke.vt, at.token) : null;
    if (tok) return tok;
    return valueOrKey(t, ke, at);
  }
  if (at.fm) {
    var hit = walkFm(t, at.fm);
    if (hit && hit.depth < at.fm.length && at.fallback) {
      var hb = walkFm(t, at.fallback);
      if (hb && hb.depth > hit.depth) hit = hb;
    }
    if (hit) {
      var e = hit.e;
      if (at.token != null) { var tk = findToken(t, e.vf, e.vt, at.token); if (tk) return tk; }
      return hit.depth === at.fm.length ? valueOrKey(t, e, at) : { from: e.kf, to: e.kt };
    }
    var fs = frontSpan(t);
    if (fs) return { from: 0, to: 3 };
  }
  return { from: 0, to: Math.min(t.length, 3) };
}

/** The diagnostics for CodeMirror: each finding, located. A fault is a warning, not an error --
 *  the file still parses and draws -- and a query is information. */
function lint(t, graph) {
  return findings(graph).map(function (f) {
    var r = locate(t, f.at);
    return { from: r.from, to: Math.max(r.to, r.from + 1), severity: f.sev === "!" ? "warning" : "info",
             message: f.msg + (f.sev === "?" ? "  (a query: the checker asks, and it may be right as it is)" : "") };
  });
}

// ---------------------------------------------------------------- where the cursor is
/** What is being written at `pos`: inside a step's or a relation's map, the front matter's
 *  `mechanism:` block, or neither. {zone, path, key, inKey, from, word}:
 *    zone "causes" | "constitutes" | "fm";
 *    path: for "fm", the keys down to the map the cursor is in (["mechanism", "states", "drought"]);
 *    key: the key whose value the cursor is in, or null when a key is being written;
 *    from/word: the start and text of the word being written. */
function contextAt(t, pos) {
  var w = /[\w$.+\-]*$/.exec(t.slice(Math.max(0, pos - 60), pos));
  var word = w ? w[0] : "", from = pos - word.length;
  var fs = frontSpan(t);
  if (fs && pos >= fs.f && pos <= fs.t) {
    var path = [], span = { f: fs.f, t: fs.t }, key = null;
    for (var depth = 0; depth < 8; depth++) {
      var es = entries(t, span.f, span.t), inside = null;
      for (var j = 0; j < es.length; j++) {
        var e = es[j];
        if (pos >= e.kf && pos <= e.kt) return { zone: "fm", path: path, key: null, from: from, word: word };
        if (pos > e.kt && pos <= Math.max(e.vt, e.kt + 1)) { inside = e; break; }
      }
      if (!inside) {
        // A new key being typed on a line of its own, at this level.
        return { zone: "fm", path: path, key: null, from: from, word: word };
      }
      // A scalar or a list of scalars: the cursor is in this key's value.
      var vs = skipWs(t, inside.vf, inside.vt);
      var nested = entries(t, inside.vf, inside.vt).length && !(t[vs] === "[");
      if (!nested) return { zone: "fm", path: path, key: inside.key, from: from, word: word };
      path = path.concat([inside.key]);
      span = { f: inside.vf, t: inside.vt };
      key = inside.key;
    }
    return { zone: "fm", path: path, key: null, from: from, word: word };
  }
  // A claim's `{…}` block: find the innermost `causes:`/`constitutes:` item around pos.
  var start = t.lastIndexOf("\n", pos - 1) + 1, look = Math.max(0, start - 2000);
  var seg = t.slice(look, pos), m, best = null, re = /\b(causes|constitutes)\s*:/g;
  while ((m = re.exec(seg))) best = { rel: m[1], at: look + m.index + m[0].length };
  if (!best) return null;
  // Still inside the relation's value? Brackets opened since must not have closed below zero.
  var depth2 = 0, q = null, opened = [];
  for (var i = best.at; i < pos; i++) {
    var ch = t[i];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === '"') q = ch;
    else if (ch === "{" || ch === "[") { depth2++; opened.push(i); }
    else if (ch === "}" || ch === "]") { depth2--; opened.pop(); if (depth2 < 0) return null; }
  }
  if (depth2 <= 0) {
    // Block style, or the value not yet opened: `causes: ` with nothing after.
    if (/^\s*$/.test(t.slice(best.at, pos))) return { zone: best.rel, path: [], key: null, from: from, word: word, bare: true };
    return null;
  }
  // The innermost open map: is the cursor writing a key, or a value?
  var inner = opened[opened.length - 1];
  var tail = t.slice(inner + 1, pos);
  var lastSep = Math.max(tail.lastIndexOf(","), tail.lastIndexOf("{"), tail.lastIndexOf("\n"));
  var piece = tail.slice(lastSep + 1);
  var kv = /^\s*([A-Za-z_$][\w$-]*)\s*:\s*(\[?)\s*(.*)$/.exec(piece);
  var listKey = null;
  if (t[inner] === "[") {
    // Inside a list: of steps (`causes: [`) or of ids (`via: [`).
    var before = t.slice(Math.max(best.at, inner - 40), inner);
    var lk = /([A-Za-z_$][\w$-]*)\s*:\s*$/.exec(before);
    listKey = lk ? lk[1] : null;
    if (listKey && listKey !== best.rel) return { zone: best.rel, path: [], key: listKey, from: from, word: word };
    return { zone: best.rel, path: [], key: null, from: from, word: word };
  }
  var parentKey = (function () {
    var b = t.slice(Math.max(best.at, inner - 40), inner);
    var pk = /([A-Za-z_$][\w$-]*)\s*:\s*\[?\s*$/.exec(b);
    return pk ? pk[1] : null;
  })();
  var path2 = parentKey && parentKey !== best.rel ? [parentKey] : [];
  if (kv) return { zone: best.rel, path: path2, key: kv[1], from: from, word: word };
  return { zone: best.rel, path: path2, key: null, from: from, word: word };
}

// ---------------------------------------------------------------- completion
var REFS = { from: "state", to: "state", via: "state", unless: "state", despite: "state", jointly: "state",
             measured_by: "state", by: "state", state: "state", part_of: "state", measures: "state", general: "state",
             chain: "chain", channel: "channel", actor: "actor", level: "level", levels: "level", kind: "kind",
             conditioned: "state" };
/** Values a key takes, from the registry's `values`, or the alternatives its `type` lists. */
function valuesOf(entry) {
  if (!entry) return null;
  if (Array.isArray(entry.values)) return entry.values.map(String);
  var ty = String(entry.type || "");
  if (/\|/.test(ty) && !/\bid\b|string|map|list/.test(ty)) return ty.split("|").map(function (x) { return x.trim(); }).filter(Boolean);
  if (ty === "boolean") return ["true", "false"];
  return null;
}
function oneLine(s) { s = String(s || ""); var k = s.search(/[.;:](\s|$)/); return k > 0 && k < 140 ? s.slice(0, k + 1) : s.length > 140 ? s.slice(0, 139) + "…" : s; }

/** The registry entry for key `key` at a context, and the keys allowed there. */
function registryAt(ctx) {
  if (!PROFILE) return null;
  if (ctx.zone === "causes" || ctx.zone === "constitutes") {
    var base = PROFILE[ctx.zone];
    if (ctx.path.length && base[ctx.path[0]] && base[ctx.path[0]].keys) {
      var sub = base[ctx.path[0]].keys, out = {};
      Object.keys(sub).forEach(function (k) { out[k] = typeof sub[k] === "string" ? { type: sub[k] } : sub[k]; });
      return out;
    }
    if (ctx.path[0] === "modifies") return { by: { type: "state id", summary: "The moderating state." },
      effect: { type: "enum", values: ["strengthens", "weakens", "reverses", "0"], summary: "What it does to the step." },
      period: { type: "string", summary: "When it moderates, in the text's words." } };
    if (ctx.path[0] === "size") return { value: { type: "string" }, unit: { type: "string" }, ci: { type: "string" }, versus: { type: "string" }, at: { type: "string" } };
    if (ctx.path[0] === "given") return { state: { type: "state id", summary: "A declared state the step is conditioned on." }, value: { type: "string", summary: "The value it has." } };
    if (ctx.path[0] === "attribution") return { type: { type: "enum", values: ATTRIBUTIONS }, by: { type: "actor id" } };
    return Object.keys(base).reduce(function (o, k) { if (k !== "summary") o[k] = base[k]; return o; }, {});
  }
  if (ctx.zone === "fm") {
    var p = ctx.path;
    if (!p.length) return PROFILE.map_frontmatter;
    if (p[0] !== "mechanism") return null;
    var mech = PROFILE.mechanism;
    if (p.length === 1) return mech;
    var col = { states: 1, actors: 1, chains: 1, kinds: 1, channels: 1 };
    if (p.length === 3 && col[p[1]]) {
      if (p[1] === "channels") return { label: { type: "string", summary: "The kind of link, in the text's words." } };
      var ks = mech[p[1]] && mech[p[1]].keys;
      if (!ks) return null;
      var o2 = {};
      Object.keys(ks).forEach(function (k) { o2[k] = { type: String(ks[k]).split(":")[0], summary: ks[k] }; });
      return o2;
    }
    if (p.length === 2 && p[1] === "ordering") return { kind: { type: Object.keys(ORDERINGS).join(" | ") }, pinpoint: { type: "string" } };
    return null;
  }
  return null;
}

/** The ids declared in the front matter, with what a reader needs to choose among them. */
function declaredIds(graph) {
  var b = graph && graph.mechanism && graph.mechanism.block;
  b = isDict(b) ? b : {};
  var pick = function (o) { return isDict(o) ? o : {}; };
  var lbl = function (x) { return isDict(x) && x.label != null ? String(x.label) : ""; };
  var out = { state: [], actor: [], chain: [], kind: [], channel: [], level: [] };
  var st = pick(b.states), ac = pick(b.actors);
  Object.keys(st).forEach(function (id) {
    var s = pick(st[id]), who = asList(s.actor).map(function (a) { return lbl(ac[a]) || a; }).join(", ");
    var role = rolesOf(s).join(", ");
    out.state.push({ id: id, label: lbl(s), detail: [who, role].filter(Boolean).join(" · ") });
  });
  Object.keys(ac).forEach(function (id) { out.actor.push({ id: id, label: lbl(ac[id]), detail: ac[id] && ac[id].level != null ? String(ac[id].level) : "" }); });
  Object.keys(pick(b.chains)).forEach(function (id) { out.chain.push({ id: id, label: lbl(b.chains[id]), detail: b.chains[id] && b.chains[id].question ? String(b.chains[id].question) : "" }); });
  Object.keys(pick(b.kinds)).forEach(function (id) { out.kind.push({ id: id, label: lbl(b.kinds[id]), detail: "" }); });
  Object.keys(pick(b.channels)).forEach(function (id) { out.channel.push({ id: id, label: lbl(b.channels[id]), detail: "" }); });
  (Array.isArray(b.levels) ? b.levels : DEFAULT_LEVELS).forEach(function (lv) { out.level.push({ id: String(lv), label: "", detail: "" }); });
  return out;
}

/** What to offer at `pos`: {from, options: [{label, detail, info, apply, type}]} or null.
 *  Keys with their one-line meanings; after a key that names a state, a chain, an actor or a level,
 *  the declared ones with their labels; after a key with listed values, the values. */
function complete(t, pos, graph) {
  // A CLAIM THAT STANDS FOR A CHAIN (1.20): after `mechanism:` in a claim's `{…}`, the declared chains.
  var fs0 = frontSpan(t);
  if (!(fs0 && pos >= fs0.f && pos <= fs0.t)) {
    var mm = /\{[^{}\n]*\bmechanism\s*:\s*([\w$.-]*)$/.exec(t.slice(Math.max(0, pos - 300), pos));
    if (mm) {
      var cs = declaredIds(graph).chain.map(function (x) { return { label: x.id, detail: x.label, info: x.detail, type: "constant" }; });
      cs.push({ label: "true", detail: "the whole mechanism", info: "For a map that declares no chains.", type: "keyword" });
      return { from: pos - mm[1].length, options: cs };
    }
  }
  var ctx = contextAt(t, pos);
  if (!ctx) return null;
  var reg = registryAt(ctx), ids = declaredIds(graph), opts = [];
  if (ctx.key == null) {
    if (!reg) return null;
    if (ctx.bare) {
      opts.push({ label: "{from: …, to: …, sign: …}", apply: "{from: , to: , sign: \"+\", basis: asserted}", detail: "a whole step", type: "text",
                  info: "A step: from one declared state to another, its sign, and what the text offers for it." });
    }
    // The keys already written in this map are not offered again.
    var open = t.lastIndexOf("{", pos - 1), taken = {};
    if (ctx.zone !== "fm" && open >= 0) {
      var seg = t.slice(open, pos), km, kre = /([A-Za-z_$][\w$-]*)\s*:/g;
      while ((km = kre.exec(seg))) taken[km[1]] = true;
    }
    Object.keys(reg).forEach(function (k) {
      if (k === "summary" || taken[k]) return;
      var e = reg[k] || {};
      opts.push({ label: k, apply: k + ": ", detail: String(e.type || ""), info: e.summary ? String(e.summary) : "", type: "property" });
    });
    return opts.length ? { from: ctx.from, options: opts } : null;
  }
  var kind = REFS[ctx.key];
  if (ctx.zone === "fm" && ctx.key === "actor") kind = "actor";
  if (ctx.zone === "fm" && (ctx.key === "level" || ctx.key === "levels") && ctx.path[1] !== undefined) kind = "level";
  if (ctx.zone === "constitutes" && ctx.key === "to") {
    var both = ids.state.map(function (s) { return { label: s.id, detail: s.label, info: s.detail, type: "variable" }; })
      .concat(ids.actor.map(function (a) { return { label: a.id, detail: (a.label || "") + " (actor)", info: a.detail, type: "class" }; }));
    return both.length ? { from: ctx.from, options: both } : null;
  }
  if (kind && ids[kind]) {
    ids[kind].forEach(function (x) { opts.push({ label: x.id, detail: x.label, info: x.detail, type: kind === "state" ? "variable" : "constant" }); });
    return opts.length ? { from: ctx.from, options: opts } : null;
  }
  var entry = reg && reg[ctx.key];
  var vals = valuesOf(entry);
  if (ctx.key === "sign") vals = ["+", "-", "0", "which"];
  if (vals) {
    var SAY = { "+": "raises", "-": "lowers", "0": "a finding of no effect", which: "decides which" };
    vals.forEach(function (v) {
      var quoted = /^[+\-0]$/.test(v) || /\s/.test(v) ? '"' + v + '"' : v;
      opts.push({ label: v, apply: quoted, detail: SAY[v] || "", info: entry && entry.summary ? oneLine(entry.summary) : "", type: "enum" });
    });
    return { from: ctx.from, options: opts };
  }
  return null;
}

// ---------------------------------------------------------------- hover
/** What to say when the pointer rests at `pos`: a declared id with its label, actor, level and
 *  role; a key with its meaning and the version that added it. A string, or null. */
function hover(t, pos, graph) {
  var s = t.slice(Math.max(0, pos - 60), pos + 60), off = Math.min(pos, 60);
  var re = /[A-Za-z_$][\w$.-]*/g, m, word = null, wf = 0;
  while ((m = re.exec(s))) if (m.index <= off && off <= m.index + m[0].length) { word = m[0]; wf = pos - off + m.index; break; }
  if (!word) return null;
  var isKey = /^\s*:/.test(t.slice(wf + word.length, wf + word.length + 3));
  var ctx = contextAt(t, wf);
  if (!ctx) return null;
  if (isKey) {
    var reg = registryAt({ zone: ctx.zone, path: ctx.path.concat(ctx.key && ctx.zone === "fm" ? [] : []), key: null });
    // In the front matter the key's own map is the one the cursor's path names.
    var e = reg && reg[word];
    if (!e) return null;
    var since = /\(since (1\.\d+)\)|\(added in (1\.\d+)\)/.exec(String(e.summary || ""));
    return "`" + word + "`" + (e.type ? " — " + e.type : "") + "\n" + String(e.summary || "") +
      (since ? "" : "");
  }
  var ids = declaredIds(graph), b = graph && graph.mechanism && graph.mechanism.block;
  var st = ids.state.filter(function (x) { return x.id === word; })[0];
  if (st) {
    var raw = isDict(b) && isDict(b.states) ? b.states[word] : {};
    raw = isDict(raw) ? raw : {};
    var bits = [];
    var acts = isDict(b) && isDict(b.actors) ? b.actors : {};
    if (raw.actor != null) bits.push("actor: " + asList(raw.actor).map(function (a) { return isDict(acts[a]) && acts[a].label != null ? py(acts[a].label) : a; }).join(", "));
    if (raw.levels != null) bits.push("levels: " + asList(raw.levels).join(", "));
    if (raw.role != null) bits.push("role: " + rolesOf(raw).join(", "));
    if (raw.aspect != null) bits.push("aspect: " + py(raw.aspect));
    if (raw.status != null) bits.push("status: " + py(raw.status));
    return "state `" + word + "`: " + (st.label || "(no label)") + (bits.length ? "\n" + bits.join(" · ") : "");
  }
  var groups = [["actor", "actor"], ["chain", "chain"], ["kind", "kind"], ["channel", "channel"]];
  for (var g = 0; g < groups.length; g++) {
    var x = ids[groups[g][0]].filter(function (y) { return y.id === word; })[0];
    if (x) return groups[g][1] + " `" + word + "`: " + (x.label || "(no label)") + (x.detail ? "\n" + x.detail : "");
  }
  return null;
}

/** Where a claim's readback goes: the end of the `{…}` block that carries its `causes:`, or null. */
function stepAnchor(t, title) {
  var defs = claimBlocks(t, title);
  for (var d = 0; d < defs.length; d++) {
    if (!defs[d].block) continue;
    var es = blockEntries(t, defs[d].block);
    for (var j = 0; j < es.length; j++) if (es[j].key === "causes") return defs[d].block.t - 1;
  }
  return null;
}

var API = { stepAnchor: stepAnchor, findings: findings, declared: declared, locate: locate, lint: lint, contextAt: contextAt,
            complete: complete, hover: hover, entries: entries, nearest: nearest, py: py, PROFILE: PROFILE };
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (global) /** @type {any} */ (global).ArgdownMechanismLint = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
