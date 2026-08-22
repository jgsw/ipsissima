/* argdown-graph.mjs — the one adapter from Argdown's own output to the live map's graph.
 *
 * Three hosts need this conversion: the pandoc filter (argdown-live-filter.mjs), the per-file
 * viewer, and the standalone drop-anything viewer. They must agree, or the same file draws
 * differently depending on which route it took — so the conversion lives here once.
 *
 * `toGraph` is deliberately free of any Node dependency: the standalone viewer runs it in the
 * browser against a parser bundled into the page. Only `buildGraph` needs @argdown/node.
 *
 *   IN   an Argdown response carrying .map, .statements and .arguments
 *   OUT  { nodes: [{id,label,detail,kind,facet,color,group}],
 *          edges: [{from,to,type}],
 *          groups:[{id,label,parent}] }
 */

/** PURE: metadata blocks that Argdown will silently drop the rest of the file over.
 *
 *  THE WORST FAILURE THIS TOOL HAS HAD. A `{…}` block is YAML, and a missing comma —
 *
 *      {chapter: "one.md", source: "..." comment: "no comma before me"}
 *
 *  — is a YAMLException. The command line prints it and then exits 0. The in-process parser,
 *  which is what the viewer and the editor both use, swallows it whole: `exceptions`,
 *  `lexerErrors` and `parserErrors` all come back EMPTY, the parse reports success, and every
 *  claim from that point to the end of the file is quietly missing from the map. Reported from
 *  a real session: half a book vanished and nothing said a word.
 *
 *  So the braces are checked here, with the same YAML library Argdown itself uses, and the
 *  answer is given to everyone who needs it — the builder refuses to bake a truncated map, the
 *  viewer says so on screen, and the editor marks the line. One rule, three consumers; a second
 *  implementation of YAML would be a second opinion that could drift.
 *
 *  Returns [{ line, column, message, text }], line 1-based.
 */
export function metadataProblems(source, yamlLoad) {
  const out = [];
  if (typeof yamlLoad !== "function") return out;
  const text = String(source || "");
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (/^\s*\/\//.test(lines[i])) { i++; continue; }
    const open = lines[i].indexOf("{");
    if (open < 0) { i++; continue; }
    // Collect the block, brace-balanced, so a metadata block spanning lines is checked whole.
    let depth = 0, block = "", startLine = i, done = false;
    for (let n = i; n < lines.length && !done; n++) {
      const from = n === i ? open : 0;
      for (let c = from; c < lines[n].length; c++) {
        const ch = lines[n][c];
        block += ch;
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) { done = true; break; } }
      }
      if (!done) block += "\n";
      if (done) i = n;
    }
    if (!done) { i = startLine + 1; continue; }
    try { yamlLoad(block); }
    catch (e) {
      const mark = e && e.mark;
      out.push({
        line: startLine + (mark ? mark.line : 0) + 1,
        column: (mark && mark.line === 0 ? open : 0) + (mark ? mark.column : 0) + 1,
        message: String(e && e.reason ? e.reason : e && e.message ? e.message : e).split("\n")[0],
        text: block.length > 90 ? block.slice(0, 90) + "\u2026" : block
      });
    }
    i++;
  }
  return out;
}

/** The line a claim is DEFINED on — the one with a colon and text — not a line that merely
 *  mentions it. A comment written onto a reference would attach to nothing. */
export function findClaimDefinition(lines, label){
  var esc = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var re = new RegExp("^\\s*(?:[+\\-_<>]+\\s*)?(?:\\[" + esc + "\\]|<" + esc + ">)\\s*:");
  for (var i = 0; i < lines.length; i++) if (re.test(lines[i])) return i;
  return -1;
}

/** Where the `{…}` block belonging to the claim defined on `at` runs, or null. Argdown allows it
 *  on the definition line itself or on the indented lines below it. */
export function metaBlockAfter(lines, at){
  for (var i = at; i < lines.length && i <= at + 3; i++) {
    var open = lines[i].indexOf("{");
    if (open < 0) {
      if (i > at && lines[i].trim() !== "") return null;   // the claim ended without one
      continue;
    }
    var depth = 0;
    for (var n = i; n < lines.length; n++) {
      var from = n === i ? open : 0;
      for (var c = from; c < lines[n].length; c++) {
        if (lines[n][c] === "{") depth++;
        else if (lines[n][c] === "}") {
          depth--;
          if (depth === 0) return { startLine: i, startCol: open, endLine: n, endCol: c };
        }
      }
    }
    return null;
  }
  return null;
}

/** A YAML double-quoted scalar. JSON's escaping IS valid YAML 1.2 double-quoted, which is the
 *  cheapest correct answer and avoids hand-rolling an escaper. */
export function yamlString(v){ return JSON.stringify(String(v)); }

/** Put `value` into the claim's `comment:` field, or take it out when value is null.
 *  Returns the new text, or null if it could not be done safely. */
export function withComment(text, label, value){
  var lines = text.split("\n");
  var at = findClaimDefinition(lines, label);
  if (at < 0) return null;
  var block = metaBlockAfter(lines, at);

  if (!block) {
    if (value == null) return text;                 // nothing to remove
    // No metadata at all: give the claim one, indented under its definition.
    var indent = (lines[at].match(/^\s*/) || [""])[0] + "    ";
    lines.splice(at + 1, 0, indent + "{comment: " + yamlString(value) + "}");
    return lines.join("\n");
  }

  // Pull the block out whole, edit it as one string, put it back.
  var inner = "";
  for (var n = block.startLine; n <= block.endLine; n++) {
    var a = n === block.startLine ? block.startCol : 0;
    var b = n === block.endLine ? block.endCol + 1 : lines[n].length;
    inner += lines[n].slice(a, b) + (n === block.endLine ? "" : "\n");
  }
  var body = inner.slice(1, -1);                    // drop the braces
  // A `comment:` already there — replace its value, wherever it sits.
  var found = /(^|[,{\s])comment\s*:\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^,}\n]*)/;
  var m = found.exec(body);
  if (m) {
    var head = body.slice(0, m.index) + m[1];
    var tail = body.slice(m.index + m[0].length);
    body = value == null
      ? (head + tail).replace(/,\s*,/g, ",").replace(/^[\s,]+|[\s,]+$/g, "")
      : head + "comment: " + yamlString(value) + tail;
  } else {
    if (value == null) return text;
    body = body.replace(/\s*$/, "") + ", comment: " + yamlString(value);
  }
  var before = lines[block.startLine].slice(0, block.startCol);
  var after = lines[block.endLine].slice(block.endCol + 1);
  var out = lines.slice();
  // An empty `{}` is litter, not metadata. If removing the comment emptied the block and the
  // block had a line to itself, take the line with it.
  if (!body.trim() && !before.trim() && !after.trim()) {
    out.splice(block.startLine, block.endLine - block.startLine + 1);
    return out.join("\n");
  }
  out.splice(block.startLine, block.endLine - block.startLine + 1,
             before + "{" + body + "}" + after);
  return out.join("\n");
}


/** Argdown's IMap nests groups and carries no tags on its nodes; the live map wants a flat node
 *  list plus a `facet` to filter on. Tags are joined back on by title, which is the key
 *  `response.statements` / `response.arguments` are indexed under. */
export function toGraph(res) {
  const nodes = [], groups = [], edges = [];
  const tagOf = title => {
    const rec = (res.statements && res.statements[title]) ||
                (res.arguments  && res.arguments[title]);
    return rec && rec.tags && rec.tags.length ? rec.tags[0] : null;
  };

  // Fidelity: whose words these are. A SECOND axis, orthogonal to the argumentative role
  // that tags carry -- which is exactly why it cannot itself be a tag, since only tags[0]
  // reaches the map. Colour is spent on role, so the renderer gives fidelity the border.
  const FIDELITY = new Set(["quotation", "paraphrase", "compression",
                            "interpretation", "imputation"]);
  const fidelityOf = title => {
    const rec = (res.statements && res.statements[title]) ||
                (res.arguments  && res.arguments[title]);
    for (const m of (rec && rec.members) || []) {
      const f = m.data && m.data.fidelity;
      if (f && FIDELITY.has(String(f))) return String(f);
    }
    const d = rec && rec.data;
    return d && FIDELITY.has(String(d.fidelity)) ? String(d.fidelity) : null;
  };

  // Provenance: WHERE IN THE MANUSCRIPT the claim comes from. Needed by the exposition-ordered
  // view, which lays the same nodes out by position in the text rather than by what supports
  // what. Carried here rather than resolved here: turning `chapter` + `section` into a line
  // needs the manuscript, which this adapter deliberately does not have — argdown-positions.js
  // does that, in whichever host has the files.
  // `source` is included because it is where a reconstruction usually parks the author's exact
  // words, and a located quotation gives a claim an EXACT line rather than a located paragraph.
  /** MARGINALIA. Two hands write in the margin of a reconstruction and they must not be
   *  confused with each other:
   *
   *    note     the reconstructor's own — why a reading was taken, what the map cannot show
   *    comment  someone else's, on the argument — a tutor reading a student's essay
   *
   *  Neither is a move in the argument, so neither becomes a node: putting "try reading Anscombe
   *  on this" in as a claim would say the essay contains that move. They are marginalia, drawn
   *  on the claim they are about.
   *
   *  Read from the claim ITSELF and never from the front-matter defaults — a default note on
   *  every claim would be a note about nothing.
   */
  const marginOf = title => {
    const rec = (res.statements && res.statements[title]) ||
                (res.arguments  && res.arguments[title]);
    const out = {};
    const take = d => {
      if (!d) return;
      if (out.note == null && typeof d.note === "string") out.note = d.note;
      if (out.comment == null && typeof d.comment === "string") out.comment = d.comment;
    };
    for (const m of (rec && rec.members) || []) take(m.data);
    take(rec && rec.data);
    return out;
  };

  const PROV = ["chapter", "section", "line", "lineSource", "source"];
  // FRONT-MATTER DEFAULTS. `chapter` is the same on every claim of a single-source
  // reconstruction and `reviewed` is the date of the pass -- together about 15% of the bytes of
  // a finished map, retyped per claim and stale the moment a file is renamed. Declared once:
  //
  //     ===
  //     defaults:
  //       chapter: "source/the-paper.md"
  //     ===
  //
  // Applied LAST, so anything written on the claim wins and a map drawing on two sources still
  // says which is which where it matters. The Python half reads the same block out of the file
  // text, because the CLI's json export drops front matter while the core parser's response
  // keeps it; test_argdown_positions.mjs is what holds the two readings together.
  const defaults = (res.frontMatter && res.frontMatter.defaults) || {};
  const provenanceOf = title => {
    const rec = (res.statements && res.statements[title]) ||
                (res.arguments  && res.arguments[title]);
    const out = {};
    const take = d => { for (const k of PROV) if (out[k] == null && d && d[k] != null) out[k] = d[k]; };
    for (const m of (rec && rec.members) || []) take(m.data);
    take(rec && rec.data);
    take(defaults);
    return out;
  };

  // Where each claim was WRITTEN, in lines of the .argdown. Section order (below) fixes the
  // order of the clusters, but every claim in one section shares its section's ordinal, so it
  // cannot order claims WITHIN a cluster -- and dagre's crossing-minimisation happily reverses
  // them. On the Williams map that drew Williams's own numbered propositions (i) (ii) (iii) (iv)
  // as iv, iii, ii, i. The line number is the finer key that fixes it.
  const lineOf = title => {
    const rec = (res.statements && res.statements[title]) ||
                (res.arguments  && res.arguments[title]);
    let best = null;
    for (const m of (rec && rec.members) || [])
      if (m.startLine != null && (best === null || m.startLine < best)) best = m.startLine;
    if (best === null && rec && rec.startLine != null) best = rec.startLine;
    return best;
  };

  // Document order. Argdown's map builder emits groups in ITS own order -- on one test file the
  // third section it emitted was the seventh in the source -- and dagre then reorders again to
  // minimise crossings. Neither consults the document, so a reader following the argument in the
  // order it was written finds the sections scattered. `res.sections` is the only place the
  // source order survives, and its ids are exactly the group-map-node ids.
  const orderOf = new Map();
  (function walk(list) {
    for (const s of list || []) {
      if (!orderOf.has(s.id)) orderOf.set(s.id, orderOf.size);
      walk(s.children);
    }
  })(res.sections);
  const visit = (list, parent) => {
    for (const n of list || []) {
      if (n.type === "group-map-node") {
        groups.push({
          id: n.id, label: n.labelTitle || n.title || n.id, parent: parent || null,
          order: orderOf.has(n.id) ? orderOf.get(n.id) : orderOf.size
        });
        visit(n.children, n.id);
      } else {
        const tag = tagOf(n.title);
        nodes.push({
          id: n.id,
          label: n.labelTitle || n.title || n.id,
          detail: (n.labelText || "").trim(),
          // WHAT THE NODE IS, not what it is tagged. The tag used to win here, so every
          // <Argument> that carried one — all 13 in the reference maps — arrived at the renderer
          // indistinguishable from a plain statement, and the language's central distinction
          // could not be drawn because it had already been thrown away. The tag is not lost: it
          // is `facet`, right below, which is what the chips and the colour actually read.
          kind: n.type === "argument-map-node" ? "argument" : "statement",
          facet: tag,
          color: n.color || null,
          fidelity: fidelityOf(n.title),
          ...marginOf(n.title),
          docLine: lineOf(n.title),
          ...provenanceOf(n.title),
          group: parent || null,
          // A node inherits its section's place in the document; ungrouped nodes keep the
          // order they were emitted in, which is the best available guess.
          order: parent != null && orderOf.has(parent) ? orderOf.get(parent) : orderOf.size
        });
      }
    }
  };
  visit(res.map.nodes, null);

  /* WHICH INFERENCE STEP A PREMISE BELONGS TO.
   *
   * Argdown's map flattens an argument to one node with a support edge from every premise, so a
   * six-premise LINKED step and six INDEPENDENT pro reasons arrive as the same six arrows. The
   * distinction is the point of the notation — premises of one step must all hold to carry any
   * force, whereas each `+` relation stands on its own — and `res.map` has no trace of it.
   *
   * `res.arguments[title].pcs` does: an ordered list whose roles are `premise`,
   * `intermediary-conclusion` and `main-conclusion`. Walking it, every run of premises ending at
   * a conclusion is one step. Numbering the steps here lets the renderer draw the ones that are
   * joined as joined, without teaching it anything about Argdown.
   *
   * Matched by TITLE, and per argument rather than globally: a statement can be a premise of two
   * different arguments (`def-a` is, in both Gettier cases) at different step numbers.
   */
  const stepOfPremise = new Map();     // argument title -> Map(premise title -> step index)
  const stepCount = new Map();
  for (const [title, a] of Object.entries(res.arguments || {})) {
    const pcs = a.pcs || [];
    if (!pcs.length) continue;
    const where = new Map();
    let step = 0, run = [];
    for (const p of pcs) {
      if (p.role === "premise") run.push(p.title);
      else { for (const t of run) where.set(t, step); run = []; step++; }
    }
    for (const t of run) where.set(t, step);          // a PCS with no closing conclusion
    stepOfPremise.set(title, where);
    stepCount.set(title, step);
  }
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const n of nodes) if (stepCount.has(n.label)) n.steps = stepCount.get(n.label);

  for (const e of res.map.edges || []) {
    if (!e.from || !e.to) continue;
    const edge = { from: e.from.id, to: e.to.id, type: e.relationType || "support" };
    const target = byId.get(e.to.id), source = byId.get(e.from.id);
    if (edge.type === "support" && target && source && stepOfPremise.has(target.label)) {
      const k = stepOfPremise.get(target.label).get(source.label);
      if (k != null) edge.step = k;
    }
    edges.push(edge);
  }
  return { nodes, groups, edges };
}

/** The process chain and settings every host must use, so a file maps identically everywhere.
 *  `removeTagsFromText` matters: tags drive the facet chips and the node colour, and must not
 *  also be left sitting in the visible label. */
export const RUN = {
  process: ["parse-input", "build-model", "build-map", "export-json"],
  model: { removeTagsFromText: true },
  logLevel: "error"
};

/* NOTE: there is deliberately no `buildGraph` here that imports @argdown/node.
 * esbuild follows even a dynamic import when bundling, and @argdown/node's plugins pull in
 * fs/path/util -- which fails the browser build with 60 unresolved-builtin errors. Callers that
 * have Node available import the parser themselves and pass the response to toGraph. */
