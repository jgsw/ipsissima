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
// WHAT KIND OF ORDERING THE LEVELS ARE (profile 1.10) -- mechanism.py's ORDERINGS, word for word.
var ORDERINGS = { composition: "parts within wholes", space: "regions within regions", authority: "a chain of command",
                  scale: "larger and smaller, not containing", sequence: "an order along a chain", systems: "separate systems",
                  mixed: "more than one ordering", unstated: "an ordering the text does not name" };
var NESTING = ["composition", "space", "authority"];
/** What the chart says its levels are, in words: the reader who has not read the paper is told
 *  (James, 30 Sep 2026: "I wasn't really sure what the levels in the paper were supposed to be
 *  doing"). A map that does not say is said not to. */
function orderingWords(o) {
  if (!o || !o.kind) return "levels: the map does not say what ordering they are";
  return "levels: " + ORDERINGS[o.kind] + (o.stated ? ", as the text says (" + o.stated + ")" : ", as the reconstructor reads them");
}
/** The nesting a map declares: its `within:` tree, or a chain where it says its levels nest
 *  without giving a tree; null where it says they do not nest. `declared` is false where the map
 *  says nothing (or `mixed`, `unstated`), and the frames are the reader's assumption. */
function nestingOf(o) {
  o = o || { kind: null, within: [] };
  if (o.kind && NESTING.indexOf(o.kind) < 0 && o.kind !== "mixed" && o.kind !== "unstated") return { offer: false };
  var declared = !!o.kind && NESTING.indexOf(o.kind) >= 0;
  var spec = /** @type {any} */ ("chain");
  if (o.within && o.within.length) { var par = {}; o.within.forEach(function (q) { par[q[0]] = q[1]; }); spec = { parent: par }; }
  return { offer: true, declared: declared, spec: spec };
}
/** `ordering:` and `within:` as the checker's level_order reads them: {kind, stated, within}. */
function levelOrder(block, levels) {
  var raw = block.ordering, kind = null, stated = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) { kind = raw.kind == null ? null : raw.kind; stated = raw.pinpoint == null ? null : raw.pinpoint; }
  else if (raw != null) kind = raw;
  if (kind != null) { kind = String(kind); if (!has(ORDERINGS, kind)) kind = null; }
  var pairs = [], w = block.within;
  if (w && typeof w === "object" && !Array.isArray(w))
    Object.keys(w).forEach(function (c) { var par = String(w[c]); c = String(c);
      if (levels.indexOf(c) >= 0 && levels.indexOf(par) >= 0 && c !== par) pairs.push([c, par]); });
  var parent = {}; pairs.forEach(function (q) { parent[q[0]] = q[1]; });
  for (var i = 0; i < levels.length; i++) {
    var seen = {}, pp = parent[levels[i]];
    while (pp != null && !seen[pp]) { seen[pp] = true; pp = parent[pp]; }
    if (pp != null) { pairs = []; break; }
  }
  pairs.sort(function (a, b) { return levels.indexOf(a[0]) - levels.indexOf(b[0]); });
  return { kind: kind, stated: stated == null ? null : String(stated), within: pairs };
}
var BASES = ["study", "statistics", "model", "example", "testimony", "asserted"];
// PROCESS, FORMATION AND CONSTITUTION (profile 1.11) -- mechanism.py's ASPECTS, FORMATION and FORMS.
var ASPECTS = ["quantity", "activity", "development", "event", "condition"];
var FORMATION = ["being", "persistence", "character", "possibility"];
// CAUSAL REASONING (profile 1.13) -- mechanism.py's GOALS and SCOPES.
var GOALS = ["explain", "intervene", "predict", "attribute"];
var SCOPES = ["singular", "general"];
// HOW THE TEXT REASONS ABOUT CAUSES (profile 1.14) -- mechanism.py's ACCOUNTS.
var ACCOUNTS = ["regularity", "manipulability", "mechanism", "counterfactual", "intra-action"];
function accountOf(b) { return asList(obj(b).account).filter(function (a) { return ACCOUNTS.indexOf(a) >= 0; }); }
// BRIDGES FROM THE MECHANISM INTO THE ARGUMENT (profile 1.15) -- profile.json's "bridges", held
// equal to it by test_profile.py. An inference line naming one of these is a causal move from
// step-bearing premises, not a deductive rule; the Reasons view draws its short name and asks
// its questions, and the census lists it.
var BRIDGES = [
   {
    "name": "From cause to effect",
    "short": "cause → effect",
    "move": "The steps bring the effect about, so it will or does occur.",
    "questions": [
     "How strong is each step, and what backs it?",
     "Does anything stated block or counteract the effect (unless, despite, a rival route, a regime)?"
    ]
   },
   {
    "name": "From effect to cause",
    "short": "effect → cause",
    "move": "The mechanism best explains what was observed.",
    "questions": [
     "Which rival accounts does the text set out?",
     "How thorough is the account: where does the chain stop?"
    ]
   },
   {
    "name": "From correlation to cause",
    "short": "correlation → cause",
    "move": "Two things go together, so one brings the other about.",
    "questions": [
     "Is there a common cause?",
     "Could it run the other way?",
     "Is it mediated, and over what range does it hold?",
     "Is the measure itself the source of the change?"
    ]
   },
   {
    "name": "From cases to a general mechanism",
    "short": "cases → general",
    "move": "The steps hold in these cases, so the general step holds.",
    "questions": [
     "Are the cases kinds of the general step?",
     "How many cases, and how different?",
     "Is a general claim drawn from one case?"
    ]
   },
   {
    "name": "From there to here",
    "short": "there → here",
    "move": "A conclusion established in one setting -- a study population, a case, a thought experiment, a model, another country -- is carried to another, because the mechanism that produced it is shared.",
    "questions": [
     "Is the mechanism of action present here?",
     "Are its support factors (its `jointly` and `given` conditions) said to hold here?",
     "Is there a counteracting mechanism here that was absent there?",
     "For a stipulated case: what did it stipulate that the world does not have?",
     "For a normative conclusion: does the consideration keep its weight and polarity here?"
    ]
   },
   {
    "name": "From a mechanism to what to do",
    "short": "means → end",
    "move": "A route runs from an action to a valued outcome, so the action should be taken.",
    "questions": [
     "What other goals does the action bear on?",
     "What other routes reach the goal?",
     "Can the action be taken: does anything block it?",
     "What other consequences does it have?"
    ]
   },
   {
    "name": "From consequences",
    "short": "consequences",
    "move": "A route runs to a good or bad outcome, so the policy, rule or view is good or bad.",
    "questions": [
     "Does the route exist in the text?",
     "What other consequences does the text give?",
     "What criterion of good or bad does the step rely on?"
    ]
   },
   {
    "name": "From a mechanism to a possibility",
    "short": "lever",
    "move": "The mechanism has a lever, so things can be otherwise.",
    "questions": [
     "Does anything block the lever?",
     "Is the outcome only possible, or open?"
    ]
   },
   {
    "name": "From a mechanism against a theory",
    "short": "against a theory",
    "move": "A mechanism the theory denies or ignores holds, so the theory fails.",
    "questions": [
     "Does the mechanism hold where the theory claims to hold (scope, regime, conditions)?"
    ]
   },
   {
    "name": "From a mechanism to a classification",
    "short": "classification",
    "move": "What the mechanism does makes the case one of a kind (forced, momentous, brittle).",
    "questions": [
     "Does the mechanism establish each condition the kind requires?"
    ]
   },
   {
    "name": "Genealogical debunking",
    "short": "debunking genealogy",
    "move": "A view is produced by a cause that does not track its truth, so its claim to authority fails.",
    "questions": [
     "Is the producing cause one that could not track the truth?",
     "Does the critique apply to the critic's own view?"
    ]
   },
   {
    "name": "Vindicatory genealogy",
    "short": "vindicating genealogy",
    "move": "A practice or view came about because it meets needs we have, so it merits our confidence.",
    "questions": [
     "Does the process that formed it give reasons to prefer it over its rivals, including giving it up?",
     "Whose needs are these, and do we share and endorse them?",
     "Do the needs the story starts from still hold for us?",
     "Is the story's order historical, or the order in which complications are added?"
    ]
   },
   {
    "name": "From a genealogy to contingency",
    "short": "contingent genealogy",
    "move": "A practice or view came about by a process that gives no reason to prefer it over its rivals, so it is rationally contingent: it could as well have been otherwise.",
    "questions": [
     "Does the formation process really give no reason to prefer it?",
     "Is contingency being taken as a reason against it, which it is not?",
     "Would a rival have met the same needs as well?"
    ]
   }
  ];
var BRIDGE_BY_NAME = {};
BRIDGES.forEach(function (b) { BRIDGE_BY_NAME[b.name.toLowerCase()] = b; });
/** The scheme a line's rule names, or null: exactly one name, and a registered one. */
function bridgeScheme(rules) {
  var names = (rules || []).map(function (r) { return String(r).trim().toLowerCase(); }).filter(Boolean);
  return names.length === 1 && BRIDGE_BY_NAME[names[0]] ? BRIDGE_BY_NAME[names[0]] : null;
}
function goalOf(b) { var g = obj(b).goal; return g != null && GOALS.indexOf(String(g)) >= 0 ? String(g) : null; }
/** The form a block or a chain declares -- mechanism.py's form_of, less its problems. */
function formOf(b) {
  b = obj(b);
  var form = b.form == null ? "chain" : String(b.form);
  if (form !== "chain" && form !== "cycle") form = "chain";
  return { form: form, settles: typeof b.settles === "boolean" ? b.settles : null };
}
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
  // Its actor's level -- or, since 1.12, each of its actors' levels, top first.
  var lvs = {};
  asList(obj(state).actor).forEach(function (a) { var l = obj(actors[a]).level; if (l) lvs[l] = true; });
  return levels.filter(function (l) { return lvs[l]; });
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
              // AN OBJECTION THE TEXT VOICES IS NOT THE TEXT'S CHAIN -- as the checker has it.
              : (tags.indexOf("reported") >= 0 || tags.indexOf("contested") >= 0) ? "rival" : "text";
    if (layer === "appraisal") appraisalClaims++;
    var supports = (c.id != null ? (supportsOf[c.id] || 0) : 0) + (concluded[c.title] ? 1 : 0);
    (c.causes || []).forEach(function (raw, i) {
      raw = obj(raw);
      var tier = c.fidelity === "imputation" ? "imputed"
               : (TIER_OF_BASIS[raw.basis] || "asserted");
      // A HYPOTHETICAL ILLUSTRATION IS NOT AN EXAMPLE (1.9) -- as the checker has it.
      if (c.fidelity !== "imputation" && String(raw.design) === "illustration") tier = "asserted";
      var stance = raw.stance == null ? "" : String(raw.stance);
      var mods = raw.modifies == null ? [] : (Array.isArray(raw.modifies) ? raw.modifies : [raw.modifies]);
      if (tier === "asserted" && supports) tier = "argued";
      var given = raw.given == null ? [] : (Array.isArray(raw.given) ? raw.given : [raw.given]);
      var sign = raw.sign == null ? "" : String(raw.sign);
      steps.push({
        id: c.title + "#" + i, claim: c, from: raw.from, to: raw.to,
        layer: layer,
        reported: layer === "rival", stance: stance,
        // MODIFIES, NECESSARY, SUFFICIENT, DESIGN, ATTRIBUTION (profile 1.9) -- see mechanism.py.
        modifies: mods.map(function (m) { m = obj(m);
          return { by: m.by == null ? "" : String(m.by), effect: m.effect == null ? "" : String(m.effect),
                   period: m.period == null ? "" : String(m.period) }; }),
        necessary: raw.necessary, sufficient: raw.sufficient, measuredBy: asList(raw.measured_by),
        design: raw.design == null ? "" : String(raw.design),
        attribution: raw.attribution == null ? "" : typeof raw.attribution === "object" ? (raw.attribution.type == null ? "" : String(raw.attribution.type)) : String(raw.attribution),
        attributionBy: raw.attribution && typeof raw.attribution === "object" && raw.attribution.by != null ? String(raw.attribution.by) : "",
        sign: sign, basis: raw.basis || null, tier: tier, fidelity: FIDELITY.indexOf(c.fidelity) >= 0 ? c.fidelity : "compression",
        // A NULL FINDING (sign 0) and a SELECTION LINK are reported, never walked: see mechanism.py.
        isNull: sign === "0", selects: !!raw.selects, hedged: !!raw.hedged,
        // AN ASSOCIATION and a SCOPE (profile 1.13) -- see mechanism.py.
        assoc: !!raw.association, scope: raw.scope == null ? "" : String(raw.scope),
        lag: raw.lag == null ? "" : String(raw.lag), given: given.map(condText),
        how: raw.how && typeof raw.how === "object" ? raw.how : null,
        reflexive: !!raw.reflexive, supports: supports,
        // JOINTLY (profile 1.4): the states together with which alone the step holds.
        jointly: asList(raw.jointly),
        // CHAIN (profile 1.5): which of the text's chains the step belongs to.
        chain: asList(raw.chain),
        // VIA (profile 1.8): the finer route the text opens this step into. Not `via`, which a
        // folded route already carries for the states folded into it.
        statedVia: asList(raw.via),
        // UNLESS and DESPITE (profile 1.8): a blocker, and a blocker that failed.
        unless: asList(raw.unless), despite: asList(raw.despite),
        // PERIOD and ON (profile 1.8, G7): when the step holds, and whether it moves a level or a trend.
        period: raw.period == null ? "" : String(raw.period), on: raw.on == null ? "level" : String(raw.on),
        // SHARE and SIZE (profile 1.8, G3) -- mechanism.py's `share` and _size.
        share: raw.share != null ? String(raw.share) : raw.via != null ? "entire" : "",
        // REGIME and THRESHOLD (profile 1.8, G2).
        regime: raw.regime == null ? "" : String(raw.regime), threshold: raw.threshold == null ? "" : String(raw.threshold),
        size: sizeText(raw.size), sizeValue: raw.size && typeof raw.size === "object" && raw.size.value != null ? String(raw.size.value) : ""
      });
    });
  });
  var ok = steps.filter(function (s) { return has(states, s.from) && has(states, s.to); });
  // WHAT CONSTITUTES WHAT (profile 1.11) -- mechanism.py's constitutions: never walked, never a step.
  // Its `to` may be a state or an actor; malformed ones are the checker's to name, and are dropped.
  var consts = [];
  (m.claims || []).forEach(function (c) {
    var tags = c.tags || [];
    var layer = tags.indexOf("appraisal") >= 0 ? "appraisal"
              : (tags.indexOf("reported") >= 0 || tags.indexOf("contested") >= 0) ? "rival" : "text";
    (c.constitutes || []).forEach(function (raw) {
      raw = obj(raw);
      var txt = function (k) { return raw[k] == null ? "" : String(raw[k]); };
      if (!has(states, raw.from) || !(has(states, raw.to) || has(actors, raw.to)) || raw.from === raw.to) return;
      consts.push({ claim: c, layer: layer, from: String(raw.from), to: String(raw.to), toActor: !has(states, raw.to),
                    extent: txt("extent"), whole: txt("whole"), under: txt("under"), basis: raw.basis == null ? null : String(raw.basis) });
    });
  });
  var chains = chainsOf(block), kinds = kindsOf(block);
  // CLAIMS THE ARGUMENT SETS AGAINST EACH OTHER (`><`, an attack), by title -- mechanism.py's
  // _disputed reads the same relations. The appraisal's are left out, as the checker leaves them.
  var titleOfId = {};
  (graph.nodes || []).forEach(function (n) { if (!isAppraisalNode(n)) titleOfId[n.id] = n.label; });
  var against = {};
  (graph.edges || []).forEach(function (e) {
    if ((e.type === "attack" || e.type === "contradictory") && titleOfId[e.from] != null && titleOfId[e.to] != null)
      against[titleOfId[e.from] + "\u0000" + titleOfId[e.to]] = against[titleOfId[e.to] + "\u0000" + titleOfId[e.from]] = true;
  });
  var ordering = levelOrder(block, levels);
  var form = formOf(block);
  var reasoning = { goal: goalOf(block), contrast: block.contrast == null ? null : String(block.contrast), account: accountOf(block) };
  var prof = profile(levels, actors, states, ids, ok,
                     m.appraisal != null ? m.appraisal : appraisalClaims, chains, kinds, against, ordering,
                     form, consts, reasoning);
  // WHERE THE CHAIN STOPS AND THE ARGUMENT TAKES IT ON, and THE BRIDGES (1.15) -- mechanism.py's
  // taken_up and bridges, field for field, from the parser's own records (graph.mechanism).
  var reasonSet = {}; (m.reasons || []).forEach(function (t) { reasonSet[t] = true; });
  var gapStates = {}; (prof.gaps || []).forEach(function (g) { var p = String(g && g.message != null ? g.message : g).split("`"); if (p.length >= 3) gapStates[p[1]] = true; });
  prof.taken_up = uniqSorted(ok.filter(function (s) { return s.layer === "text" && gapStates[s.to] && reasonSet[s.claim.title]; })
                               .map(function (s) { return [s.to, s.claim.title]; }));
  var stepTitles = {};
  (m.claims || []).forEach(function (c) { stepTitles[c.title] = true; });
  prof.bridges = uniqSorted((m.inferences || []).map(function (f) {
    var sch = bridgeScheme(f.rules);
    return sch ? [f.argument, f.step, sch.name, f.inputs.length, f.inputs.filter(function (t) { return stepTitles[t]; }).length] : null;
  }).filter(Boolean));
  // THERE AND HERE (1.17): mechanism.py's transfers, field for field -- a "From there to here"
  // bridge's premise steps by the setting each holds in, and those with no counterpart elsewhere.
  prof.transfers = (m.inferences || []).map(function (f) {
    var sch = bridgeScheme(f.rules);
    if (!sch || sch.name !== "From there to here") return null;
    var inSet = {}; f.inputs.forEach(function (t) { inSet[t] = true; });
    var by = {};
    steps.forEach(function (st) {
      if (!inSet[st.claim.title] || !has(states, st.from) || !has(states, st.to)) return;
      (by[st.regime] = by[st.regime] || {})[JSON.stringify([String(st.from), String(st.to), st.sign || ""])] = true;
    });
    var regimes = Object.keys(by).sort(), unmatched = [];
    if (regimes.length >= 2) regimes.forEach(function (r) {
      Object.keys(by[r]).forEach(function (k) {
        var elsewhere = regimes.some(function (o) { return o !== r && by[o][k]; });
        if (!elsewhere) unmatched.push([r].concat(JSON.parse(k)));
      });
    });
    return [f.argument, f.step, regimes, unmatched.sort(cmpDeep)];
  }).filter(Boolean).sort(cmpDeep);
  // HOW FAR THE MECHANISM IS MAPPED (1.17): mechanism.py's depth and depth_reason.
  prof.depth = block.depth == null ? "full" : String(block.depth);
  prof.depth_reason = block.depth_reason == null ? null : String(block.depth_reason);
  return { levels: levels, ordering: ordering, actors: actors, states: states, ids: ids, steps: ok,
           dropped: steps.length - ok.length, appraisalClaims: appraisalClaims,
           question: block.question == null ? "" : String(block.question), chains: chains, kinds: kinds, against: against,
           form: form, constitutions: consts, reasoning: reasoning,
           order: block.order == null ? "time" : String(block.order),
           profile: prof };
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

function loops(ids, edges, regimes) {
  var order = {}; ids.forEach(function (v, i) { order[v] = i; });
  var adj = adjacency(edges, ids);
  var out = [];
  regimes = regimes || {};
  // A LOOP IS IN ONE REGIME AND ONE PERIOD -- as the checker has it.
  function walk(start, v, path, allowed) {
    (adj[v] || []).forEach(function (w) {
      if (out.length >= LOOP_CAP) return;
      var now = narrow(allowed, pairsOf(regimes, v, w));
      if (now == null) return;
      if (w === start) out.push(path.slice());
      else if (has(order, w) && order[w] > order[start] && path.indexOf(w) < 0) {
        path.push(w); walk(start, w, path, now); path.pop();
      }
    });
  }
  ids.forEach(function (s) { walk(s, s, [s], [null, null]); });
  return out;
}

/** A step's size as the census prints it -- mechanism.py's _size. */
function sizeText(x) {
  if (x == null) return "";
  if (typeof x !== "object" || Array.isArray(x)) return String(x);
  var out = ["value", "unit"].filter(function (k) { return x[k] != null; }).map(function (k) { return String(x[k]); }).join(" ");
  if (x.ci != null) out += " (" + x.ci + ")";
  if (x.versus != null) out += " versus " + x.versus;
  if (x.at != null) out += " at " + x.at;
  return out.trim();
}

/** A condition as the census prints it -- mechanism.py's _cond: the text's words, or a declared
 *  state and its value. */
function condText(g) {
  if (g && typeof g === "object" && !Array.isArray(g)) return String(g.state) + (g.value != null ? ": " + g.value : "");
  return String(g);
}

/** Each edge's signs among `steps`, a co-cause's edge taking the sign of its step and a blocker's
 *  the opposite -- mechanism.py's _signs. */
function signsOf(steps, states) {
  var out = {}, flip = { "+": "-", "-": "+" };
  var add = function (a, b, sg) { var k = a + "\u0000" + b; (out[k] = out[k] || {})[sg || "?"] = true; };
  steps.forEach(function (s) {
    add(s.from, s.to, s.sign);
    (s.jointly || []).forEach(function (j) { if (has(states, j) && j !== s.to) add(j, s.to, s.sign); });
    (s.unless || []).forEach(function (u) { if (has(states, u) && u !== s.to) add(u, s.to, flip[s.sign] || "?"); });
  });
  return out;
}

/** The net sign of a run of states -- mechanism.py's _net: `+` or `-` where every step has the
 *  one sign, `?` otherwise. */
function netSign(signs, run) {
  var neg = 0;
  for (var i = 0; i + 1 < run.length; i++) {
    var sg = Object.keys(signs[run[i] + "\u0000" + run[i + 1]] || {});
    if (sg.length !== 1 || (sg[0] !== "+" && sg[0] !== "-")) return "?";
    if (sg[0] === "-") neg++;
  }
  return neg % 2 ? "-" : "+";
}

/** A loop's polarity -- mechanism.py's _polarity. */
function polarity(loop, signs) {
  return ({ "+": "reinforcing", "-": "balancing" })[netSign(signs, loop.concat([loop[0]]))] || null;
}

/** Each edge's regimes -- mechanism.py's _regimes: "" for a step in no regime. */
function regimesOf(steps, states) {
  var out = {};
  steps.forEach(function (s) {
    [s.from].concat((s.jointly || []).concat(s.unless || []).filter(function (j) { return has(states, j) && j !== s.to; }))
      .forEach(function (a) { var k = a + "\u0000" + s.to, m = out[k] = out[k] || {};
        m[(s.regime || "") + "\u0001" + (s.period || "")] = [s.regime || "", s.period || ""]; });
  });
  return out;
}

/** mechanism.py's _narrow: the regimes and periods a route may still be in after a step stated
 *  in `pairs`, or null when it fits none. `allowed` is [regimes, periods], each null while open. */
function narrow(allowed, pairs) {
  var rs = [], ps = [];
  pairs.forEach(function (x) { if (rs.indexOf(x[0]) < 0) rs.push(x[0]); if (ps.indexOf(x[1]) < 0) ps.push(x[1]); });
  var cut = function (a, xs) { return xs.indexOf("") >= 0 ? a : a == null ? xs : a.filter(function (r) { return xs.indexOf(r) >= 0; }); };
  var nr = cut(allowed[0], rs), np = cut(allowed[1], ps);
  if ((nr != null && !nr.length) || (np != null && !np.length)) return null;
  return [nr, np];
}
function pairsOf(regimes, v, w) {
  var m = regimes[v + "\u0000" + w];
  return m ? Object.keys(m).map(function (k) { return m[k]; }) : [["", ""]];
}

/** Routes from start to goal -- mechanism.py's _routes, ONE REGIME TO A ROUTE. */
function routes(start, goal, edges, ids, signs, regimes) {
  var adj = adjacency(edges, ids);
  var lengths = [], net = { "+": 0, "-": 0, "?": 0 };
  regimes = regimes || {};
  function walk(v, seen, allowed) {
    (adj[v] || []).forEach(function (w) {
      if (lengths.length >= ROUTE_CAP) return;
      var now = narrow(allowed, pairsOf(regimes, v, w));
      if (now == null) return;
      if (w === goal) { lengths.push(seen.length); net[netSign(signs || {}, seen.concat([w]))]++; }
      else if (seen.indexOf(w) < 0) walk(w, seen.concat([w]), now);
    });
  }
  walk(start, [start], [null, null]);
  return lengths.length ? { routes: lengths.length, shortest: Math.min.apply(null, lengths),
                            longest: Math.max.apply(null, lengths), net: net } : null;
}

/** The chains a block declares (profile 1.5), in declared order -- mechanism.py's _chains. */
function chainsOf(block) {
  var raw = obj(block.chains), out = [];
  Object.keys(raw).forEach(function (id) {
    var c = obj(raw[id]);
    // ITS FORM (1.11): its own where it declares one, the whole block's otherwise.
    var f = formOf(c.form != null ? c : block);
    out.push({ id: String(id), label: c.label == null ? null : String(c.label),
               question: c.question == null ? null : String(c.question), roles: obj(c.roles),
               form: f.form, settles: f.settles,
               // ITS GOAL (1.13), its own or the block's, and its CONTRAST -- as the checker has it.
               goal: goalOf(c) || goalOf(block), contrast: c.contrast == null ? null : String(c.contrast),
               // ITS ACCOUNT OF CAUSATION (1.14), its own or the block's.
               account: accountOf(c).length ? accountOf(c) : accountOf(block),
               // ITS ORDER (1.17), its own or the block's: time, or the order of explanation.
               order: c.order != null ? String(c.order) : block.order != null ? String(block.order) : "time" });
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
function walkChain(ids, states, edges, signs, regimes, nullFrom, rivalEdges, ends, cycle, constituted) {
  nullFrom = nullFrom || {}; ends = ends || {}; constituted = constituted || {};
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
  // A CYCLE HAS NO START (profile 1.11) -- as the checker has it.
  if (cycle) systems(ids, edges).forEach(function (comp) { comp.forEach(function (v) {
    var r = reach(v, edges); for (var k in r) reached[k] = true; }); });
  var used = {}; edges.forEach(function (e) { used[e[0]] = used[e[1]] = true; });
  var gaps = [];
  interventions.forEach(function (i) {
    if (!from[i] && !nullFrom[i]) gaps.push({ kind: "unlinked-intervention", state: i,
      message: "the intervention `" + i + "` has no step in the text: nothing says how it " +
               "brings about anything" });
  });
  conditions.forEach(function (c) {
    if (!from[c] && !nullFrom[c]) gaps.push({ kind: "unlinked-condition", state: c,
      message: "the condition `" + c + "` has no step in the text: nothing says what it " +
               "brings about" });
  });
  // AN OUTCOME REACHED ONLY IN VIEWS THE TEXT REPORTS says so -- as the checker has it.
  var rivalReached = {};
  (rivalEdges || []).forEach(function (e) { var r = reach(e[0], rivalEdges);
    for (var k in r) if (k !== e[0]) rivalReached[k] = true; });
  outcomes.forEach(function (o) {
    if (!reached[o]) gaps.push({ kind: "unreached-outcome", state: o,
      message: rivalReached[o] ? "the outcome `" + o + "` is reached only by the steps of views the text reports, not by its own"
               : "the outcome `" + o + "` is not reached by the text's steps from where its chain starts" });
  });
  ids.forEach(function (i) {
    // A PART GOES ON AS ITS WHOLE -- as the checker has it.
    var whole = obj(states[i]).part_of;
    var onward = whole != null && whole !== i && (from[whole] || outcomes.indexOf(whole) >= 0);
    // AND A STATE GOES ON AS WHAT IT CONSTITUTES (1.11) -- as the checker has it.
    onward = onward || (constituted[i] || []).some(function (w) {
      return w.indexOf("actor:") === 0 || outcomes.indexOf(w) >= 0 || !!from[w]; });
    // A MEASURE STOPS WHERE IT IS READ (1.9) -- as the checker has it.
    if (used[i] && outcomes.indexOf(i) < 0 && !ends[i] && !obj(states[i]).appraisal && obj(states[i]).measures == null
        && !onward && !from[i])
      gaps.push({ kind: "dead-end", state: i,
                  message: "`" + i + "` leads nowhere in the text: the chain stops there" });
  });
  // As the checker: a chain with no stated cause, or nothing it is for, says so.
  if (!cycle && !interventions.length && !conditions.length)
    gaps.push({ kind: "no-intervention", state: null,
                message: "no state has `role: intervention` or `role: condition`, so the chain has " +
                         "no stated cause to run from" });
  if (!cycle && !outcomes.length)
    gaps.push({ kind: "no-outcome", state: null,
                message: "no state has `role: outcome`, so nothing says what the chain is for" });
  var rs = [];
  // THE TEXT'S OWN STARTING POINTS FIRST -- as the checker lists them.
  var rank = {}; ids.forEach(function (v, i) { rank[v] = i; });
  var key = function (v) { return [interventions.indexOf(v) < 0 ? 1 : 0, conditions.indexOf(v) < 0 ? 1 : 0, rank[v]]; };
  entries.slice().sort(function (a, b) { var x = key(a), y = key(b);
    for (var i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; })
  .forEach(function (e) { outcomes.forEach(function (o) {
    if (o === e) return;          // both where the circle starts and what it explains
    var r = routes(e, o, edges, ids, signs, regimes);
    if (r) rs.push({ start: e, outcome: o, routes: r.routes, shortest: r.shortest, longest: r.longest, net: r.net });
  }); });
  return { entries: entries, gaps: gaps, used: used, outcomes: outcomes, routes: rs, interventions: interventions };
}

/** A co-cause is a cause: the steps' edges, with each co-cause's edge to the step's `to`. */
function edgesWithCoCauses(steps, states) {
  var edges = uniqEdges(steps);
  var seenEdge = {}; edges.forEach(function (e) { seenEdge[e[0] + "\u0000" + e[1]] = true; });
  steps.forEach(function (s) { (s.jointly || []).concat(s.unless || []).forEach(function (j) {
    var k = j + "\u0000" + s.to;
    if (has(states, j) && j !== s.to && !seenEdge[k]) { seenEdge[k] = true; edges.push([j, s.to]); } }); });
  return edges;
}

/** {from\u0000to: via} for each step whose `via` names a route `edges` give -- mechanism.py's
 *  _opened: that step is walked as the route, once. */
function openedOf(steps, edges) {
  var have = {}, out = {};
  edges.forEach(function (e) { have[e[0] + "\u0000" + e[1]] = true; });
  steps.forEach(function (s) {
    if (!(s.statedVia || []).length || s.share !== "entire" || s.from == null || s.to == null) return;
    var run = [s.from].concat(s.statedVia, [s.to]);
    for (var i = 0; i + 1 < run.length; i++) if (!have[run[i] + "\u0000" + run[i + 1]]) return;
    out[s.from + "\u0000" + s.to] = s.statedVia.slice();
  });
  return out;
}
function withoutOpened(edges, opened) {
  return edges.filter(function (e) { return !has(opened, e[0] + "\u0000" + e[1]); });
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
function chainProfiles(chains, states, ids, text, isReflexive, kindOf, instances, rival, nullFrom, constituted) {
  var out = [], member = {};
  chains.forEach(function (c) {
    var mine = text.filter(function (s) { return s.chain.indexOf(c.id) >= 0; });
    // A CHAIN OF STORIES THE TEXT REPORTS is walked on those steps -- as the checker has it.
    var layer = "text";
    if (!mine.length) { mine = (rival || []).filter(function (s) { return s.chain.indexOf(c.id) >= 0; }); if (mine.length) layer = "rival"; }
    var edges = edgesWithCoCauses(mine, states);
    edges = withoutOpened(edges, openedOf(mine, edges));
    var cids = chainIds(c, states, ids, mine);
    var cstates = chainStates(c, states, cids);
    var csigns = signsOf(mine, states);
    var W = walkChain(cids, cstates, edges, csigns, regimesOf(mine, states), nullFrom, null, null,
                      c.form === "cycle", constituted);
    var best = {}, titles = {};
    mine.forEach(function (s) { best[s.from + "\u0000" + s.to + "\u0000" + s.sign] = true; titles[s.claim.title] = true; });
    var roles = {};
    cids.forEach(function (i) { var r = rolesOf(cstates[i]).slice().sort(); if (r.length) roles[i] = r; });
    out.push({ id: c.id, label: c.label, question: c.question, layer: layer,
               steps: Object.keys(best).length, claims: Object.keys(titles).length, states: cids,
               roles: roles, entries: W.entries, routes: W.routes,
               loops: loops(cids, edges, regimesOf(mine, states)).map(function (l) { return { states: l, reflexive: isReflexive(l, mine), polarity: polarity(l, csigns) }; }),
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
    // ITS FORM (1.11) -- as the checker has it.
    var ch = chains.filter(function (c) { return c.id === cp.id; })[0] || {};
    cp.form = { form: ch.form || "chain", settles: ch.settles == null ? null : ch.settles };
    cp.goal = ch.goal == null ? null : ch.goal;
    cp.contrast = ch.contrast == null ? null : ch.contrast;
    cp.account = ch.account || [];
    cp.order = ch.order || "time";
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
function isAppraisalNode(n) { return (n.tags || []).indexOf("appraisal") >= 0; }

/** Pairs of steps on one pair of states whose claims the argument sets against each other --
 *  mechanism.py's _disputed. */
function disputedOf(steps, against) {
  var by = {}, out = [];
  steps.forEach(function (s) { if (s.selects || s.assoc || !s.claim) return;
    var k = s.from + "\u0000" + s.to, l = by[k] = by[k] || { from: s.from, to: s.to, titles: [] };
    if (l.titles.indexOf(s.claim.title) < 0) l.titles.push(s.claim.title); });
  Object.keys(by).forEach(function (k) { var l = by[k];
    l.titles.forEach(function (x) { l.titles.forEach(function (y) {
      if (x < y && against && against[x + "\u0000" + y]) out.push([l.from, l.to, [x, y]]); }); }); });
  return uniqSorted(out);
}

function profile(levels, actors, states, ids, steps, appraisalClaims, chains, kinds, against, ordering, form, consts, reasoning) {
  form = form || { form: "chain", settles: null }; consts = consts || []; reasoning = reasoning || { goal: null, contrast: null, account: [] };
  // What each state constitutes, in the text's own voice (1.11) -- as the checker has it.
  var constituted = {};
  consts.forEach(function (c) { if (c.layer !== "text") return;
    var w = c.toActor ? "actor:" + c.to : c.to, l = constituted[c.from] = constituted[c.from] || [];
    if (l.indexOf(w) < 0) l.push(w); });
  var causal = steps.filter(function (s) { return !s.isNull && !s.selects && !s.assoc; });
  var textAll = steps.filter(function (s) { return s.layer === "text"; });
  var text = causal.filter(function (s) { return s.layer === "text"; });
  // A CO-CAUSE IS A CAUSE, as the checker has it: routes, loops and dead ends run through it.
  var edges = edgesWithCoCauses(text, states);
  // A STEP THE TEXT OPENS INTO A ROUTE IS WALKED AS THAT ROUTE (profile 1.8).
  var opened = openedOf(text, edges);
  edges = withoutOpened(edges, opened);
  var signOf = signsOf(text, states);
  var nullFrom = {}; textAll.forEach(function (s) { if (s.isNull) nullFrom[s.from] = true; });
  // A MODERATOR IS LINKED BY WHAT IT MODERATES (1.9) -- as the checker has it.
  textAll.forEach(function (s) { s.modifies.forEach(function (m) { if (has(states, m.by)) nullFrom[m.by] = true; }); });
  var rivalSteps = causal.filter(function (s) { return s.layer === "rival"; });
  // What a chain is for is no dead end on the whole map -- as the checker has it.
  var chainEnds = {};
  (chains || []).forEach(function (c) { Object.keys(c.roles).forEach(function (i) {
    if (asList(c.roles[i]).indexOf("outcome") >= 0) chainEnds[i] = true; }); });
  var W = walkChain(ids, states, edges, signOf, regimesOf(text, states), nullFrom, uniqEdges(rivalSteps), chainEnds,
                    form.form === "cycle", constituted);
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
  var loopsText = loops(ids, edges, regimesOf(text, states));
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
  var CP = chainProfiles(chains || [], states, ids, text, isReflexive, kindOf, AK.instances, rivalSteps, nullFrom, constituted);
  var spanned = {};
  Object.keys(used).forEach(function (i) {
    levelsOf(states[i], actors, levels).forEach(function (lv) { spanned[lv] = true; }); });
  var lags = {}; text.forEach(function (s) { if (s.lag) lags[s.lag] = true; });
  // EACH LAG WITH ITS STEP -- as the checker has it.
  var timed = {}; text.forEach(function (s) { if (s.lag) timed[[s.from, s.to, s.lag].join("\u0000")] = [s.from, s.to, s.lag]; });
  var cmp3 = function (a, b) { for (var k = 0; k < 3; k++) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1; return 0; };
  var claimTitles = {}; text.forEach(function (s) { claimTitles[s.claim.title] = true; });
  return {
    levels: levels,
    levels_spanned: levels.filter(function (lv) { return spanned[lv]; }),
    ordering: ordering || { kind: null, stated: null, within: [] },
    states: ids.length, steps: Object.keys(best).length,
    claims: Object.keys(claimTitles).length,
    lags: Object.keys(lags).sort(),
    timed: Object.keys(timed).map(function (k) { return timed[k]; }).sort(cmp3),
    entries: entries, routes: rs, interventions: W.interventions,
    loops_text: loopsText.map(function (l) {
      return { states: l, reflexive: isReflexive(l, text), polarity: polarity(l, signOf) }; }),
    feedback: systems(ids, edges).map(function (comp) {
      var inC = {}; comp.forEach(function (v) { inC[v] = true; });
      var inside = loopsText.filter(function (l) { return l.every(function (v) { return inC[v]; }); });
      return { states: comp, loops: inside.length, capped: loopsText.length >= LOOP_CAP,
               shortest: shortestLoops(comp, edges, ids, 3).map(function (l) {
                 return { states: l, reflexive: isReflexive(l, text), polarity: polarity(l, signOf) }; }) };
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
    blocked: sideRows(text, "unless"), despite: sideRows(textAll, "despite"),
    strata: strataOf(textAll),
    regimes: (function () { var r = {}; textAll.forEach(function (s) { if (s.regime) r[s.regime] = true; }); return Object.keys(r).sort(); })(),
    thresholds: (function () {
      var seen = {}, out = [];
      textAll.forEach(function (s) { if (!s.threshold) return;
        var k = [s.from, s.to, s.sign, s.threshold].join("\u0000"); if (!seen[k]) { seen[k] = true; out.push([k, [s.from, s.to, s.sign, s.threshold]]); } });
      return out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }).map(function (r) { return r[1]; });
    })(),
    sizes: (function () {
      var seen = {}, out = [];
      textAll.forEach(function (s) { if (!s.size) return;
        var k = [s.from, s.to, s.sign, s.size].join("\u0000"); if (!seen[k]) { seen[k] = true; out.push([k, [s.from, s.to, s.sign, s.size]]); } });
      return out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }).map(function (r) { return r[1]; });
    })(),
    mediation: (function () {
      var seen = {}, out = [];
      text.forEach(function (s) { if (!(s.statedVia || []).length) return;
        var k = [s.from, s.to, s.share].concat(s.statedVia).join("\u0000");
        if (!seen[k]) { seen[k] = true; out.push([k, [s.from, s.to, s.share, s.statedVia.slice()]]); } });
      return out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }).map(function (r) { return r[1]; });
    })(),
    trends: (function () {
      var seen = {}, out = [];
      textAll.forEach(function (s) { if (s.on !== "trend") return;
        var k = [s.from, s.to, s.sign].join("\u0000"); if (!seen[k]) { seen[k] = true; out.push([k, [s.from, s.to, s.sign]]); } });
      return out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }).map(function (r) { return r[1]; });
    })(),
    opened: Object.keys(opened).sort().map(function (k) { var e = k.split("\u0000"); return [e[0], e[1], opened[k]]; }),
    spanning: ids.slice().sort().filter(function (i) { return levelsOf(states[i], actors, levels).length > 1; })
                 .map(function (i) { return [i, levelsOf(states[i], actors, levels)]; }),
    loops_with_appraisal: loops(ids, withoutOpened(uniqEdges(pool), opened)).map(function (l) {
      return { states: l, reflexive: isReflexive(l, pool), polarity: polarity(l, signsOf(pool, states)) }; }),
    tiers: tiers, gaps: gaps,
    rival_steps: steps.filter(function (s) { return s.layer === "rival"; }).length,
    null_steps: nullsOf(textAll, steps, edges, ids),
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
    kinds: kindList, akin_steps: AK.akin, instances: AK.instances,
    moderated: uniqSorted([].concat.apply([], textAll.map(function (s) {
      return s.modifies.filter(function (m) { return has(states, m.by); })
                       .map(function (m) { return [s.from, s.to, s.sign, m.by, m.effect, m.period]; }); }))),
    necessary: uniqSorted(textAll.filter(function (s) { return s.necessary === true; })
                                 .map(function (s) { return [s.from, s.to, s.sign]; })),
    sufficient: uniqSorted(textAll.filter(function (s) { return typeof s.sufficient === "boolean"; })
                                  .map(function (s) { return [s.from, s.to, s.sign, s.jointly.slice(), s.sufficient]; })),
    designs: counted(textAll.map(function (s) { return s.design; })),
    measures: ids.filter(function (i) { var m = obj(states[i]).measures; return m != null && has(states, m) && m !== i; })
                 .map(function (i) { var st = obj(states[i]); return [i, String(st.measures), st.method == null ? "" : String(st.method)]; })
                 .sort(cmpDeep),
    attributions: uniqSorted(steps.filter(function (s) { return s.attribution; })
                                  .map(function (s) { return [s.from, s.to, s.sign, s.attribution, s.attributionBy, s.layer, s.claim.title]; })),
    stances: counted(steps.filter(function (s) { return s.reported; }).map(function (s) { return s.stance; })),
    accounts: accountsOf(ids, steps),
    disputed: disputedOf(steps, against || {}),
    rests_on: uniqSorted([].concat.apply([], textAll.map(function (s) {
      return (s.measuredBy || []).filter(function (mb) { return has(states, mb); }).map(function (mb) {
        var bias = {};
        steps.forEach(function (r) { if (r.to === mb && !r.isNull && !r.selects && !r.assoc && r.from !== obj(states[mb]).measures) bias[r.from] = true; });
        return [s.from, s.to, s.sign, mb, Object.keys(bias).sort()]; }); }))),
    // PROCESS, FORMATION AND CONSTITUTION (profile 1.11) -- mechanism.py's, field for field.
    form: { form: form.form, settles: form.settles },
    aspects: counted(ids.map(function (i) { var a = obj(states[i]).aspect; return a != null && ASPECTS.indexOf(String(a)) >= 0 ? String(a) : ""; })),
    formation: uniqSorted(textAll.filter(function (s) { return FORMATION.indexOf(s.on) >= 0; })
                                 .map(function (s) { return [s.from, s.to, s.sign, s.on]; })),
    constitution: uniqSorted(consts.map(function (c) { return [c.from, c.to, c.extent, c.whole, c.under, c.layer, c.claim.title]; })),
    both: (function () {
      var have = {}; text.forEach(function (s) { have[s.from + "\u0000" + s.to] = true; });
      return uniqSorted(consts.filter(function (c) { return c.layer === "text" && have[c.from + "\u0000" + c.to]; })
                              .map(function (c) { return [c.from, c.to]; })); })(),
    readings: uniqSorted([].concat.apply([], consts.map(function (c) {
      return causal.filter(function (s) { return s.from === c.from && s.to === c.to && s.layer !== c.layer &&
                                                 s.layer !== "appraisal" && c.layer !== "appraisal"; })
                   .map(function (s) { return [c.from, c.to, s.layer, c.layer]; }); }))),
    // WHAT IS NOT (YET) ACTUAL, WHAT MAKES EACH OTHER UP, AND WHAT KEEPS ITSELF IN BEING (1.12).
    statuses: ids.filter(function (i) { var t = obj(states[i]).status; return t === "possible" || t === "open"; })
                 .map(function (i) { return [i, String(obj(states[i]).status)]; }).sort(cmpDeep),
    mutual: uniqSorted(consts.filter(function (c) { return c.layer === "text" && !c.toActor && consts.some(function (d) {
                         return d.layer === "text" && !d.toActor && d.from === c.to && d.to === c.from; }); })
                             .map(function (c) { return [c.from, c.to].sort(); })),
    sustaining: loopsText.filter(function (l) { return sustains(l, text); }),
    // CAUSAL REASONING (1.13) -- mechanism.py's, field for field.
    goal: reasoning.goal, contrast: reasoning.contrast,
    // STOCKS, CHANCES AND ACCOUNTS (1.14) -- mechanism.py's, field for field.
    account: reasoning.account || [],
    chances: uniqSorted(textAll.filter(function (s) { return s.on === "chance"; }).map(function (s) { return [s.from, s.to, s.sign]; })),
    stocks: uniqSorted(textAll.filter(function (s) { return s.on === "stock"; }).map(function (s) { return [s.from, s.to, s.sign]; })),
    stock_loops: loopsText.filter(function (l) { return l.some(function (a, i) { var b = l[(i + 1) % l.length];
      return text.some(function (s) { return s.on === "stock" && s.from === a && s.to === b; }); }); }),
    extrapolated: (function () {
      var g = {}; textAll.forEach(function (s) { if (s.scope === "general") g[s.from + "\u0000" + s.to] = true; });
      return uniqSorted(textAll.filter(function (s) { return s.scope === "singular" && g[s.from + "\u0000" + s.to]; })
                               .map(function (s) { return [s.from, s.to]; }));
    })(),
    associations: uniqSorted(steps.filter(function (s) { return s.assoc && s.layer !== "appraisal"; })
                                  .map(function (s) { return [s.from, s.to, s.sign, s.layer]; })),
    common_causes: (function () {
      var have = {}; edges.forEach(function (e) { have[e[0] + "\u0000" + e[1]] = true; });
      var pairs = uniqSorted(steps.filter(function (s) { return s.assoc && s.layer !== "appraisal"; }).map(function (s) { return [s.from, s.to]; }));
      return pairs.map(function (pr) {
        return [pr[0], pr[1], ids.filter(function (z) { return have[z + "\u0000" + pr[0]] && have[z + "\u0000" + pr[1]]; }).sort()]; })
        .filter(function (r) { return r[2].length; }).sort(cmpDeep);
    })(),
    scopes: counted(textAll.map(function (s) { return SCOPES.indexOf(s.scope) >= 0 ? s.scope : ""; })),
    // ...but only where the map shows one case at most -- mechanism.py's _cases_of.
    one_case: uniqSorted(textAll.filter(function (s) { return s.scope === "general" &&
        (s.basis === "example" || s.design === "case study" || s.design === "anecdote") &&
        casesOf([s.from, s.to], textAll, AK.instances) <= 1; })
      .map(function (s) { return [s.from, s.to, s.claim.title]; }))
  };
}
/** How many cases of a general step the map shows -- mechanism.py's _cases_of: the singular steps on
 *  the same pair, and the steps that are cases of it by kind. */
function casesOf(edge, steps, instances) {
  var seen = {};
  steps.forEach(function (s) { if (s.scope === "singular" && s.from === edge[0] && s.to === edge[1]) seen["claim\u0000" + s.claim.title] = true; });
  (instances || []).forEach(function (pr) {
    if (pr[0][0] === edge[0] && pr[0][1] === edge[1]) seen[pr[1].join("\u0000")] = true; });
  return Object.keys(seen).length;
}
/** Whether every hop of a loop is a step that makes or maintains its next -- mechanism.py's _sustains. */
function sustains(loop, steps) {
  return loop.every(function (a, i) { var b = loop[(i + 1) % loop.length];
    return steps.some(function (s) { return s.from === a && s.to === b && (s.on === "being" || s.on === "persistence") && s.sign === "+"; }); });
}

/** Python's ordering of nested lists of strings, numbers and booleans. */
function cmpDeep(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (var i = 0; i < Math.min(a.length, b.length); i++) { var c = cmpDeep(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
  return a === b ? 0 : a < b ? -1 : 1;
}

/** Distinct rows, sorted as Python sorts a set of tuples. */
function uniqSorted(rows) {
  var seen = {}, out = [];
  rows.forEach(function (r) { var k = JSON.stringify(r); if (!seen[k]) { seen[k] = true; out.push(r); } });
  return out.sort(cmpDeep);
}

/** [[value, how many]] for the non-empty values, sorted -- mechanism.py's _count, sorted. */
function counted(xs) {
  var n = {};
  xs.forEach(function (x) { if (x) n[x] = (n[x] || 0) + 1; });
  return Object.keys(n).map(function (k) { return [k, n[k]]; }).sort(cmpDeep);
}

/** Rival accounts of one outcome, side by side -- mechanism.py's _accounts. */
function accountsOf(ids, steps) {
  var pool = steps.filter(function (s) { return !s.isNull && !s.selects && !s.assoc && s.layer !== "appraisal"; });
  var out = [];
  ids.forEach(function (i) {
    var seen = {}, accs = [];
    pool.forEach(function (s) {
      if (s.to !== i) return;
      var k = s.from + "\u0000" + s.claim.title;
      if (seen[k]) return;
      seen[k] = true;
      var opened = uniqSorted(pool.filter(function (r) { return r.to === s.from && r.claim.title !== s.claim.title; })
                                  .map(function (r) { return [r.from, r.claim.title]; }));
      accs.push({ from: s.from, title: s.claim.title, layer: s.layer, stance: s.stance,
                  attribution: s.attribution, by: s.attributionBy, opened_by: opened });
    });
    var titles = {}; accs.forEach(function (a) { titles[a.title] = true; });
    if (Object.keys(titles).length > 1 && accs.some(function (a) { return a.layer === "rival" || a.stance; }))
      out.push({ state: i, accounts: accs });
  });
  return out;
}

/** [from, to, sign, states] for each distinct step with a blocker (`unless`) or a failed one
 *  (`despite`), sorted as the checker sorts them. */
function sideRows(steps, key) {
  var seen = {}, out = [];
  steps.forEach(function (s) { if (!(s[key] || []).length) return;
    var row = [s.from, s.to, s.sign, s[key].slice()], k = [s.from, s.to, s.sign].concat(s[key]).join("\u0000");
    if (!seen[k]) { seen[k] = true; out.push([k, row]); } });
  return out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }).map(function (r) { return r[1]; });
}

/** Each pair whose steps differ by condition -- mechanism.py's _strata. */
function strataOf(textAll) {
  var by = {}, order = [];
  textAll.forEach(function (s) {
    if (s.selects || s.assoc) return;
    var k = s.from + "\u0000" + s.to;
    if (!by[k]) { by[k] = { from: s.from, to: s.to, recs: {} }; order.push(k); }
    by[k].recs[s.sign + "\u0000" + s.given.join("\u0001") + "\u0000" + s.period + "\u0000" + s.size] = [s.sign, s.given.slice(), s.period, s.size];
  });
  var cmpList = function (a, b) {
    for (var i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return a.length - b.length; };
  return order.sort().map(function (k) {
    var recs = Object.keys(by[k].recs).map(function (r) { return by[k].recs[r]; });
    recs.sort(function (a, b) { return a[0] !== b[0] ? (a[0] < b[0] ? -1 : 1) : cmpList(a[1], b[1]) || (a[2] === b[2] ? 0 : a[2] < b[2] ? -1 : 1) || (a[3] === b[3] ? 0 : a[3] < b[3] ? -1 : 1); });
    return [by[k].from, by[k].to, recs];
  }).filter(function (r) { return r[2].length > 1 && r[2].some(function (x) { return x[1].length || x[2]; }); });
}

/** The text's null findings -- mechanism.py's _nulls: each with the rival signs it answers, its
 *  conditions, and the routes the text's own steps give between its states. */
function nullsOf(textAll, steps, edges, ids) {
  var out = [], seen = {};
  textAll.forEach(function (s) {
    var k = s.from + "\u0000" + s.to;
    if (!s.isNull || seen[k]) return;
    seen[k] = true;
    var against = {};
    steps.forEach(function (r) {
      if (r.layer === "rival" && !r.isNull && r.from === s.from && r.to === s.to && r.sign) against[r.sign] = true;
    });
    var given = [], periods = [];
    textAll.forEach(function (t) {
      if (t.isNull && t.from === s.from && t.to === s.to) {
        t.given.forEach(function (g) { if (given.indexOf(g) < 0) given.push(g); });
        if (t.period && periods.indexOf(t.period) < 0) periods.push(t.period); } });
    var r = s.from !== s.to ? routes(s.from, s.to, edges || [], ids || []) : null;
    out.push({ from: s.from, to: s.to, basis: s.basis, refutes: Object.keys(against).sort(),
               given: given, periods: periods, routes: r ? r.routes : 0 });
  });
  return out;
}

/* ============================================================ the layout, pure */

// COL leaves 132px between columns. At 82px (the first build) an arrow between neighbouring
// columns in different lanes was nearly vertical, its arrowhead still pointing sideways, and every
// chip on it sat beside some other arrow's head (J-PAL sample, 26 Sep 2026).
// LANE HEADS ARE A STRIP ABOVE THE BOXES, not a column beside them: the actors' names ran under
// the first column's boxes whenever they were longer than the gutter.
// HEAD holds a lane's heading AND the badges on the top edge of its first row's boxes, clear of
// each other (M1: on the Coleman boat in general the ≈ and ↻ badges sat on "An agent, in general").
var BW = 168, BH = 56, COL = 300, GUT = 40, ROW = 100, PADY = 16, TOP = 34, HEAD = 34, STUB = 12;
// M9: rows joined by an arrow between them are this far apart, room for the head, its label, and
// the marks on both boxes' facing edges; other rows keep ROW - BH.
var STACK_GAP = 84;
// The marks on a box's edges (M11: placed here, drawn from here). A badge is a circle of BADGE_R
// on the top border (or the foot, for a measure); the "more" pill sits on the foot at the left.
var BADGE_R = 10, BADGE_STEP = 26, PILL_W = 50, PILL_H = 15, PILL_X = 32, GAPWORD_W = 128;
// One arrowhead for every arrow, whatever its weight (M4).
var HEAD_LEN = 10, HEAD_W = 10;
// Nested levels: each frame is inset this far inside its parent, and closes this far below the
// frame inside it.
var NEST_INSET = 16, NEST_CLOSE = 10;

/** THE LEVELS AS A TREE OF WHOLES (Craver 2025: levels of mechanisms are branches in a tree of
 *  composition, local to a mechanism, not strata across all of nature). `spec` is "chain" -- each
 *  level inside the one listed before it -- or { parent: { level: parentLevel } }, where siblings
 *  sit side by side inside their parent. The levels must be listed so that every level's
 *  descendants follow it without a break; otherwise nesting is refused (null) and the chart keeps
 *  its bands. Returns each level's depth and the index of its last descendant. */
function nestTree(levels, spec) {
  if (!spec || levels.length < 2) return null;
  var parent = {};
  if (spec === "chain") levels.forEach(function (lv, i) { parent[lv] = i ? levels[i - 1] : null; });
  else levels.forEach(function (lv) { var p = spec.parent && spec.parent[lv]; parent[lv] = p != null && levels.indexOf(p) >= 0 ? p : null; });
  var depth = {}, last = {};
  var dOf = function (lv, seen) { if (has(depth, lv)) return depth[lv]; if (seen[lv]) return 0; seen[lv] = true;
    return (depth[lv] = parent[lv] == null ? 0 : dOf(parent[lv], seen) + 1); };
  levels.forEach(function (lv) { dOf(lv, {}); });
  var isDesc = function (lv, anc) { for (var p = parent[lv], g = 0; p != null && g < 50; p = parent[p], g++) if (p === anc) return true; return false; };
  for (var i = 0; i < levels.length; i++) {
    var j = i;
    while (j + 1 < levels.length && isDesc(levels[j + 1], levels[i])) j++;
    // Contiguous: nothing after the block is a descendant of it.
    for (var k = j + 1; k < levels.length; k++) if (isDesc(levels[k], levels[i])) return null;
    last[levels[i]] = j;
  }
  var maxDepth = Math.max.apply(null, levels.map(function (lv) { return depth[lv]; }));
  if (!maxDepth) return null;
  return { parent: parent, depth: depth, last: last, maxDepth: maxDepth };
}
// A box's label: three lines of 14px unless opened; the room kept right of the last column for a
// state's "✕ no link in the text".
var MAX_LINES = 3, LINE_H = 14, UNLINKED_W = 150;
// Zoom: each press of + or − is one step; the chart is never drawn smaller or larger than these.
var ZOOM_STEP = 1.2, ZOOM_MIN = 0.25, ZOOM_MAX = 3;

/** A point at `t` along a cubic. */
function bez(p0, p1, p2, p3, t) { var u = 1 - t; return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3; }
/** Do segments p1-p2 and p3-p4 cross (properly, not merely touch)? */
function segCross(p1, p2, p3, p4) {
  var d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (Math.abs(d) < 1e-9) return false;
  var t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  var u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}
/** A POINT ALONG AN ARROW. An arrow is one cubic, or -- where it is routed round boxes -- several
 *  joined end to end (`segs`); `t` runs 0 to 1 over the whole, each segment an equal share. */
function segsOf(e) { return e.segs || [e.curve]; }
function pathAt(e, t) {
  var S = segsOf(e), n = S.length, i = Math.min(n - 1, Math.max(0, Math.floor(t * n))), u = Math.min(1, Math.max(0, t * n - i)), P = S[i];
  return [bez(P[0][0], P[1][0], P[2][0], P[3][0], u), bez(P[0][1], P[1][1], P[2][1], P[3][1], u)];
}
function pathPts(e, per) {
  var out = [];
  segsOf(e).forEach(function (P, si) { for (var i = si ? 1 : 0; i <= per; i++) { var u = i / per;
    out.push([bez(P[0][0], P[1][0], P[2][0], P[3][0], u), bez(P[0][1], P[1][1], P[2][1], P[3][1], u)]); } });
  return out;
}
function segsPath(S) {
  return S.map(function (P, i) { return (i ? "" : "M" + P[0][0] + "," + P[0][1] + " ") + "C" + P[1][0] + "," + P[1][1] + " " + P[2][0] + "," + P[2][1] + " " + P[3][0] + "," + P[3][1]; }).join(" ");
}
/** An orthogonal run through the points W, its corners rounded with radius r: the returning arcs'
 *  shape, as cubic segments. */
function roundPath(W, r) {
  var segs = [], cur = W[0];
  var line = function (A, B) { if (Math.hypot(B[0] - A[0], B[1] - A[1]) < 0.5) return;
    segs.push([A, [A[0] + (B[0] - A[0]) / 3, A[1] + (B[1] - A[1]) / 3], [A[0] + 2 * (B[0] - A[0]) / 3, A[1] + 2 * (B[1] - A[1]) / 3], B]); };
  for (var i = 1; i < W.length; i++) {
    var p = W[i], nx = W[i + 1];
    if (!nx) { line(cur, p); break; }
    var li = Math.hypot(p[0] - W[i - 1][0], p[1] - W[i - 1][1]) || 1, lo = Math.hypot(nx[0] - p[0], nx[1] - p[1]) || 1;
    var rr = Math.min(r, li / 2, lo / 2);
    var A = [p[0] - (p[0] - W[i - 1][0]) / li * rr, p[1] - (p[1] - W[i - 1][1]) / li * rr];
    var B = [p[0] + (nx[0] - p[0]) / lo * rr, p[1] + (nx[1] - p[1]) / lo * rr];
    line(cur, A);
    segs.push([A, [A[0] + (p[0] - A[0]) * 0.55, A[1] + (p[1] - A[1]) * 0.55], [B[0] + (p[0] - B[0]) * 0.55, B[1] + (p[1] - B[1]) * 0.55], B]);
    cur = B;
  }
  return segs;
}
/** Does the polyline enter the rectangle shrunk by `inset`? Exact per segment (Liang-Barsky), so
 *  the router and the audit agree on a line that grazes a corner, as sampling did not. */
function polyHitsRect(pts, n, inset) {
  var x0 = n.x + inset, x1 = n.x + n.w - inset, y0 = n.y + inset, y1 = n.y + n.h - inset;
  if (x1 <= x0 || y1 <= y0) return false;
  for (var i = 0; i + 1 < pts.length; i++) {
    var ax = pts[i][0], ay = pts[i][1], dx = pts[i + 1][0] - ax, dy = pts[i + 1][1] - ay, lo = 0, hi = 1, ok = true;
    [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]].forEach(function (pq) {
      if (!ok) return;
      if (pq[0] === 0) { if (pq[1] < 0) ok = false; return; }
      var r = pq[1] / pq[0];
      if (pq[0] < 0) { if (r > hi) ok = false; else if (r > lo) lo = r; }
      else { if (r < lo) ok = false; else if (r < hi) hi = r; }
    });
    if (ok && hi - lo > 1e-6) return true;
  }
  return false;
}
/** How many times two polylines cross. */
function crossCount(A, B) {
  var n = 0;
  for (var i = 0; i + 1 < A.length; i++) for (var j = 0; j + 1 < B.length; j++) if (segCross(A[i], A[i + 1], B[j], B[j + 1])) n++;
  return n;
}
function overlap(a, b) {
  var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
/** THE WORDS ON A CHIP. "+" and "-" say support and attack everywhere else on this page; here a
 *  sign is a direction of effect, as in a causal loop diagram. Words say which without a key. */
/** A chip's label as lines: broken at its " · " parts, joined while they fit, and a part too long
 *  for a line broken at its words. Nothing is cut. */
var CHIP_LINE = 28;
function chipLines(label) {
  var lines = [];
  String(label).split(" · ").forEach(function (part) {
    var last = lines.length - 1;
    if (last >= 0 && (lines[last] + " · " + part).length <= CHIP_LINE) { lines[last] += " · " + part; return; }
    var cur = "";
    part.split(" ").forEach(function (w) {
      if (cur && (cur + " " + w).length > CHIP_LINE) { lines.push(cur); cur = w; }
      else cur = cur ? cur + " " + w : w;
    });
    lines.push(cur);
  });
  return lines.length ? lines : [""];
}

/** The states that moderate an edge's step (profile 1.9): lit with it, as its co-causes are. */
function modStates(e) { return (e.modifiers || []).map(function (m) { return m.state; })
  .concat((e.rests || []).map(function (r) { return r.state; })); }

/** Stone's types of causal attribution, as a chip says them (profile 1.9). */
var ATTRIBUTION_WORD = { intentional: "intended", mechanical: "guided", inadvertent: "inadvertent",
                         accidental: "accident", complex: "complex" };
/** What a moderator does to a step, in the panel's words (profile 1.9). */
var EFFECT_WORD = { strengthens: "strengthens it", weakens: "weakens it", reverses: "reverses it", "0": "does not change it, the text finds" };

/** A step that makes, keeps or changes in kind (profile 1.11), in the chip's one word: Arthur's
 *  verbs, which a "raises" or "lowers" would turn back into nouns. Null for any other step. */
function formationWord(on, sign) {
  if (on === "character") return "transforms";
  if (on === "possibility") return sign === "+" ? "opens up" : sign === "-" ? "closes off" : null;
  if (on === "being") return sign === "+" ? "makes" : sign === "-" ? "unmakes" : null;
  if (on === "persistence") return sign === "+" ? "maintains" : sign === "-" ? "erodes" : null;
  // A CHANCE AND A STOCK (1.14): neither says its effect moves with its cause.
  if (on === "chance") return sign === "+" ? "makes likelier" : sign === "-" ? "makes less likely" : null;
  if (on === "stock") return sign === "+" ? "flows into" : sign === "-" ? "flows out of" : null;
  return null;
}
function signWord(signs) {
  if (!signs.length) return "link";
  if (signs.length > 1) return "mixed";
  return signs[0] === "+" ? "raises" : signs[0] === "-" ? "lowers" : signs[0] === "0" ? "no effect"
       : signs[0] === "which" ? "decides which" : signs[0];
}

/** Geometry for the whole chain, every layer included. Pure: the same model gives the same
 *  numbers, and nothing the reader switches changes them. */
/** WHICH MARKS EACH BOX CARRIES in a drawing of M (FULL, or a chain or the boxes drawn from it):
 *  the loop and system badges at its top right, ⇄ (in another chain) and ≈ (a kind shared) at its
 *  top left, ≙ (a measure of another state) at its foot. Pure, so the layout places them (M11) and
 *  the audit sees them; the drawing reads the same answer. */
function markSpec(FULL, M) {
  var SYS = M.profile.feedback.filter(function (f) { return f.loops > LOOPS_LISTED; });
  var inBig = function (l) { return SYS.some(function (f) { return l.states.every(function (v) { return f.states.indexOf(v) >= 0; }); }); };
  var LOOPS = M.profile.loops_text.filter(function (l) { return !inBig(l); });
  var KINDS = (FULL && FULL.profile.kinds) || [];
  var marks = {};
  M.ids.forEach(function (v) {
    var right = [], left = [], foot = [];
    LOOPS.forEach(function (l, li) { if (l.states.indexOf(v) >= 0) right.push({ kind: "loop", i: li }); });
    SYS.forEach(function (f, fi) { if (f.states.indexOf(v) >= 0) right.push({ kind: "system", i: fi }); });
    var elsewhere = M.chain && M.chain.shared && M.chain.shared[v];
    if (elsewhere && elsewhere.length) left.push({ kind: "shared" });
    // NOT (YET) ACTUAL (1.12): ◌ a possibility, … what cannot be specified in advance.
    var stt = obj(M.states[v]).status;
    if (stt === "possible" || stt === "open") left.push({ kind: stt });
    var k = FULL ? obj(FULL.states[v]).kind : null, kd = k == null ? null : KINDS.filter(function (x) { return x.id === String(k); })[0];
    if (kd && kd.states.some(function (w) { return w !== v; })) left.push({ kind: "kin" });
    var ms = FULL ? obj(FULL.states[v]).measures : null;
    if (ms != null && has(FULL.states, ms)) foot.push({ kind: "measure" });
    // WHAT CONSTITUTES WHAT (profile 1.11): ⊂ on a state that makes up something else, ⊃ on a whole
    // made up of drawn states. A mark, never an arrow: an arrow is a step, and constitution is not.
    var CS = M.constitutions || [];
    if (CS.some(function (c) { return c.from === v && c.layer !== "appraisal"; })) foot.push({ kind: "constitutes" });
    if (CS.some(function (c) { return !c.toActor && c.to === v && c.layer !== "appraisal"; })) foot.push({ kind: "constituted" });
    marks[v] = { left: left, right: right, foot: foot };
  });
  return { marks: marks, loops: LOOPS, systems: SYS };
}

/** Lay the chain out. Twice where the first pass finds a box too short for the arrows arriving
 *  at it (M9): the second gives each such box the height its arrivals need, heads a head's width
 *  apart, and everything below moves down to make room. */
function layout(M, opts) {
  opts = opts || {};
  var G = layoutOnce(M, opts), minH = {}, minW = {};
  // Up to three passes: making room in one place can show a need in another. Needs only grow, so
  // this settles.
  for (var pass = 0; pass < 3; pass++) {
    var grew = false;
    Object.keys(G.needH || {}).forEach(function (v) { if (!(minH[v] >= G.needH[v])) { minH[v] = G.needH[v]; grew = true; } });
    Object.keys(G.needW || {}).forEach(function (c) { if (!(minW[c] >= G.needW[c])) { minW[c] = G.needW[c]; grew = true; } });
    if (!grew) break;
    G = layoutOnce(M, Object.assign({}, opts, { minH: minH, minW: minW }));
  }
  delete G.needH; delete G.needW;
  return G;
}
function layoutOnce(M, opts) {
  // A CO-CAUSE ORDERS THE CHAIN AS A CAUSE DOES (profile 1.4): "belief moves people to act only
  // with a wish to fit in" puts the wish before the act, as the checker's routes have it. So the
  // columns, the systems and the depth-first walk see each co-cause as a step of its own; only
  // the drawing keeps it one arrow, with a stem.
  var ordering = M.steps.slice();
  M.steps.forEach(function (s) {
    // A BLOCKER AND A MODERATOR ARE PLACED AS A CO-CAUSE IS, before the step's end. Left out, a
    // state with no step or role of its own was never drawn at all, and its stem hung from nothing:
    // the planted defences and Marti and Gond's devices and backers (James's verdicts, 29 Sep 2026).
    (s.jointly || []).concat(s.unless || [], (s.modifies || []).map(function (m) { return m.by; }), s.measuredBy || []).forEach(function (j) {
      if (has(M.states, j) && j !== s.to) ordering.push({ id: s.id + " & " + j, from: j, to: s.to, layer: s.layer,
                                                          isNull: s.isNull, selects: s.selects, assoc: s.assoc });
    });
  });
  // WHAT MAKES SOMETHING UP IS DRAWN, AND BEFORE ITS WHOLE (profile 1.11): a state whose only tie is
  // a constitutive relation was left undrawn, and its ⊂ with it (James's health-system map, 30 Sep
  // 2026). Ordered as a co-cause is, for the columns only: nothing is drawn between them.
  (M.constitutions || []).forEach(function (c) {
    if (!c.toActor && has(M.states, c.from) && has(M.states, c.to))
      ordering.push({ id: "constitutes " + c.from + " " + c.to, from: c.from, to: c.to, layer: c.layer, isNull: false, selects: false, constitution: true });
  });
  var used = {};
  ordering.forEach(function (s) { used[s.from] = used[s.to] = true; });
  M.ids.forEach(function (i) { if (isStart(M.states[i])) used[i] = true; });
  (M.constitutions || []).forEach(function (c) { if (has(M.states, c.from)) used[c.from] = true; });
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
    if (s.layer === "text" && !s.isNull && !s.selects && !s.assoc && !s.constitution) textPairs.push([s.from, s.to]);
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
  // ...AND THAT IS NOW MADE TRUE, not hoped for. A state of the column with a lane strictly inside
  // the span would sit under the box, so the spanning state takes a column of its own and those
  // after it move one to the right: Wilson 2023's `flows` and means-improvement, each across all
  // three levels, sat on eleven boxes of the services lane (7 Oct 2026). Taken in order of column,
  // so each insertion is made once, and a span with no state inside it keeps its column.
  ids.filter(spans).sort(function (p, q) { return col[p] - col[q]; }).forEach(function (v) {
    var c = col[v];
    var under = ids.some(function (w) {
      return w !== v && col[w] === c && range[w][0] > range[v][0] && range[w][0] < range[v][1]; });
    if (!under) return;
    ids.forEach(function (u) { if (u !== v && col[u] > c) col[u] += 1; });
    col[v] = c + 1;
  });
  var slots = {};
  var place = function (v, li) { var k = M.levels[li] + "|" + col[v]; (slots[k] = slots[k] || []).push(v); };
  M.levels.forEach(function (lv, li) {
    // Ending here (from above) first, then this lane's own states, then those going on below.
    ids.forEach(function (v) { if (spans(v) && range[v][1] === li) place(v, li); });
    ids.forEach(function (v) { if (spans(v) && range[v][0] < li && range[v][1] > li) place(v, li); });
    ids.forEach(function (v) { if (!spans(v) && range[v][0] === li) place(v, li); });
    ids.forEach(function (v) { if (spans(v) && range[v][0] === li) place(v, li); });
  });
  // A BOX THE READER HAS OPENED TO ITS WHOLE LABEL IS TALLER, and its row with it (James, 29 Sep
  // 2026: a label cut at three lines hid what the state was). Rows are no longer one fixed pitch:
  // each row of a lane is as tall as the tallest box in it, so what lies below moves down rather
  // than under the opened box -- as a claim's "more" re-lays the Reasons map. Closed, every row is
  // ROW apart as before.
  var labelOf = function (v) { return obj(M.states[v]).label || v; };
  var boxH = {};
  ids.forEach(function (v) {
    var n = wrapWords(labelOf(v), charsFor(BW), Infinity).length;
    boxH[v] = opts.open && opts.open[v] && !spans(v) && n > MAX_LINES ? Math.max(BH, n * LINE_H + LINE_H + 10) : BH;
    if (opts.minH && opts.minH[v] && !spans(v)) boxH[v] = Math.max(boxH[v], opts.minH[v]);
  });
  var rowHs = M.levels.map(function (lv) {
    var hs = [];
    Object.keys(slots).forEach(function (k) {
      if (k.slice(0, lv.length + 1) !== lv + "|") return;
      slots[k].forEach(function (v, r) { hs[r] = Math.max(hs[r] || BH, spans(v) ? BH : boxH[v]); });
    });
    return hs;
  });
  // M9: ROOM IS MADE, NOT SQUEEZED. Two boxes stacked in one column with a step between them have
  // the arrow, its head, its label and the marks on both facing edges to hold: 44px held none of it
  // (the Coleman boat's B and C, 30 Sep 2026). That gap grows; the rest keep the old pitch.
  var joined = {};
  ordering.forEach(function (st) { if (st.from !== st.to && !st.constitution) joined[st.from + "\u0000" + st.to] = joined[st.to + "\u0000" + st.from] = true; });
  var gapAfter = M.levels.map(function (lv, li) {
    var gs = [];
    Object.keys(slots).forEach(function (k) {
      if (k.slice(0, lv.length + 1) !== lv + "|") return;
      var col0 = slots[k];
      for (var r = 0; r + 1 < col0.length; r++)
        if (joined[col0[r] + "\u0000" + col0[r + 1]]) gs[r] = STACK_GAP;
    });
    return gs;
  });
  var rowOff = function (li, r) { var t = 0; for (var i = 0; i < r; i++) t += rowHs[li][i] + (gapAfter[li][i] || ROW - BH); return t; };
  // NESTED LEVELS (opts.nest): each level a frame inside its parent's, instead of a band beside it.
  var nest = nestTree(M.levels, opts.nest);
  var closeAt = function (li) { return nest ? M.levels.filter(function (lv) { return nest.last[lv] === li; }).length : 0; };
  var lanes = [], y = TOP;
  M.levels.forEach(function (lv, li) {
    var rows = rowHs[li].length;
    // A level nothing in the text reaches is a thin strip that says so, not an empty band.
    var h = rows ? HEAD + rowOff(li, rows) + PADY : HEAD + 4;
    var actorsHere = Object.keys(M.actors).filter(function (a) { return obj(M.actors[a]).level === lv; })
                           .map(function (a) { return obj(M.actors[a]).label || a; });
    // THE HEADING'S EXTENT, estimated as the chips' are, so labels keep clear of its words (M1) and
    // not of the whole strip; the page test holds the estimate to what the browser draws.
    var who = !rows ? "nothing in the text at this level" : actorsHere.join(" · ");
    var dep = nest ? nest.depth[lv] : 0;
    lanes.push({ level: lv, y: y, h: h, empty: !rows, actors: actorsHere, who: who, depth: dep,
                 head: { x: 8 + dep * NEST_INSET, y: y + 4, w: 8 + lv.length * 9 + 10 + who.length * 6.9, h: 18 } });
    // Room below a lane for every frame that closes there, innermost first.
    y += h + closeAt(li) * NEST_CLOSE;
  });
  var nodes = {}, maxRank = 0;
  // M9 ACROSS: a gap between two columns is widened where a label on an arrow across it had no
  // clear place (Badger culling's ranging → contact, 30 Sep 2026); asked for by placeChips below.
  var nestPad = nest ? nest.maxDepth * NEST_INSET : 0;
  var xOfCol = function (c) { var x = GUT + nestPad + c * COL; for (var i = 0; i < c; i++) x += (opts.minW && opts.minW[i]) || 0; return x; };
  ids.forEach(function (v) {
    var rowY = function (li) { return lanes[li].y + HEAD + PADY / 2 + rowOff(li, slots[M.levels[li] + "|" + col[v]].indexOf(v)); };
    var top = rowY(range[v][0]), bottom = rowY(range[v][1]) + (spans(v) ? BH : boxH[v]);
    nodes[v] = { x: xOfCol(col[v]), y: top, w: BW, h: bottom - top, col: col[v] };
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
  // WHAT EACH BOX SAYS, and whether it says all of it. Three lines, or as many as a box running
  // through several lanes has room for; `more` offers the rest, `open` is showing it.
  ids.forEach(function (v) {
    var p = nodes[v], all = wrapWords(labelOf(v), charsFor(p.w), Infinity);
    var cap = spans(v) ? Math.max(MAX_LINES, Math.floor((p.h - LINE_H) / LINE_H)) : MAX_LINES;
    p.more = all.length > cap;
    p.open = !!(p.more && opts.open && opts.open[v]);
    if (p.open && spans(v)) p.h = Math.max(p.h, all.length * LINE_H + LINE_H + 10);
    p.lines = p.open ? all : wrapWords(labelOf(v), charsFor(p.w), cap);
  });
  // A HEADING STOPS SHORT OF A BOX IN ITS STRIP (M1): a state across levels runs down through the
  // lower lane's heading, and a long list of actors ran on under it (the Coleman boat's Schelling
  // model, 30 Sep 2026). The words are cut to the room before the first such box, and say
  // themselves in full on hover.
  lanes.forEach(function (ln) {
    var hd = ln.head, stop = Infinity;
    ids.forEach(function (v) { var n = nodes[v];
      if (n.y < hd.y + hd.h + 16 && n.y + n.h > hd.y && n.x + n.w > hd.x) stop = Math.min(stop, n.x - 8); });
    if (hd.x + hd.w <= stop) return;
    var room = Math.max(0, stop - hd.x - 8 - ln.level.length * 9 - 10), keepN = Math.floor(room / 6.9);
    ln.whoFull = ln.who;
    ln.who = keepN >= ln.who.length ? ln.who : keepN > 3 ? ln.who.slice(0, keepN - 1).replace(/\s+\S*$/, "") + "…" : "";
    hd.w = 8 + ln.level.length * 9 + (ln.who ? 10 + ln.who.length * 6.9 : 0);
  });
  // THE MARKS ON EACH BOX, placed here so everything else keeps clear of them (M11). Positions are
  // relative to the box's top-left corner; `r` is the badge's radius.
  ids.forEach(function (v) {
    var p = nodes[v], mk = (opts.marks && opts.marks[v]) || { left: [], right: [], foot: [] };
    p.badges = [];
    mk.left.forEach(function (b, i) { p.badges.push({ kind: b.kind, i: b.i, x: BADGE_R + i * BADGE_STEP, y: -5, r: BADGE_R, edge: "top" }); });
    mk.right.forEach(function (b, j) { p.badges.push({ kind: b.kind, i: b.i, x: p.w - BADGE_R - j * BADGE_STEP, y: -5, r: BADGE_R, edge: "top" }); });
    mk.foot.forEach(function (b, j) { p.badges.push({ kind: b.kind, x: p.w - BADGE_R - j * BADGE_STEP, y: p.h + 5, r: BADGE_R, edge: "foot" }); });
    p.pill = p.more ? { x: PILL_X - PILL_W / 2, y: p.h - PILL_H / 2, w: PILL_W, h: PILL_H } : null;
  });
  // A STATE THE TEXT LINKS TO NOTHING says so beside its box -- and the drawing is wide enough to
  // hold the words: on the last column "✕ no link in the text" ran off the edge and read "✕ no l"
  // (James, Valentino's second chain, 29 Sep 2026).
  var unlinkedRight = false;
  ids.forEach(function (v) {
    var s = M.states[v];
    nodes[v].unlinked = isStart(s) && !M.steps.some(function (x) {
      return x.layer === "text" && (x.from === v || (x.jointly || []).indexOf(v) >= 0 || (x.unless || []).indexOf(v) >= 0 ||
                                    (x.modifies || []).some(function (m) { return m.by === v; })); });
    if (nodes[v].unlinked && col[v] === maxRank) unlinkedRight = true;
    nodes[v].gapword = nodes[v].unlinked ? { x: nodes[v].w + 10, y: nodes[v].h / 2 - 8, w: GAPWORD_W, h: 14 } : null;
  });
  /** Where on a box's top or foot an arrow may meet it: the stretch clear of that edge's marks
   *  (M4: the head of Admissions' arrow up into "How students think" sat on its "more" pill). */
  var freeSpan = function (v, edge) {
    var p = nodes[v], lo = 0, hi = p.w, taken = [];
    (p.badges || []).forEach(function (b) { if (b.edge === edge) taken.push([b.x - b.r - 4, b.x + b.r + 4]); });
    if (edge === "foot" && p.pill) taken.push([p.pill.x - 4, p.pill.x + p.pill.w + 4]);
    // The widest stretch between the taken ones.
    var cuts = [[-Infinity, 0]].concat(taken.sort(function (a, b) { return a[0] - b[0]; }), [[p.w, Infinity]]);
    var best = [0, p.w], bw = -1;
    for (var i = 0; i + 1 < cuts.length; i++) {
      var a = Math.max(lo, cuts[i][1]), b = Math.min(hi, cuts[i + 1][0]);
      if (b - a > bw) { bw = b - a; best = [a, b]; }
    }
    return best;
  };

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
  var groups = {}, order = []; var baseOf = {};
  var kindOf = function (s) { return s.isNull ? "null" : s.selects ? "selection" : s.assoc ? "association" : "step"; };
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
            ((s.jointly || []).length ? "\u0000&" + s.jointly.join(",") : "") +
            // and "raises unless the defences hold" says something else again.
            ((s.unless || []).length ? "\u0000!" + s.unless.join(",") : "") +
            // and "slows the rise of" is not "lowers".
            (s.on === "trend" ? "\u0000~" : "") +
            // and "makes", "maintains" and "transforms" are not "raises" (1.11).
            (FORMATION.indexOf(s.on) >= 0 ? "\u0000o" + s.on : "") +
            // and a step in one regime, or past a threshold, is not the same arrow as one in all.
            (s.regime ? "\u0000@" + s.regime : "") + (s.threshold ? "\u0000|" : "") +
            // and so is a step in another period: merged, Valentino's 1990s moderation and its
            // 2010 null moderation drew one arrow with one ring (28 Sep 2026).
            (s.period ? "\u0000#" + s.period : "") +
            // and two sizes are two findings: merged, Yellowstone's two texts, which agree on the
            // direction and dispute only the size, drew as one arrow "×2" (G3).
            (s.size ? "\u0000=" + s.size : "") +
            // and "only if", "enough on its own", a moderated step and a type of attribution each say
            // something a plain "raises" does not (profile 1.9).
            (s.necessary === true ? "\u0000N" : "") + (typeof s.sufficient === "boolean" ? "\u0000S" + s.sufficient : "") +
            (s.attribution ? "\u0000A" + s.attribution : "");
    // A MODERATOR IS NOT A SECOND ARROW: it acts on the relationship, and Marti and Gond's six
    // propositions about one pair of states drew six parallel arrows. Its ring goes on the one arrow.
    // AN ARROW THE READER HAS OPENED draws each of its steps apart: "raises ×2" said how many, not
    // what each said (James's verdict on Marti and Gond's moderators, 29 Sep 2026).
    var base = k;
    if (opts.expand && opts.expand[base]) k = base + "\u0000*" + s.id;
    baseOf[k] = base;
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
  var xOfColL = xOfCol;
  // An arrow is disputed where one of its claims is set against a claim on another arrow between the
  // same two states (the model's `against`, from the argument).
  var disputedKey = function (ss) {
    var s0 = ss[0], mine = ss.filter(function (x) { return x.claim; }).map(function (x) { return x.claim.title; });
    if (!mine.length) return false;
    return drawn.steps.some(function (o) {
      // Only between arrows of one voice: a rival view against the text's own step already reads
      // as a dispute by its colour.
      return o.from === s0.from && o.to === s0.to && o.layer === s0.layer && mine.indexOf(o.claim && o.claim.title) < 0 &&
        mine.some(function (t) { return M.against && o.claim && M.against[t + "\u0000" + o.claim.title]; }); });
  };
  // ARROWS BETWEEN THE SAME STATES RUN IN TIME ORDER, top to bottom: a period's rank is where it
  // first appears in the file, which follows the text's own order. Sorted by key, "no effect after
  // culling ended" came above "raises during culling" (James's verdict on the badgers, 29 Sep 2026).
  var periodRank = {};
  M.steps.forEach(function (s, i) { if (s.period && !has(periodRank, s.period)) periodRank[s.period] = i; });
  var timeOf = function (k) { var pd = groups[k][0].period; return pd && has(periodRank, pd) ? periodRank[pd] : -1; };
  // THE COLUMNS' FREE GAPS, for routing (M2). An arrow was one curve from its start to its end,
  // and one that skipped a column ran through whatever box stood in its way: on the Coleman boat in
  // general, C's arrow to the rules of the game ran behind the agents' mental states, and read as
  // going into them (30 Sep 2026; 290 such arrows across the research maps). Each column's boxes,
  // with the room their badges and pills take above and below, leave gaps an arrow can pass through.
  var drawnHere = function (v) { return !drawn.folded[v] && setAside.indexOf(v) < 0; };
  var colSpan = {};
  Object.keys(nodes).forEach(function (v) {
    if (!drawnHere(v)) return;
    var n = nodes[v];
    (colSpan[n.col] = colSpan[n.col] || []).push([n.y - 20, n.y + n.h + 12]);
  });
  var used = {};
  /** The height at which to cross column c, nearest `ideal`, in a gap clear of its boxes and of the
   *  arrows already routed through it. */
  var crossAt = function (c, ideal, peek) {
    var spans = (colSpan[c] || []).slice().sort(function (p, q) { return p[0] - q[0]; });
    // Not along the drawing's very top edge: an arrow there took its label off the drawing.
    var gaps = [], top = TOP + 4;
    spans.forEach(function (sp) { if (sp[0] > top) gaps.push([top, sp[0]]); top = Math.max(top, sp[1]); });
    gaps.push([top, Infinity]);
    var best = null, bd = Infinity;
    gaps.forEach(function (g) {
      if (g[1] - g[0] < 10) return;
      var yy = Math.min(Math.max(ideal, g[0] + 5), g[1] - 5);
      // Apart from the arrows already through this gap, so two routes do not run as one line.
      var u = used[c] || [], guard = 0;
      while (u.some(function (w) { return Math.abs(w - yy) < 7; }) && guard++ < 12) yy += yy + 7 < g[1] - 5 ? 7 : -7;
      if (Math.abs(yy - ideal) < bd) { bd = Math.abs(yy - ideal); best = yy; }
    });
    if (!peek) (used[c] = used[c] || []).push(best);
    return best;
  };
  var hitsBox = function (segs, skip) {
    return Object.keys(nodes).some(function (v) {
      if (!drawnHere(v) || skip.indexOf(v) >= 0) return false;
      return polyHitsRect(pathPts({ segs: segs }, 40), nodes[v], 2);
    });
  };
  /** A forward arrow from S to E, through the columns between: level across each column, in a gap,
   *  and a curve between, each meeting the next level so the whole reads as one line. `down` is
   *  true where it leaves from a box's top or foot, and so starts vertical. */
  var routeThrough = function (S, E, c0, c1, vertStart, under) {
    var pts = [], prev = S;
    for (var c = c0 + 1; c < c1; c++) {
      var xl = xOfCol(c) - 8, xr = xOfCol(c) + BW + 8;
      var ideal = prev[1] + (E[1] - prev[1]) * (xl - prev[0]) / Math.max(1, E[0] - prev[0]);
      // `under`: below everything in the column, where the gap nearest the straight line is taken
      // already -- see the stem router.
      if (under) ideal = (colSpan[c] || []).reduce(function (m, sp) { return Math.max(m, sp[1] + 10); }, ideal);
      var yy = crossAt(c, ideal);
      pts.push([xl, yy], [xr, yy]);
      prev = [xr, yy];
    }
    var segs = [], at = S;
    var join = function (A, B, vert) {
      var c2 = Math.max(18, (B[0] - A[0]) / 2);
      segs.push(vert ? [A, [A[0], A[1] + (B[1] - A[1]) * 0.75], [B[0] - c2, B[1]], B]
                     : [A, [A[0] + c2, A[1]], [B[0] - c2, B[1]], B]);
    };
    for (var i = 0; i < pts.length; i += 2) {
      join(at, pts[i], !segs.length && vertStart);
      var L = pts[i], R = pts[i + 1], w3 = (R[0] - L[0]) / 3;
      segs.push([L, [L[0] + w3, L[1]], [R[0] - w3, R[1]], R]);
      at = R;
    }
    join(at, E, !segs.length && vertStart);
    return segs;
  };

  // WHERE EACH ROUTED ARROW HEADS, before its port is chosen: an arrow that goes under a box on its
  // way leaves from low on its side, whatever the height of where it ends (the Coleman boat in
  // general: C's two arrows crossed as they left it, 30 Sep 2026).
  var aimOut = {}, aimIn = {};
  order.forEach(function (k) {
    var s0 = groups[k][0], a = nodes[s0.from], b = nodes[s0.to];
    if (isBackKey[k] || isVertKey[k] || isSideKey[k] || b.col - a.col < 2) return;
    var S = [a.x + a.w, cyOf(s0.from)], E = [b.x - 2 - STUB, cyOf(s0.to)], cc0 = Math.max(40, (E[0] - S[0]) / 2);
    if (!hitsBox([[S, [S[0] + cc0, S[1]], [E[0] - cc0, E[1]], E]], [s0.from, s0.to])) return;
    var ys = [], prev = S;
    for (var cc = a.col + 1; cc < b.col; cc++) {
      var xl = xOfCol(cc) - 8, ideal = prev[1] + (E[1] - prev[1]) * (xl - prev[0]) / Math.max(1, E[0] - prev[0]);
      var yy = crossAt(cc, ideal, true); ys.push(yy); prev = [xOfCol(cc) + BW + 8, yy];
    }
    aimOut[k] = ys[0]; aimIn[k] = ys[ys.length - 1];
  });
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
        return (where === "bottom" ? b - a : a - b) || timeOf(p) - timeOf(q) || (p < q ? -1 : p > q ? 1 : 0);
      });
      var fs = freeSpan(v, where === "bottom" ? "foot" : "top"), a0 = fs[0] + 8, a1 = fs[1] - 8;
      list.forEach(function (k, i) { portSide[k] = where; portX[k] = n.x + a0 + (a1 - a0) * (i + 0.5) / list.length; });
    };
    fan(below, "bottom"); fan(above, "top");
    outs[v] = side;
  });
  var spread = function (list, key, other, into) {
    var aim = key === "from" ? aimOut : aimIn;
    var yOf = function (k2) { return has(aim, k2) ? aim[k2] : cyOf(groups[k2][0][other]); };
    list.sort(function (p, q) {
      var a = groups[p][0], b = groups[q][0];
      return yOf(p) - yOf(q) || nodes[a[other]].x - nodes[b[other]].x || timeOf(p) - timeOf(q) || (p < q ? -1 : p > q ? 1 : 0);
    });
    list.forEach(function (k, i) { var n = nodes[groups[k][0][key]]; into[k] = n.y + 8 + (n.h - 16) * (i + 0.5) / list.length; });
  };
  Object.keys(outs).forEach(function (v) { spread(outs[v], "from", "to", portY); });
  Object.keys(ins).forEach(function (v) { spread(ins[v], "to", "from", portIn); });
  // A SIDE TOO SHORT FOR ITS ARRIVALS: their heads would sit on each other (1,252 such pairs across
  // the research maps, 30 Sep 2026). Asked for here, granted by the second pass in `layout`.
  var needH = {};
  Object.keys(ins).forEach(function (v) {
    var want = 16 + (HEAD_W + 4) * ins[v].length;
    if (want > nodes[v].h + 0.5) needH[v] = want;
  });

  var edges = order.map(function (k) {
    var ss = groups[k], s0 = ss[0], a = nodes[s0.from], b = nodes[s0.to];
    var isBack = isBackKey[k];
    // A merged arrow is a null or a selection only if everything in it is; otherwise it is a step.
    var kinds = {}; ss.forEach(function (x) { kinds[kindOf(x)] = true; });
    var kind = Object.keys(kinds).length === 1 ? kindOf(s0) : "step";
    var wordOf = function (x) { return x.isNull ? "no effect" : x.selects ? "selection effect" : x.assoc ? "associated" : signWord(x.sign ? [x.sign] : []); };
    var tally = {}; ss.forEach(function (x) { tally[wordOf(x)] = (tally[wordOf(x)] || 0) + 1; });
    var breakdown = Object.keys(tally).map(function (w) { return { word: w, count: tally[w] }; })
      .sort(function (p, q) { return q.count - p.count || (p.word < q.word ? -1 : p.word > q.word ? 1 : 0); });
    var off = s0.layer === "rival" ? 10 : s0.layer === "appraisal" ? -10 : kind === "null" ? 20 : kind === "selection" || kind === "association" ? -20 : 0;
    // THREE CHANNELS, ONE MEANING EACH (F5). Weight: the best the text offers for the step.
    // Pattern: the closest any of its claims stands to the words. Colour: whose step, and what kind.
    var tier = ss.map(function (s) { return s.tier; })
                 .sort(function (p, q) { return TIERS.indexOf(p) - TIERS.indexOf(q); })[0];
    var fidelity = ss.map(function (s) { return s.fidelity; })
                     .sort(function (p, q) { return FIDELITY.indexOf(p) - FIDELITY.indexOf(q); })[0];
    var ink = s0.layer !== "text" ? s0.layer : kind === "selection" ? "selection" : kind === "association" ? "association" : "text";   // kind is "step" when mixed
    // THE ARROWHEAD RIDES A SHORT SOLID STUB at the end of the path. On a dashed line the head sat
    // wherever the dash pattern happened to end -- often after a gap, floating off its line.
    var d, stub, P, segs = null;
    if (isVertKey[k]) {
      // Downward arrows to the left of the centre, upward ones to the right, spread if several.
      var down = b.y > a.y, mine = pairKeys[[s0.from, s0.to].sort().join("\u0000")];
      var ways = mine.filter(function (q) { return (nodes[groups[q][0].to].y > nodes[groups[q][0].from].y) === down; });
      var both = mine.length > ways.length;
      var fa = freeSpan(s0.from, down ? "foot" : "top"), fb = freeSpan(s0.to, down ? "top" : "foot");
      var lo = Math.max(fa[0], fb[0]) + 8, hi = Math.min(fa[1], fb[1]) - 8, mid = (lo + hi) / 2;
      var vx = a.x + (hi > lo ? mid : a.w / 2) + (both ? (down ? -14 : 14) : 0) + (ways.indexOf(k) - (ways.length - 1) / 2) * 10 * (down ? -1 : 1);
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
      // A RETURNING ARC runs under the boxes, from its source's foot to its target's (M2). Where a
      // box stands below either end in its column, that leg cannot go straight down or up through
      // it: it goes out of the box's side into the gap beside the column instead, and a target so
      // blocked is entered from its left side (Merton's bank loop, 29 Sep 2026). The run under is
      // at the shallowest depth clear of every box between.
      var below = function (n) { return Object.keys(nodes).some(function (w) { var m = nodes[w];
        return drawnHere(w) && m !== n && m.y > n.y && m.x < n.x + n.w && m.x + m.w > n.x; }); };
      var outSide = below(a), inSide = below(b);
      var x1 = a.x + a.w / 2 + off, y1 = a.y + a.h, x2 = b.x + b.w / 2 + off, y2 = b.y + b.h;
      var yo = a.y + a.h / 2 + 8, gxa = a.x + a.w + 22 + Math.abs(off), yin = b.y + b.h / 2 + 8, xin = b.x - 2, xe = xin - STUB, gxb = xe - 26 - Math.abs(off);
      var shape = function (dp) {
        var W = outSide ? [[a.x + a.w, yo], [gxa, yo], [gxa, dp]] : [[x1, y1], [x1, dp]];
        W = W.concat(inSide ? [[gxb, dp], [gxb, yin], [xe, yin]] : [[x2, dp], [x2, y2 + STUB + 2]]);
        return roundPath(W, 18);
      };
      var dip0 = Math.max(outSide ? yo : y1, inSide ? yin : y2) + 30 + Math.abs(off) * 2;
      var dips = [dip0];
      Object.keys(nodes).forEach(function (w) { var m = nodes[w];
        if (drawnHere(w) && m.y + m.h + 30 > dip0 && m.x + m.w > Math.min(x1, x2, gxb) - 20 && m.x < Math.max(x1, x2, gxa) + 20) dips.push(m.y + m.h + 34 + Math.abs(off)); });
      dips.sort(function (p, q) { return p - q; });
      var pickDip = dips[dips.length - 1];
      for (var di = 0; di < dips.length; di++) if (!hitsBox(shape(dips[di]), [s0.from, s0.to])) { pickDip = dips[di]; break; }
      segs = shape(pickDip);
      var lastB = segs[segs.length - 1];
      P = [segs[0][0], segs[0][1], lastB[2], lastB[3]];
      stub = inSide ? "M" + xe + "," + yin + " L" + xin + "," + yin
                    : "M" + x2 + "," + (y2 + STUB + 2) + " L" + x2 + "," + (y2 + 2);
    } else {
      var X2 = b.x - 2, Y2 = portIn[k], XE = X2 - STUB;
      var S0;
      if (portSide[k]) {
        var BX = portX[k], BY = portSide[k] === "bottom" ? a.y + a.h : a.y;
        var c2 = Math.max(30, (XE - BX) / 2);
        P = [[BX, BY], [BX, BY + (Y2 - BY) * 0.75], [XE - c2, Y2], [XE, Y2]];
        S0 = [BX, BY];
      } else {
        var X1 = a.x + a.w, Y1 = portY[k], c = Math.max(40, (XE - X1) / 2);
        P = [[X1, Y1], [X1 + c, Y1], [XE - c, Y2], [XE, Y2]];
        S0 = [X1, Y1];
      }
      // Routed only where the one curve would run through a box; a clear arrow keeps its curve.
      if (b.col - a.col > 1 && hitsBox([P], [s0.from, s0.to])) {
        segs = routeThrough(S0, [XE, Y2], a.col, b.col, !!portSide[k]);
        var last = segs[segs.length - 1];
        P = [segs[0][0], segs[0][1], last[2], last[3]];
      }
      stub = "M" + XE + "," + Y2 + " L" + X2 + "," + Y2;
    }
    d = segs ? segsPath(segs) : "M" + P[0][0] + "," + P[0][1] + " C" + P[1][0] + "," + P[1][1] + " " + P[2][0] + "," + P[2][1] + " " + P[3][0] + "," + P[3][1];
    // A null finding has no head, so no stub: its line runs all the way in.
    // It runs on along its own last direction, whichever side of the box it comes in by.
    // AN ASSOCIATION (1.13) has no head either: it relates the two, it runs from neither.
    if (kind === "null" || kind === "association") {
      var nd = [P[3][0] - P[2][0], P[3][1] - P[2][1]], nl = Math.hypot(nd[0], nd[1]) || 1;
      d += " L" + (P[3][0] + nd[0] / nl * STUB) + "," + (P[3][1] + nd[1] / nl * STUB); stub = null;
    }
    var signs = [];
    ss.forEach(function (s) { if (s.sign && signs.indexOf(s.sign) < 0) signs.push(s.sign); });
    // ↻ marks the step that closes a loop: an arc that returns, or a step in one column that the
    // depth-first walk found closing one.
    var closes = isBack || ((isVertKey[k] || isSideKey[k]) && ss.some(function (x) { return back[x.id]; }));
    var given = ss.some(function (s) { return s.given.length > 0; });
    var viaName = function (v) { var t = String(obj(M.states[v]).label || v); return t.length > 22 ? t.slice(0, 21) + "…" : t; };
    // A STEP THE TEXT OPENS INTO A ROUTE (profile 1.8) is labelled as a folded route is: it IS
    // that route, not a second one beside it.
    var stated = !s0.parts && ss.every(function (x) { return (x.statedVia || []).length && x.share === "entire"; }) ? s0.statedVia : null;
    // THE SIZE ON THE ARROW (G3): two texts that agree on direction and dispute only size drew as
    // one picture of agreement. One step with a stated value shows it.
    var sz = s0.sizeValue || s0.size || "";
    // NEVER CUT: "slows · 8% below the coun…" hid the finding it was there to give (James's verdict
    // on the levy, 29 Sep 2026). The chip wraps instead (chipLines).
    var sizeTag = sz ? " · " + (sz.length > 60 ? sz.slice(0, 59) + "…" : sz) : "";
    // THE PERIOD ON THE ARROW, where one pair has steps in several: each is its own arrow.
    var pd = s0.period || "";
    var periodTag = pd && ss.every(function (x) { return x.period === pd; }) &&
      M.steps.some(function (x) { return x.from === s0.from && x.to === s0.to && x.period && x.period !== pd; })
      ? " · " + (pd.length > 40 ? pd.slice(0, 39) + "…" : pd) : "";
    var route = s0.parts ? (ss.length === 1 ? " · via " + viaName(s0.via[0]) + (s0.via.length > 1 ? " +" + (s0.via.length - 1) : "")
                                            : " · " + ss.length + " routes")
              : stated ? " · via " + viaName(stated[0]) + (stated.length > 1 ? " +" + (stated.length - 1) : "") : "";
    var label = breakdown.length > 1
              ? breakdown.slice(0, 2).map(function (b) { return b.word + " ×" + b.count; }).join(" · ") +
                (breakdown.length > 2 ? " · +" + (breakdown.length - 2) + " more" : "") +
                (given ? " ◇" : "") + (closes ? " ↻" : "")
              : kind === "null" ? "no effect" + (ss.length > 1 ? " ×" + ss.length : "") +
                // A NULL IN ONE PERIOD SAYS WHICH: "no effect" beside "raises during culling" read as
                // a contradiction, not a time course.
                (pd && ss.every(function (x) { return x.period === pd; }) ? " · " + pd : "")
              // "SELECTION EFFECT", in full: "selection" alone named no relation (James's verdict).
              : kind === "selection" ? "selection effect"
              // "ASSOCIATED" (1.13): the text reports they go together, and no more.
              : kind === "association" ? "associated" + (ss.length > 1 ? " ×" + ss.length : "") :
                // A STEP THAT MAKES, KEEPS OR CHANGES IN KIND (1.11) says which, in a verb.
                (signs.length === 1 && formationWord(s0.on, signs[0]) ? formationWord(s0.on, signs[0])
                // A STEP ON A TREND (G7) says so: the levy slowed obesity's rise, it did not lower it.
                : s0.on === "trend" && signs.length === 1 && (signs[0] === "+" || signs[0] === "-")
                  ? (signs[0] === "+" ? "speeds" : "slows")
                  // "ONLY IF" IS NOT "RAISES" (profile 1.9, G5): drawn as a plain raise, a necessary
                  // condition read as more of the one giving more of the other.
                  : s0.necessary === true && s0.sufficient === true ? "needed and enough for"
                  : s0.necessary === true ? "needed for"
                  : s0.sufficient === true ? "enough for" : signWord(signs)) +
                (s0.sufficient === false ? " · not alone" : "") +
                (s0.attribution ? " · " + (ATTRIBUTION_WORD[s0.attribution] || s0.attribution) +
                  (s0.attributionBy ? " by " + String(obj(M.actors[s0.attributionBy]).label || s0.attributionBy).toLowerCase() : "") : "") +
                // TWO ACCOUNTS THAT CANNOT BOTH HOLD SAY SO (James's verdict on Yellowstone, 29 Sep 2026).
                (disputedKey(ss) ? " · disputed" : "") +
                // A STEP PAST A THRESHOLD (G2) says so: drawn as a plain "raises" it read as "more
                // of the one, more of the other", monotone, which Lenton's tipping points are not.
                (s0.threshold ? " past a threshold" : "") +
                (route || (ss.length > 1 ? " ×" + ss.length : "")) + sizeTag + periodTag +
                (given ? " ◇" : "") + (closes ? " ↻" : "");
    var jointly = [];
    ss.forEach(function (x) { (x.jointly || []).forEach(function (j) {
      if (has(M.states, j) && nodes[j] && j !== s0.to && jointly.indexOf(j) < 0) jointly.push(j); }); });
    var blockers = [];
    ss.forEach(function (x) { (x.unless || []).forEach(function (j) {
      if (has(M.states, j) && nodes[j] && j !== s0.to && blockers.indexOf(j) < 0) blockers.push(j); }); });
    // THE MEASURE THE EVIDENCE IS READ FROM, and whether the text says anything bears on it.
    var rests = [];
    ss.forEach(function (x) { (x.measuredBy || []).forEach(function (mb) {
      if (has(M.states, mb) && nodes[mb] && !rests.some(function (y) { return y.state === mb; }))
        rests.push({ state: mb, biased: M.steps.some(function (r) { return r.to === mb && !r.isNull && !r.selects && r.from !== obj(M.states[mb]).measures; }) }); }); });
    var modifiers = [];
    ss.forEach(function (x) { (x.modifies || []).forEach(function (m) {
      if (has(M.states, m.by) && nodes[m.by] && m.by !== s0.to && m.by !== s0.from &&
          !modifiers.some(function (y) { return y.state === m.by; })) modifiers.push({ state: m.by, effect: m.effect }); }); });
    return { key: k, base: baseOf[k] || k, expanded: (baseOf[k] || k) !== k, from: s0.from, to: s0.to, layer: s0.layer, kind: kind, tier: tier, fidelity: fidelity, jointly: jointly, blockers: blockers, modifiers: modifiers, rests: rests, stems: [], junction: /** @type {null | {x:number,y:number,bar:string,gate:string,back:number[],u?:number[],n?:number[],box?:any}} */ (null),
             head: /** @type {null | {x:number,y:number,w:number,h:number}} */ (null), gateT: 0,
             ink: ink, route: !!s0.parts, back: isBack, vertical: !!isVertKey[k], side: !!isSideKey[k], mixed: breakdown.length > 1, breakdown: breakdown,
             steps: ss, path: d, stub: stub, curve: P, segs: segs,
             // A DIRECTION GLYPH BEFORE THE WORD: ▲ raises, ▼ lowers, ◆ decides which -- read at a glance
             // where many chips crowd, and not the + and − that mean support and attack in Reasons.
             chip: (function () {
               var glyph = kind === "step" && breakdown.length === 1 && signs.length === 1
                 ? ({ "+": "▲", "-": "▼", "which": "◆" })[signs[0]] || "" : "";
               var lines = chipLines(label);
               var widest = Math.max.apply(null, lines.map(function (l, i) { return l.length * 6.6 + (i === 0 && glyph ? 11 : 0); }));
               return { x: 0, y: 0, w: widest + 14, h: 4 + 14 * lines.length, label: label, lines: lines, glyph: glyph };
             })() };
  });
  var shown = {};
  Object.keys(nodes).forEach(function (v) { if (!drawn.folded[v] && setAside.indexOf(v) < 0) shown[v] = nodes[v]; });
  // EVERY HEAD ON A SIDE OF A BOX, APART (M1). Each kind of arrow chose where it arrives on its own
  // -- an arc returning into a box's foot, a straight arrow up into the same foot -- and their heads
  // met (Merton's prejudice, 30 Sep 2026). Here all the heads on one side of one box are spread
  // along it, in the order they came, a head's width and a little apart, within what the side's
  // marks leave free; a side with no room for them asks the second pass for a taller box.
  var sideOf = function (e) {
    if (!e.stub) return null;
    var m = /M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/.exec(e.stub), b = nodes[e.to];
    var x1 = +m[3], y1 = +m[4];
    if (+m[2] === y1) return Math.abs(x1 - b.x) < Math.abs(x1 - b.x - b.w) ? "L" : "R";
    return Math.abs(y1 - b.y) < Math.abs(y1 - b.y - b.h) ? "T" : "B";
  };
  var bySide = {};
  edges.forEach(function (e) { var sd = sideOf(e); if (sd) (bySide[e.to + "\u0000" + sd] = bySide[e.to + "\u0000" + sd] || []).push(e); });
  var reStub = function (e) { e.path = segsPath(segsOf(e)); };
  Object.keys(bySide).forEach(function (key) {
    var list = bySide[key]; if (list.length < 2) return;
    var v = key.split("\u0000")[0], sd = key.split("\u0000")[1], b = nodes[v], across = sd === "L" || sd === "R";
    var coord = function (e) { var m = /L([-\d.]+),([-\d.]+)/.exec(e.stub); return across ? +m[2] : +m[1]; };
    list.sort(function (p, q) { return coord(p) - coord(q); });
    var gap = HEAD_W + 3, ok = true;
    for (var i = 1; i < list.length; i++) if (coord(list[i]) - coord(list[i - 1]) < gap) ok = false;
    if (ok) return;
    var lo, hi;
    if (across) { lo = b.y + 8; hi = b.y + b.h - 8; }
    else { var fs = freeSpan(v, sd === "T" ? "top" : "foot"); lo = b.x + fs[0] + 6; hi = b.x + fs[1] - 6; }
    if ((hi - lo) < gap * (list.length - 1)) {
      if (across) needH[v] = Math.max(needH[v] || 0, 16 + gap * list.length);
      var mid = (lo + hi) / 2; lo = mid - gap * (list.length - 1) / 2; hi = mid + gap * (list.length - 1) / 2;
    }
    list.forEach(function (e, i) {
      var want = list.length === 1 ? (lo + hi) / 2 : lo + (hi - lo) * i / (list.length - 1), d = want - coord(e), P = e.curve, ax = across ? 1 : 0;
      if (Math.abs(d) < 0.01) return;
      // A straight arrow between stacked boxes moves whole, so it stays straight; any other moves
      // its end and the control point before it, so it still arrives along its stub.
      if (e.vertical) P.forEach(function (pt) { pt[0] += d; });
      else { P[3][ax] += d; P[2][ax] += d; }
      e.stub = e.stub.replace(/M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/, function (_, a1, b1, c1, d1) {
        return across ? "M" + a1 + "," + (+b1 + d) + " L" + c1 + "," + (+d1 + d) : "M" + (+a1 + d) + "," + b1 + " L" + (+c1 + d) + "," + d1; });
      reStub(e);
    });
  });
  // THE HEAD'S OWN RECTANGLE, from the stub it rides (M4): what labels keep clear of, and what the
  // audit holds apart from everything but the box it points into.
  edges.forEach(function (e) {
    if (!e.stub) { e.head = null; return; }
    var m = /M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/.exec(e.stub);
    var x0 = +m[1], y0 = +m[2], x1 = +m[3], y1 = +m[4];
    var hx = x1 - (x1 - x0) / (Math.hypot(x1 - x0, y1 - y0) || 1) * HEAD_LEN, hy = y1 - (y1 - y0) / (Math.hypot(x1 - x0, y1 - y0) || 1) * HEAD_LEN;
    var lo = [Math.min(hx, x1), Math.min(hy, y1)], hi = [Math.max(hx, x1), Math.max(hy, y1)];
    var hw = HEAD_W / 2;
    e.head = x0 === x1 ? { x: x1 - hw, y: lo[1], w: HEAD_W, h: hi[1] - lo[1] }
                       : { x: lo[0], y: y1 - hw, w: hi[0] - lo[0], h: HEAD_W };
  });
  // GATES APART (M1): where several joint steps run into one state, their gates at one point along
  // each arrow sat on each other near the head (Badger culling's TB). Each takes the first place
  // along its arrow clear of the gates already placed.
  var gatesAt = [];
  edges.forEach(function (e) {
    if (!e.jointly.length || e.back) return;
    var pick = JUNCTION_T;
    for (var gi = 0; gi < GATE_T.length; gi++) {
      var tt = GATE_T[gi], gq = pathAt(e, tt), gxp = gq[0], gyp = gq[1];
      var gbox = { x: gxp - 16, y: gyp - 16, w: 32, h: 32 };
      var hitsBox = Object.keys(shown).some(function (v) { var n = shown[v];
        return overlap(gbox, { x: n.x - 4, y: n.y - 16, w: n.w + 8, h: n.h + 32 }) > 0; }) ||
        lanes.some(function (ln) { return overlap(gbox, ln.head) > 0; });
      if (!hitsBox && gatesAt.every(function (q) { return Math.hypot(q[0] - gxp, q[1] - gyp) > 34; })) { pick = tt; break; }
    }
    e.gateT = pick;
    gatesAt.push(pathAt(e, pick));
  });
  var taken = gatesAt.slice();
  // A stem heading right goes through the columns between as an arrow does.
  var stemRouter = function (n, S, T, under) {
    var cT = 0;
    for (var c = 0; c <= maxRank; c++) if (xOfCol(c) - 8 <= T[0]) cT = c;
    if (T[0] <= xOfCol(cT) + BW + 8 && T[0] >= xOfCol(cT) - 8) cT = cT; else cT = cT + 1;
    if (cT - n.col < 2) return null;
    return routeThrough(S, T, n.col, cT, false, under);
  };
  edges.forEach(function (e) { stemsOf(e, shown, taken, stemRouter, lanes); });
  var chipFails = placeChips(edges, shown, lanes);
  // Wide enough for every lane's heading too (M3: a one-column chain cut its headings off).
  var headRight = Math.max.apply(null, lanes.map(function (ln) { return ln.head ? ln.head.x + ln.head.w + 10 : 0; }).concat([0]));
  var needW = {};
  ids.forEach(function (v) {
    var n = nodes[v];
    if (n.gapword && n.col < maxRank) {
      var want = GAPWORD_W + 30 - (COL - BW) + ((opts.minW && opts.minW[n.col]) || 0);
      if (want > ((opts.minW && opts.minW[n.col]) || 0)) needW[n.col] = Math.max(needW[n.col] || 0, want);
    }
  });
  chipFails.forEach(function (e) {
    var a = nodes[e.from], b = nodes[e.to];
    if (!a || !b || b.col <= a.col) return;
    // The widest gap the arrow crosses gets the room: a label sits where there is most already.
    var c = a.col, want = e.chip.w + 44 - (COL - BW) + ((opts.minW && opts.minW[c]) || 0);
    needW[c] = Math.max(needW[c] || 0, Math.min(want, 400));
  });
  // THE DRAWING HOLDS EVERYTHING DRAWN (M3), routes and labels included: a returning arc goes out
  // into the gap beside the last column, and its label went off the edge with it.
  var extX = 0, extY = 0;
  edges.forEach(function (e) {
    pathPts(e, 8).forEach(function (q) { extX = Math.max(extX, q[0]); extY = Math.max(extY, q[1]); });
    extX = Math.max(extX, e.chip.x + e.chip.w / 2); extY = Math.max(extY, e.chip.y + e.chip.h / 2);
    e.stems.forEach(function (sm) { (sm.pts || []).forEach(function (q) { extX = Math.max(extX, q[0]); extY = Math.max(extY, q[1]); }); });
  });
  // WHAT THE LEVELS ARE, in words, on the drawing's top line after "in sequence, left to right".
  var caption = M.levels.length > 1 ? { text: orderingWords(M.ordering), x: GUT + (M.form && M.form.form === "cycle" ? 290 : 200), y: 22 } : null;
  if (caption) caption.w = caption.text.length * 6.4;
  var width = Math.max(headRight, xOfCol(maxRank) + BW + (unlinkedRight ? UNLINKED_W : 40), extX + 16, caption ? caption.x + caption.w + 16 : 0) + nestPad;
  var height = Math.max(y + 70, extY + 16);
  // THE FRAMES, from their lane's top to below the last lane inside them, each inset by its depth.
  var frames = !nest ? null : M.levels.map(function (lv, li) {
    var L = lanes[nest.last[lv]], d = nest.depth[lv];
    var bottom = L.y + L.h + (nest.depth[M.levels[nest.last[lv]]] - d) * NEST_CLOSE + 4;
    return { level: lv, depth: d, x: 4 + d * NEST_INSET, y: lanes[li].y + 2, w: width - 8 - 2 * d * NEST_INSET, h: bottom - lanes[li].y - 2 };
  });
  return { needH: needH, needW: needW, width: width, height: height, lanes: lanes, nodes: nodes, frames: frames, caption: caption,
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
    if ((s.isNull || s.selects || s.assoc) && (fold[s.from] || fold[s.to])) { hidden.findings++; return; }
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
          sign: mulSign(i.sign, o.sign), isNull: false, selects: false, assoc: false,
          tier: TIERS[Math.max(TIERS.indexOf(i.tier), TIERS.indexOf(o.tier))],
          fidelity: FIDELITY[Math.max(FIDELITY.indexOf(i.fidelity), FIDELITY.indexOf(o.fidelity))],
          hedged: i.hedged || o.hedged, given: i.given.concat(o.given),
          lag: [i.lag, o.lag].filter(Boolean).join("; "), how: null, reflexive: i.reflexive || o.reflexive,
          // A route holds only with every co-cause of every step on it.
          jointly: (i.jointly || []).concat((o.jointly || []).filter(function (j) { return (i.jointly || []).indexOf(j) < 0; }))
                     .filter(function (j) { return j !== o.to; }),
          // and is blocked by whatever blocks any step on it.
          unless: (i.unless || []).concat((o.unless || []).filter(function (j) { return (i.unless || []).indexOf(j) < 0; }))
                     .filter(function (j) { return j !== o.to; }),
          despite: [], statedVia: [],
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
    if (s.isNull || s.selects || s.assoc) return;
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
var CHIP_T = [0.5, 0.4, 0.6, 0.3, 0.7, 0.45, 0.55, 0.22, 0.78, 0.35, 0.65, 0.15, 0.85, 0.1, 0.9,
              0.25, 0.75, 0.33, 0.67, 0.2, 0.8, 0.12, 0.88, 0.05, 0.95];
var CHIP_DY = [0, -13, 13, -24, 24, -36, 36, -50, 50];
/** JOINT CAUSES, DRAWN AS THE REASONS MAP DRAWS LINKED PREMISES. Each co-cause sends a stem to a
 *  bar across the arrow near its head: the effect passes the bar only with every stem in. Drawn
 *  only from a co-cause on the page; the panel names every one whatever is drawn. */
var JUNCTION_T = 0.8, GATE_T = [0.8, 0.7, 0.62, 0.54, 0.46, 0.38, 0.86, 0.3, 0.22];
function stemsOf(e, shown, taken, router, lanes) {
  taken = taken || [];
  if (!e.jointly.length && !e.blockers.length && !(e.modifiers || []).length && !(e.rests || []).length) return;
  var t = e.back ? 0.5 : e.gateT || JUNCTION_T;
  var at = function (u) { return pathAt(e, u); };
  var J = at(t), J1 = at(t - 0.02), J2 = at(Math.min(1, t + 0.02));
  var dx = J2[0] - J1[0], dy = J2[1] - J1[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = -dy / len * 8, ny = dx / len * 8;
  // AN AND GATE WHERE THE CAUSES MEET (James's verdict on the Schelling step, 29 Sep 2026): a bar
  // across the arrow read as a blocker's mark, and the angle a stem came in at hid it. The gate's
  // flat back faces the causes, its round front the effect, as in a circuit diagram.
  var ux = dx / len, uy = dy / len;
  var gx = nx * 1.4, gy = ny * 1.4;
  var B = [J[0] - ux * 11, J[1] - uy * 11], F = [J[0] + ux * 1, J[1] + uy * 1];
  var gate = "M" + (B[0] + gx) + "," + (B[1] + gy) + " L" + (F[0] + gx) + "," + (F[1] + gy) +
             " C" + (F[0] + gx + ux * 15) + "," + (F[1] + gy + uy * 15) + " " + (F[0] - gx + ux * 15) + "," + (F[1] - gy + uy * 15) +
             " " + (F[0] - gx) + "," + (F[1] - gy) + " L" + (B[0] - gx) + "," + (B[1] - gy) + " Z";
  // The gate's rectangle, for everything else to keep clear of (M1).
  var gpts = [[B[0] + gx, B[1] + gy], [B[0] - gx, B[1] - gy], [F[0] + gx + ux * 12, F[1] + gy + uy * 12], [F[0] - gx + ux * 12, F[1] - gy + uy * 12]];
  var gxs = gpts.map(function (q) { return q[0]; }), gys = gpts.map(function (q) { return q[1]; });
  e.junction = e.jointly.length ? { x: J[0], y: J[1], gate: gate, back: B, u: [ux, uy], n: [nx / 8, ny / 8],
                                    box: { x: Math.min.apply(null, gxs), y: Math.min.apply(null, gys),
                                           w: Math.max.apply(null, gxs) - Math.min.apply(null, gxs), h: Math.max.apply(null, gys) - Math.min.apply(null, gys) },
                                    bar: "M" + (J[0] - nx) + "," + (J[1] - ny) + " L" + (J[0] + nx) + "," + (J[1] + ny) } : null;
  // M5: THE INPUTS OF A GATE COME IN APART. The arrow's own line enters the middle of the gate's
  // back; each co-cause its own point on the side it comes from, running in along the arrow's
  // direction for the last stretch -- where two ran to one point from opposite sides they crossed
  // on the way in (Reason's high-reliability organizations, 30 Sep 2026).
  var mainPts = [];
  for (var mi = 0; mi <= 24; mi++) mainPts.push(pathAt(e, t * mi / 24));
  // Each co-cause's side of the arrow, and its place on that side: the one standing further out takes
  // the outer point, so two on one side come in without crossing.
  var gateSlot = {};
  if (e.junction) {
    var bySideJ = { "1": [], "-1": [] };
    e.jointly.forEach(function (j) { var n = shown[j]; if (!n) return;
      var cx1 = n.x + n.w / 2 - e.junction.back[0], cy1 = n.y + n.h / 2 - e.junction.back[1];
      var dist = -uy * cx1 + ux * cy1;
      bySideJ[dist >= 0 ? "1" : "-1"].push({ j: j, d: Math.abs(dist) }); });
    ["1", "-1"].forEach(function (sd) {
      bySideJ[sd].sort(function (p, q) { return p.d - q.d; }).forEach(function (o, i) { gateSlot[o.j] = { side: +sd, off: 5 + 4 * i }; }); });
  }
  // THE STEM GOES ROUND, NOT THROUGH. On the planted boat the wish sat in the row of the belief it
  // joins, one column back, and a stem from its right side ran straight through the belief's box.
  // Three ways are tried -- from the side, under the row, over it -- and the first that crosses
  // no box is taken, else the one that crosses least.
  var others = Object.keys(shown).filter(function (v) { return v !== e.to; });
  // A BLOCKER (profile 1.8) takes the same way in, and stops short of the arrow on a bar across its
  // own end: the inhibition mark, where a co-cause's stem runs on to the bar across the arrow.
  // A MODERATOR (profile 1.9) sends a dotted stem to a small ring on the arrow two-thirds along: it
  // changes how strongly the step runs, and is neither a cause of the step's end nor a blocker.
  var mods = (e.modifiers || []).map(function (m) { return m.state; });
  var rs = (e.rests || []).map(function (r) { return r.state; });
  var nj = e.jointly.length, nb = e.blockers.length, nm = mods.length;
  e.jointly.concat(e.blockers, mods, rs).forEach(function (j, idx) {
    var n = shown[j], blocks = idx >= nj && idx < nj + nb;
    var moderates = idx >= nj + nb && idx < nj + nb + nm, rests = idx >= nj + nb + nm;
    // A BLOCKER MEETS THE ARROW A THIRD OF THE WAY ALONG: at the head parallel arrows crowd, and
    // at the middle the chips sit; on the planted defences it was lost in both (28 Sep 2026).
    // Two moderators of one arrow get a ring each, spaced along it: on one point they read as one.
    var t0 = blocks ? 0.3 : moderates ? 0.66 - 0.12 * (idx - nj - nb) : rests ? 0.42 - 0.08 * (idx - nj - nb - nm) : null;
    // A mark on the arrow sits where the arrow is clear of every box (M1): where the arrow crossed a
    // box, its ring sat on the box.
    if (t0 != null) {
      var clearAt = function (tt) { var q = at(tt); return !Object.keys(shown).some(function (v) { var m = shown[v];
        return q[0] > m.x - 10 && q[0] < m.x + m.w + 10 && q[1] > m.y - 10 && q[1] < m.y + m.h + 10; }) &&
        taken.every(function (k) { return Math.hypot(k[0] - q[0], k[1] - q[1]) > 26; }) &&
        (lanes || []).every(function (ln) { return !ln.head || overlap({ x: q[0] - 12, y: q[1] - 12, w: 24, h: 24 }, ln.head) === 0; }); };
      for (var dt = 0; dt <= 0.5; dt += 0.05) {
        if (clearAt(Math.min(0.9, t0 + dt))) { t0 = Math.min(0.9, t0 + dt); break; }
        if (clearAt(Math.max(0.1, t0 - dt))) { t0 = Math.max(0.1, t0 - dt); break; }
      }
    }
    var T = t0 != null ? at(t0) : e.junction ? e.junction.back : J;
    if (t0 != null) taken.push(T);
    if (!n) return;
    var joins = !blocks && !moderates && !rests && !!e.junction;
    if (joins) {
      // Which side of the arrow the co-cause stands on decides which half of the back it enters.
      var slot = gateSlot[j] || { side: 1, off: 5 };
      T = [T[0] + (-uy) * slot.side * slot.off, T[1] + ux * slot.side * slot.off];
    }
    var cands = [];
    var sx = n.x + n.w, sy = n.y + n.h / 2;
    // A co-cause's last control point lies straight back along the arrow from its point on the gate,
    // so it runs in parallel to the arrow and alongside it, not across it.
    var lead = function (c) { if (joins) c[2] = [T[0] - ux * 26, T[1] - uy * 26]; return c; };
    if (sx + 20 < T[0]) cands.push(lead([[sx, sy], [sx + Math.max(30, (T[0] - sx) / 2), sy], [T[0], T[1] + (sy < T[1] ? -12 : 12)]]));
    var low = Math.max(n.y + n.h, T[1]) + 28, high = Math.min(n.y, T[1]) - 28;
    cands.push(lead([[n.x + n.w / 2, n.y + n.h], [n.x + n.w / 2, low], [T[0], low]]));
    cands.push(lead([[n.x + n.w / 2, n.y], [n.x + n.w / 2, high], [T[0], high]]));
    // And under or over everything between the two, where the near ways all cross a box.
    var xa = Math.min(n.x, T[0]) - 10, xb = Math.max(n.x + n.w, T[0]) + 10, deep = low, tall = high;
    others.concat([e.to]).forEach(function (v) { var m = shown[v];
      if (m.x < xb && m.x + m.w > xa) { deep = Math.max(deep, m.y + m.h + 26); tall = Math.min(tall, m.y - 26); } });
    if (deep > low) cands.push(lead([[n.x + n.w / 2, n.y + n.h], [n.x + n.w / 2, deep], [T[0], deep]]));
    if (tall < high) cands.push(lead([[n.x + n.w / 2, n.y], [n.x + n.w / 2, tall], [T[0], tall]]));
    // Every candidate as segments ending at T; and, where the arrow is to the right, one routed
    // through the gaps of the columns between, as an arrow is (M2).
    cands = cands.map(function (c) { return [[c[0], c[1], c[2], T]]; });
    // Out of the box's side into the gap beside it, along the gap, then across to the arrow: the way
    // round a stack of boxes that every curve crosses.
    [[sx, sx + 18], [n.x, n.x - 18]].forEach(function (g) {
      var W = [[g[0], sy], [g[1], sy], [g[1], T[1]]];
      if (Math.abs(T[0] - g[1]) < 30) return;
      var segs0 = roundPath(W, 14), from = W[2], dx = T[0] - from[0];
      segs0.push([from, [from[0] + dx / 3, from[1]], joins ? [T[0] - ux * 26, T[1] - uy * 26] : [from[0] + 2 * dx / 3, T[1]], T]);
      cands.push(segs0);
    });
    if (router && sx + 40 < T[0]) {
      var rs = router(n, [sx, sy], T);
      if (rs) { if (joins) rs[rs.length - 1][2] = [T[0] - ux * 26, T[1] - uy * 26]; cands.push(rs); }
      // AND ONE UNDER EVERYTHING BETWEEN. The gap nearest the straight line may be one the arrow
      // itself takes: Wilson 2023's gap -> waiting runs over the top of `flows`, a box the chart's
      // whole height, and first-come first-served's stem, joining it from below, could go over only
      // by crossing it (M5) and through only by crossing the box (M2). Under it crosses neither.
      var ru = router(n, [sx, sy], T, true);
      if (ru) { if (joins) ru[ru.length - 1][2] = [T[0] - ux * 26, T[1] - uy * 26]; cands.push(ru); }
    }
    var best = cands[0], bestHits = Infinity;
    // A blocker's stem stops short of the arrow on a bar, so it must not reach it through the box
    // the arrow enters: on the planted defences it dipped through "Harm" and read as a step into it.
    var obst = blocks || moderates || rests ? others.concat([e.to]) : others;
    cands.forEach(function (c) {
      var hits = 0, pts = pathPts({ segs: c }, 20);
      // The audit's own test (M2), so what is chosen here is what passes there. A HARD RULE OUTWEIGHS
      // ANY LENGTH: at 10 a box, the way round Wilson 2023's `flows` -- a box the chart's whole
      // height, which a stem can only pass below -- cost more in length than going through it.
      obst.forEach(function (v) { if (polyHitsRect(pts, shown[v], 2)) hits += 1000; });
      // Among ways equally clear, the shorter (M8): a stem looped up over the whole chart where a
      // way through the column gaps was clear too (Reason's high-reliability organizations).
      for (var li = 1; li < pts.length; li++) hits += Math.hypot(pts[li][0] - pts[li - 1][0], pts[li][1] - pts[li - 1][1]) / 400;
      // A gate's input that crosses the arrow's own line, or another input, on its way in breaks M5,
      // and costs more than a box: where no way is clear of both, a stem through a box was the old
      // choice and stays it (the private research maps: 2 crossings at 20 a box's 10; 1 now).
      if (joins) {
        hits += 2000 * crossCount(pts.slice(0, -2), mainPts.slice(0, -2));
        e.stems.forEach(function (o) { if (o.joins) hits += 2000 * crossCount(pts.slice(0, -2), o.pts.slice(0, -2)); });
      }
      if (hits < bestHits) { best = c; bestHits = hits; }
    });
    var end = T, tbar = null, ring = null, square = null, lastSeg = best[best.length - 1];
    if (rests) {
      var qx = T[0] - lastSeg[2][0], qy = T[1] - lastSeg[2][1], ql = Math.sqrt(qx * qx + qy * qy) || 1;
      end = [T[0] - qx / ql * 5, T[1] - qy / ql * 5];
      square = { x: T[0], y: T[1], biased: (e.rests.filter(function (r) { return r.state === j; })[0] || {}).biased };
    }
    if (moderates) {
      var mx = T[0] - lastSeg[2][0], my = T[1] - lastSeg[2][1], ml = Math.sqrt(mx * mx + my * my) || 1;
      end = [T[0] - mx / ml * 5, T[1] - my / ml * 5];
      ring = { x: T[0], y: T[1], r: 5, effect: (e.modifiers.filter(function (m) { return m.state === j; })[0] || {}).effect };
    }
    if (blocks) {
      // bx/by, not ux/uy: a `var` here is the whole function's, and shadowed the arrow's own
      // direction that a gate's inputs are led in along -- their control points came out NaN.
      var bx = T[0] - lastSeg[2][0], by = T[1] - lastSeg[2][1], bl = Math.sqrt(bx * bx + by * by) || 1;
      bx /= bl; by /= bl;
      end = [T[0] - bx * 7, T[1] - by * 7];
      tbar = "M" + (end[0] + by * 7) + "," + (end[1] - bx * 7) + " L" + (end[0] - by * 7) + "," + (end[1] + bx * 7);
    }
    var ssegs = best.slice(0, -1).concat([[lastSeg[0], lastSeg[1], lastSeg[2], end]]);
    var curve = ssegs[ssegs.length - 1], spts = pathPts({ segs: ssegs }, 20);
    e.stems.push({ state: j, blocks: blocks, joins: joins, tbar: tbar, ring: ring, square: square, end: end, curve: curve, pts: spts,
                   segs: ssegs, path: segsPath(ssegs) });
  });
}

/** A point on a curve, moved `d` along its normal: beside a steep line a label steps sideways,
 *  where stepping up or down would only slide it along the line (the Coleman boat's two arrows
 *  between stacked boxes, whose labels sat on each other). */
function chipAt(e, t, d, w) {
  var q = pathAt(e, t), x = q[0], y = q[1];
  if (!d) return [x, y];
  var q1 = pathAt(e, Math.max(0, t - 0.02)), q2 = pathAt(e, Math.min(1, t + 0.02));
  var dx = q2[0] - q1[0], dy = q2[1] - q1[1];
  var len = Math.hypot(dx, dy) || 1;
  // Mostly level lines keep the old vertical step (the normal is nearly vertical anyway); steep ones
  // step across, far enough to clear the line with the label's width.
  if (Math.abs(dy) < Math.abs(dx)) return [x, y + d];
  // Beside a steep line, the label's near edge a few pixels from the line (the Coleman boat's "link ↻"
  // sat a whole label's width away), further out only as the nearer places are taken.
  return [x + (d > 0 ? 1 : -1) * ((w || 60) / 2 + 4 + (Math.abs(d) - 13)), y];
}
function pad(r, m) { return { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m }; }
/** The rectangles of a box's marks, in the drawing's coordinates. */
function markRects(n) {
  var out = [];
  (n.badges || []).forEach(function (b) { out.push({ x: n.x + b.x - b.r, y: n.y + b.y - b.r, w: 2 * b.r, h: 2 * b.r, kind: "badge" }); });
  if (n.pill) out.push({ x: n.x + n.pill.x, y: n.y + n.pill.y, w: n.pill.w, h: n.pill.h, kind: "pill" });
  if (n.gapword) out.push({ x: n.x + n.gapword.x, y: n.y + n.gapword.y, w: n.gapword.w, h: n.gapword.h, kind: "gap" });
  return out;
}
function placeChips(edges, nodes, lanes) {
  var fixed = [];
  // EVERYTHING DRAWN IS AN OBSTACLE (M1): the headings' words, the boxes and every mark on them,
  // the gates. Labels were placed clear of boxes and of each other only, and sat on badges.
  (lanes || []).forEach(function (ln) { var hd = ln.head || { x: 0, y: ln.y, w: 100000, h: HEAD - 2 }; fixed.push(pad(hd, 3)); });
  Object.keys(nodes).forEach(function (v) {
    var n = nodes[v];
    fixed.push({ x: n.x - 6, y: n.y - 6, w: n.w + 12, h: n.h + 12 });
    markRects(n).forEach(function (r) { fixed.push(pad(r, 3)); });
  });
  edges.forEach(function (e) { if (e.junction && e.junction.box) fixed.push(pad(e.junction.box, 3)); });
  // A BLOCKER'S BAR IS NOT TO BE COVERED: a chip placed over it hid the only mark that the step
  // holds unless something else does (28 Sep 2026).
  edges.forEach(function (e) { (e.stems || []).forEach(function (sm) {
    if (sm.tbar) fixed.push({ x: sm.end[0] - 11, y: sm.end[1] - 11, w: 22, h: 22 });
    if (sm.ring) fixed.push({ x: sm.ring.x - 10, y: sm.ring.y - 10, w: 20, h: 20 });
    if (sm.square) fixed.push({ x: sm.square.x - 10, y: sm.square.y - 10, w: 20, h: 20 }); }); });
  edges.forEach(function (e) { if (e.head) fixed.push(pad(e.head, 4)); });
  var rankOf = function (e) {
    return (e.layer === "text" ? 0 : e.layer === "rival" ? 10 : 20) +
           (e.kind === "step" ? TIERS.indexOf(e.tier) : 5);
  };
  var order = edges.map(function (e, i) { return i; })
                   .sort(function (i, j) { return rankOf(edges[i]) - rankOf(edges[j]) || i - j; });
  var placed = [];
  // A CHIP SITS WHERE ITS LINE RUNS ALONE. Placed only clear of boxes and other chips, a chip in a
  // bundle of lines -- Reason's first column sends a dozen arrows down one corridor -- sat on four
  // lines at once and belonged visibly to none (27 Sep 2026). Every line is sampled, and a place
  // where OTHER lines pass through the chip costs as a partial overlap would.
  var samples = edges.map(function (e) { return pathPts(e, 32); });
  var crossings = function (box, self) {
    var n = 0;
    for (var q = 0; q < samples.length; q++) {
      if (q === self) continue;
      var S = samples[q];
      for (var r = 0; r < S.length; r++)
        if (S[r][0] > box.x - 3 && S[r][0] < box.x + box.w + 3 && S[r][1] > box.y - 3 && S[r][1] < box.y + box.h + 3) n++;
    }
    return n;
  };
  order.forEach(function (i) {
    var e = edges[i], P = e, best = null, bestCost = Infinity;
    // On the line first, at every point tried; only then a step above or below it, which still
    // reads as the arrow's own label where the line is crowded.
    for (var k = 0; k < CHIP_T.length * CHIP_DY.length; k++) {
      var t = CHIP_T[k % CHIP_T.length], dy = CHIP_DY[Math.floor(k / CHIP_T.length)];
      var at = chipAt(P, t, dy, e.chip.w), cx = at[0], cy = at[1];
      var box = { x: cx - e.chip.w / 2, y: cy - e.chip.h / 2, w: e.chip.w, h: e.chip.h };
      // Never off the drawing: a route's chip was pushed past the left edge when folding sent
      // it out of the bottom of a box in the first column.
      var cost = box.x < 4 || box.y < 2 ? 1e6 : 0;
      fixed.forEach(function (f) { cost += overlap(box, f); });
      placed.forEach(function (f) { cost += 2 * overlap(box, { x: f.x - 3, y: f.y - 3, w: f.w + 6, h: f.h + 6 }); });
      if (cost < bestCost) { best = { x: cx, y: cy, box: box }; bestCost = cost; }
      if (!cost) break;
    }
    e.chip.x = Math.round(best.x * 10) / 10; e.chip.y = Math.round(best.y * 10) / 10;
    placed[i] = best.box;
  });
  // SECOND PASS: each chip moves to a place where fewer OTHER lines cross it, but only to a place
  // clear of every box, arrowhead and chip -- so the first pass's guarantee stands, and a chip moves
  // only where there is room. A place on its own line is preferred to one beside it.
  var clear = function (box, self) {
    if (box.x < 4 || box.y < 2) return false;
    if (fixed.some(function (f) { return overlap(box, f) > 0; })) return false;
    return !placed.some(function (f, j) { return j !== self && f && overlap(box, { x: f.x - 3, y: f.y - 3, w: f.w + 6, h: f.h + 6 }) > 0; });
  };
  order.forEach(function (i) {
    var e = edges[i], P = e, cur = placed[i];
    var score = function (box, dy) { return crossings(box, i) + (dy ? 2 + Math.abs(dy) / 12 : 0); };
    var bestScore = clear(cur, i) ? score(cur, Math.abs(cur.y + cur.h / 2 - e.chip.y) > 0.5 ? 1 : 0) : Infinity, move = null;
    if (!bestScore) return;
    for (var k = 0; k < CHIP_T.length * CHIP_DY.length; k++) {
      var t = CHIP_T[k % CHIP_T.length], dy = CHIP_DY[Math.floor(k / CHIP_T.length)];
      var at = chipAt(P, t, dy, e.chip.w), cx = at[0], cy = at[1];
      var box = { x: cx - e.chip.w / 2, y: cy - e.chip.h / 2, w: e.chip.w, h: e.chip.h };
      if (!clear(box, i)) continue;
      var sc = score(box, dy);
      if (sc < bestScore) { bestScore = sc; move = { x: cx, y: cy, box: box }; }
    }
    if (move) { e.chip.x = Math.round(move.x * 10) / 10; e.chip.y = Math.round(move.y * 10) / 10; placed[i] = move.box; }
  });
  // What found no clear place: the layout makes room for it (M9).
  return order.filter(function (i) { return !clear(placed[i], i); }).map(function (i) { return edges[i]; });
}

/* ============================================================ the rules, checked
 *
 * `audit` takes a finished layout and reports every breach of the hard rules in
 * docs/MECHANISM-LAYOUT.md (M1 to M5) and the soft numbers (M6 to M8). It reads only what `layout`
 * returns, which is what the drawing draws (M11), so it needs no browser. */
function curvePts(P, n) {
  var out = [];
  for (var i = 0; i <= n; i++) { var t = i / n; out.push([bez(P[0][0], P[1][0], P[2][0], P[3][0], t), bez(P[0][1], P[1][1], P[2][1], P[3][1], t)]); }
  return out;
}
function audit(G, opts) {
  opts = opts || {};
  var hard = [], soft = { chipCrossings: 0, crossings: 0, detours: 0 };
  var shown = {};
  Object.keys(G.nodes).forEach(function (v) { if (G.folded.indexOf(v) < 0 && G.setAside.indexOf(v) < 0) shown[v] = G.nodes[v]; });
  var edges = G.edges.filter(function (e) { return shown[e.from] && shown[e.to] && (opts.layers ? opts.layers(e) : true); });
  var name = function (v) { return String(v).slice(0, 40); };
  // EVERY DRAWN THING, with who owns it: a mark may sit on its own box's border, and a head or a
  // gate on its own arrow, and nothing else may touch anything.
  var items = [];
  G.lanes.forEach(function (ln, i) { if (ln.head) items.push({ r: ln.head, what: "heading of " + ln.level, lane: i }); });
  Object.keys(shown).forEach(function (v) {
    var n = shown[v];
    items.push({ r: { x: n.x, y: n.y, w: n.w, h: n.h }, what: "box " + name(v), box: v });
    markRects(n).forEach(function (m) { items.push({ r: m, what: m.kind + " on " + name(v), on: v }); });
  });
  edges.forEach(function (e, i) {
    var id = name(e.from) + " → " + name(e.to);
    items.push({ r: { x: e.chip.x - e.chip.w / 2, y: e.chip.y - e.chip.h / 2, w: e.chip.w, h: e.chip.h }, what: "label of " + id, edge: i });
    if (e.head) items.push({ r: e.head, what: "head of " + id, edge: i, into: e.to });
    if (e.junction && e.junction.box) items.push({ r: e.junction.box, what: "AND gate on " + id, edge: i });
    e.stems.forEach(function (sm) {
      if (sm.ring) items.push({ r: { x: sm.ring.x - sm.ring.r, y: sm.ring.y - sm.ring.r, w: 2 * sm.ring.r, h: 2 * sm.ring.r }, what: "ring on " + id, edge: i });
      if (sm.square) items.push({ r: { x: sm.square.x - 4.5, y: sm.square.y - 4.5, w: 9, h: 9 }, what: "square on " + id, edge: i });
      if (sm.tbar) items.push({ r: { x: sm.end[0] - 7, y: sm.end[1] - 7, w: 14, h: 14 }, what: "bar on " + id, edge: i });
    });
  });
  var cut = function (a, b) {
    return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
  };
  var excused = function (A, B) {
    if (A.on != null && B.box === A.on || B.on != null && A.box === B.on) return true;           // a mark on its own box
    if (A.into != null && B.box === A.into || B.into != null && A.box === B.into) return true;   // a head into its box
    if (A.edge != null && A.edge === B.edge && !/label/.test(A.what + B.what)) return true;       // a gate, ring or head on its own arrow
    return false;
  };
  for (var i = 0; i < items.length; i++) for (var j = i + 1; j < items.length; j++) {
    var A = items[i], B = items[j];
    if (A.lane != null && B.lane != null) continue;
    if (cut(A.r, B.r) && !excused(A, B)) hard.push({ rule: "M1", what: A.what + " overlaps " + B.what });
  }
  // M3: on the drawing.
  items.forEach(function (it) {
    if (it.r.x < -0.5 || it.r.y < -0.5 || it.r.x + it.r.w > G.width + 0.5 || it.r.y + it.r.h > G.height + 0.5)
      hard.push({ rule: "M3", what: it.what + " is off the drawing" });
  });
  // M2: lines through boxes.
  var inside = function (pt, n) { return pt[0] > n.x + 2 && pt[0] < n.x + n.w - 2 && pt[1] > n.y + 2 && pt[1] < n.y + n.h - 2; };
  var lines = edges.map(function (e) { return pathPts(e, 40); });
  edges.forEach(function (e, i) {
    var id = name(e.from) + " → " + name(e.to);
    Object.keys(shown).forEach(function (v) {
      if (v === e.from || v === e.to) return;
      if (polyHitsRect(lines[i], shown[v], 2)) hard.push({ rule: "M2", what: "the arrow " + id + " runs through " + name(v) });
    });
    e.stems.forEach(function (sm) {
      Object.keys(shown).forEach(function (v) {
        if (v === sm.state || (!sm.blocks && v === e.to)) return;
        if (polyHitsRect(sm.pts || curvePts(sm.curve, 20), shown[v], 2))
          hard.push({ rule: "M2", what: "the stem from " + name(sm.state) + " to " + id + " runs through " + name(v) });
      });
    });
    // M4: the curve meets its stub along the stub's direction.
    if (e.stub) {
      var m = /M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/.exec(e.stub);
      var sx = +m[3] - +m[1], sy = +m[4] - +m[2];
      var SG = segsOf(e), P = SG[SG.length - 1], cx = P[3][0] - P[2][0], cy = P[3][1] - P[2][1];
      if (Math.hypot(cx, cy) < 1e-6) { cx = P[3][0] - P[1][0]; cy = P[3][1] - P[1][1]; }
      var cos = (sx * cx + sy * cy) / ((Math.hypot(sx, sy) || 1) * (Math.hypot(cx, cy) || 1));
      if (cos < Math.cos(15 * Math.PI / 180)) hard.push({ rule: "M4", what: "the head of " + id + " arrives at " + Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI) + "° to its line" });
    }
    // M5: a gate's inputs come in apart.
    if (e.junction) {
      var t = e.back ? 0.5 : e.gateT || JUNCTION_T, main = [];
      for (var q = 0; q <= 24; q++) main.push(pathAt(e, t * q / 24));
      var ins = e.stems.filter(function (sm) { return sm.joins; });
      ins.forEach(function (sm, a) {
        var pa = (sm.pts || curvePts(sm.curve, 20)).slice(0, -2);
        if (crossCount(pa, main.slice(0, -2))) hard.push({ rule: "M5", what: "the input from " + name(sm.state) + " crosses the arrow " + id + " on its way into the gate" });
        ins.slice(a + 1).forEach(function (o) {
          if (crossCount(pa, (o.pts || curvePts(o.curve, 20)).slice(0, -2))) hard.push({ rule: "M5", what: "the inputs from " + name(sm.state) + " and " + name(o.state) + " cross on their way into the gate of " + id });
          if (Math.hypot(sm.end[0] - o.end[0], sm.end[1] - o.end[1]) < 3) hard.push({ rule: "M5", what: "two inputs enter the gate of " + id + " at one point" });
        });
      });
    }
    // M6: other lines through this label.
    var cb = { x: e.chip.x - e.chip.w / 2, y: e.chip.y - e.chip.h / 2, w: e.chip.w, h: e.chip.h };
    lines.forEach(function (L, k) { if (k !== i && L.some(function (pt) { return pt[0] > cb.x && pt[0] < cb.x + cb.w && pt[1] > cb.y && pt[1] < cb.y + cb.h; })) soft.chipCrossings++; });
    // M8: detours.
    var len = 0; for (var z = 1; z < lines[i].length; z++) len += Math.hypot(lines[i][z][0] - lines[i][z - 1][0], lines[i][z][1] - lines[i][z - 1][1]);
    var L0 = lines[i][0], L1 = lines[i][lines[i].length - 1];
    if (len > 2.5 * Math.max(40, Math.hypot(L1[0] - L0[0], L1[1] - L0[1]))) soft.detours++;
  });
  // M7: crossings between arrows, not counting where two share an end.
  for (var a = 0; a < edges.length; a++) for (var b = a + 1; b < edges.length; b++) {
    var ea = edges[a], eb = edges[b];
    var share = ea.from === eb.from || ea.to === eb.to || ea.from === eb.to || ea.to === eb.from;
    var A2 = share ? lines[a].slice(3, -3) : lines[a], B2 = share ? lines[b].slice(3, -3) : lines[b];
    soft.crossings += crossCount(A2, B2);
  }
  return { hard: hard, soft: soft };
}

/* ============================================================ drawing */

var NS = "http://www.w3.org/2000/svg";
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
}
function el(name, attrs, parent) {
  var e = document.createElementNS(NS, name);
  for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
/** A label in lines of about `n` characters, cut with an ellipsis at `max` lines (three unless
 *  told otherwise; Infinity for the whole label). */
function wrapWords(s, n, max) {
  var words = String(s).split(/\s+/), lines = [], cur = "";
  var cap = max == null ? MAX_LINES : max;
  words.forEach(function (w) {
    if ((cur + " " + w).trim().length > n) { if (cur.trim()) lines.push(cur.trim()); cur = w; }
    else cur += " " + w;
  });
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length > cap) { lines = lines.slice(0, cap); lines[cap - 1] = lines[cap - 1].replace(/\s*\S*$/, "") + "…"; }
  return lines;
}
/** How many characters a line of a box this wide holds. */
function charsFor(w) { return Math.max(8, Math.round(24 * w / BW)); }

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
    "  --mv-selection:#2f8f83;--mv-association:#8a6d3b;",
    "  --mv-evidence:#203a6a;--mv-argued:#5a78a8;--mv-asserted:#a7b6cf;--mv-imputed:#dde2ea;",
    "  --mv-lane-a:rgba(0,0,0,.035);--mv-lane-b:rgba(0,0,0,.015);--mv-sel:#e0a800}",
    "@media (prefers-color-scheme:dark){.amech{",
    "  --mv-cond-bg:#23324a;--mv-text:#9cc3ef;--mv-rival:#9aa4b3;--mv-appraisal:#b3a4e6;--mv-appraisal-bg:#2a2638;--mv-gap:#f08a4b;",
    "  --mv-selection:#5fc2b5;--mv-association:#d2b27a;",
    "  --mv-evidence:#9cc3ef;--mv-argued:#6f93bf;--mv-asserted:#4d6484;--mv-imputed:#334155;",
    "  --mv-lane-a:rgba(255,255,255,.04);--mv-lane-b:rgba(255,255,255,.015);--mv-sel:#f5c542}}",
    ".amech[hidden]{display:none}",
    ".amech-head{padding:8px 12px;border-bottom:1px solid var(--line,#ddd)}",
    ".amech-q{color:var(--fg-dim,#666);font-size:13px;min-width:0}",
    // The map bar's look, from the page's own tokens (argdown-live-map.js, .alm-bar).
    ".amech-guide{font-size:13px;line-height:1.5;margin:.3rem 0 .6rem}",
    ".amech-helplink{border:0;background:none;padding:0;font:inherit;color:var(--accent,#3a7bd5);text-decoration:underline;text-underline-offset:2px;cursor:pointer}",
    ".amech-bar{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;align-self:flex-start;",
    "  margin:0 8px 8px;padding:.35rem .5rem;max-width:calc(100% - 16px);",
    "  font:11px system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--alm-bar-bg,rgba(255,255,255,.94));",
    "  border:1px solid var(--alm-group-line,#ddd);border-radius:7px}",
    ".amech-tog{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--alm-group-line,#ccc);",
    "  border-radius:5px;padding:.15rem .45rem;background:transparent;cursor:pointer;font-size:11px;user-select:none;",
    // The ink too: a <button> with this class drew the browser's black on the dark panel (1.3:1).
    "  color:inherit;font-family:inherit}",
    // A LAYER SWITCH IS A PILL, as every independent switch on the page is (ruled D8, 27 Sep
    // 2026): the native checkbox stays for the keyboard and the screen reader, out of sight, and
    // the pill's ring says whether the layer is on.
    ".amech-tog{position:relative}",
    ".amech-tog input{margin:0;position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}",
    ".amech-tog:has(input:checked){border-color:var(--accent,#3a7bd5);box-shadow:inset 0 0 0 1px var(--accent,#3a7bd5)}",
    ".amech-tog:has(input:focus-visible){outline:2px solid var(--accent,#3a7bd5);outline-offset:2px}",
    ".amech-tog .sw{width:20px;height:0;border-top:2px solid var(--mv-rival)}",
    ".amech-tog.appr{border-color:var(--mv-appraisal)}",
    ".amech-tog.appr .sw{height:9px;border:0;border-radius:2px;",
    "  background:repeating-linear-gradient(45deg,var(--mv-appraisal) 0 2px,transparent 2px 5px)}",
    ".amech-tog .aside{color:var(--fg-dim,#666);font-size:11px}",
    ".amech-banner{margin:8px 12px 0;padding:7px 11px;border-radius:7px;font-size:13px;",
    "  background:var(--mv-appraisal-bg);border:1px solid var(--mv-appraisal)}",
    ".amech-banner[hidden]{display:none}",
    ".amech-nestbanner{margin:8px 12px 0;padding:7px 11px;border-radius:7px;font-size:13px;border:1px dashed var(--alm-group-line,#ccc);color:inherit}",
    ".amech-nestbanner[hidden]{display:none}",
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
    // A badge on a dark box keeps its own ink: the white of the box's label made its glyph vanish.
    ".amech .st.intervention .loopmark text{fill:var(--mv-text)}.amech .st.intervention .more text{fill:var(--accent,#3a7bd5)}",
    ".amech .st.outcome rect.outer{fill:none;stroke:var(--fg,#1a1a1a)}",
    // NOT (YET) ACTUAL (1.12): hollow, and in italic.
    ".amech .st.notactual rect.box{fill:var(--bg,#fff);fill-opacity:.35;stroke:var(--fg-dim,#666)}.amech .st.notactual > text{font-style:italic}",
    // A CONDITION is a starting point the text does not recommend: the intervention's navy, but
    // as a tint, so what the text would DO and what it takes as given read apart at a glance.
    ".amech .st.condition rect.box{fill:var(--mv-cond-bg);stroke:var(--mv-text)}",
    ".amech .loopmark{cursor:pointer}.amech .loopmark circle{fill:var(--panel,#fff);stroke:var(--mv-text);stroke-width:1.4}",
    ".amech .loopmark text{font-size:10.5px;font-weight:700;fill:var(--mv-text)}",
    ".amech-loop{display:block;text-align:left;font:inherit;background:none;border:1px solid var(--line,#ddd);border-radius:6px;",
    "  padding:3px 7px;margin:0 0 4px;cursor:pointer;color:var(--fg,#1a1a1a);width:100%}",
    ".amech-loop:hover{border-color:var(--mv-text)}",
    // Hatched and violet, never dashed: a dash is a fidelity rung (ruled D7, 27 Sep 2026).
    ".amech .st.appraisal rect.box{fill:url(#amech-hatch);stroke:var(--mv-appraisal)}",
    ".amech .st{cursor:pointer}.amech .st text{font-size:12px}",
    ".amech .ed{fill:none;cursor:pointer}.amech .junction{fill:none;stroke-linecap:butt}.amech .ring{fill:var(--panel,#fff)}.amech .gate{fill:var(--panel,#fff);stroke-linejoin:round}.amech .hit{fill:none;stroke:transparent;stroke-width:14;cursor:pointer}",
    ".amech .chip rect{fill:var(--panel,#fff);stroke:currentColor}.amech .chip text{font-size:11px;fill:currentColor;font-weight:600}",
    ".amech .chip .glyph{font-size:9px}",
    ".amech svg.hovering g[data-edge]:not(.hot){opacity:.18}.amech svg.hovering g[data-edge].hot .ed{stroke-width:3.2}",
    ".amech svg.hovering g.chip.hot rect{stroke-width:2}",
    ".amech .sel{stroke:var(--mv-sel)!important;stroke-width:4!important}",
    ".amech .dim{opacity:.1}.amech .faint{opacity:.35}",
    ".amech-legend{display:grid;gap:3px;margin:0 0 8px}.amech-legend div{display:flex;align-items:center;gap:8px}",
    ".amech-legend .g{color:var(--fg-dim,#666);font-size:11.5px;margin-top:4px}",
    ".amech-route{border:1px solid var(--line,#ddd);border-radius:7px;padding:6px 9px;margin:6px 0}",
    ".amech-route>.t{font-weight:600}.amech-fold{display:flex;flex-wrap:wrap;gap:4px;align-items:center}",
    ".amech-fold button,.amech-state-act button{font:inherit;font-size:12px;background:none;border:1px solid var(--line,#ddd);",
    "  border-radius:5px;padding:1px 7px;cursor:pointer;color:var(--fg,#1a1a1a)}",
    ".amech-tog select{font:inherit;font-size:11px;border:0;background:none;color:inherit}",
    ".amech-tog.fit{font:inherit;font-size:11px;color:inherit}",
    ".amech-zoom{display:inline-flex;gap:0}.amech-zoom .zm{font:inherit;font-size:12px;color:inherit;border-radius:0;min-width:26px;justify-content:center}",
    ".amech-zoom .zm:first-child{border-radius:5px 0 0 5px}.amech-zoom .zm:last-child{border-radius:0 5px 5px 0}",
    ".amech-zoom .zm+.zm{margin-left:-1px}.amech-zoom .pct{font-size:11px;min-width:44px;font-variant-numeric:tabular-nums}",
    ".amech .frame{stroke:var(--alm-group-line,#d6d6d6);stroke-width:1}",
    ".amech .caption.unsaid{font-style:italic}",
    ".amech .st .more{cursor:pointer}.amech .st .more rect{fill:var(--panel,#fff);stroke:var(--mv-text);stroke-width:1;opacity:.95}",
    ".amech .st .more text{font-size:9.5px;font-weight:600;fill:var(--accent,#3a7bd5)}.amech .st .more:hover text{text-decoration:underline}",
    ".amech-focus{margin:0 0 8px;padding:6px 9px;border-radius:6px;border:1px solid var(--mv-sel);font-size:12.5px}",
    ".amech .st.intervention text.gapmark,.amech .gapmark{fill:var(--mv-gap);font-size:11px;font-weight:600}"
  ].join("\n");
  document.head.appendChild(s);
}

var INKS = ["text", "rival", "appraisal", "selection", "association"];
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
    c.unless = [];
    (s.unless || []).forEach(function (j) { var t = has(top, j) ? top[j] : j;
      if (t !== b && c.unless.indexOf(t) < 0) c.unless.push(t); });
    c.modifies = [];
    (s.modifies || []).forEach(function (m) { var t = has(top, m.by) ? top[m.by] : m.by;
      if (t !== a && t !== b) c.modifies.push({ by: t, effect: m.effect, period: m.period }); });
    if (a !== s.from || b !== s.to) { c.partFrom = s.from; c.partTo = s.to; }
    steps.push(c);
  });
  // What constitutes what, at the text's own boxes: a part's relation is its whole's, and one
  // within a single box is not drawn (1.11).
  var consts = (M.constitutions || []).map(function (c) {
    var d = {}; for (var k in c) if (has(c, k)) d[k] = c[k];
    d.from = top[c.from]; if (!c.toActor) d.to = top[c.to]; return d; })
    .filter(function (c) { return c.toActor || c.from !== c.to; });
  return { levels: M.levels, ordering: M.ordering, actors: M.actors, states: states, ids: ids, steps: steps,
           dropped: M.dropped, appraisalClaims: M.appraisalClaims, question: M.question,
           form: M.form, constitutions: consts, reasoning: M.reasoning,
           profile: profile(M.levels, M.actors, states, ids, steps, M.appraisalClaims, undefined, undefined, undefined, M.ordering,
                            M.form, consts, M.reasoning),
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
  var text = M.steps.filter(function (s) { return s.layer === "text" && !s.isNull && !s.selects && !s.assoc && s.chain.indexOf(id) >= 0; });
  var inIds = {};
  chainIds(c, M.states, M.ids, text).forEach(function (i) { inIds[i] = true; });
  M.steps.forEach(function (s) { if (s.chain.indexOf(id) >= 0) {
    inIds[s.from] = inIds[s.to] = true; (s.jointly || []).concat(s.unless || [], (s.modifies || []).map(function (m) { return m.by; }))
      .forEach(function (j) { if (has(M.states, j)) inIds[j] = true; }); } });
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
  ids.forEach(function (i) { asList(obj(M.states[i]).actor).forEach(function (a) { if (has(M.actors, a)) actors[a] = M.actors[a]; }); });
  (steps || []).forEach(function (x) { var a = x.how && x.how.actor; if (a && has(M.actors, a)) actors[a] = M.actors[a]; });
  var cform = { form: c.form || "chain", settles: c.settles == null ? null : c.settles };
  var creason = { goal: c.goal == null ? null : c.goal, contrast: c.contrast == null ? null : c.contrast, account: c.account || [] };
  var consts = (M.constitutions || []).filter(function (x) { return inIds[x.from]; });
  return { levels: M.levels, ordering: M.ordering, actors: actors, states: states, ids: ids, steps: steps,
           dropped: 0, appraisalClaims: Object.keys(appr).length,
           question: c.question || M.question, chains: [], kinds: M.kinds,
           chain: { id: c.id, label: c.label || c.id, shared: shared },
           form: cform, constitutions: consts, reasoning: creason, order: c.order || "time",
           profile: profile(M.levels, actors, states, ids, steps, Object.keys(appr).length, [], M.kinds, undefined, M.ordering,
                            cform, consts, creason) };
}

/** Draw the chain into `container`. `opts.onClaim(claim)` is called when the reader asks to see
 *  a claim -- the host takes it to the claim's passage. Returns a small controller. */
function create(container, graph, opts) {
  opts = opts || {};
  // CONSIDERED, NOT MAPPED (1.17): under the parallel method every text's mechanism is considered,
  // and a map may record that it was not mapped, and why. That record is what this view shows.
  var DEPTH = obj(graph && graph.mechanism && graph.mechanism.block);
  if (DEPTH.depth === "none") {
    container.textContent = "The mechanism was considered, and not mapped" +
      (DEPTH.depth_reason ? ": " + String(DEPTH.depth_reason) : ".");
    return null;
  }
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
               chain: CHAINS.length ? CHAINS[0].id : null, then: null,
               opened: {}, zoom: null,
               // Levels as bands (null), or as frames nested one inside another ("chain", or a tree
               // { parent: {...} } handed in by a host). A reader's choice, not the default: most
               // texts' levels are not wholes containing parts (James, 30 Sep 2026).
               nest: opts.nest || null };
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
    zoomBy: function (f) { cur.zoomBy(f); },
    fit: function () { cur.fit(); },
    /** Everything the reader has set on the chart, in one plain object -- what the fold state
     *  identifier encodes for this arrangement, so a drawing fault can be reported and rebuilt. */
    getView: function () {
      var v = cur.getView();
      return { chain: keep.chain, boxes: keep.boxes, rival: keep.rival, appraisal: keep.appraisal, nest: keep.nest ? "on" : null,
               opened: Object.keys(keep.opened).sort(), show: v.show, ends: v.ends, folded: v.folded,
               expanded: v.expanded, zoom: v.zoom };
    },
    /** The inverse: ids this chain does not know are ignored rather than drawn as nonsense. */
    setView: function (v) {
      if (!v) return;
      if ("chain" in v) keep.chain = v.chain && CHAINS.some(function (c) { return c.id === v.chain; }) ? v.chain : null;
      if ("boxes" in v) keep.boxes = !!v.boxes && hasWholes;
      if ("rival" in v) keep.rival = v.rival !== false;
      if ("appraisal" in v) keep.appraisal = !!v.appraisal;
      if ("nest" in v) keep.nest = v.nest ? "on" : null;
      keep.opened = {}; (v.opened || []).forEach(function (x) { if (has(FULL.states, x)) keep.opened[x] = true; });
      keep.zoom = null;
      remount();
      cur.setView(v);
    },
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
  var expanded = {};
  // Boxes the reader has opened to their whole label (▼ more), kept across a remount as the
  // layers are, so moving between chains does not shut them.
  var opened = keep.opened;
  var MS = markSpec(FULL, M);
  var NEST = nestingOf(M.ordering);
  if (!NEST.offer) keep.nest = null;
  var nestSpec = function () { return keep.nest ? NEST.spec : null; };
  var G = layout(M, { folded: folded, ends: ends, expand: expanded, open: opened, marks: MS.marks, nest: nestSpec() });
  // Off unless the host says the page's switch is already on: the view reports its layers back
  // as soon as it is drawn, and starting from `false` regardless would have turned off, on first
  // entry, an appraisal the reader had switched on in Reasons.
  var layers = { rival: keep.rival, appraisal: keep.appraisal };
  var selected = null;
  // THE LOOPS AND THE SYSTEMS the text closes, in its own voice. A few loops are listed and marked
  // one by one, in order; a system with more than a reader can follow is marked as ONE system,
  // with its shortest loops offered -- Wimmer's feedback came to 50+ loops and 410 badges.
  var SYS = MS.systems, LOOPS = MS.loops;
  var sysName = function (i) { return String.fromCharCode(65 + i); };
  function loopNames(l) {
    return l.states.concat(l.states[0]).map(function (v) { return obj(M.states[v]).label || v; }).join(" → ");
  }
  // WHAT IS SHOWN. "tested" keeps only the steps the text backs with a study, statistics or a
  // model -- nulls included, since a null is a finding -- so the evidence can be read on its own.
  var show = "all", fit = false, zk = 1;
  var anyUntested = G.edges.some(function (e) { return !e.steps.some(function (x) { return x.tier === "evidence"; }); });

  // THE QUESTION HEADS THE CHART; THE CONTROLS SIT BELOW IT, as the other arrangements' do
  // (ruled D10, 27 Sep 2026). They were a top bar of their own, in a different type and shape
  // from the map's bar at the bottom-left, so moving between arrangements moved the controls
  // and changed how they looked. The bar is now the map bar's cousin: the same place, the same
  // small type and pills.
  var head = document.createElement("div"); head.className = "amech-head";
  head.innerHTML = '<div class="amech-q">' + esc(M.question) + '</div>';
  container.appendChild(head);
  var bar = document.createElement("div"); bar.className = "amech-bar";
  bar.innerHTML =
    (CHAINS.length ? '<label class="amech-tog chain" title="The text answers several questions, each with a chain of its own">Chain <select data-chain>' +
      CHAINS.map(function (c) { return '<option value="' + esc(c.id) + '"' + (keep.chain === c.id ? ' selected' : '') + '>' +
        esc(c.label || c.id) + '</option>'; }).join("") +
      '<option value=""' + (keep.chain ? '' : ' selected') + '>Every chain together</option></select></label>' : '') +
    // Every control says what it does on hover (F8, clarity audit 27 Sep 2026): these three were
    // the chain's switches with nothing to say.
    (M.profile.rival_steps ? '<label class="amech-tog rival" title="The steps rival views claim, as the text reports them; switch off to see only what the text itself asserts"><input type="checkbox" data-layer="rival" checked>' +
      '<span class="sw"></span><span>Rival views</span><span class="aside">as the text reports them</span></label>' : '') +
    (M.appraisalClaims ? '<label class="amech-tog appr" title="The reconstructor’s own reading of the text against the world, off until asked for; never something the text says"><input type="checkbox" data-layer="appraisal">' +
      '<span class="sw"></span><span>Reconstructor’s appraisal</span><span class="aside amech-acount"></span></label>' : '') +
    (anyUntested ? '<label class="amech-tog" title="Every step the text sets out, or only those it backs with a study, statistics or a model">Show <select data-show><option value="all">every step</option>' +
      '<option value="tested">only what the text tested</option></select></label>' : '') +
    // Offered only where there is something to fold (F2: a control is a promise).
    // NAMED FOR WHAT THE READER GETS, not for the operation: "Fold to the ends" described the
    // mechanics, and the author could not tell from it what the button would show (26 Sep 2026).
    (toEnds.length ? '<button type="button" class="amech-tog fold" data-foldall title="Show only the routes from where the chain starts to its outcomes: the states between are folded, and what lies off that line is set aside">' + endsLabel + '</button>' : '') +
    // Offered only where the map declares wholes (F2). Named for what a click will show.
    (hasWholes ? '<button type="button" class="amech-tog boxes" data-boxes title="Parts drawn inside the boxes the text itself draws, or every state apart">' +
      (keep.boxes ? "Show every state" : "The text’s own boxes") + '</button>' : '') +
    // ZOOM, as the other arrangements have it (James, 29 Sep 2026): out, the size it is at (a press
    // puts it back to actual size), in, and the fit to the pane's width. Pinch or Ctrl/⌘-scroll
    // zooms at the pointer; the plain wheel scrolls, as the chart is a page that scrolls.
    // LEVELS AS BANDS OR NESTED (offered where there are two levels or more). Named for what a
    // click will show.
    (M.levels.length > 1 && NEST.offer ? '<button type="button" class="amech-tog nest" data-nest title="Draw each level as a frame inside the one it is part of, or as bands one above another">' +
      (keep.nest ? "Levels as bands" : "Nest the levels") + '</button>' : '') +
    '<span class="amech-zoom"><button type="button" class="amech-tog zm" data-zoom="out" title="Zoom out (⌘− or Ctrl −)">−</button>' +
    '<button type="button" class="amech-tog zm pct" data-zoom="1" title="The size the chain is drawn at; press for its actual size">100%</button>' +
    '<button type="button" class="amech-tog zm" data-zoom="in" title="Zoom in (⌘= or Ctrl =)">+</button></span>' +
    '<button type="button" class="amech-tog fit" data-fit title="Scale the chain to the width of the pane; press again for its actual size">Fit to width</button>' +
    // A GUIDE TO THIS DRAWING'S MARKS (James's verdict: a reader who has not read the conventions
    // sees "raises" and "no effect" on one pair and is lost). It walks the marks this chain uses,
    // lighting one example of each.
    '<button type="button" class="amech-tog guide" data-guide-go="0" title="Step through what each mark on this drawing means, one example at a time">Read this drawing</button>';
  var banner = document.createElement("div"); banner.className = "amech-banner"; banner.hidden = true;
  // THE SAME SENTENCE AS THE ARGUMENT MAP'S BANNER, word for word: one switch, one state, one
  // announcement (sweep D, 27 Sep 2026: the two had drifted into different wordings).
  banner.innerHTML = '<b>Appraisal on.</b> ' + M.appraisalClaims + ' addition' +
    (M.appraisalClaims === 1 ? '' : 's') + ' by the reconstructor, drawn hatched in violet \u2014 ' +
    'readings of the text against the world, not claims the text makes.' + (opts.helpLinks
      ? ' <button type="button" class="amech-helplink" data-help="The reconstructor&#39;s ' +
        'appraisal">What is this?</button>' : '');
  container.appendChild(banner);
  // NESTING A MAP THAT DOES NOT SAY ITS LEVELS NEST: the frames are then the reader's assumption,
  // and say so (James's choice, 30 Sep 2026).
  var nestBanner = document.createElement("div"); nestBanner.className = "amech-nestbanner"; nestBanner.hidden = true;
  nestBanner.innerHTML = '<b>Nested by assumption.</b> These frames take each level to be part of the one above it. ' +
    'The map does not say its levels nest' + (M.ordering && M.ordering.kind ? ' (it calls them ' + esc(ORDERINGS[M.ordering.kind]) + ')' : '') + '.';
  container.appendChild(nestBanner);
  var body = document.createElement("div"); body.className = "amech-body";
  var stage = document.createElement("div"); stage.className = "amech-stage";
  var side = document.createElement("div"); side.className = "amech-side";
  body.appendChild(stage); body.appendChild(side); container.appendChild(body);
  container.appendChild(bar);

  var svg = el("svg", { width: G.width, height: G.height, viewBox: "0 0 " + G.width + " " + G.height,
                        role: "img", "aria-label": "The mechanism the text asserts" }, stage);
  var defs = el("defs", {}, svg);
  var pat = el("pattern", { id: "amech-hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse",
                            patternTransform: "rotate(45)" }, defs);
  el("rect", { width: 6, height: 6, fill: "var(--mv-appraisal-bg)" }, pat);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "var(--mv-appraisal)", "stroke-width": 1, opacity: 0.35 }, pat);
  INKS.forEach(function (t) {
    // ONE SIZE OF HEAD (M4): in the line's own units a head grew with its weight, and a tested
    // step's head was a slab wider than the stub it rode (the law school rankings, 30 Sep 2026).
    var mk = el("marker", { id: "amech-ar-" + t, viewBox: "0 0 10 10", refX: 10, refY: 5, markerUnits: "userSpaceOnUse",
                            markerWidth: HEAD_LEN, markerHeight: HEAD_W, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--mv-" + t + ")" }, mk);
    // A NULL FINDING ENDS IN A BAR: the line reaches the state and nothing passes.
    var bar = el("marker", { id: "amech-bar-" + t, viewBox: "0 0 4 12", refX: 2, refY: 6,
                             markerWidth: 4, markerHeight: 12, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
    el("rect", { x: 0.5, y: 0, width: 3, height: 12, fill: "var(--mv-" + t + ")" }, bar);
  });
  var gL = el("g", {}, svg);
  // THREE LAYERS, and the chips on top. Each arrow carries a 14px invisible hit stroke so it can
  // be clicked at all, and where arrows run close -- a rival view beside the text's own step --
  // one arrow's stroke lay over the other's chip: driving the page with real clicks, the "x7"
  // chip of the text's busiest step opened the RIVAL arrow instead. The chip is the unambiguous
  // target, so every chip is drawn above every stroke. The lanes' headings sit between the two,
  // on a halo, so an arrow crossing a heading never runs through its words.
  var gE = el("g", {}, svg), gH = el("g", {}, svg), gC = el("g", {}, svg), gN = el("g", {}, svg);
  /** The lanes and the drawing's size, which a box opened to its whole label changes. */
  function drawFrame() {
    while (gL.firstChild) gL.removeChild(gL.firstChild);
    while (gH.firstChild) gH.removeChild(gH.firstChild);
    // NESTED: each level a frame inside its parent's, deeper frames a shade darker.
    if (G.frames) G.frames.forEach(function (f) {
      el("rect", { x: f.x, y: f.y, width: f.w, height: f.h, rx: 10, "class": "frame", "data-level": f.level,
                   fill: f.depth % 2 ? "var(--mv-lane-a)" : "var(--mv-lane-b)" }, gL);
    });
    G.lanes.forEach(function (ln, i) {
      if (!G.frames) el("rect", { x: 0, y: ln.y, width: G.width, height: ln.h, fill: i % 2 ? "var(--mv-lane-b)" : "var(--mv-lane-a)" }, gL);
      var head = el("text", { x: ln.head.x + 4, y: ln.y + 17, "class": "lane-l" }, gH);
      head.textContent = ln.level.toUpperCase();
      var who = el("tspan", { "class": "actor-l", dx: 10 }, head);
      who.textContent = ln.who;
      if (ln.whoFull) el("title", {}, head).textContent = ln.level.toUpperCase() + " — " + ln.whoFull;
    });
    while (gCap.firstChild) gCap.removeChild(gCap.firstChild);
    if (G.caption) el("text", { x: G.caption.x, y: G.caption.y, "class": "actor-l caption" + (M.ordering && M.ordering.kind ? "" : " unsaid") }, gCap).textContent = G.caption.text;
    svg.setAttribute("width", String(G.width)); svg.setAttribute("height", String(G.height));
    svg.setAttribute("viewBox", "0 0 " + G.width + " " + G.height);
    sizeSvg();
  }
  // A CYCLE IS NOT A SEQUENCE (1.13): in a diagram of kinds and variables with feedback, "there can be
  // no time line" (Johansson et al. 2024, p. 102), and a cycle has no first state to read from.
  el("text", { x: GUT, y: 22, "class": "actor-l" }, svg).textContent =
    M.form && M.form.form === "cycle" ? "a cycle: its order on the page is not time" :
    // AN ORDER OF EXPLANATION IS NOT TIME (1.17): a genealogy's stages come in the order
    // complications are added, and left to right reads as history unless the chart says otherwise.
    M.order === "explanation" ? "in order of explanation, not of time: each stage adds a complication →" :
    "in sequence, left to right →";
  var gCap = el("g", {}, svg);

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
        if (sm.tbar) el("path", { d: sm.tbar, "class": "junction", stroke: col, "stroke-width": st.width + 2, "data-blocker": sm.state }, g);
        if (sm.square) {
          // A MEASURE THE EVIDENCE RESTS ON: dashed, to a small square on the arrow; in the gap colour
          // where the text says something bears on the measure -- a bias that undercuts the step.
          var qc = sm.square.biased ? "var(--mv-gap)" : col;
          sp.setAttribute("stroke", qc); sp.setAttribute("stroke-dasharray", "4 3");
          var sq = el("rect", { x: sm.square.x - 4.5, y: sm.square.y - 4.5, width: 9, height: 9, "class": "ring", stroke: qc,
                                "stroke-width": 1.6, "data-rests": sm.state, "data-biased": sm.square.biased ? "1" : "0" }, g);
          el("title", {}, sq).textContent = "The evidence for this step is read from “" + (obj(M.states[sm.state]).label || sm.state) + "”" +
            (sm.square.biased ? ", which the text says is biased: a bias in the measure undercuts the step" : "");
        }
        if (sm.ring) {
          sp.setAttribute("stroke-dasharray", "1.5 3");
          el("circle", { cx: sm.ring.x, cy: sm.ring.y, r: sm.ring.r, "class": "ring", stroke: col, "stroke-width": 1.6,
                         "data-moderator": sm.state, "data-effect": sm.ring.effect || "" }, g);
        }
      });
      if (e.junction) {
        var gt = el("path", { d: e.junction.gate, "class": "gate", stroke: col, "stroke-width": 1.8, "data-gate": "and" }, g);
        el("title", {}, gt).textContent = "AND: the step runs only with every cause coming in";
      }
      var chip = el("g", { "class": "chip", style: "color:" + col, "data-layer": e.layer,
                           "data-edge": e.from + ">" + e.to, "data-kind": e.kind }, gC);
      var tw = e.chip.w;
      // THE CHIP LOOKS LIKE ITS LINE: its border takes the line's pattern (F5 -- a dotted step's
      // chip is dotted), so a chip in a crowd is tied to its line by more than nearness.
      var th = e.chip.h || 18, lines = e.chip.lines || [e.chip.label];
      var cr = el("rect", { x: e.chip.x - tw / 2, y: e.chip.y - th / 2, width: tw, height: th, rx: 9 }, chip);
      if (st.dash) cr.setAttribute("stroke-dasharray", st.dash);
      lines.forEach(function (line, li) {
        var ct = el("text", { x: e.chip.x, y: e.chip.y - th / 2 + 13 + 14 * li, "text-anchor": "middle" }, chip);
        if (li === 0 && e.chip.glyph) {
          el("tspan", { "class": "glyph" }, ct).textContent = e.chip.glyph + " ";
          el("tspan", {}, ct).textContent = line;
        } else ct.textContent = line;
      });
      // HOVER TIES A CHIP TO ITS LINE without a click: both stand out, the rest fade.
      var hot = function (on) { svg.classList.toggle("hovering", on); g.classList.toggle("hot", on); chip.classList.toggle("hot", on); };
      [g, chip].forEach(function (x) {
        x.addEventListener("mouseenter", function () { hot(true); });
        x.addEventListener("mouseleave", function () { hot(false); });
      });
      var title = el("title", {}, g);
      title.textContent = e.steps.length + " claim" + (e.steps.length === 1 ? "" : "s") +
        (e.jointly.length ? ", holding only together with " + e.jointly.map(function (j) { return obj(M.states[j]).label || j; }).join(" and ") : "") +
        (e.blockers.length ? ", unless " + e.blockers.map(function (j) { return obj(M.states[j]).label || j; }).join(" or ") + " holds" : "") +
        ((e.modifiers || []).length ? ", moderated by " + e.modifiers.map(function (m) { return (obj(M.states[m.state]).label || m.state) + " (" + (EFFECT_WORD[m.effect] || m.effect) + ")"; }).join(" and ") : "") +
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
      // AN ONGOING DOING HAS ROUND ENDS (profile 1.11): an activity or a development is drawn as a
      // capsule, so a chain told in verbs looks different from one told in nouns (Arthur 2023).
      var doing = s.aspect === "activity" || s.aspect === "development";
      var rx = doing ? Math.min(p.h / 2, 18) : 7;
      if (s.aspect != null) g.setAttribute("data-aspect", String(s.aspect));
      if (hasRole(s, "outcome")) el("rect", { "class": "outer", x: -4, y: -4, width: p.w + 8, height: p.h + 8, rx: rx + 2 }, g);
      // WHAT IS NOT (YET) ACTUAL IS DRAWN HOLLOW, ITS WORDS IN ITALIC (1.12), and marked ◌ or … at its top
      // left. Never dashed: on these charts a pattern is fidelity, as on every box (F5).
      var notActual = s.status === "possible" || s.status === "open";
      if (notActual) { g.setAttribute("data-status", String(s.status)); g.setAttribute("class", cls + " notactual"); }
      el("rect", { "class": "box", width: p.w, height: p.h, rx: rx }, g);
      var lines = p.lines || wrapWords(s.label || v, charsFor(p.w));
      lines.forEach(function (t, i) {
        // Lifted a little where the foot carries the "more" pill, so the last line stays clear of it.
        el("text", { x: p.w / 2, y: p.h / 2 + (i - (lines.length - 1) / 2) * LINE_H + 4 - (p.more ? 4 : 0), "text-anchor": "middle" }, g).textContent = t;
      });
      // THE WHOLE LABEL ON ASKING, as a claim's "▼ more" in Reasons: a pill on the box's foot. The
      // box grows and the rows below make room; "▲ less" puts it back.
      if (p.more) {
        var mo = el("g", { "class": "more", "data-more": v, transform: "translate(" + (p.pill.x + p.pill.w / 2) + "," + (p.pill.y + p.pill.h / 2) + ")" }, g);
        el("rect", { x: -p.pill.w / 2, y: -p.pill.h / 2, width: p.pill.w, height: p.pill.h, rx: p.pill.h / 2 }, mo);
        el("text", { "text-anchor": "middle", y: 3.5 }, mo).textContent = p.open ? "▲ less" : "▼ more";
        el("title", {}, mo).textContent = p.open ? "Show the first lines only" : "Show the whole of “" + (s.label || v) + "”";
        mo.addEventListener("click", function (ev) { ev.stopPropagation(); setOpen(v, !p.open); });
      }
      var tt = el("title", {}, g); tt.textContent = (s.label || v) + " — click to see only the paths through it";
      drawnNodes[v] = g;
      // THE MARKS, WHERE THE LAYOUT PUT THEM (M11). A loop is marked on every state in it, not only
      // on the arrow that closes it: the closing arc alone was easy to miss, and a reader tracing
      // Merton's circle across the page could not tell where it began. Each badge is also a control
      // (F2). ⇄ couples the chains (profile 1.5), ≈ is a kind shared across cases (1.6), ≙ a measure
      // of another state (1.9).
      var elsewhere = M.chain && M.chain.shared[v];
      (p.badges || []).forEach(function (b) {
        var mk = el("g", { "class": "loopmark" + (b.kind === "system" ? " sys" : b.kind === "loop" ? "" : " " + b.kind),
                           transform: "translate(" + b.x + "," + b.y + ")" }, g);
        el("circle", { r: b.r }, mk);
        var tx = el("text", { "text-anchor": "middle", y: 4 }, mk), ti = el("title", {}, mk);
        if (b.kind === "loop") {
          var li = b.i;
          mk.setAttribute("data-loop", li);
          tx.textContent = "↻" + (LOOPS.length > 1 ? li + 1 : "");
          ti.textContent = "In loop " + (li + 1) + ": " + loopNames(LOOPS[li]) + " — click to see it alone";
          mk.addEventListener("click", function (ev) { ev.stopPropagation(); select({ cycle: LOOPS[li], name: "Loop " + (li + 1) }); });
        } else if (b.kind === "system") {
          var fi = b.i;
          mk.setAttribute("data-system", fi);
          tx.textContent = "⟳" + sysName(fi);
          ti.textContent = "In feedback system " + sysName(fi) + ": " + SYS[fi].states.length +
            " states, " + SYS[fi].loops + (SYS[fi].capped ? "+" : "") + " loops — click to see it alone";
          mk.addEventListener("click", function (ev) { ev.stopPropagation(); select({ system: fi }); });
        } else if (b.kind === "shared") {
          var other = CHAINS.filter(function (c) { return c.id === elsewhere[0]; })[0];
          mk.setAttribute("data-shared", elsewhere[0]);
          tx.textContent = "⇄";
          ti.textContent = "Also in " + elsewhere.map(function (o) {
            var x = CHAINS.filter(function (c) { return c.id === o; })[0]; return "“" + (x && x.label || o) + "”"; }).join(" and ") +
            " — click to see " + (other && other.label || elsewhere[0]);
          mk.addEventListener("click", function (ev) { ev.stopPropagation(); keep.chain = elsewhere[0]; keep.then = { state: v }; remount(); });
        } else if (b.kind === "kin") {
          var kin = kinOf(v), gk = generalOfKind(kindOfState(v));
          mk.setAttribute("data-kind", kindOfState(v));
          tx.textContent = "≈";
          ti.textContent = (gk === v ? "The general case of which these are cases: " : gk ? "A case of the general " +
            "“" + (obj(FULL.states[gk]).label || gk) + "”; the same kind of thing as " : "The same kind of thing as ") + kin.map(function (w) {
            var cs = chainsOfState(w); return "“" + (obj(FULL.states[w]).label || w) + "”" + (cs.length ? " (" + cs.map(chainLabel).join(", ") + ")" : ""); }).join(" and ") +
            " — a different state, in a different case; click to see them";
          mk.addEventListener("click", function (ev) { ev.stopPropagation(); select({ kind: kindOfState(v) }); });
        } else if (b.kind === "measure") {
          var measOf = obj(FULL.states[v]).measures;
          mk.setAttribute("data-measures", measOf);
          tx.textContent = "≙";
          ti.textContent = "A measure of “" + (obj(FULL.states[measOf]).label || measOf) + "”" +
            (obj(FULL.states[v]).method ? ", by " + obj(FULL.states[v]).method : "") + " — a reading of it, not a cause of it";
        } else if (b.kind === "possible" || b.kind === "open") {
          mk.setAttribute("data-status", b.kind);
          tx.textContent = b.kind === "possible" ? "◌" : "…";
          ti.textContent = b.kind === "possible" ? "A possibility the text sets out: not (yet) actual"
                                                 : "Open: what the text says cannot be specified in advance";
        } else if (b.kind === "constitutes" || b.kind === "constituted") {
          // WHAT CONSTITUTES WHAT (1.11): named in the tooltip, listed in the panel; a click shows it.
          var mine = (M.constitutions || []).filter(function (c) { return c.layer !== "appraisal" &&
            (b.kind === "constitutes" ? c.from === v : !c.toActor && c.to === v); });
          mk.setAttribute("data-constitution", b.kind);
          tx.textContent = b.kind === "constitutes" ? "⊂" : "⊃";
          ti.textContent = (b.kind === "constitutes" ? "Makes up: " : "Made up of: ") + mine.map(function (c) {
            var other = b.kind === "constitutes" ? c.to : c.from;
            var name = c.toActor && b.kind === "constitutes" ? obj(M.actors[other]).label || other : obj(FULL.states[other]).label || other;
            return (c.extent === "partial" ? "partly " : "") + "“" + name + "”" + (c.layer === "rival" ? " (in a view the text reports)" : "");
          }).join("; ") + " — what it is made of, not a cause of it; click for the claims";
          mk.addEventListener("click", function (ev) { ev.stopPropagation(); select({ state: v }); });
        }
      });
      // A co-cause is linked: its step is the one it joins (profile 1.4).
      if (p.gapword) el("text", { x: p.gapword.x, y: p.gapword.y + 12, "class": "gapmark" }, g).textContent = "✕ no link in the text";
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
      selected.edge.jointly.concat(selected.edge.blockers, modStates(selected.edge)).forEach(function (j) { k[j] = true; });
      return { nodes: k, edge: function (e) { return e.key === selected.edge.key; } };
    }
    var v = selected.state, up = {}, down = {};
    var walk = function (seed, dir, into) {
      var stack = [seed];
      while (stack.length) {
        var x = stack.pop();
        vis.forEach(function (e) {
          [e.from].concat(e.jointly, e.blockers, modStates(e)).forEach(function (src) {
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
      return [e.from].concat(e.jointly, e.blockers, modStates(e)).some(function (src) {
        return (up[src] && (up[e.to] || e.to === v)) || ((src === v || down[src]) && down[e.to]); });
    } };
  }
  function applyFocus() {
    var f = focusSets(), lit = {};
    drawnEdges.forEach(function (d) {
      var on = !f || f.edge(d.e);
      d.g.classList.toggle("dim", !on); d.chip.classList.toggle("dim", !on);
      if (on) { lit[d.e.from] = lit[d.e.to] = true; d.e.jointly.concat(d.e.blockers, modStates(d.e)).forEach(function (j) { lit[j] = true; }); }
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
    var meta = ['<span class="amech-pill">' + esc(s.isNull ? "no effect" : s.selects ? "selection effect" : s.assoc ? "associated" : signWord(s.sign ? [s.sign] : [])) + '</span>',
                '<span class="amech-pill">' + esc(c.fidelity || "compression") + '</span>',
                '<span class="amech-pill">' + esc(s.basis || (s.tier === "imputed" ? "imputed" : "asserted")) + '</span>']
      .join("") + (c.pinpoint ? esc(c.pinpoint) : "") + (s.lag ? " · lag: " + esc(s.lag) : "") +
      (s.given.length ? " · given: " + s.given.map(esc).join("; ") : "") +
      (s.isNull ? " · <b>the text finds no effect</b>" : "") +
      (s.selects ? " · <b>a selection link, not an effect</b>" : "") +
      (s.assoc ? " · <b>an association</b>: the text reports they go together, not that one brings the other about" : "") +
      (s.scope === "singular" ? " · about <b>a particular case</b>" : s.scope === "general" ? " · <b>a general</b> causal claim" : "") +
      (s.hedged ? " · hedged: the text says it may" : "") +
      ((s.jointly || []).length ? " · <b>only together with</b> " + s.jointly.map(function (j) { return esc(obj(FULL.states[j]).label || j); }).join(" and ") : "") +
      ((s.unless || []).length ? " · <b>unless</b> " + s.unless.map(function (j) { return esc(obj(FULL.states[j]).label || j); }).join(" or ") + " holds: it blocks the step" : "") +
      (s.period ? " · when: " + esc(s.period) : "") +
      (s.size ? " · <b>size</b>: " + esc(s.size) : "") +
      (s.regime ? " · <b>regime</b>: " + esc(s.regime) : "") +
      (s.threshold ? " · <b>only past a threshold</b>: " + esc(s.threshold) : "") +
      ((s.statedVia || []).length && s.share !== "entire" ? " · " + (s.share === "none" ? "<b>not</b> through " : "runs " + (s.share === "most" ? "mostly" : "partly") + " through ") +
        s.statedVia.map(function (j) { return esc(obj(FULL.states[j]).label || j); }).join(" → ") : "") +
      (s.on === "trend" ? " · <b>on the trend</b>: it " + (s.sign === "-" ? "slows" : s.sign === "+" ? "speeds" : "changes") + " the change in its effect, not its level" : "") +
      (s.on === "being" ? " · <b>" + (s.sign === "-" ? "unmakes" : "makes") + "</b>: it brings its effect " + (s.sign === "-" ? "to an end" : "into being") + ", not more or less of it" : "") +
      (s.on === "persistence" ? " · <b>" + (s.sign === "-" ? "erodes" : "maintains") + "</b>: it " + (s.sign === "-" ? "wears its effect away" : "keeps its effect going") + ", not more or less of it" : "") +
      (s.on === "character" ? " · <b>transforms</b>: it changes what kind of thing its effect is" : "") +
      (s.on === "possibility" ? " · <b>" + (s.sign === "-" ? "closes off" : "opens up") + "</b>: it changes what can happen, not what does" : "") +
      (s.on === "chance" ? " · <b>" + (s.sign === "-" ? "makes less likely" : "makes likelier") + "</b>: it changes the chance of its effect, not whether it happens" : "") +
      (s.on === "stock" ? " · <b>" + (s.sign === "-" ? "flows out of" : "flows into") + "</b>: " + (s.sign === "-" ? "an outflow from" : "an inflow to") + " a stock; the stock need not move with it" : "") +
      ((s.despite || []).length ? " · <b>despite</b> " + s.despite.map(function (j) { return esc(obj(FULL.states[j]).label || j); }).join(" and ") + ", which acted against it and failed" : "") +
      ((s.statedVia || []).length && s.share === "entire" ? " · <b>the route through</b> " + s.statedVia.map(function (j) { return esc(obj(FULL.states[j]).label || j); }).join(" → ") +
        ": this link and that route are one, counted once" : "") +
      ((s.modifies || []).length ? " · <b>moderated</b>: " + s.modifies.map(function (m) {
        return esc(obj(FULL.states[m.by]).label || m.by) + " " + esc(EFFECT_WORD[m.effect] || m.effect) + (m.period ? " (" + esc(m.period) + ")" : ""); }).join("; ") : "") +
      (s.necessary === true ? " · <b>necessary</b>: its effect holds only where its cause does" : "") +
      (s.sufficient === true ? " · <b>enough</b>: " + ((s.jointly || []).length ? "with its co-causes it" : "it") + " brings the effect about on its own" : "") +
      (s.sufficient === false ? " · <b>not enough on its own</b>, the text says" : "") +
      ((s.measuredBy || []).length ? " · <b>evidence read from</b> " + s.measuredBy.map(function (j) { return esc(obj(FULL.states[j]).label || j); }).join(" and ") : "") +
      (s.design ? " · design: " + esc(s.design) + (s.design === "illustration" ? " (hypothetical: shows how, not that)" : "") : "") +
      (s.attribution ? " · <b>attribution</b>: " + esc(s.attribution) : "") +
      (s.reported ? " · a view the text reports" + (s.stance ? ", " + esc(s.stance) : ", taking no stance the map records") : "") +
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
    var ink = {}, fid = {}, tier = {}, isNull = false, joint = false, blocked = false, moderated = false, rested = false;
    G.edges.forEach(function (e) {
      if (e.layer !== "text" && !layers[e.layer]) return;
      if (e.jointly.length) joint = true;
      if (e.blockers.length) blocked = true;
      if ((e.modifiers || []).length) moderated = true;
      if ((e.rests || []).length) rested = true;
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
     ["selection", "selection effect: who ends up on each side, not an effect"],
     ["association", "associated: the text reports they go together, not that one brings the other about"]].forEach(function (r) {
      if (ink[r[0]]) out += row(line("var(--mv-" + r[0] + ")", 2, ""), r[1]);
    });
    if (isNull) out += row(line("var(--mv-text)", 1.4, "", true), "no effect found: nothing passes");
    // THE GATE AS THE CHART DRAWS IT (James, 30 Sep 2026: the old icon was cut off at top and foot):
    // the arrow into the middle of its flat back, the co-cause into its own point beside it, and the
    // arrow on out of its round front.
    if (joint) out += row('<svg width="46" height="22" viewBox="0 0 46 22" aria-hidden="true">' +
      '<line x1="2" y1="11" x2="44" y2="11" stroke="var(--mv-text)" stroke-width="2"/>' +
      '<path d="M2,20 C10,20 12,15 18,15" fill="none" stroke="var(--mv-text)" stroke-width="2"/>' +
      '<path d="M18,3 L24,3 C33,3 33,19 24,19 L18,19 Z" fill="var(--panel,#fff)" stroke="var(--mv-text)" stroke-width="1.6"/></svg>',
      "an AND gate: the step runs only with every cause coming in");
    if (blocked) out += row('<svg width="46" height="16" aria-hidden="true"><path d="M2,14 C12,14 18,10 20,10" fill="none" stroke="var(--mv-text)" stroke-width="2"/>' +
      '<line x1="20" y1="4" x2="20" y2="16" stroke="var(--mv-text)" stroke-width="4"/><line x1="2" y1="3" x2="44" y2="3" stroke="var(--mv-text)" stroke-width="2"/></svg>',
      "a stem ending in a bar: the step holds unless that state does");
    if (moderated) out += row('<svg width="46" height="16" aria-hidden="true"><path d="M2,14 C12,14 22,8 26,8" fill="none" stroke="var(--mv-text)" stroke-width="2" stroke-dasharray="1.5 3"/>' +
      '<line x1="2" y1="3" x2="44" y2="3" stroke="var(--mv-text)" stroke-width="2"/><circle cx="30" cy="3" r="4" fill="var(--panel,#fff)" stroke="var(--mv-text)" stroke-width="1.6"/></svg>',
      "a dotted stem to a ring: that state changes how strongly the step runs (click the arrow for how)");
    if (rested) out += row('<svg width="46" height="16" aria-hidden="true"><path d="M2,14 C12,14 18,8 24,8" fill="none" stroke="var(--mv-gap)" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<line x1="2" y1="3" x2="44" y2="3" stroke="var(--mv-text)" stroke-width="2"/><rect x="24" y="-1" width="8" height="8" fill="var(--panel,#fff)" stroke="var(--mv-gap)" stroke-width="1.6"/></svg>',
      "a dashed stem to a square: the step's evidence is read from that measure; orange where the text says the measure is biased");
    // PROCESS AND CONSTITUTION (profile 1.11): what a box's shape and its foot marks say.
    var drawnIds = Object.keys(G.nodes).filter(function (v) { return G.folded.indexOf(v) < 0 && G.setAside.indexOf(v) < 0; });
    if (drawnIds.some(function (v) { var a = obj(M.states[v]).aspect; return a === "activity" || a === "development"; }))
      out += '<div class="g">Boxes</div>' + row('<svg width="46" height="16" aria-hidden="true"><rect x="3" y="2" width="40" height="12" rx="6" fill="var(--panel,#fff)" stroke="var(--mv-text)" stroke-width="1.4"/></svg>',
        "round ends: an ongoing doing, an activity or a development, not an amount");
    if (drawnIds.some(function (v) { var t = obj(M.states[v]).status; return t === "possible" || t === "open"; }))
      out += row('<svg width="46" height="16" aria-hidden="true"><text x="8" y="12" font-size="12" fill="var(--mv-text)">◌ …</text></svg>',
        "a hollow box in italic: not (yet) actual. ◌ a possibility the text sets out; … what it says cannot be specified in advance");
    var CSd = (M.constitutions || []).filter(function (c) { return c.layer !== "appraisal"; });
    if (CSd.length) out += row('<svg width="46" height="16" aria-hidden="true"><text x="8" y="12" font-size="12" fill="var(--mv-text)">⊂ ⊃</text></svg>',
        "⊂ makes up something else; ⊃ is made up of drawn states. What a thing is made of, not a cause of it: never an arrow");
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
          esc(l.states.concat(l.states[0]).map(label).join(" → ")) + (l.polarity ? ' <i>(' + l.polarity + ')</i>' : '') +
          (l.reflexive ? ' <i>(reflexive)</i>' : '') + '</button>'; }).join("")
                                       : "none closed in the text";
    // WHERE THE ARGUMENT TAKES THE CHAIN ON (1.15): the whole map's, since a chain's own model
    // does not recompute it. Such a state is listed apart from the gaps, and is not one.
    var HANDED = {};
    ((FULL && FULL.profile && FULL.profile.taken_up) || P.taken_up || []).forEach(function (x) { (HANDED[x[0]] = HANDED[x[0]] || []).push(x[1]); });
    var gapText = function (g) {
      var s = g.state ? "“" + label(g.state) + "”" : "";
      // EVERY KIND THE MODEL EMITS, each a whole sentence. Three kinds fell through to the
      // dead-end wording, and the two with no state printed " leads nowhere…" with no subject
      // at all (clarity audit sweep D, 27 Sep 2026).
      return g.kind === "unlinked-intervention" ? "The intervention " + s + " has no link in the text: nothing says how it brings about anything."
           : g.kind === "unlinked-condition" ? "The condition " + s + " has no link in the text: nothing says what it brings about."
           : g.kind === "unreached-outcome" ? s + " is not reached by the text’s links from where its chain starts."
           : g.kind === "no-intervention" ? "No state is marked as an intervention or a condition, so the chain has no stated start."
           : g.kind === "no-outcome" ? "No state is marked as an outcome, so nothing says what the chain is for."
           : g.state && HANDED[g.state] ? s + " is where the chain stops and the argument takes it on: " +
               HANDED[g.state].map(function (t) { return "[" + t + "]"; }).join(", ") + " is a reason there."
           : g.state ? s + " leads nowhere in the text: the chain stops there."
           : String(g.message || "");
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
      (P.levels.length > 1 ? '<div class="amech-row"><span class="k">levels are</span><span>' + esc(orderingWords(P.ordering).replace(/^levels: /, "")) +
        (P.ordering && P.ordering.within && P.ordering.within.length ? '; ' + esc(P.ordering.within.map(function (q) { return q[0] + " within " + q[1]; }).join(", ")) : '') + '</span></div>' : '') +
      // A CYCLE, AND WHETHER IT COMES TO REST (1.11); and whether the chain is told in nouns or verbs.
      // ITS GOAL AND ITS CONTRAST (1.13).
      (P.goal ? '<div class="amech-row"><span class="k">goal</span><span>' + esc(({ explain: "to explain why and how something happened",
        intervene: "to find what to do to bring an effect about", predict: "to predict what will happen",
        attribute: "to attribute responsibility: what cause was decisive, and whose" })[P.goal]) + '</span></div>' : '') +
      (P.contrast ? '<div class="amech-row"><span class="k">rather than</span><span>' + esc(P.contrast) + '</span></div>' : '') +
      // ITS ACCOUNT OF CAUSATION (1.14): what an arrow means differs with each.
      ((P.account || []).length ? '<div class="amech-row"><span class="k">causation as</span><span>' + esc(P.account.map(function (a) { return ({
        regularity: "regular succession", manipulability: "what changes when you intervene", mechanism: "a mechanism",
        counterfactual: "what would have happened otherwise", "intra-action": "relations that make what they relate" })[a]; }).join("; ")) + '</span></div>' : '') +
      ((P.stock_loops || []).length ? '<div class="amech-row"><span class="k">stock loops</span><span>' + P.stock_loops.length +
        ' loop' + (P.stock_loops.length === 1 ? '' : 's') + ' through a flow into a stock: the sign counts flows, and the states need not move together</span></div>' : '') +
      // HOW FAR IT IS MAPPED, and AN ORDER OF EXPLANATION (1.17).
      (P.depth === "sketch" ? '<div class="amech-row"><span class="k">mapped</span><span>a sketch: steps marked only where the argument relies on them' +
        (P.depth_reason ? ' -- ' + esc(P.depth_reason) : '') + '</span></div>' : '') +
      ((P.chains || []).some(function (c) { return c.order === "explanation"; }) ? '<div class="amech-row"><span class="k">order</span><span>' +
        esc((P.chains || []).filter(function (c) { return c.order === "explanation"; }).map(function (c) { return c.id; }).join(", ")) +
        ': told in order of explanation, each stage adding a complication -- not in order of time</span></div>' : '') +
      (P.form && P.form.form === "cycle" ? '<div class="amech-row"><span class="k">form</span><span>a cycle, not asked where it starts or ends; ' +
        (P.form.settles === true ? 'the text says it comes to rest' : P.form.settles === false ? 'the text says it does not come to rest' : 'the text does not say whether it comes to rest') + '</span></div>' : '') +
      ((P.aspects || []).length ? '<div class="amech-row"><span class="k">told in</span><span>' + esc(P.aspects.map(function (a) { return a[1] + " " + a[0]; }).join(", ")) + '</span></div>' : '') +
      '<div class="amech-row"><span class="k">height</span><span>' + P.levels_spanned.length + ' of ' + P.levels.length + ' levels' +
        (P.levels_spanned.length ? ': ' + esc(P.levels_spanned.join(", ")) : '') + '</span></div>' +
      // EACH LAG WITH ITS STEP, one to a line: joined with "; ", timings that hold "; " could not be read.
      '<div class="amech-row"><span class="k">length</span><span>' + ((P.timed || []).length ? P.timed.map(function (t) {
        return esc(label(t[0]) + " \u2192 " + label(t[1]) + ": " + t[2]); }).join("<br>") : 'no timing stated') + '</span></div>' +
      '<div class="amech-row"><span class="k">loops</span><span>' + loopText + '</span></div>' +
      (P.null_steps.length ? '<div class="amech-row"><span class="k">no effect</span><span>' +
        P.null_steps.map(function (n) { return esc(label(n.from) + " \u2192 " + label(n.to)) +
          // A CONDITIONAL NULL SAYS SO: "no effect" alone read a knockout as the opposite of its point.
          ((n.given || []).length ? ' <span class="amech-q">(only where: ' + n.given.map(esc).join("; ") + ')</span>' : "") +
          (n.refutes.length ? ' <span class="amech-q">(against the rival view)</span>' : ""); }).join("<br>") + '</span></div>' : '') +
      (P.selection_steps.length ? '<div class="amech-row"><span class="k">selection</span><span>' +
        P.selection_steps.map(function (x) { return esc(label(x[0]) + " \u2192 " + label(x[1])); }).join("<br>") +
        ' <span class="amech-q">(not effects)</span></span></div>' : '') +
      '<h3>Light and shadow</h3><div class="amech-barline">' +
      TIERS.map(function (t) { return '<span style="width:' + (100 * T[t] / tot) + '%;background:var(--mv-' + t + ')"></span>'; }).join("") +
      '</div><div class="amech-q">' + T.evidence + ' backed by a study or statistics · ' + T.argued + ' argued · ' +
      T.asserted + ' asserted only · ' + T.imputed + ' imputed</div>' +
      (P.gaps.some(function (g) { return !(g.state && HANDED[g.state]); }) ? '<h3>Gaps</h3><ul class="amech-gaps">' +
        P.gaps.filter(function (g) { return !(g.state && HANDED[g.state]); }).map(function (g) { return '<li>' + esc(gapText(g)) + '</li>'; }).join("") + '</ul>' : '') +
      (P.gaps.some(function (g) { return g.state && HANDED[g.state]; }) ? '<h3>Taken on by the argument</h3><ul class="amech-handed">' +
        P.gaps.filter(function (g) { return g.state && HANDED[g.state]; }).map(function (g) { return '<li>' + esc(gapText(g)) + '</li>'; }).join("") + '</ul>' : '') +
      // "LEGEND", because "Key" names the floating card the other arrangements share, and Help ▸
      // Show the Key opens that card, not this (clarity audit, 27 Sep 2026).
      '<h3>Legend</h3>' + legendHTML() + '<div class="amech-q">An arrow says the text holds that one state brings about a change in another: ' +
      '“raises” (more of the first, more of the second) or “lowers” (more of the first, less of the second). ' +
      'These are effects, not the support and attack of the Reasons map. ' +
      '×n: claims behind one arrow. ◇: conditions stated. ↻: closes a loop. “via”: a route through folded states. ' +
      // A MISSING ARROW (1.14): silence, not a finding of no effect -- unlike a causal diagram of a
      // system, where no arrow says no direct relation (Banitz et al. 2022, Fig. 2A).
      'No arrow between two states means the text does not say; it does not mean there is no effect. The text says so only where a “no effect” line is drawn. ' +
      'Click a state to see only the paths through it, or to fold it into its arrows.</div>' +
      (M.dropped ? '<div class="amech-q" style="color:var(--mv-gap)">' + M.dropped + ' step(s) name an undeclared state and are not drawn; the checker names them.</div>' : '');
  }
  /** The guide's steps: only the marks this drawing has, each with one example to light. */
  function guideSteps() {
    var es = drawnEdges.map(function (d) { return d.e; });
    var find = function (f) { return es.filter(f)[0]; };
    var out = [{ title: "Boxes and bands",
      body: "Each box is a <b>state</b>: a change in someone's condition or conduct. The horizontal bands are <b>levels</b>, with the actors named above them. " +
            "A dark box is what the text recommends doing; a tinted box, a condition it starts from; a double border, an outcome it explains or aims at." }];
    var textStep = find(function (e) { return e.layer === "text" && e.kind === "step"; });
    if (textStep) out.push({ edge: textStep, title: "An arrow is a step the text asserts",
      body: "The chip says what the step does: <b>▲ raises</b>, <b>▼ lowers</b>, <b>◆ decides which</b>. " +
            "The line's <b>weight</b> is what the text offers for it (heavy: a study or data; thin and pale: asserted only). " +
            "Its <b>pattern</b> is how close the claim stands to the text's words (solid: quoted). Click any arrow to read the claims behind it." });
    var add = function (f, title, body) { var e = find(f); if (e) out.push({ edge: e, title: title, body: body }); };
    add(function (e) { return e.layer === "rival"; }, "A view the text reports",
        "Slate grey: a step in someone else's account, which the text sets out. It is never walked as the text's own chain.");
    add(function (e) { return e.kind === "null"; }, "No effect",
        "A line ending in a bar, with no arrowhead: the text finds <b>no effect</b>. Nothing passes. Where a view the text reports says otherwise, the two lines sit side by side: a dispute, not a contradiction in the map.");
    add(function (e) { return e.kind === "association"; }, "An association",
        "A line with no head, in brown: the text reports that the two go together, and does not say one brings the other about. Where a state the text says causes both is drawn, the association may be its work.");
    add(function (e) { return e.kind === "selection"; }, "A selection effect",
        "A teal line: the two go together because of who ends up on each side, not because one brings the other about.");
    add(function (e) { return !!e.junction; }, "Only together",
        "An <b>AND gate</b> on the arrow: the step runs only with every cause that comes into the gate.");
    add(function (e) { return e.blockers.length; }, "Unless",
        "A stem ending on a bar across its own end: the step holds <b>unless</b> that state holds, as defences stop a hazard becoming harm.");
    add(function (e) { return (e.modifiers || []).length; }, "A moderator",
        "A dotted stem to a small ring: that state <b>strengthens, weakens or reverses</b> the step, or the text finds it does not. Click the arrow to see which.");
    add(function (e) { return (e.rests || []).length; }, "Evidence read from a measure",
        "A dashed stem to a small square: the step's evidence is read from that measure. It is orange where the text says something biases the measure, which undercuts the step.");
    add(function (e) { return /slows|speeds/.test(e.chip.label); }, "On a trend",
        "<b>slows</b> or <b>speeds</b>: the step changes how fast something is rising or falling, not its level.");
    add(function (e) { return /^(makes|unmakes|maintains|erodes|transforms|opens up|closes off)\b/.test(e.chip.label); }, "Making, keeping, changing",
        "<b>makes</b> or <b>unmakes</b>: the step brings something into being or ends it. <b>maintains</b> or <b>erodes</b>: it keeps something going or wears it away. <b>transforms</b>: it changes what kind of thing it is. <b>opens up</b> or <b>closes off</b>: it changes what can happen, not what does. None of these is more or less of something.");
    add(function (e) { return /needed for|enough for|not alone/.test(e.chip.label); }, "Needed, enough, not alone",
        "<b>needed for</b>: the effect holds only where the cause does. <b>enough for</b>: the cause brings it about on its own. <b>not alone</b>: the text says it is not enough by itself.");
    add(function (e) { return / · disputed/.test(e.chip.label); }, "Disputed",
        "Two accounts of one step that the argument sets against each other: they cannot both hold.");
    add(function (e) { return / · (intended|guided|inadvertent|accident|complex)/.test(e.chip.label); }, "What kind of causing",
        "The chip names the type of causing an account attributes, and whose it is: <b>intended</b>, <b>inadvertent</b>, <b>guided</b> (through another agent), <b>accident</b>, <b>complex</b>.");
    if (LOOPS.length) out.push({ cycle: LOOPS[0], title: "A loop",
      body: "<b>↻</b> marks each state in a loop the text's steps close. The side panel says whether it reinforces itself or balances." });
    out.push({ title: "Reading on",
      body: "Click a box to see only the paths through it; click an arrow for the claims behind it and the text's words. The key under the chain lists every mark used here." });
    return out;
  }
  function guideHTML(i) {
    var st = GUIDE[i];
    return '<h3>' + esc(st.title) + '</h3><div class="amech-guide">' + st.body + '</div>' +
      '<div class="amech-state-act"><span class="amech-q">' + (i + 1) + ' of ' + GUIDE.length + '</span> ' +
      (i > 0 ? '<button type="button" data-guide-go="' + (i - 1) + '">Back</button> ' : '') +
      (i + 1 < GUIDE.length ? '<button type="button" data-guide-go="' + (i + 1) + '">Next</button> ' : '') +
      '<button type="button" data-back="1">Close</button></div>';
  }
  var GUIDE = [];
  function guideGo(i) {
    GUIDE = guideSteps();
    i = Math.max(0, Math.min(i, GUIDE.length - 1));
    var st = GUIDE[i], d = st.edge ? drawnEdges.filter(function (x) { return x.e === st.edge; })[0] : null;
    select(d ? { edge: d.e, path: d.p, guide: i } : st.cycle ? { cycle: st.cycle, name: "Loop", guide: i } : { guide: i });
  }
  function renderSide() {
    if (selected && selected.guide != null) { side.innerHTML = guideHTML(selected.guide); return; }
    if (selected && selected.edge) {
      var e = selected.edge;
      side.innerHTML = '<h3>' + esc(obj(M.states[e.from]).label || e.from) + ' → ' + esc(obj(M.states[e.to]).label || e.to) + '</h3>' +
        (e.mixed ? e.breakdown.map(function (b) {
            return '<h3>' + esc(b.word) + ' (' + b.count + ')</h3>' + e.steps.filter(function (x) {
              return (x.isNull ? "no effect" : x.selects ? "selection effect" : x.assoc ? "associated" : signWord(x.sign ? [x.sign] : [])) === b.word;
            }).map(stepHTML).join("");
          }).join("") : e.steps.map(stepHTML).join("")) +
        // OFF MEANS OFF IN THE PANEL TOO: the appraisal's view of a text step is named only while
        // the layer is on.
        (layers.appraisal ? appraisalNotes(e) : '') +
        // By the arrow's index, not its key: a key holds NUL separators, which HTML rewrites.
        (e.steps.length > 1 && !e.expanded ? '<div class="amech-state-act"><button type="button" data-expand="' + G.edges.indexOf(e) +
          '">Draw each step apart</button> <span class="amech-q">one arrow for each of its ' + e.steps.length + ' steps</span></div>' : '') +
        (e.expanded ? '<div class="amech-state-act"><button type="button" data-collapse="' + G.edges.indexOf(e) +
          '">Draw them as one arrow again</button></div>' : '') +
        '<h3>&nbsp;</h3><button type="button" data-back="1" title="Leave this view and see every state again (Esc)">Back to the whole chain</button>';
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
        '<h3>&nbsp;</h3><button type="button" data-back="1" title="Leave this view and see every state again (Esc)">Back to the whole chain</button>';
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
        '<h3>&nbsp;</h3><button type="button" data-back="1" title="Leave this view and see every state again (Esc)">Back to the whole chain</button>';
    } else if (selected && selected.cycle) {
      var L = selected.cycle;
      var hopEdges = L.states.map(function (v, i) {
        var w = L.states[(i + 1) % L.states.length];
        return G.edges.filter(function (e) { return e.layer === "text" && e.kind === "step" && e.from === v && e.to === w; });
      });
      side.innerHTML = '<h3>' + esc(selected.name || "Loop") + '</h3>' +
        '<div class="amech-focus">Showing one loop the text closes: ' + esc(loopNames(L)) + '.' +
        (L.reflexive ? ' It is <b>reflexive</b>: it runs through a belief, a prediction or a classification that the loop itself acts on.' : '') +
        ((M.profile.sustaining || []).some(function (x) { return x.join("\u0000") === L.states.join("\u0000"); })
          ? ' It <b>keeps itself in being</b>: every step makes or maintains the next.' : '') +
        '</div>' +
        hopEdges.map(function (es) { return es.map(function (e) { return e.steps.map(stepHTML).join(""); }).join(""); }).join("") +
        '<h3>&nbsp;</h3><button type="button" data-back="1" title="Leave this view and see every state again (Esc)">Back to the whole chain</button>';
    } else if (selected && selected.state) {
      var s = obj(M.states[selected.state]), who = asList(s.actor), a = obj(M.actors[who[0]]);
      side.innerHTML = '<h3>' + esc(s.label || selected.state) + '</h3>' +
        '<div class="amech-focus">Showing only the paths through this state: what leads to it, and what it leads to.</div>' +
        '<div class="amech-row"><span class="k">actor</span><span>' + (s.actor == null
          // A PROCESS WITH NO OWNER (1.11) says so, and where it runs.
          ? 'none: a process with no owner' + (asList(s.levels).length ? ' (' + esc(asList(s.levels).join(", ")) + ')' : '')
          // SEVERAL ACTORS TOGETHER (1.12): a relation, or a doing none of them does alone.
          : who.length > 1 ? esc(who.map(function (x) { return obj(M.actors[x]).label || x; }).join(" and ")) + ', together'
          : esc(a.label || who[0] || "") + (a.level ? ' (' + esc(a.level) + ')' : '')) + '</span></div>' +
        (s.status === "possible" || s.status === "open" ? '<div class="amech-row"><span class="k">status</span><span>' +
          (s.status === "possible" ? 'possible: a possibility the text sets out, not (yet) actual' : 'open: what the text says cannot be specified in advance') + '</span></div>' : '') +
        (rolesOf(s).length ? '<div class="amech-row"><span class="k">role</span><span>' + esc(rolesOf(s).join(", ")) + '</span></div>' : '') +
        (s.aspect != null && ASPECTS.indexOf(String(s.aspect)) >= 0 ? '<div class="amech-row"><span class="k">is</span><span>' +
          esc(({ quantity: "a quantity: an amount, level or rate", activity: "an activity: ongoing, complete at every moment",
                 development: "a development: heading to an end through stages", event: "an event: it happens at a time",
                 condition: "a condition: a standing arrangement" })[String(s.aspect)]) + '</span></div>' : '') +
        // WHAT IT MAKES UP, AND WHAT MAKES IT UP (1.11): never a step, so listed here, with its claim.
        (function () {
          var CS = (M.constitutions || []).filter(function (c) { return c.layer !== "appraisal" || layers.appraisal; });
          var row = function (k, list, other) { return list.length ? '<div class="amech-row"><span class="k">' + k + '</span><span>' +
            list.map(function (c) { var o = other(c);
              return '<div>' + (c.extent === "partial" ? 'partly ' : '') + esc(o) +
                ' <span class="amech-q">(' + esc(c.claim.title) + (c.layer === "rival" ? '; reported' : c.layer === "appraisal" ? '; the appraisal' : '; the text’s own') +
                (c.whole ? '; ' + esc({ aggregate: "no more than their sum", organised: "through their organisation", reducible: "nothing but them" }[c.whole] || c.whole) : '') +
                (c.under ? '; on ' + esc(c.under) : '') + ')</span></div>'; }).join("") + '</span></div>' : ''; };
          return row("makes up", CS.filter(function (c) { return c.from === selected.state; }), function (c) {
                   return c.toActor ? (obj(M.actors[c.to]).label || c.to) : (obj(FULL.states[c.to]).label || c.to); }) +
                 row("made up of", CS.filter(function (c) { return !c.toActor && c.to === selected.state; }), function (c) {
                   return obj(FULL.states[c.from]).label || c.from; });
        })() +
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
        (s.measures != null && has(FULL.states, s.measures) ? '<div class="amech-row"><span class="k">measures</span><span>' +
          esc(obj(FULL.states[s.measures]).label || s.measures) + (s.method ? ', by ' + esc(s.method) : '') +
          ' — a reading of it, not a cause</span></div>' : '') +
        // RIVAL ACCOUNTS OF THIS STATE, SIDE BY SIDE (profile 1.9, G11).
        (function () {
          var acc = (FULL.profile.accounts || []).filter(function (x) { return x.state === selected.state; })[0];
          if (!acc) return '';
          return '<div class="amech-row"><span class="k">accounts</span><span>' + acc.accounts.map(function (x) {
            return '<div>' + esc(obj(FULL.states[x.from]).label || x.from) + ' <span class="amech-q">(' + esc(x.title) + '; ' +
              (x.layer === "text" && !x.stance ? 'the text’s own' : 'reported' + (x.stance ? ', ' + esc(x.stance) : '')) +
              (x.attribution ? '; ' + esc(x.attribution) : '') + ')' +
              (x.opened_by.length ? ' — opened by ' + x.opened_by.map(function (o) { return esc(obj(FULL.states[o[0]]).label || o[0]) + ' (' + esc(o[1]) + ')'; }).join('; ') : '') +
              '</span>' +
              // EACH STORY ON ITS OWN (James's verdict on Stone's stories, 29 Sep 2026): where a story
              // has its own chain, one click draws it alone.
              (function () {
                var cs = [];
                FULL.steps.forEach(function (s) { if (s.claim.title === x.title) s.chain.forEach(function (c) { if (cs.indexOf(c) < 0) cs.push(c); }); });
                var here = M.chain && M.chain.id;
                return cs.filter(function (c) { return c !== here; }).slice(0, 1).map(function (c) {
                  return ' <button type="button" data-open-chain="' + esc(c) + '" data-open-state="' + esc(selected.state) + '">Draw this story alone</button>'; }).join('');
              })() +
              '</div>'; }).join('') + '</span></div>';
        })() +
        // WHICH OF THE TEXT'S WORDS WERE READ AS THIS ONE STATE: the decision two annotators most
        // often make differently (mechanism-pass.md), so the reader is shown it.
        (s.note ? '<div class="amech-row"><span class="k">note</span><span>' + esc(s.note) + '</span></div>' : '') +
        (s.appraisal ? '<div class="amech-row"><span class="k">layer</span><span>the reconstructor’s appraisal: not in the text</span></div>' : '') +
        (canFold.indexOf(selected.state) >= 0 ? '<div class="amech-state-act"><button type="button" data-fold="' + esc(selected.state) +
          '">Fold into its arrows</button> <span class="amech-q">draws what leads in and what leads out as routes through it</span></div>' : '') +
        '<h3>&nbsp;</h3><button type="button" data-back="1" title="Leave this view and see every state again (Esc)">Back to the whole chain</button>';
    } else {
      side.innerHTML = profileHTML();
    }
  }
  function appraisalNotes(e) {
    var on = G.edges.filter(function (x) { return x.layer === "appraisal" && x.from === e.from && x.to === e.to; });
    if (!on.length || e.layer === "appraisal") return "";
    return '<h3>The appraisal on this step</h3>' + on[0].steps.map(claimHTML).join("");
  }
  // ESC LEAVES A FOCUS, as it leaves every other mode on the page (clarity audit, 27 Sep 2026:
  // the focus had only its button). Only while this chart is on screen and something is
  // focused, and not when another handler has already taken the key.
  var doc = container.ownerDocument;
  var onEsc = function (ev) {
    // A remount replaces this drawing; its listener then retires itself.
    if (!container.contains(side)) { if (doc) doc.removeEventListener("keydown", onEsc); return; }
    if (ev.key !== "Escape" || ev.defaultPrevented || !container.offsetParent) return;
    if (!side.querySelector("[data-back]")) return;
    ev.preventDefault();
    select(null);
  };
  if (doc) doc.addEventListener("keydown", onEsc);
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
    var gg = t.getAttribute && t.getAttribute("data-guide-go");
    if (gg != null) { guideGo(+gg); return; }
    var xv = t.getAttribute && t.getAttribute("data-expand"), cv = t.getAttribute && t.getAttribute("data-collapse");
    if (xv != null && G.edges[+xv]) { expanded[G.edges[+xv].base] = true; refold(); return; }
    if (cv != null && G.edges[+cv]) { delete expanded[G.edges[+cv].base]; refold(); return; }
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
    nestBanner.hidden = !(keep.nest && !NEST.declared);
    // A selection that the switch has just taken off the page goes with it.
    if (selected && selected.edge && selected.edge.layer !== "text" && !layers[selected.edge.layer]) selected = null;
    if (selected && selected.state && obj(M.states[selected.state]).appraisal && !layers.appraisal) selected = null;
    if (selected && selected.edge && !visible(selected.edge)) selected = null;
    drawFrame(); drawEdges(); drawNodes(); renderSide(); applyFocus();
    if (opts.onLayers) opts.onLayers({ rival: layers.rival, appraisal: layers.appraisal });
  }
  Array.prototype.forEach.call(bar.querySelectorAll("input[data-layer]"), function (inp) {
    inp.addEventListener("change", function () {
      layers[inp.getAttribute("data-layer")] = inp.checked; keep[inp.getAttribute("data-layer")] = inp.checked; apply(); });
  });
  var nestBtn = /** @type {HTMLElement|null} */ (bar.querySelector("[data-nest]"));
  if (nestBtn) nestBtn.addEventListener("click", function () { keep.nest = keep.nest ? null : "on"; refold(); nestBtn.textContent = keep.nest ? "Levels as bands" : "Nest the levels"; });
  var boxesBtn = /** @type {HTMLElement|null} */ (bar.querySelector("[data-boxes]"));
  if (boxesBtn) boxesBtn.addEventListener("click", function () { keep.boxes = !keep.boxes; remount(); });
  var chainSel = /** @type {HTMLSelectElement|null} */ (bar.querySelector("select[data-chain]"));
  if (chainSel) chainSel.addEventListener("change", function () { keep.chain = chainSel.value || null; remount(); });
  var guideBtn = /** @type {HTMLElement|null} */ (bar.querySelector("[data-guide-go]"));
  if (guideBtn) guideBtn.addEventListener("click", function () { guideGo(0); });
  var foldAll = /** @type {HTMLElement|null} */ (bar.querySelector("[data-foldall]"));
  function refold() {
    if (!Object.keys(folded).length) ends = false;
    G = layout(M, { folded: folded, ends: ends, expand: expanded, open: opened, marks: MS.marks, nest: nestSpec() });
    selected = null;
    // "UNFOLD", NOT "SHOW THE WHOLE CHAIN": that label also named the way out of a focus, which
    // is a different action (clarity audit, 27 Sep 2026). One name, one thing.
    if (foldAll) foldAll.textContent = G.folded.length ? "Unfold the chain" : endsLabel;
    apply();
  }
  function setFolded(v, on) { if (on) folded[v] = true; else delete folded[v]; refold(); }
  /** Open a box to its whole label, or shut it. Re-laid out like a fold, keeping what is selected. */
  function setOpen(v, on) {
    if (on) opened[v] = true; else delete opened[v];
    var was = selected && selected.state ? { state: selected.state } : null;
    refold();
    if (was && G.nodes[was.state]) select(was);
  }
  var fitBtn = /** @type {HTMLElement} */ (bar.querySelector("[data-fit]"));
  var pctBtn = /** @type {HTMLElement} */ (bar.querySelector("[data-zoom='1']"));
  /** The scale the chart is drawn at: the reader's, or the pane's width when fitted. */
  function scaleNow() { return fit ? Math.max(0.05, (stage.clientWidth - 4) / G.width) : zk; }
  function sizeSvg() {
    var k = scaleNow();
    // Style over the attributes: the drawing's own size stays what the layout says.
    var sv = /** @type {SVGElement} */ (svg);
    sv.style.width = Math.round(G.width * k) + "px"; sv.style.height = Math.round(G.height * k) + "px";
    if (fitBtn) fitBtn.textContent = fit ? "Actual size" : "Fit to width";
    if (pctBtn) pctBtn.textContent = Math.round(k * 100) + "%";
  }
  function setFit(on) { fit = !!on; if (!fit) zk = 1; keep.zoom = fit ? "fit" : null; sizeSvg(); }
  function setZoom(k, cx, cy) {
    var was = scaleNow(), now = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
    // The point under the pointer (or the middle of the pane) stays where it is.
    var ax = cx == null ? stage.clientWidth / 2 : cx, ay = cy == null ? stage.clientHeight / 2 : cy;
    var px = (stage.scrollLeft + ax) / was, py = (stage.scrollTop + ay) / was;
    fit = false; zk = now; keep.zoom = Math.abs(now - 1) < 1e-6 ? null : now;
    sizeSvg();
    stage.scrollLeft = px * now - ax; stage.scrollTop = py * now - ay;
  }
  function zoomBy(f, cx, cy) { setZoom(scaleNow() * f, cx, cy); }
  if (foldAll) foldAll.addEventListener("click", function () {
    if (G.folded.length) { folded = {}; ends = false; }
    else { toEnds.forEach(function (v) { folded[v] = true; }); ends = true; }
    refold();
  });
  var showSel = /** @type {HTMLSelectElement|null} */ (bar.querySelector("select[data-show]"));
  if (showSel) showSel.addEventListener("change", function () { show = showSel.value; apply(); });
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  fitBtn.addEventListener("click", function () { setFit(!fit); });
  Array.prototype.forEach.call(bar.querySelectorAll("[data-zoom]"), function (b) {
    b.addEventListener("click", function () {
      var z = b.getAttribute("data-zoom");
      if (z === "1") setZoom(1); else zoomBy(z === "in" ? ZOOM_STEP : 1 / ZOOM_STEP);
    });
  });
  // PINCH, OR CTRL/⌘ AND THE WHEEL, zooms at the pointer (a trackpad's pinch arrives as a wheel
  // with ctrlKey). The plain wheel is left to scroll the chart.
  stage.addEventListener("wheel", function (ev) {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    var r = stage.getBoundingClientRect();
    zoomBy(Math.pow(ZOOM_STEP, -ev.deltaY / (ev.deltaMode ? 3 : 100)), ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(function () { if (fit) sizeSvg(); }).observe(stage);
  apply();
  if (keep.zoom) { if (keep.zoom === "fit") setFit(true); else setZoom(keep.zoom); }

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
    select: function (x) { if (x && (x.kind || (x.state && G.nodes[x.state]))) select(x); },
    zoomBy: function (f) { zoomBy(f); },
    fit: function () { setFit(true); },
    getView: function () { return { show: show, ends: ends, folded: Object.keys(folded).sort(), expanded: Object.keys(expanded).sort(),
                                    zoom: fit ? "fit" : zk }; },
    setView: function (v) {
      if (!v) return;
      if (v.show) { show = v.show === "tested" ? "tested" : "all"; if (showSel) showSel.value = show; }
      folded = {}; (v.folded || []).forEach(function (x) { folded[x] = true; });
      ends = !!v.ends && hasEnds;
      expanded = {}; (v.expanded || []).forEach(function (x) { expanded[x] = true; });
      refold();
      if (v.zoom === "fit") setFit(true); else if (typeof v.zoom === "number") setZoom(v.zoom);
    }
  };
  }
}

var API = { model: model, layout: layout, markSpec: markSpec, audit: audit, nestTree: nestTree, nestingOf: nestingOf, pathPts: pathPts, pathAt: pathAt, create: create, foldable: foldable, collapseModel: collapseModel, chainModel: chainModel, TIERS: TIERS, BASES: BASES,
            FIDELITY: FIDELITY, FIDELITY_DASH: FIDELITY_DASH, BRIDGES: BRIDGES, bridgeScheme: bridgeScheme };
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (global) /** @type {any} */ (global).ArgdownMechanism = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
