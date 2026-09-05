/* SPDX-License-Identifier: MIT */
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
/** Syntax errors the parser REPORTS rather than throws.
 *
 *  THE SAME SHAPE OF SILENCE AS THE BRACES ABOVE, and it sat open right beside the guard built
 *  for that one. `argdown.run` does not throw on a syntax error; it returns `parserErrors` and
 *  `lexerErrors` and carries on with a document truncated at the fault. Nothing read either
 *  array. So a file with one bad line built an 875 KB page reporting `0 nodes, 0 edges`, exited
 *  0, and opened on an empty canvas with the error panel blank.
 *
 *  An empty canvas is not a silence. It is a statement — *this file has no argument in it* —
 *  and a reader handed a reconstruction has no reason to doubt it.
 *
 *  Returns [{ line, column, message, text }], line 1-based: the same shape `metadataProblems`
 *  returns, so the three consumers that already know how to present one need no new code.
 */
/* THE ONE SHAPE WORTH TRANSLATING, and only that one. Measured 5 Sep 2026 over eighteen
 * classroom-shaped mistakes (docs/EDITOR-PLAN.md \u00a71): the parser's own long messages \u2014
 * "Invalid relation syntax\u2026", "Incomplete premise-conclusion-structure\u2026", "Missing
 * inference\u2026", "Invalid paragraph start\u2026", "Invalid inference position\u2026" \u2014 already teach,
 * and pass through untouched; rewording them would be a second opinion on the official
 * parser's words. What a classroom meets and cannot read is chevrotain's
 *
 *     Expecting token of type --> EOF <-- but found --> '\u2026' <--
 *
 * which is how three different mistakes come back: text after a bare [reference] (a missing
 * colon), a second claim started on the same line, and their variants. The raw words stay on
 * the end of the translation, because the translation is ours and the authority is not. */
export function friendlyParseMessage(message, lineText) {
  const m = /^Expecting token of type --> EOF <-- but found --> '([\s\S]*)' <--/.exec(message);
  if (!m) return message;
  const secondClaim = /^@?[[<]/.test(m[1]);
  const bareRef = /^\s*@?(\[[^\]\n]+\]|<[^>\n]+>)\s+\S/.test(lineText || "");
  const why = secondClaim
    ? "a new claim starts before the line ends, and each claim needs its own line"
    : bareRef
      ? "text follows a bare reference \u2014 to give the claim its text here, put a `:` after " +
        "the closing bracket"
      : "the line was already complete, and what follows cannot be read as part of it";
  return "Could not read past this point: " + why + ". (The parser said: " + message + ")";
}

export function parseProblems(res, source) {
  const out = [];
  if (!res) return out;
  const lines = String(source || "").split("\n");
  const at = (line) => {
    const l = lines[line - 1];
    return l == null ? "" : (l.length > 90 ? l.slice(0, 90) + "\u2026" : l);
  };
  for (const e of res.lexerErrors || []) {
    const line = e && e.line ? e.line : 1;
    out.push({ line, column: (e && e.column) || 1,
               message: String((e && e.message) || e).split("\n")[0], text: at(line) });
  }
  for (const e of res.parserErrors || []) {
    // Chevrotain hangs the position off the offending token. `previousToken` is the fallback:
    // an error at end-of-input has a token with no position of its own.
    const tok = (e && e.token && e.token.startLine ? e.token : e && e.previousToken) || {};
    const line = tok.startLine || 1;
    out.push({ line, column: tok.startColumn || 1,
               message: friendlyParseMessage(
                 String((e && e.message) || e).split("\n")[0], at(line)),
               text: at(line) });
  }
  return out;
}


/* Statement and argument mentions, rendered as what they mention.
 *
 *  A PLAIN BLOCK COMMENT, not JSDoc, and only because of what it has to quote: `tsc`
 *  reads `@` in a `/**` block as opening a tag, and the examples below begin `@[` and
 *  `@<`, which are not identifiers. The whole suite failed on "Identifier expected".
 *
 *  ARGDOWN DOES NOT STRIP THESE. Bold, italic and links are resolved away into `labelText` with
 *  their markup removed, so the worst they do is lose their emphasis. Mentions are left in the
 *  text exactly as written, so a box showed `@[Voice of the People]` — sigil, brackets and all.
 *  That is the one presentation which is both ugly and wrong, because it reads as a syntax error
 *  the reader should go and report. Seven of them in Argdown's own populism map, six in
 *  Greenspan's.
 *
 *  WHY THE LENGTH IS COMPUTED FROM THE TITLE rather than from the range. The two mention types
 *  disagree about what `stop` means in `@argdown/core` 2.0, and the disagreement is silent:
 *
 *      "We should heed @[Voice] and also @<Turnover>."
 *      statement-mention  start 15, stop 23   ->  stop is EXCLUSIVE
 *      argument-mention   start 33, stop 43   ->  stop is INCLUSIVE
 *
 *  Trusting either convention eats a character of the neighbouring prose on half the mentions in
 *  a file. So the markup is rebuilt from the title the range already carries, checked against the
 *  text at `start`, and skipped where it does not match — a mention left alone is a blemish, and
 *  a mis-sliced one silently corrupts a claim.
 *
 *  Returns { text, ranges } with the remaining ranges shifted to match the new text, so the
 *  emphasis work still to come has correct offsets to draw from.
 */
export function resolveMentions(text, ranges) {
  const src = String(text || "");
  const all = (ranges || []).slice().sort((a, b) => (a.start | 0) - (b.start | 0));
  const cuts = [];
  for (const r of all) {
    if (r.type !== "statement-mention" && r.type !== "argument-mention") continue;
    if (!r.title) continue;
    const markup = r.type === "statement-mention" ? "@[" + r.title + "]" : "@<" + r.title + ">";
    const start = r.start | 0;
    if (src.slice(start, start + markup.length) !== markup) continue;   // not where it claims
    cuts.push({ start, end: start + markup.length, to: r.title });
  }
  if (!cuts.length) return { text: src, ranges: all };

  let out = "", read = 0, shift = 0;
  const moved = [];
  const shifts = [];
  for (const c of cuts) {
    out += src.slice(read, c.start) + c.to;
    read = c.end;
    shift += c.to.length - (c.end - c.start);          // negative: the text gets shorter
    shifts.push({ at: c.end, by: shift });
  }
  out += src.slice(read);

  // Shift whatever survives. A range that started inside a mention we rewrote is dropped rather
  // than guessed at — there is no honest place to put it.
  const shiftFor = (pos) => {
    let s = 0;
    for (const x of shifts) if (pos >= x.at) s = x.by;
    return s;
  };
  for (const r of all) {
    if (r.type === "statement-mention" || r.type === "argument-mention") continue;
    const inside = cuts.some(c => r.start >= c.start && r.start < c.end);
    if (inside) continue;
    moved.push({ ...r, start: (r.start | 0) + shiftFor(r.start | 0),
                 stop: (r.stop | 0) + shiftFor(r.stop | 0) });
  }
  return { text: out, ranges: moved };
}


/* Mention markup, stripped from text that arrives with NO ranges to slice by.
 *
 *  A PLAIN BLOCK COMMENT for the same reason `resolveMentions` above is one: `tsc` reads the `@`
 *  in a `/**` block as opening a tag, and `@[` is not an identifier.
 *
 *  WHY THIS EXISTS BESIDE `resolveMentions` RATHER THAN CALLING IT. That function is the right
 *  one and works from `labelTextRanges`, which is what makes it safe -- it rebuilds each mention
 *  from the title the range carries instead of trusting `stop`, because the two mention types
 *  disagree about whether `stop` is inclusive. The lines of a premise-conclusion structure carry
 *  no ranges at all: `pcs[].text` is a plain string. So there is nothing to slice by, and the
 *  markup has to be matched as markup.
 *
 *  That is safe HERE precisely because it is a match rather than a slice -- there is no index to
 *  be off by one. It is not a replacement for `resolveMentions`, which keeps the surviving ranges
 *  aligned so emphasis can still be drawn; this one has no ranges to keep.
 *
 *  Without it, a premise reading `... in spectators (@[Causal link]).` -- Argdown's own
 *  `censorship.argdown`, premise (1) of <Argument from expertise> -- draws with the sigil and
 *  brackets intact, which reads as a syntax error the viewer failed to handle.
 */
export function stripMentionMarkup(text) {
  return String(text || "").replace(/@\[([^\]]+)\]/g, "$1").replace(/@<([^>]+)>/g, "$1");
}

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
    // TWO METADATA STYLES ARE VALID, AND THIS ONLY KNEW ONE.
    //
    // `{…}` handed to a YAML parser is a FLOW mapping, where commas between entries are
    // mandatory. That is right for the style the samples use — `{fidelity: "quotation",
    // pinpoint: "[32]", note: "…"}`, wrapping across lines with the commas kept.
    //
    // But a block whose brace sits ALONE on its line is not flow. Argdown reads its interior as
    // ordinary block YAML, where the entries are separated by newlines and a comma is a syntax
    // error. Checked against @argdown/core, which parses
    //
    //     {                       {chapter: "x.md", fidelity: "quotation"}
    //     chapter: "x.md"
    //     fidelity: "quotation"
    //     }
    //
    // identically, and silently yields NOTHING for either style written with the other's
    // punctuation. This check called the left-hand form 138 broken blocks on a valid map and
    // refused to draw it — a false alarm that stops a good file opening, which is worse than the
    // silence it exists to break.
    //
    // So: flow first, and where the brace stands alone, block as well. A block that fails both
    // is broken in a way Argdown will not report, which is the whole point of being here.
    // THE BRACE'S POSITION DECIDES WHICH PARSE APPLIES. Not "try flow, fall back to block": the
    // two styles are each other's errors, and a fallback accepts a file Argdown drops. A block
    // whose brace stands alone AND carries commas parses perfectly as flow YAML and yields
    // NOTHING from Argdown — precisely the silence this check exists to break.
    const braceAlone = /^\s*\{\s*$/.test(lines[startLine].slice(open));
    // Only the braces come off, never the newline after the first, so reported line numbers
    // still point at the line the reader has to fix.
    const toParse = braceAlone ? block.replace(/^\s*\{/, "").replace(/\}\s*$/, "") : block;
    try { yamlLoad(toParse); }
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
  /* WHERE A FORMALIZATION ACTUALLY LIVES.
   *
   * `(2) [The advice was unlawful]` is a REFERENCE: the line carries no inline data at all, and
   * the `formalization:` is on the statement it names. Ipsissima's house style defines claims
   * once and refers to them, so that is the normal case and not the exception -- reading only
   * the line found nothing on the first real map this was pointed at.
   */
  const formalizationOf = title => {
    const rec = (res.statements && res.statements[title]) ||
                (res.arguments  && res.arguments[title]);
    for (const m of (rec && rec.members) || []) {
      const f = m.data && m.data.formalization;
      if (typeof f === "string" && f.trim()) return f;
    }
    const d = rec && rec.data;
    return d && typeof d.formalization === "string" && d.formalization.trim()
      ? d.formalization : null;
  };

  /* HAS THE CLAIM CHANGED SINCE ITS FORMULA WAS WRITTEN? A `formalization` is written once, by
   * hand, and nothing afterwards ties it to the sentence it stands for: edit the claim, leave the
   * formula, and the step is still decided -- correctly -- about formulas that no longer say what
   * the claim says. The map would then draw `checked: the conclusion follows` over an argument
   * the words no longer make, which is worse than drawing nothing.
   *
   * `formalized:` is the claim's record of the words it was written for. Read here beside the
   * formula, and compared against the claim as it now stands; see `validity.stamp`, and
   * `check_argdown.py --stamp`, which writes them. */
  const stampedTextOf = title => {
    const rec = (res.statements && res.statements[title]) ||
                (res.arguments  && res.arguments[title]);
    if (!rec) return { text: null, was: null };
    // The text is on a MEMBER, not on the record, and some members carry only a space.
    let text = null;
    for (const m of rec.members || [])
      if (m.text && m.text.trim()) { text = m.text; break; }
    if (text == null && typeof rec.text === "string") text = rec.text;
    let was = null;
    for (const m of rec.members || []) {
      const v = m.data && m.data.formalized;
      if (typeof v === "string") { was = v; break; }
    }
    if (was == null && rec.data && typeof rec.data.formalized === "string") was = rec.data.formalized;
    return { text, was };
  };

  /* WHY the reconstructor departed from the text, where they did. `fidelity` says how far a
   * claim is from the author's words; `warrant` says what licensed going that far, and it is
   * the half a reader is entitled to see -- an `imputation` with a reason is a reading, and one
   * without is a guess. It never reached the map at all until now: the Python checker read it
   * out of the file and this adapter dropped it, so the renderer had no way to show it.
   *
   * NOT filtered against a vocabulary, unlike fidelity. `WARRANTS` in the Python half is
   * explicitly "a prompt, not a jail" -- any other value is accepted and simply reported -- and
   * a filter here would silently delete exactly the unusual reason most worth reading. */
  const warrantOf = title => {
    const rec = (res.statements && res.statements[title]) ||
                (res.arguments  && res.arguments[title]);
    for (const m of (rec && rec.members) || []) {
      const w = m.data && m.data.warrant;
      if (typeof w === "string" && w.trim()) return w.trim();
    }
    const d = rec && rec.data;
    return d && typeof d.warrant === "string" && d.warrant.trim() ? d.warrant.trim() : null;
  };

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
          // MENTIONS RESOLVED, EMPHASIS CARRIED. `labelText` arrives with `@[…]` and `@<…>`
          // still in it -- see resolveMentions -- and its `ranges` were dropped here, which is
          // the single cause behind bold, italic, links and both mention forms all being lost.
          // The ranges now travel with the node so the renderer can draw them; nothing reads
          // them yet, and a field that is carried can be drawn, whereas one that is thrown away
          // has to be recovered first.
          ...(() => {
            const r = resolveMentions(n.labelText || "", n.labelTextRanges || []);
            if (r.text.trim()) return { detail: r.text.trim(), detailRanges: r.ranges };
            /* THE WORDS SURVIVE THE LABEL MODE. `statementLabelMode: "title"` (and its
             * argument twin) tells Argdown to put nothing but the title on a map node, and the
             * words then arrived here as an empty labelText -- so the box, its tooltip and the
             * claims toggle all had nothing to show, and a reader met "Unsafe Without
             * Philosophy" with no way to unpack what it amounts to (reported from use, on the
             * one map in the corpus that sets the mode). A label mode is an export style for
             * Argdown's own outputs; this adapter's contract is that the claim's words are
             * always carried, because a field that is carried can be drawn and the viewer's
             * own claims toggle is what decides how much of it shows. The words live at the
             * definition, exactly where wordsOf reads them for a bare reference line; a claim
             * referred to but never defined keeps an empty detail, since its title is already
             * the label.
             */
            const rec = (res.statements && res.statements[n.title]) ||
                        (res.arguments && res.arguments[n.title]);
            for (const m of (rec && rec.members) || []) {
              const t = m.text == null ? "" : String(m.text).trim();
              if (t) return { detail: stripMentionMarkup(t), detailRanges: [] };
            }
            return { detail: "", detailRanges: [] };
          })(),
          // WHAT THE NODE IS, not what it is tagged. The tag used to win here, so every
          // <Argument> that carried one — all 13 in the reference maps — arrived at the renderer
          // indistinguishable from a plain statement, and the language's central distinction
          // could not be drawn because it had already been thrown away. The tag is not lost: it
          // is `facet`, right below, which is what the chips and the colour actually read.
          kind: n.type === "argument-map-node" ? "argument" : "statement",
          facet: tag,
          color: n.color || null,
          fidelity: fidelityOf(n.title),
          warrant: warrantOf(n.title),
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
  const ruleOfStep = new Map();       // argument title -> Map(step index -> {rule, uses})
  const lineOfPremise = new Map();    // argument title -> Map(premise title -> line number)
  const pcsOf = new Map();            // argument title -> { conclusion, members }
  for (const [title, a] of Object.entries(res.arguments || {})) {
    const pcs = a.pcs || [];
    if (!pcs.length) continue;
    const where = new Map();
    let step = 0, run = [];
    /* ONE WALK, THREE ANSWERS.
     *
     * This loop used to run for its effect on `where` alone, and a second pass below asked the
     * same list for the main conclusion. The STRUCTURE that list describes -- the numbering, the
     * order, the premise/conclusion roles, and the rule each step names -- was read and thrown
     * away both times. It was the largest thing missing from the map and it was never missing
     * from the parse. The walk now builds `lines` as well, and the two older answers fall out of
     * the same pass rather than costing another.
     */
    /* THE WORDS OF A LINE, which are not always on the line.
     *
     * A conclusion can be written as a bare REFERENCE -- `(3) [Causal link]` in Argdown's own
     * `censorship.argdown` -- carrying a title and no text at all. Drawn literally that is a row
     * reading "(3)" and nothing else, which looks like the renderer failed rather than like the
     * reference it is. The words are at the statement's own definition, elsewhere in the file,
     * and `res.statements` is indexed by exactly that title.
     *
     * The title is the last resort: a statement referred to but never defined has no words
     * anywhere, and its name is the most that can honestly be shown.
     */
    const wordsOf = (q) => {
      let t = (q.text || "").trim();
      if (!t && q.title) {
        const rec = res.statements && res.statements[q.title];
        for (const m of (rec && rec.members) || [])
          if (m.text && String(m.text).trim()) { t = String(m.text).trim(); break; }
        if (!t) t = q.title;
      }
      return stripMentionMarkup(t);
    };
    const lines = [];
    for (let i = 0; i < pcs.length; i++) {
      const p = pcs[i], inf = p.inference;
      lines.push({
        // THE NUMBER AS WRITTEN, never anything derived. A reader checking the map against the
        // file needs (4) to mean the line the file calls (4) -- the renderer draws every line
        // (boxed claims as bracketed references) and repeats these numbers on the edges, so a
        // number invented here would disagree with the file in three places at once.
        n: i + 1,
        role: p.role,
        title: p.title || null,
        text: wordsOf(p),
        step,
        // THE RULE THAT LICENSES THIS STEP, and the premises it declares it uses. Both hang off
        // the CONCLUSION's `inference` in Argdown's model -- an inference belongs to the line
        // that closes a step, not to the premises that feed it -- which is why they are read
        // here and not from the premises above.
        rule: inf && inf.inferenceRules && inf.inferenceRules.length
                ? inf.inferenceRules.join(", ") : null,
        uses: inf && inf.data && Array.isArray(inf.data.uses) ? inf.data.uses.slice() : null,
        // THE FORMALIZATION, carried so the step can be decided. Only a step that NAMES a rule
        // is ever decided -- see `docs/VALIDITY-PLAN.md` -- so on the overwhelming majority of
        // maps this is null on every line and costs nothing.
        form: (p.data && typeof p.data.formalization === "string" ? p.data.formalization : null)
              || (p.title ? formalizationOf(p.title) : null),
        // Filled in below, once every line of the step is known. Declared here so the shape of
        // a line is stated in one place rather than grown by assignment.
        verdict: /** @type {any} */ (null)
      });
      if (p.role === "premise") run.push(p.title);
      else { for (const t of run) where.set(t, step); run = []; step++; }
    }
    for (const t of run) where.set(t, step);          // a PCS with no closing conclusion

    /* WHAT THE FILE DECLARES BEATS WHERE THE LINE SITS.
     *
     * The walk above reads a step's inputs off the ORDER of the structure: every run of
     * premises ending at a conclusion is one step. That is an inference, and until a file says
     * otherwise it is the only thing available. But `-- {uses: [1,2]} --` says outright which
     * lines a step draws on, and a step may legitimately reach back past the run it sits in --
     * a later step using premise (2) again, or skipping one that belongs to a sibling step.
     *
     * The bar the renderer draws asserts that the claims gathered onto it stand or fall
     * together, so it must follow the declaration rather than the layout. Position still fills
     * in every premise no declaration names: a `uses` list that forgets a line must not make
     * that line vanish from the map, because a claim dropping silently out of a step is exactly
     * the failure the bar was introduced to prevent. `check_argdown.py` reports the divergence
     * instead, which is where a disagreement between the file and its own shape belongs.
     */
    const titleOfLine = new Map();
    for (const l of lines) if (l.role === "premise" && l.title) titleOfLine.set(l.n, l.title);
    for (const l of lines) {
      if (!l.uses) continue;
      for (const u of l.uses) {
        const t = titleOfLine.get(Number(u));       // `uses: [1,2]` and `from: ["1","2"]` alike
        if (t != null) where.set(t, l.step);
      }
    }
    stepOfPremise.set(title, where);
    stepCount.set(title, step);
    // THE LINE NUMBER, INDEXED BY PREMISE TITLE, so the edge a boxed premise arrives on can
    // carry the number of the line it is. The box lists the whole structure and the arrows are
    // its lines; without the number on the arrow the reader pairs them up by matching titles,
    // which is the work the numbering exists to spare. First occurrence wins where a statement
    // is reused across steps -- one edge cannot carry two numbers, and the first is where the
    // reader meets it.
    const lineNo = new Map();
    for (const l of lines)
      if (l.role === "premise" && l.title && !lineNo.has(l.title)) lineNo.set(l.title, l.n);
    lineOfPremise.set(title, lineNo);
    // THE RULE, INDEXED BY THE STEP IT LICENSES, so the bar that gathers a step's premises can
    // name it. The rule is written on the conclusion's line, but what it describes is the whole
    // step -- and the step is the thing the reader sees, as a bar with several lines meeting it.
    /* DOES THE STEP KEEP THE WORD ITS RULE NAME GIVES?
     *
     * `-- Modus ponens --` asserts the conclusion follows. `ArgdownValidity` decides it, and
     * the bar says which of four things is true: decided and sound, decided and NOT sound,
     * claimed but with nothing to check it against, or no claim made at all. The fourth is
     * every step in every map that names no rule, and it draws exactly as it always has.
     *
     * The API is looked up rather than imported: in the page it is the inlined classic script,
     * in Node it is a `require` the caller has already done. Absent, every step is simply
     * undecided, which is the same as it was before this existed.
     */
    const V = (typeof globalThis !== "undefined" && globalThis.ArgdownValidity) || null;
    const verdictOf = (l) => {
      if (!l.rule) return null;
      const inputs = l.uses ? l.uses.map(Number)
                            : lines.filter(x => x.step === l.step && x.role === "premise")
                                   .map(x => x.n)
                                   .concat(l.step > 0 ? lines.filter(x => x.step === l.step - 1 &&
                                                                     x.role !== "premise")
                                                             .map(x => x.n) : []);
      const byN = new Map(lines.map(x => [x.n, x]));
      const prem = inputs.map(n => byN.get(n) && byN.get(n).form);
      if (!V || !l.form || prem.some(f => !f)) return { state: "unformalized" };

      /* STALE BEFORE VALID. Asked of every line of the step, and it outranks the verdict: a step
       * whose claims have been edited since they were formalized has not been checked, whatever
       * the formulas say about each other. */
      if (typeof V.stamp === "function") {
        const lines2 = inputs.concat([l.n]);
        for (const n2 of lines2) {
          const x = byN.get(n2);
          if (!x || !x.title) continue;
          const { text, was } = stampedTextOf(x.title);
          if (was && text != null && V.stamp(text) !== was)
            return { state: "stale", claim: x.title };
        }
      }

      const r = V.checkStep(prem, l.form);
      if (!r.supported) return { state: "undecided", why: r.error };
      return r.valid ? { state: "valid" }
                     : { state: "invalid", countermodel: r.countermodel };
    };
    // Decided ONCE per step and hung on the line, because the rule name is drawn twice -- beside
    // the join bar when the premises have boxes of their own, and on the inference line inside
    // the argument's box when they do not. Both readings must say the same thing.
    for (const l of lines) if (l.rule) l.verdict = verdictOf(l);
    ruleOfStep.set(title, new Map(lines.filter(l => l.rule || l.uses)
                                       .map(l => [l.step, { rule: l.rule, uses: l.uses,
                                                            verdict: l.verdict || null }])));
    // WHERE THE ARGUMENT LANDS, carried so that `argdown-positions` can place it in the
    // manuscript. An <Argument> has no words of its own, so nothing locates it: across this
    // corpus every argument either dropped out of the exposition view into an unnamed band or
    // was placed by matching the reconstructor's own summary prose against the source, which is
    // a guess about a paraphrase. Its MAIN CONCLUSION has words, and an argument is made where
    // it lands.
    //
    // Not the earliest premise, which was the other candidate: two arguments here borrow a
    // definition from an earlier section, and anchoring to the earliest member files them under
    // that section rather than the one they are argued in. Not the LAST member either — that
    // reads well until you notice it puts every argument after every premise BY CONSTRUCTION,
    // which manufactures the very thing `argdown-exposition` measures.
    //
    // The text and the quotation travel beside the title because a conclusion written inline in
    // the premise-conclusion structure gets an auto-generated title and no map node of its own.
    // It is still a statement with words, and words are what place a claim.
    const main = [...pcs].reverse().find(p => p.role === "main-conclusion");
    pcsOf.set(title, {
      conclusion: main ? main.title : null,
      conclusionText: main ? (main.text || "").trim() : null,
      conclusionSource: main && main.data ? main.data.source || null : null,
      pcs: lines
    });
  }
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const n of nodes) if (stepCount.has(n.label)) n.steps = stepCount.get(n.label);
  /* WHICH LINES OF THE STRUCTURE ALREADY HAVE A BOX OF THEIR OWN.
   *
   * A titled premise is selected into the map and arrives at its argument as an arrow. An
   * UNTITLED one is not selected at all, and under Argdown's default
   * `statementSelectionMode: with-title` it becomes nothing whatever -- no node, no arrow, no
   * trace. So an argument standing on five premises of which one is bracketed drew with exactly
   * ONE arrow into it, and the map said the argument had one reason. It had five. Argdown's own
   * `greenspan.argdown` is worse: <Turnover Argument> has five premises and NONE of them is
   * bracketed, so the argument arrived as a lone box carrying its prose description and the
   * whole structure was invisible.
   *
   * That is a map asserting something false rather than a map keeping quiet, which is why it
   * ranks above the rest of the premise-conclusion work. The renderer draws the lines that have
   * no box, so the structure is complete on screen and no claim is drawn twice; `drawn` is how
   * it tells the two apart.
   */
  const drawnTitles = new Set(nodes.filter(n => n.kind === "statement").map(n => n.label));
  for (const [, rec] of pcsOf)
    for (const l of rec.pcs) l.drawn = l.title != null && drawnTitles.has(l.title);
  for (const n of nodes) if (pcsOf.has(n.label)) Object.assign(n, pcsOf.get(n.label));

  for (const e of res.map.edges || []) {
    if (!e.from || !e.to) continue;
    const edge = { from: e.from.id, to: e.to.id, type: e.relationType || "support" };
    const target = byId.get(e.to.id), source = byId.get(e.from.id);
    if (edge.type === "support" && target && source && stepOfPremise.has(target.label)) {
      const k = stepOfPremise.get(target.label).get(source.label);
      if (k != null) {
        edge.step = k;
        const ln = (lineOfPremise.get(target.label) || new Map()).get(source.label);
        if (ln != null) edge.line = ln;
        // Carried on the EDGE because that is what the renderer has in hand when it plans the
        // bars: `planJoins` groups the arrivals by target and step, and would otherwise have to
        // find its way back to the argument's own record to ask what licenses the step.
        const inf = (ruleOfStep.get(target.label) || new Map()).get(k);
        if (inf && inf.rule) edge.rule = inf.rule;
        if (inf && inf.uses) edge.uses = inf.uses;
        if (inf && inf.verdict) {
          edge.validity = inf.verdict.state;
          if (inf.verdict.countermodel) edge.countermodel = inf.verdict.countermodel;
          if (inf.verdict.why) edge.undecidedWhy = inf.verdict.why;
        }
      }
    }
    // THE MAIN CONCLUSION'S NUMBER, on the edge Argdown itself made. The arrow from an
    // argument to its concluded statement is a line of the structure leaving the box, exactly
    // as a premise's arrow is a line arriving -- so it is numbered the same way, at the
    // argument's end. Guarded to statement targets: when a conclusion is unselected Argdown
    // wires the argument straight to the arguments it feeds, and those edges are no line of
    // anything.
    if (edge.type === "support" && source && target && target.kind === "statement" &&
        pcsOf.has(source.label) && source.kind === "argument" &&
        pcsOf.get(source.label).conclusion === target.label) {
      const main = [...pcsOf.get(source.label).pcs].reverse()
        .find(l => l.role === "main-conclusion");
      if (main) edge.line = main.n;
    }
    edges.push(edge);
  }

  /* A TITLED INTERMEDIARY CONCLUSION IS WIRED TO THE ARGUMENT THAT CONCLUDES IT.
   *
   * Argdown's map maker connects an argument to a statement node in exactly two cases: the
   * statement is the argument's LAST pcs line (the main conclusion), or the statement is a
   * PREMISE of it. An intermediary conclusion is neither, so when one carries a title that is
   * selected into the map it arrived with no edge in either direction: on the Cribb map,
   * <Master Argument> concludes [Deliberation Is Indispensable] at its first step, and the
   * drawn map never said so -- the claim floated beside the argument, held up by its OTHER
   * supporters, while the argument concluding it stood unconnected. Six arguments on that one
   * map, and the book's central inference among them.
   *
   * The edge is synthesised here, argument to statement, exactly as Argdown draws the main
   * conclusion -- because that is what an intermediary conclusion is: a conclusion, reached
   * part-way. `concludes` carries the step so a renderer can tell it from a relation the file
   * wrote. The step's REUSE of the conclusion further down the structure is deliberately not
   * an edge back in: a two-cycle between a claim and its own argument is dagre bait, and the
   * reference row the renderer now draws in the box (see pcsRows) is where that reading lives.
   */
  const stmtIdByLabel = new Map(nodes.filter(n => n.kind === "statement")
                                     .map(n => [n.label, n.id]));
  const supported = new Set(edges.filter(e => e.type === "support")
                                 .map(e => e.from + ">" + e.to));
  for (const n of nodes) {
    if (n.kind !== "argument" || !pcsOf.has(n.label)) continue;
    for (const l of pcsOf.get(n.label).pcs) {
      if (l.role !== "intermediary-conclusion" || !l.drawn) continue;
      const sid = stmtIdByLabel.get(l.title);
      if (sid == null || sid === n.id || supported.has(n.id + ">" + sid)) continue;
      supported.add(n.id + ">" + sid);
      edges.push({ from: n.id, to: sid, type: "support", concludes: l.step, line: l.n });
    }
  }
  return { nodes, groups, edges,
           // The map's own declaration about the TEXT it reads (front matter
           // `text-provenance:`), carried to the page so the reader meets it beside the
           // title. `generated` is the documented value; any other declared value travels
           // verbatim, because dropping a declaration silently is exactly what this field
           // exists to prevent.
           textProvenance: (res.frontMatter && res.frontMatter["text-provenance"]) || null,
           // The front matter's own default chapter, so a claim the page writes (the
           // Quote-this-passage gesture) can obey "declare it once": it cites a chapter
           // explicitly only where the default does not already say it.
           defaultChapter: defaults.chapter || null };
}

/** The process chain and settings every host must use, so a file maps identically everywhere.
 *  `removeTagsFromText` matters: tags drive the facet chips and the node colour, and must not
 *  also be left sitting in the visible label.
 *
 *  FRESH EVERY TIME, and that is not a style choice. Every caller spreads this into a request
 *  --- `argdown.run({ input, ...RUN })` --- and a spread is a SHALLOW copy, so `model` was one
 *  object shared by every parse in the process. Argdown merges a file's own front matter into
 *  the request's `model`, so parsing a single file carrying
 *
 *      ===
 *      model:
 *          mode: strict
 *      ===
 *
 *  wrote `mode: strict` into this object and left it there. Every LATER parse in the same
 *  process then ran strict without asking: `+` comes back as `entails` and `-` as `contrary`
 *  instead of `support` and `attack`, so the map redraws its relations for a file that never
 *  requested it. Nothing is logged and nothing fails.
 *
 *  It reaches further than one map. `rebuild_viewers.mjs` builds every viewer in one process,
 *  so one strict file would have silently built all the ones after it strict; the editor
 *  re-parses on every pause in typing, where the setting would survive until the page reloaded.
 *
 *  Defining the two mutable members as getters means the spread invokes them and each request
 *  gets its own array and its own `model`. Call sites are unchanged. */
export const RUN = {
  get process() { return ["parse-input", "build-model", "build-map", "export-json"]; },
  get model() { return { removeTagsFromText: true }; },
  logLevel: "error"
};

/* NOTE: there is deliberately no `buildGraph` here that imports @argdown/node.
 * esbuild follows even a dynamic import when bundling, and @argdown/node's plugins pull in
 * fs/path/util -- which fails the browser build with 60 unresolved-builtin errors. Callers that
 * have Node available import the parser themselves and pass the response to toGraph. */
