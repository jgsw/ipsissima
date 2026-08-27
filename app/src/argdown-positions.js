/* argdown-positions.js — where in the manuscript each claim comes from.
 *
 * The exposition-ordered view needs one number per claim: its position in the text. This
 * computes it, and is the JS half of a pair — `argdown_provenance.py` computes the same
 * positions for the report that `check_argdown.py --source-root` prints. The two MUST agree,
 * or the report says one thing and the picture shows another; `test_argdown_positions.js`
 * cross-checks them against the real book and fails on any disagreement.
 *
 * WHY A PARAGRAPH SEARCH. Section metadata is far too coarse to be an axis. On the book map
 * 324 of 339 claims resolved to their section heading, which put 336 claims at 94 distinct
 * positions, stacked 19 of them on one, and left 154 of 265 support edges with both ends at
 * the same point — drawn as stubs. Scoring each PARAGRAPH of the claim's section against the
 * claim's own words takes that to 268 positions, a worst pile-up of 4, and 29 collapsed edges.
 *
 * TWO CONSTRAINTS MAKE IT SAFE RATHER THAN CLEVER:
 *   * The search is confined to the claim's OWN section. The author said which section a claim
 *     belongs to; this only asks where in it. So it can refine a position but never contradict
 *     the metadata, and never move a claim out of the cluster the map draws it in.
 *   * Nothing is written back. A stored line number is an assertion about a manuscript still
 *     being edited, and goes quietly wrong the first time a paragraph moves — the exact failure
 *     this strand exists to prevent. Positions are recomputed on every run.
 *
 * Classic script, no build step: sets window.ArgdownPositions and exports for Node, so the
 * in-browser hosts and the viewer build can share one implementation.
 */
/** @param {any} global */
(function (global) {
"use strict";

var MIN_SCORE = 0.30;
var MIN_PARA  = 120;   // characters; shorter lines are headings, list stubs and stray notes

/* Four letters and up drops the articles and prepositions any two sentences of English share;
 * the list then catches the long function words that survive that cut. */
var STOP = new Set(("the a an of and or to in is are be that this it as for with on by not but " +
  "its which what who whom whose can could would should may might must will shall do does did " +
  "have has had from at than then so if we our they their them there here about into over " +
  "under more most less least such no nor only own same too very just also one two both each " +
  "any all some other others being been was were").split(" "));

function contentWords(text) {
  var out = [], m = String(text || "").toLowerCase().match(/[a-z]{4,}/g) || [];
  for (var i = 0; i < m.length; i++) if (!STOP.has(m[i])) out.push(m[i]);
  return out;
}

/** Every markdown heading in a source file: line, level and text, in document order. */
function headingIndex(text) {
  var lines = String(text || "").split("\n"), out = [];
  for (var i = 0; i < lines.length; i++) {
    var mo = /^(#{1,6})\s+(.*?)\s*(?:\{.*\})?\s*$/.exec(lines[i]);
    if (mo) out.push({ line: i + 1, level: mo[1].length, text: mo[2].trim() });
  }
  return out;
}

/** The line range of a named section: its heading, to the next heading of the same or higher
 *  level. Subsections stay inside their parent, which is what a claim tagged with the parent
 *  should be searched against. */
function sectionSpan(headings, section, totalLines) {
  for (var i = 0; i < headings.length; i++) {
    if (headings[i].text !== section) continue;
    var end = totalLines;
    for (var j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= headings[i].level) { end = headings[j].line - 1; break; }
    }
    return [headings[i].line, end];
  }
  return null;
}

/** Which heading level divides this text into bands — the shallowest level with MORE THAN ONE
 *  heading at it, or 0 when nothing divides it.
 *
 *  WHY NOT SIMPLY LEVEL 1, which is what this used to be. The two converters disagree:
 *  `pdf_to_source.py` writes a paper's sections as `#`, and `html_to_source.py` writes the
 *  article title as `#` and its sections as `##`, because that is what the publisher's own
 *  markup says. So a source converted from a PDF banded correctly and the same paper converted
 *  from the publisher's HTML fell into a single band — the exposition view of a four-section
 *  paper showing one section, with nothing to say why.
 *
 *  MORE THAN ONE, because a single heading is not a division. An HTML-derived source has exactly
 *  one `#` — the title — and banding on it puts the whole paper in one band, which is the same
 *  failure wearing a different number.
 */
function bandLevel(headings) {
  var count = {};
  for (var i = 0; i < headings.length; i++)
    count[headings[i].level] = (count[headings[i].level] || 0) + 1;
  var levels = Object.keys(count).map(Number).sort(function (a, b) { return a - b; });
  for (var j = 0; j < levels.length; j++) if (count[levels[j]] > 1) return levels[j];
  return 0;
}

/** The heading a line falls under — the last heading at or above it. Null before the first one.
 *
 *  WHY THIS IS DERIVED AND NOT READ. The band a claim sits in, in the exposition view, is a FACT
 *  ABOUT WHERE ITS LINE IS, and until now it was taken from the `section:` the reconstructor
 *  happened to write. The house rule says to write `section:` only when a claim has no
 *  quotation — because a verified quotation already pins the exact line — and that rule is right
 *  about LOCATING a claim and wrong about BANDING it. A map that quoted 80 of its 82 claims
 *  therefore declared no sections at all, and every claim fell into one undifferentiated band:
 *  the exposition view of a four-section paper showed one section.
 *
 *  Deriving it fixes that for every claim that can be placed at all, needs no metadata, and
 *  cannot disagree with the text. `section:` goes back to being what it is useful as — a hint
 *  that scopes the paragraph search — rather than something the view depends on.
 */
function sectionOfLine(headings, line) {
  var lvl = bandLevel(headings);
  if (!lvl) return null;
  var found = null;
  for (var i = 0; i < headings.length; i++) {
    if (headings[i].line > line) break;
    if (headings[i].level === lvl) found = headings[i];
  }
  return found ? found.text : null;
}

/** The line of the paragraph in lines[lo-1..hi-1] that best matches the claim.
 *  Ties go to the earliest, so a claim restated later is placed where it is first made. */
function locateParagraph(claimText, lines, lo, hi) {
  var want = Object.create(null), total = 0, w;
  var cw = contentWords(claimText);
  for (var i = 0; i < cw.length; i++) { w = cw[i]; want[w] = (want[w] || 0) + 1; total++; }
  if (!total) return { line: null, score: 0 };
  var best = 0, bestLine = null;
  for (var n = Math.max(1, lo); n <= Math.min(hi, lines.length); n++) {
    var raw = String(lines[n - 1]).trim();
    if (raw.length < MIN_PARA || raw.charAt(0) === "#") continue;
    var have = new Set(contentWords(raw)), score = 0;
    for (w in want) if (have.has(w)) score += want[w];
    score /= total;
    if (score > best) { best = score; bestLine = n; }
  }
  return best >= MIN_SCORE ? { line: bestLine, score: best } : { line: null, score: best };
}

/* ------------------------------------------------------------------ quotations
 *
 * A located quotation gives a claim an EXACT line, which beats any paragraph match. Only the
 * "found it" case is ported from argdown_provenance.py: a quotation that has drifted, or is
 * absent, yields no line either way, and diagnosing WHICH of those it is belongs to the
 * checker's report rather than to a layout.
 */

var MIN_QUOTE = 10;
var QUOTED = /[“”"«]([^“”"»]{10,})[“”"»]/g;
var SUBS = { "‘": "'", "’": "'", "“": '"', "”": '"', "«": '"',
             "»": '"', "–": "-", "—": "-", "…": "...", " ": " " };
var INVISIBLE = "*_`\\";

/** Fold the differences that do not matter, and remember where each character came from, so a
 *  match can be turned back into a line number. Mirrors normalise() in argdown_provenance.py:
 *  whitespace runs collapse to one space, smart quotes/dashes/ellipses fold, and markdown
 *  emphasis is dropped — that last one because a manuscript's _obscure_ is quoted as the bare
 *  word, and treating the underscores as content turns a faithful quotation into a near miss. */
function normalise(text) {
  var out = [], lines = [], line = 1, prevSpace = false, s = String(text || "");
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (ch === "\n") line++;
    if (INVISIBLE.indexOf(ch) >= 0) continue;
    var rep = SUBS[ch] != null ? SUBS[ch] : ch;
    if (ch === "\n" || /\s/.test(rep)) {
      if (prevSpace) continue;
      out.push(" "); lines.push(line); prevSpace = true;
      continue;
    }
    prevSpace = false;
    for (var j = 0; j < rep.length; j++) { out.push(rep[j]); lines.push(line); }
  }
  return { text: out.join(""), lineOf: lines };
}

/** Split a quotation on elision and drop a trailing ellipsis. Both halves of "A ... B" must
 *  appear, in order, but not adjacently. */
function quoteParts(quote) {
  var q = normalise(quote).text.trim().replace(/\.{3,}\s*$/, "").trim();
  var parts = q.split(/\s*\.{3,}\s*/);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (p.length >= 4) out.push(p);
  }
  return out;
}

/** The line a quotation starts on, or null if it is not there verbatim. */
function findQuote(quote, sourceText) {
  var parts = quoteParts(quote);
  if (!parts.length) return null;
  var n = normalise(sourceText), hay = n.text.toLowerCase();
  var pos = 0, first = null;
  for (var i = 0; i < parts.length; i++) {
    var idx = hay.indexOf(parts[i].toLowerCase(), pos);
    if (idx < 0) return null;
    if (first === null) first = n.lineOf[idx];
    pos = idx + parts[i].length;
  }
  return first;
}

/** The earliest line at which any quotation this claim carries can be found in its chapter.
 *  Both places a quotation lives are searched: the statement's own text, and the `source:`
 *  metadata where a reconstruction usually parks the author's exact words. */
function locateQuotation(node, chapterText) {
  var best = null;
  var blobs = [node.detail, node.source];
  for (var b = 0; b < blobs.length; b++) {
    if (!blobs[b]) continue;
    QUOTED.lastIndex = 0;
    var mo;
    while ((mo = QUOTED.exec(String(blobs[b]))) !== null) {
      var line = findQuote(mo[1], chapterText);
      if (line != null && (best === null || line < best)) best = line;
    }
  }
  return best;
}

/** The manuscript's own chapter order, from _quarto.yml.
 *  Authoritative: file paths sort alphabetically, which is not reading order. */
/** The ordered source files in a project file, Quarto's shape or the native one.
 *
 *  Twin of `parse_project` in argdown_provenance.py — one rule in two languages, which
 *  test_argdown_positions.mjs exists to keep in step. Quoting is optional: the old reader
 *  required it and silently returned NOTHING for a file written without quotes, which is how
 *  most people write YAML.
 */
function readingOrder(projectText) {
  var lines = String(projectText || "").split("\n"), out = [], depth = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    var indent = line.length - line.replace(/^\s*/, "").length;
    if (/^\s*chapters:\s*$/.test(line)) { if (depth === null) depth = indent; continue; }
    // Any key at or outside the list's own indent ends it — with a value or without.
    if (depth !== null && indent <= depth && /^\s*[\w-]+\s*:/.test(line)
        && !/^\s*chapters\s*:/.test(line)) { depth = null; continue; }
    if (/^\s*-\s*part:\s*/.test(line)) continue;
    var mo = /^\s*-\s*["']?([^"'#]+?\.(?:md|qmd|markdown|txt))["']?\s*$/.exec(line);
    if (mo && depth !== null) out.push(mo[1].trim());
  }
  return out;
}

/** Positions for a whole graph.
 *
 *   nodes    [{ id, detail, chapter, section, line }]   detail = the claim's own text
 *   sources  { "<chapter path>": "<file contents>" }
 *   quarto   the text of _quarto.yml
 *
 * Returns { byId, order } where byId[id] = { chapter, chapterIndex, line, precision, inBook }.
 * Precision, best first: `declared` (a hand-written {line: N}), `paragraph`, `heading`,
 * `chapter-only`. Claims citing a file the book does not list are placed after everything and
 * flagged, because a claim sourced outside the manuscript is worth noticing on its own account.
 */
function positions(nodes, sources, quarto) {
  var order = readingOrder(quarto);
  var index = Object.create(null);
  for (var i = 0; i < order.length; i++) index[order[i]] = i;

  var lineCache = Object.create(null), headCache = Object.create(null);
  function linesOf(ch) {
    if (!(ch in lineCache)) lineCache[ch] = sources && sources[ch] != null
      ? String(sources[ch]).split("\n") : null;
    return lineCache[ch];
  }
  function headsOf(ch) {
    if (!(ch in headCache)) headCache[ch] = sources && sources[ch] != null
      ? headingIndex(sources[ch]) : [];
    return headCache[ch];
  }

  var byId = Object.create(null);
  for (var k = 0; k < nodes.length; k++) {
    var n = nodes[k];
    if (!n.chapter) continue;
    var place = { chapter: n.chapter, line: null, precision: "chapter-only",
                  chapterIndex: (n.chapter in index) ? index[n.chapter] : order.length,
                  inBook: n.chapter in index };
    var quoted = sources && sources[n.chapter] != null
      ? locateQuotation(n, sources[n.chapter]) : null;
    if (quoted != null) {
      place.line = quoted;
      place.precision = "quotation";
    } else if (n.line) {
      place.line = +n.line;
      place.precision = n.lineSource || "declared";
    } else if (n.section && linesOf(n.chapter)) {
      var span = sectionSpan(headsOf(n.chapter), n.section, linesOf(n.chapter).length);
      if (span) {
        var hit = locateParagraph(n.detail, linesOf(n.chapter), span[0] + 1, span[1]);
        if (hit.line) { place.line = hit.line; place.precision = "paragraph"; }
        else          { place.line = span[0];  place.precision = "heading"; }
      }
    }
    // WHOLE-FILE FALLBACK. Sources are byte-faithful now, so a paper printed as continuous
    // prose has no section to scope by, and without this every such claim sits at
    // `chapter-only` — no position at all. The twin of the same block in
    // argdown_provenance.resolve_lines; test_argdown_positions.mjs compares them on the real
    // book and fails on any disagreement.
    var all = linesOf(n.chapter);
    if (place.line == null && all && all.length) {
      var wide = locateParagraph(n.detail, all, 1, all.length);
      if (wide.line) { place.line = wide.line; place.precision = "paragraph"; }
    }
    // The band, derived from wherever the line landed. The claim's own `section:` is preferred
    // when it has one — the author said which section it belongs to, and that beats a guess from
    // a line that may have been matched loosely.
    place.section = n.section
      || (place.line != null ? sectionOfLine(headsOf(n.chapter), place.line) : null)
      || null;
    byId[n.id] = place;
  }
  return { byId: byId, order: order };
}

/** Word counts for a manuscript: the whole of it, each file, and each top-level section.
 *
 *  THE ONE DEFINITION, because two callers need it and they must agree — the Node builder, which
 *  bakes the counts into a per-file viewer, and the standalone viewer, which computes them in
 *  the page from dropped files. It lives here rather than in either because this module is
 *  already the one place that knows how a manuscript is cut into files and headings.
 *
 *  What counts as a word is the plain-prose reading, which is what an author means by "how long
 *  is this chapter": whitespace-separated runs containing a letter or a digit, with the fenced
 *  code blocks, the YAML front matter and the heading lines themselves left out. Markdown marks
 *  (`*`, `_`, `#`) do not make or break a word, and a bare `---` or `|` is not one.
 *
 *    sources  { "path/to/chapter.md": "text" | null }
 *    -> { total, byChapter: {path: n}, bySection: {path: {heading: n}} }
 */
function wordCounts(sources) {
  var byChapter = {}, bySection = {}, total = 0;
  for (var ch in sources) {
    if (!Object.prototype.hasOwnProperty.call(sources, ch) || !sources[ch]) continue;
    var lines = String(sources[ch]).split("\n");
    var heads = headingIndex(sources[ch]).filter(function (h) { return h.level === 1; });
    var here = {}, sum = 0, current = null, fence = false, front = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], trimmed = line.trim();
      // Front matter only counts as front matter at the very top of the file; a `---` further
      // down is a horizontal rule and closes nothing.
      if (i === 0 && trimmed === "---") { front = true; continue; }
      if (front) { if (trimmed === "---" || trimmed === "...") front = false; continue; }
      if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
      if (fence) continue;
      var h = null;
      for (var k = 0; k < heads.length; k++) if (heads[k].line === i + 1) h = heads[k].text;
      if (h != null) { current = h; if (!(h in here)) here[h] = 0; continue; }
      if (/^#{1,6}\s/.test(trimmed)) continue;          // a sub-heading is not prose either
      var words = trimmed.split(/\s+/).filter(function (w) { return /[A-Za-z0-9]/.test(w); }).length;
      sum += words;
      if (current != null) here[current] += words;
    }
    byChapter[ch] = sum;
    bySection[ch] = here;
    total += sum;
  }
  return { total: total, byChapter: byChapter, bySection: bySection };
}

var API = { positions: positions, readingOrder: readingOrder, headingIndex: headingIndex,
            wordCounts: wordCounts,
            sectionSpan: sectionSpan, locateParagraph: locateParagraph,
            bandLevel: bandLevel, sectionOfLine: sectionOfLine,
            contentWords: contentWords, normalise: normalise, findQuote: findQuote,
            MIN_SCORE: MIN_SCORE, MIN_PARA: MIN_PARA };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownPositions = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
