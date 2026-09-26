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
var MIN_VERBATIM = 30; // mirrors argdown_provenance.MIN_VERBATIM — below it, no verdict

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

/* ------------------------------------------------------------------ bands
 *
 * HOW A TEXT IS DIVIDED FOR THE EXPOSITION VIEW, in one place: its bands, the line each starts
 * on, and the prose each holds. Everything else — the band a claim is filed in, the word count
 * on a band, the empty bands drawn for sections with nothing mapped — reads it from here.
 */

/** The prose words on each line of a source: 0 for the front matter, the converter's HTML
 *  comments, fenced code and headings, which are not the author's prose. One count, so the
 *  word counts drawn on the bands and the counts that decide which headings divide the text
 *  cannot disagree. Index 0 is line 1. */
function proseWords(lines) {
  var out = new Array(lines.length), fence = false, front = false, comment = false;
  for (var i = 0; i < lines.length; i++) {
    var line = String(lines[i]), trimmed = line.trim();
    out[i] = 0;
    // Front matter only counts as front matter at the very top of the file; a `---` further
    // down is a horizontal rule and closes nothing.
    if (i === 0 && trimmed === "---") { front = true; continue; }
    if (front) { if (trimmed === "---" || trimmed === "...") front = false; continue; }
    // THE CONVERTER'S NOTES ARE NOT THE TEXT. Every converted source opens with a comment
    // block saying where it came from and what was repaired — a few hundred words, counted
    // until 26 Sep 2026 as the author's.
    if (comment) { if (trimmed.indexOf("-->") >= 0) comment = false; continue; }
    if (trimmed.indexOf("<!--") === 0) { if (trimmed.indexOf("-->") < 0) comment = true; continue; }
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence || /^#{1,6}\s/.test(trimmed)) continue;
    out[i] = trimmed.split(/\s+/).filter(function (w) { return /[A-Za-z0-9]/.test(w); }).length;
  }
  return out;
}

/** Headings that close a text rather than divide it: references, notes, funding, and the
 *  furniture the SEP and Project Gutenberg append. They never decide how a text is banded, and
 *  a band of theirs with nothing mapped in it is not a gap in the reconstruction. */
var BACK_MATTER = new RegExp("^(references|bibliography|works cited|notes|footnotes|endnotes|" +
  "funding|acknowledg|appendix|conflicts? of interest|competing interests|author contributions|" +
  "data availability|declarations?|academic tools|other internet resources|related entries|" +
  "(the )?(full )?project gutenberg)", "i");
function isBackMatter(heading) { return BACK_MATTER.test(String(heading || "")); }

/** A heading that is nothing but a link is a web page's navigation — "[Environment](https://…)"
 *  over a news story — and never a section of the text. */
var LINK_ONLY = /^\[[^\]]*\]\([^)]*\)$/;

/** Below this many words of prose, a heading divides nothing: a title page's "ESSAYS", a judge's
 *  name set as a heading, a heading the converter broke across two lines. */
var MIN_BAND_WORDS = 50;

/** The page each printed page begins at: [{ line, page }], from the converters' own markers —
 *  `<!-- p.514 begins here -->`, or `<!-- Ethics p.514 begins here -->` in a volume. The number
 *  is READ OFF THE SHEET rather than counted, so it is the number a reader would cite. The
 *  viewer's Manuscript pane hangs these in its margin and asks this function for them, so the
 *  page numbers there and the page bands in the exposition view come from one reading. */
var PAGE_MARK = /<!--\s*(?:.*?\s)?p\.\s*(\d+)\s+begins here\s*-->/;
function pageMarks(text) {
  var out = [], lines = String(text == null ? "" : text).split("\n");
  for (var i = 0; i < lines.length; i++) {
    var m = PAGE_MARK.exec(lines[i]);
    if (m) out.push({ line: i + 1, page: m[1] });
  }
  return out;
}

var BANDS = new Map();

/** How a text is divided into bands: { level, paged, bands: [{ heading, line, back, page }] }.
 *
 *  THE SHALLOWEST LEVEL WITH MORE THAN ONE HEADING THAT DIVIDES THE TEXT. Not simply level 1:
 *  `pdf_to_source.py` writes a paper's sections as `#` and `html_to_source.py` writes the title
 *  as `#` and the sections as `##`, as the publisher's markup does. And more than one, because a
 *  single heading is not a division — an HTML source's lone `#` is its title.
 *
 *  BUT ONLY HEADINGS THAT DIVIDE. The rule used to count every heading, and title pages, web
 *  pages and licence boilerplate beat it (measured 26 Sep 2026): James's essay was banded on its
 *  book's title page, "ESSAYS" and "POPULAR PHILOSOPHY.", so its ten sections never appeared;
 *  the Miller judgment sat in one band called "Court:"; Swift's pamphlet in one called "1729"; a
 *  Gutenberg copy of it on the licence; a paper whose converter broke a heading across two lines
 *  put 5,198 of its words "before the first heading". So a heading decides the level only if the
 *  stretch it heads holds real prose (`MIN_BAND_WORDS`), it is not back matter, and it is not a
 *  bare link. Back matter still BOUNDS a band once the level is chosen — a claim in the
 *  references is in the references, not in the conclusion — but a heading with no prose under
 *  it at all bounds nothing, so a title page's heading cannot swallow the text that follows it.
 *
 *  AND WHERE NOTHING DIVIDES IT, THE PRINTED PAGES DO (`paged`). Converters no longer insert
 *  headings, so a paper printed as continuous prose — Williams, Nagel, Gettier, most of what is
 *  scanned — used to be one undivided band, the one kind of text where a reader most needs a
 *  place to stand. Its pages are marked in the source already. A band per page, named for the
 *  page ("p. 101"), which says plainly that it is the printer's division and not the author's.
 */
function bandsOf(text) {
  var key = String(text == null ? "" : text);
  var hit = BANDS.get(key);
  if (hit) return hit;
  if (BANDS.size >= SRC_CACHE_MAX) BANDS.clear();
  var lines = key.split("\n"), words = proseWords(lines), heads = headingIndex(key);
  // The prose under each heading: to the next heading of the same level or higher.
  var under = new Array(heads.length);
  for (var i = 0; i < heads.length; i++) {
    var end = lines.length;
    for (var j = i + 1; j < heads.length; j++)
      if (heads[j].level <= heads[i].level) { end = heads[j].line - 1; break; }
    var n = 0;
    for (var k = heads[i].line; k < end; k++) n += words[k];
    under[i] = n;
  }
  var count = {};
  for (var c = 0; c < heads.length; c++)
    if (under[c] >= MIN_BAND_WORDS && !isBackMatter(heads[c].text) && !LINK_ONLY.test(heads[c].text))
      count[heads[c].level] = (count[heads[c].level] || 0) + 1;
  var levels = Object.keys(count).map(Number).sort(function (a, b) { return a - b; });
  var level = 0;
  for (var l = 0; l < levels.length; l++) if (count[levels[l]] > 1) { level = levels[l]; break; }
  var bands = [];
  for (var b = 0; b < heads.length; b++) {
    var h = heads[b];
    if (level && h.level === level && under[b] > 0 && !LINK_ONLY.test(h.text))
      bands.push({ heading: h.text, line: h.line, back: isBackMatter(h.text), page: false });
  }
  var marks = level ? [] : pageMarks(key);
  var paged = !level && marks.length > 1;
  if (paged)
    for (var m = 0; m < marks.length; m++)
      bands.push({ heading: "p. " + marks[m].page, line: marks[m].line, back: false, page: true });
  hit = { level: level, paged: paged, bands: bands };
  BANDS.set(key, hit);
  return hit;
}

/** The band a line falls in — the last band starting at or above it. Null before the first one,
 *  which is the text's opening, and null throughout a text nothing divides.
 *
 *  WHY THIS IS DERIVED AND NOT READ. The band a claim sits in is a FACT ABOUT WHERE ITS LINE IS,
 *  and it used to be taken from the `section:` the reconstructor happened to write. The house
 *  rule says to write `section:` only when a claim has no quotation, and that rule is right
 *  about LOCATING a claim and wrong about BANDING it: a map that quoted 80 of its 82 claims
 *  declared no sections at all, and every claim fell into one band. Deriving it needs no
 *  metadata and cannot disagree with the text. */
function sectionAt(bands, line) {
  var found = null;
  for (var i = 0; i < bands.length; i++) {
    if (bands[i].line > line) break;
    found = bands[i];
  }
  return found ? found.heading : null;
}

/** The line of the paragraph in lines[lo-1..hi-1] that best matches the claim.
 *  Ties go to the earliest, so a claim restated later is placed where it is first made. */
/** The content words of every line of one source, tokenised ONCE.
 *
 *  THE SOURCE DOES NOT CHANGE WHILE A MAP IS BEING PLACED, but this used to be re-derived for
 *  every claim: `locateParagraph` walked the whole file and called `contentWords` plus built a
 *  `Set` on each line, once per claim. On the Wilson map that is 161 claims over about a
 *  thousand lines — 161,000 tokenisations of the same paragraphs, and it made placement 99% of
 *  the cost of opening a map: 873 ms on Wilson, 847 ms on Prescott-Couch.
 *
 *  Keyed on the array itself, which `linesOf` memoises per chapter, so one file is tokenised
 *  once however many claims cite it. `null` marks a line placement skips — too short, or a
 *  heading — so the skip test is not repeated either.
 */
var LINE_WORDS = typeof WeakMap === "function" ? new WeakMap() : null;

function lineWordSets(lines) {
  var hit = LINE_WORDS && LINE_WORDS.get(lines);
  if (hit) return hit;
  var sets = new Array(lines.length);
  for (var n = 0; n < lines.length; n++) {
    var raw = String(lines[n]).trim();
    sets[n] = (raw.length < MIN_PARA || raw.charAt(0) === "#")
      ? null : new Set(contentWords(raw));
  }
  if (LINE_WORDS) LINE_WORDS.set(lines, sets);
  return sets;
}

function locateParagraph(claimText, lines, lo, hi) {
  var want = Object.create(null), total = 0, w;
  var cw = contentWords(claimText);
  for (var i = 0; i < cw.length; i++) { w = cw[i]; want[w] = (want[w] || 0) + 1; total++; }
  if (!total) return { line: null, score: 0 };
  var sets = lineWordSets(lines);
  var best = 0, bestLine = null;
  for (var n = Math.max(1, lo); n <= Math.min(hi, lines.length); n++) {
    var have = sets[n - 1];
    if (!have) continue;
    var score = 0;
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

/** `normalise` and `foldPunctuation` applied to a whole SOURCE, remembered.
 *
 *  THE SOURCE IS THE SAME FOR EVERY CLAIM AND WAS RE-DERIVED FOR EACH ONE. `findQuote`
 *  normalised the entire chapter per quotation and `isVerbatim` folded it per claim — 68 KB
 *  walked character by character, 161 times over, on the Wilson map. Profiling put `normalise`
 *  at 44% of the run and `foldPunctuation` at a further 16%: between them, three fifths of the
 *  cost of opening any map with a manuscript behind it.
 *
 *  Keyed on the string, which is the same object each time because `positions` reads it out of
 *  its own `sources` map, so the lookup is a pointer comparison in practice. Bounded, and
 *  cleared wholesale rather than evicted one at a time: this holds at most a few chapters, and a
 *  cache that needs an eviction policy needs a test for the eviction policy.
 */
var SRC_CACHE_MAX = 8;
var NORM_SRC = new Map();
var FOLD_SRC = new Map();

function normaliseSource(text) {
  var hit = NORM_SRC.get(text);
  if (hit) return hit;
  if (NORM_SRC.size >= SRC_CACHE_MAX) NORM_SRC.clear();
  hit = normalise(text);
  NORM_SRC.set(text, hit);
  return hit;
}

function foldSource(text) {
  var hit = FOLD_SRC.get(text);
  if (hit != null) return hit;
  if (FOLD_SRC.size >= SRC_CACHE_MAX) FOLD_SRC.clear();
  hit = foldPunctuation(text);
  FOLD_SRC.set(text, hit);
  return hit;
}

/** The line a quotation starts on, or null if it is not there verbatim. */
function findQuote(quote, sourceText) {
  var parts = quoteParts(quote);
  if (!parts.length) return null;
  var n = normaliseSource(sourceText), hay = n.lower || (n.lower = n.text.toLowerCase());
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

/* ------------------------------------------------------------------ the claim's own words
 *
 * A CLAIM WHOSE TEXT IS THE AUTHOR'S WORDS IS A QUOTATION, whether or not it wears quotation
 * marks. The house style asks for exactly that — "the author's words quoted verbatim in the
 * claim's own text" — and the border already honours it: `isVerbatim` below draws such a claim
 * solid. Placement did not. `locateQuotation` looks only for QUOTED spans, so a claim written
 * as the author's sentence with no marks round it fell through to the paragraph search, where
 * ties go to the earliest paragraph. Measured 26 Sep 2026 on the Bates bulletin: 84 of 97 claims
 * placed by that fuzzy match, and the abstract — which repeats the findings word for word — took
 * six of them from the Results section that argues them.
 *
 * Found the way `isVerbatim` finds it: punctuation and case folded away, one line at a time,
 * earliest first. A sentence broken across a hard line break is not on any one line, so the exact
 * search a quotation gets follows as a fallback. Statements only: an <Argument> is placed where
 * it lands (see `positions`), and its text is the reconstructor's summary, not a passage.
 *
 * Twin of `own_words_line` in argdown_provenance.py.
 */
var FOLDED_LINES = typeof WeakMap === "function" ? new WeakMap() : null;

/** Every line of one source with punctuation and case folded away, computed once per source —
 *  the same economy as `lineWordSets`, and for the same reason.
 *
 *  ONLY THE TEXT IS SEARCHED. The YAML front matter and the converter's HTML comments come back
 *  empty, so nothing can be found in them: a converter copies the abstract into the front matter
 *  and quotes repaired sentences in its notes, and a claim found THERE is placed ahead of the
 *  very passage it came from. Measured on Bates, where the front-matter abstract took two claims
 *  before the published abstract could. The paragraph search never sees these lines either — they
 *  are hard-wrapped, and under its length threshold. */
function foldedLines(lines) {
  var hit = FOLDED_LINES && FOLDED_LINES.get(lines);
  if (hit) return hit;
  hit = new Array(lines.length);
  var front = false, comment = false;
  for (var i = 0; i < lines.length; i++) {
    var t = String(lines[i]).trim(), skip = false;
    if (i === 0 && t === "---") front = skip = true;
    else if (front) { skip = true; if (t === "---" || t === "...") front = false; }
    else if (comment) { skip = true; if (t.indexOf("-->") >= 0) comment = false; }
    else if (t.indexOf("<!--") === 0) { skip = true; if (t.indexOf("-->") < 0) comment = true; }
    hit[i] = skip ? "" : foldPunctuation(lines[i]);
  }
  if (FOLDED_LINES) FOLDED_LINES.set(lines, hit);
  return hit;
}

/** The line where a claim's own text stands in its source, or null. `text` has its inline
 *  hashtags already stripped, as for the border. */
function locateOwnWords(text, lines, chapterText) {
  if (!text || text.length < MIN_VERBATIM || !lines) return null;
  var want = foldPunctuation(text);
  if (!want) return null;
  var folded = foldedLines(lines);
  for (var i = 0; i < folded.length; i++) if (folded[i].indexOf(want) >= 0) return i + 1;
  // Across a line break, exactly — and still not in the front matter or a converter's note.
  var across = findQuote(text, chapterText);
  return across != null && folded[across - 1] ? across : null;
}

/** Where in its line a claim's words fall — a character offset in the line with punctuation and
 *  case folded away — or null when the words cannot be found there.
 *
 *  THE SOURCES ARE ONE PARAGRAPH TO A LINE, so a line is a paragraph, and every claim drawn from
 *  one paragraph shares a position. The exposition view stacked such claims by their depth in
 *  the argument, and measured 26 Sep 2026 that put two-thirds of stacks in an order the text
 *  does not use — in a view whose one job is the text's order. This is the order within the
 *  paragraph: where the claim's quotation starts, or its own words where they are the author's.
 *  A claim read from a note sits where the note's mark is. A claim placed by the paragraph
 *  search has no words to find, and gets null: the layout puts those after the ones it can
 *  place, rather than guess.
 *
 *  `texts` are the claim's own text and its `source:`, and for an <Argument> its conclusion's
 *  text and source, which is what placed it. Each quoted span is tried, then the text itself;
 *  the earliest found wins, as it does for the line. */
function colInLine(lines, line, note, texts) {
  var raw = lines[line - 1];
  if (raw == null) return null;
  raw = String(raw);
  if (note != null) {
    var mark = raw.indexOf("[^" + note + "]");
    return mark < 0 ? null : foldPunctuation(raw.slice(0, mark)).length;
  }
  var folded = foldPunctuation(raw), best = null;
  var tryText = function (t) {
    var parts = quoteParts(t);
    var probe = foldPunctuation(parts.length ? parts[0] : t).slice(0, 60);
    if (probe.length < 10) return;
    var at = folded.indexOf(probe);
    if (at >= 0 && (best === null || at < best)) best = at;
  };
  for (var i = 0; i < texts.length; i++) {
    if (!texts[i]) continue;
    var blob = String(texts[i]), mo;
    QUOTED.lastIndex = 0;
    while ((mo = QUOTED.exec(blob)) !== null) tryText(mo[1]);
    tryText(blob.replace(/(^|\s)#[A-Za-z][\w-]*/g, "$1 "));
  }
  return best;
}

/* ------------------------------------------------------------------ notes
 *
 * A NOTE IS READ WHERE ITS MARK IS. A claim quoted from a footnote used to be placed where the
 * converter had put the note — after the conclusion, under `# Notes` or `## Footnotes` — so the
 * exposition view drew it in a band of its own at the end of the paper and ran a long line back
 * to the sentence it glosses. Measured 26 Sep 2026: 27 claims across three samples (Akhlaghi 6,
 * Prescott-Couch 18, Tooming 3), every one of them traceable to the body sentence carrying its
 * mark. A reader meets a note at its mark, so that is where the claim is placed. The note's own
 * line is kept beside it (`noteLine`), so the Manuscript pane can still light the claim from the
 * note itself, and the note's label (`note`) so the pane can say where the words really are.
 *
 * TWO SHAPES OF NOTE, because the converters write two:
 *   * `[^3]: text` — Markdown's own, which `pdf_to_source.py` writes. A later paragraph of the
 *     same note is INDENTED, so the first unindented line after it ends the note.
 *   * `[[[3]]]` on a line of its own, followed by the note's paragraphs — what the HTML route
 *     writes for a publisher's footnote list. Those paragraphs are not indented, so the note
 *     runs until the next marker or the next heading.
 * The mark in the text is `[^3]` in both.
 *
 * Twin of `note_index` in argdown_provenance.py. One pass per source, remembered like the
 * paragraph words: a book's worth of claims asks the same question of the same file.
 */
var NOTE_DEF = /^\[\^([^\]\s]+)\]:/;
var NOTE_BLOCK = /^\s*\[\[\[([^\]\s]+)\]\]\]\s*$/;
var NOTE_REF = /\[\^([^\]\s]+)\](?!:)/g;
var HEADING_LINE = /^#{1,6}\s/;
var NOTES = typeof WeakMap === "function" ? new WeakMap() : null;

/** Which note each line belongs to (null for the text proper, index 0 = line 1), and the first
 *  line of the text proper that carries each note's mark. */
function notesOf(lines) {
  var hit = NOTES && NOTES.get(lines);
  if (hit) return hit;
  var noteOf = new Array(lines.length), markOf = Object.create(null);
  var current = null, markdown = false;
  for (var i = 0; i < lines.length; i++) {
    var t = String(lines[i]), m;
    if ((m = NOTE_DEF.exec(t))) { current = m[1]; markdown = true; }
    else if ((m = NOTE_BLOCK.exec(t))) { current = m[1]; markdown = false; }
    else if (HEADING_LINE.test(t)) current = null;
    else if (markdown && current != null && t.trim() && !/^\s/.test(t)) current = null;
    noteOf[i] = current;
    if (current == null) {
      NOTE_REF.lastIndex = 0;
      while ((m = NOTE_REF.exec(t)) !== null) if (!(m[1] in markOf)) markOf[m[1]] = i + 1;
    }
  }
  hit = { noteOf: noteOf, markOf: markOf };
  if (NOTES) NOTES.set(lines, hit);
  return hit;
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
 * Returns { byId, order } where byId[id] = { chapter, chapterIndex, line, precision, section,
 * opening, inBook }, plus `note` and `noteLine` for a claim read from a note. Precision, best
 * first: `quotation` (a quoted span, or the claim's own text where that is the author's words),
 * `declared` (a hand-written {line: N}), `inference` (an <Argument>, placed at the claims it is
 * made of), `paragraph`, `heading`, `chapter-only`. Claims citing a file the book does not list
 * are placed after everything and flagged, because a claim sourced outside the manuscript is
 * worth noticing on its own account.
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
    var chapterText = sources ? sources[n.chapter] : null;
    // The claim's words as the border reads them: inline hashtags are chips, not words.
    var vtext = String(n.detail || n.label || "")
      .replace(/(^|\s)#[A-Za-z][\w-]*/g, "$1 ").trim();
    var quoted = chapterText != null ? locateQuotation(n, chapterText) : null;
    // Its own words next, with the same standing as a quoted span — they ARE a quotation. From
    // `detail` alone, which is what the Python twin reads: a claim with no text of its own has
    // only its title, and a title is the reconstructor's name for the claim, not a passage.
    var own = quoted == null && chapterText != null && n.kind !== "argument" && n.detail
      ? locateOwnWords(String(n.detail).replace(/(^|\s)#[A-Za-z][\w-]*/g, "$1 ").trim(),
                       linesOf(n.chapter), chapterText)
      : null;
    if (quoted != null || own != null) {
      place.line = quoted != null ? quoted : own;
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
    // ---- IS THE BORDER TRUE? -----------------------------------------------------------
    // THE MAP DRAWS A SOLID BORDER FOR `quotation`, which is a claim that these are the
    // author's own words — and until 3 Sep 2026 the app drew it AS DECLARED. This is the seam
    // to check it at, because the manuscript is already here: `positions` is handed the source
    // text of every chapter in order to place the claim in it. Nothing new is loaded.
    //
    // COMPUTED HERE, ADJUDICATED BY THE HOST. This records the fact — are the claim's words a
    // contiguous run of its source — and mirrors `derived_quotation` in argdown_provenance.py
    // exactly, because the host applies the same two-level adjudication the build gets from
    // `--derive-fidelity` and the two must not drift (test_argdown_positions.mjs pins them):
    //   * inline hashtags are chips, not words, and are stripped before testing;
    //   * a claim under 30 characters gets no verdict either way (`null`) — a short claim can
    //     coincide with its source by accident, and calling that a quotation would be worse
    //     than staying silent. MIN_VERBATIM, one value in two languages.
    // `interpretation`, `imputation` and `compression` are judgements about the reading; the
    // adjudicating host leaves them alone, writes nothing back to the .argdown, and says on
    // the status line which state the page is in — the checker stays where a discrepancy is
    // REPORTED so the file itself can be corrected.
    place.verbatim = (chapterText == null || vtext.length < MIN_VERBATIM) ? null
                   : isVerbatim(vtext, chapterText);
    byId[n.id] = place;
  }

  /* AN ARGUMENT IS PLACED BY ITS CONCLUSION.
   *
   * An <Argument> is not a passage of the manuscript. It is a structure the reconstructor built
   * out of claims, and it has no words of its own, so nothing above places it: across the
   * published corpus every argument either dropped into the exposition view's unnamed band or
   * was placed by matching the reconstructor's OWN summary prose against the source — a guess
   * about a paraphrase, and one that put an argument named after section 3 in section 2.
   *
   * Its MAIN CONCLUSION has words, and an argument is made where it LANDS. Three routes to the
   * same place, best first: the conclusion's own claim where that claim is drawn on the map and
   * already placed; failing that the conclusion's quotation, then its words, located here.
   * The last two exist because a conclusion written inline in the premise-conclusion structure
   * gets an auto-generated title and no map node.
   *
   * WHY NOT THE LAST PLACED MEMBER when the conclusion cannot be found. It reads plausibly and
   * it is wrong: it puts the argument after every one of its premises BY CONSTRUCTION, so every
   * premise-to-argument relation comes out as support that arrived before the claim it supports.
   * That is exactly what `argdown-exposition` measures, and on the Carroll dialogue it inverted
   * the verdict — a text that asserts and then justifies read as one that earns its claims
   * first. A position that manufactures the finding is worse than no position.
   *
   * NOR THE EARLIEST MEMBER: two arguments in this corpus borrow a definition from an earlier
   * section, and that files them under the section they borrow from rather than the one they
   * are argued in.
   *
   * The argument's OWN evidence still wins. Where the reconstructor quoted the passage, or wrote
   * a line, that is about the argument itself rather than about its conclusion.
   *
   * The statement/argument asymmetry is deliberate. A statement whose words are not in the text
   * is the reconstructor's own — an imputation — and placing it from its neighbours would invent
   * a position the text does not support. An argument is BY CONSTRUCTION made of claims.
   */
  var lineByTitle = Object.create(null);
  for (var a = 0; a < nodes.length; a++) {
    var st = nodes[a], sp = byId[st.id];
    if (st.label && sp && sp.line != null && !(st.label in lineByTitle))
      lineByTitle[st.label] = { line: sp.line, chapter: sp.chapter };
  }
  for (var b = 0; b < nodes.length; b++) {
    var arg = nodes[b], ap = byId[arg.id];
    if (!ap || arg.kind !== "argument") continue;
    if (ap.precision === "quotation" || ap.precision === "declared") continue;
    // Only within the argument's own chapter: a conclusion cited from a different file gives a
    // line number that means nothing here.
    var drawn = arg.conclusion ? lineByTitle[arg.conclusion] : null;
    var line = drawn && drawn.chapter === ap.chapter ? drawn.line : null;
    var body = sources && sources[ap.chapter] != null ? sources[ap.chapter] : null;
    if (line == null && arg.conclusionText && body != null)
      line = locateQuotation({ detail: arg.conclusionText, source: arg.conclusionSource }, body);
    if (line == null && arg.conclusionText && linesOf(ap.chapter))
      line = locateParagraph(arg.conclusionText, linesOf(ap.chapter),
                             1, linesOf(ap.chapter).length).line;
    if (line != null) { ap.line = line; ap.precision = "inference"; }
  }

  // THE BAND, derived from wherever the line landed, and derived ONCE. This was computed here
  // and then computed AGAIN, differently, by both hosts — the viewer template and the build —
  // which is how the build came to be banding on `#` headings after the rule had moved on.
  // A paper whose sections are `##`, which is every source converted from a publisher's HTML,
  // built a viewer with no sections at all. The rule is `bandsOf`.
  //
  // A declared `section:` is the FALLBACK, not the winner. The band is a fact about where the
  // claim's words are, and `sectionAt` reads it off the text; `section:` is what a claim with no
  // line at all has left to go on.
  //
  // A NOTE IS READ AT ITS MARK (see `notesOf`), and that is settled first, because the band is a
  // fact about the line the claim ends up on: a claim quoted from note 3 belongs to the section
  // that marks note 3, not to `Footnotes`. Whatever placed the claim — its quotation, a declared
  // line, the paragraph search, an argument's conclusion — a line inside a note moves to the mark,
  // and a note the text never marks leaves the claim where it was found.
  for (var f = 0; f < nodes.length; f++) {
    var fp = byId[nodes[f].id];
    if (!fp || fp.line == null || !linesOf(fp.chapter)) continue;
    var notes = notesOf(linesOf(fp.chapter)), label = notes.noteOf[fp.line - 1];
    if (label == null || !(label in notes.markOf)) continue;
    fp.note = label;
    fp.noteLine = fp.line;
    fp.line = notes.markOf[label];
  }
  for (var d = 0; d < nodes.length; d++) {
    var nn = nodes[d], pp = byId[nn.id];
    if (!pp) continue;
    var banded = sources && sources[pp.chapter] != null
      ? bandsOf(sources[pp.chapter]) : { bands: [], paged: false };
    pp.section = (pp.line != null ? sectionAt(banded.bands, pp.line) : null)
      || nn.section || null;
    // THE OPENING: placed, in a file that IS divided into sections, but before the first of
    // them — an abstract, or an introduction its author did not title. It has no heading to be
    // banded under, and it used to share the file's own unlabelled row with whatever else had no
    // section, which is how the top of the exposition view came to mix the introduction with
    // claims that had no position at all. Flagged rather than given a made-up section name,
    // because `section` is a heading of the text's and this is not one.
    pp.opening = pp.line != null && !pp.section && banded.bands.length > 0;
    // A PRINTED PAGE, not a heading of the author's — the layout says so on the band.
    pp.page = !!(banded.paged && pp.section && pp.line != null);
    // WHERE IN ITS PARAGRAPH (see `colInLine`), so claims sharing a paragraph can be read in the
    // order the text makes them.
    pp.col = pp.line != null && linesOf(pp.chapter)
      ? colInLine(linesOf(pp.chapter), pp.line, pp.note,
                  [nn.detail, nn.source, nn.conclusionText, nn.conclusionSource])
      : null;
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
 *  code blocks, the YAML front matter, the HTML comments and the heading lines themselves left
 *  out. Markdown marks (`*`, `_`, `#`) do not make or break a word, and a bare `---` or `|` is
 *  not one.
 *
 *  THE SECTIONS ARE THE BANDS — `bandsOf`, the division the exposition view draws: the headings
 *  that divide the text, or its printed pages where no heading does. Not level 1, which is what
 *  this counted until 26 Sep 2026 and which gave no count at all to any band of a paper whose
 *  sections are `##`. The text before the first band is counted too, under the empty heading
 *  `""`: that is the key the opening's band is looked up by, and no heading can collide with it.
 *
 *  `sections` lists them IN ORDER, with the line each starts on and whether it is back matter or
 *  a printed page, because the exposition view draws a band for a section with nothing mapped in
 *  it and has to know where it falls and whether it is worth drawing. An object's keys cannot
 *  carry the order: a heading such as `1729` is an integer-like key, and JavaScript puts those
 *  first whatever order they were written in.
 *
 *    sources  { "path/to/chapter.md": "text" | null }
 *    -> { total, byChapter: {path: n}, bySection: {path: {heading: n}},
 *         sections: {path: [{ heading, line, words, back, page }]} }
 */
function wordCounts(sources) {
  var byChapter = {}, bySection = {}, sections = {}, total = 0;
  for (var ch in sources) {
    if (!Object.prototype.hasOwnProperty.call(sources, ch) || !sources[ch]) continue;
    var words = proseWords(String(sources[ch]).split("\n"));
    var bands = bandsOf(sources[ch]).bands;
    var list = bands.length ? [{ heading: "", line: 0, words: 0, back: false, page: false }] : [];
    for (var b = 0; b < bands.length; b++)
      list.push({ heading: bands[b].heading, line: bands[b].line, words: 0,
                  back: bands[b].back, page: bands[b].page });
    var sum = 0, at = list.length ? 0 : -1;
    for (var i = 0; i < words.length; i++) {
      while (at >= 0 && at + 1 < list.length && list[at + 1].line <= i + 1) at++;
      sum += words[i];
      if (at >= 0) list[at].words += words[i];
    }
    // Two sections under one heading — two `Notes`, say — are one band, so their counts add.
    var here = {};
    for (var s = 0; s < list.length; s++)
      here[list[s].heading] = (here[list[s].heading] || 0) + list[s].words;
    byChapter[ch] = sum;
    bySection[ch] = here;
    sections[ch] = list;
    total += sum;
  }
  return { total: total, byChapter: byChapter, bySection: bySection, sections: sections };
}

/** Is this claim the source's WORDS — allowing punctuation and case to differ, but nothing else?
 *
 *  THE SECOND IMPLEMENTATION OF ONE RULE, and deliberately so. `argdown_provenance._is_verbatim`
 *  is the other. That is normally the thing this project refuses, and the reason it is right here
 *  is worth setting out, because the comment it replaces gave a different reason that has expired.
 *
 *  WHAT THE OLD COMMENTS SAID: that the rule "leans on difflib and has no clean JavaScript
 *  equivalent", so the build asks Python rather than working it out again. That described the
 *  rule this one REPLACED — 0.75 similarity over a window. The current rule is: fold punctuation
 *  and case away, then ask whether the claim appears as a contiguous run of the source. There is
 *  no difflib in it and there never needs to be.
 *
 *  WHY DUPLICATE RATHER THAN MOVE. Python's copy cannot go: `--fix` writes markers with it and
 *  the MCP reading checks use it, and making a Python server shell out to Node is a worse
 *  dependency than four pinned lines. And the border cannot keep being asked of Python, because
 *  `--derive-fidelity` has exactly one caller — the builder, and only when given `--source-root`.
 *  A folder opened in the app, a folder dropped on the standalone, a bundle, and every exported
 *  page draw the border AS DECLARED. Those are now the ordinary ways to read a reconstruction,
 *  and "the border is checked rather than believed" is close to the point of the program.
 *
 *  So it is duplicated and PINNED: `test_argdown_positions.mjs` cross-checks this against the
 *  Python on the whole corpus, which is the same answer this project already gives for the
 *  positions rule and the reason that file exists.
 *
 *  ONE TRAP, and it is the only place the two languages can drift. Python's `\w` is
 *  Unicode-aware and JavaScript's is ASCII-only, so `/[^\w\s]+/` would treat every accented
 *  letter as punctuation here and as a letter there — on a corpus with Etiévant and naïve in it
 *  that is not hypothetical. `\p{L}\p{N}_` with the `u` flag is what Python's `\w` means.
 */
function foldPunctuation(text) {
  return normalise(text).text.toLowerCase()
    .replace(/[^\p{L}\p{N}_\s]+/gu, " ")
    .split(/\s+/).join(" ").trim();
}

function isVerbatim(claim, body) {
  var a = foldPunctuation(claim);
  if (!a) return false;
  // The claim is folded fresh — it differs every time. The BODY is the same source for every
  // claim in the file, so it is folded once. See normaliseSource above.
  return foldSource(body).indexOf(a) >= 0;
}


var API = { positions: positions, readingOrder: readingOrder, headingIndex: headingIndex,
            wordCounts: wordCounts,
            sectionSpan: sectionSpan, locateParagraph: locateParagraph,
            bandsOf: bandsOf, sectionAt: sectionAt, pageMarks: pageMarks,
            proseWords: proseWords, isBackMatter: isBackMatter,
            contentWords: contentWords, normalise: normalise, findQuote: findQuote,
            isVerbatim: isVerbatim, foldPunctuation: foldPunctuation,
            MIN_SCORE: MIN_SCORE, MIN_PARA: MIN_PARA, MIN_VERBATIM: MIN_VERBATIM };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownPositions = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
