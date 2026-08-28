/** The Text pane's source cleanup, tested against the invariant that makes it safe.
 *
 *  The pane renders the manuscript as prose, and every click-to-claim link is keyed to a SOURCE
 *  LINE NUMBER that markdown-it reports for each block. So the cleanup may blank a line but must
 *  never remove one: deleting the four lines of YAML front matter would slide the whole article
 *  up by four and point every link at the wrong paragraph.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tpl = fs.readFileSync(path.join(HERE, "argdown-viewer.template.html"), "utf8");

// Lift the function out of the page and run it here, so the test exercises the shipped source
// rather than a copy that can drift away from it.
const start = tpl.indexOf("function readableSource(");
if (start < 0) { console.error("readableSource is not in the template"); process.exit(1); }
let depth = 0, end = start;
for (let i = tpl.indexOf("{", start); i < tpl.length; i++) {
  if (tpl[i] === "{") depth++;
  else if (tpl[i] === "}" && --depth === 0) { end = i + 1; break; }
}
const readableSource = new Function(tpl.slice(start, end) + "; return readableSource;")();

/** The source of one top-level function, taken from the shipped template. */
function sourceOf(name) {
  const at = tpl.indexOf("function " + name + "(");
  if (at < 0) { console.error(name + " is not in the template"); process.exit(1); }
  let d = 0, e = at;
  for (let i = tpl.indexOf("{", at); i < tpl.length; i++) {
    if (tpl[i] === "{") d++;
    else if (tpl[i] === "}" && --d === 0) { e = i + 1; break; }
  }
  return tpl.slice(at, e);
}

/** Lift a function out of the page and run it here, so the test exercises the shipped source
 *  rather than a copy that can drift from it. `needs` names the helpers it calls, which have to
 *  come into the same scope with it — otherwise the lifted function throws on its first call and
 *  the failure looks like a bug in the code under test rather than in the harness. */
function lift(name, needs = []) {
  const src = needs.concat([name]).map(sourceOf).join("\n");
  return new Function(src + "; return " + name + ";")();
}
const pageMarks = lift("pageMarks");
const splitWidth = lift("splitWidth");
const soleWinner = lift("soleWinner");
const sideLayout = lift("sideLayout", ["sideAxis"]);
const scrollWithin = lift("scrollWithin");
const frontMatterAbstract = lift("frontMatterAbstract");

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

const SRC = [
  "---",                                     // 1
  'title: "Aggregation, Risk, and Reductio"',// 2
  'author: "Joe Horton"',                    // 3
  "---",                                     // 4
  "",                                        // 5
  "<!-- CONVERTED TEXT - NOT THE PUBLISHED ARTICLE.",   // 6
  "     (d) Dropped: page number (1), running head (31).", // 7
  "     raw.txt beside this file is the untouched extraction. -->", // 8
  "",                                        // 9
  "<!-- Ethics p.511 begins here -->",       // 10
  "",                                        // 11
  "Is there any number of people you should save?[^1]", // 12
  "",                                        // 13
  "# I. Introduction",                       // 14
  "",                                        // 15
  "[^1]: For influential partially aggregative views, see Kamm.", // 16
].join("\n");

const out = readableSource(SRC);
const a = SRC.split("\n"), b = out.split("\n");

console.log("readableSource");
check("not one line is added or removed", b.length, a.length);
check("  the front matter is blanked, lines 1-4", b.slice(0, 4), ["", "", "", ""]);
check("  the conversion log is blanked, lines 6-8", b.slice(5, 8), ["", "", ""]);
check("  the page marker goes too, line 10", b[9], "");
check("the article's first line stays ON line 12", b[11], a[11]);
check("  the heading stays on line 14", b[13], "# I. Introduction");
check("  and the note definition on line 16", b[15], a[15]);

const altered = [];
for (let i = 0; i < a.length; i++) if (b[i] !== "" && b[i] !== a[i]) altered.push(i + 1);
check("no surviving line is rewritten", altered, []);

// A manuscript with no front matter and no log must come back untouched.
const plain = "First paragraph.\n\nSecond paragraph with an -- em dash.\n";
check("a plain manuscript is returned unchanged", readableSource(plain), plain);
check("empty input is safe", readableSource(""), "");
check("null is safe", readableSource(null), "");

// A comment opened and closed on one line must not swallow what follows it.
const oneline = "Before.\n<!-- a note -->\nAfter.";
check("a single-line comment closes on its own line",
      readableSource(oneline).split("\n"), ["Before.", "", "After."]);

// A `---` that is NOT front matter (a horizontal rule mid-document) must survive.
const rule = "Para.\n\n---\n\nNext para.";
check("a horizontal rule mid-document is not front matter",
      readableSource(rule).split("\n"), ["Para.", "", "---", "", "Next para."]);

console.log("pageMarks");
// The converter writes one of these at every page break, with the number READ OFF THE SHEET.
// Getting it wrong is worse than not showing it: a reader quoting from the pane would cite a
// page the passage is not on. Horton's markers were three out until the converter started
// reading them rather than counting from a hand-set config.
const MS = [
  "<!-- CONVERTED TEXT - NOT THE PUBLISHED ARTICLE.",   // 1
  "     (g) Pages numbered 514-529, read off the sheets. -->", // 2
  "",                                                   // 3
  "<!-- Ethics p.514 begins here -->",                   // 4
  "",                                                   // 5
  "Is there any number of people you should save?",      // 6
  "",                                                    // 7
  "<!-- Ethics p.515 begins here -->",                    // 8
  "",                                                     // 9
  "Though partially aggregative views have appeal.",       // 10
].join("\n");
check("every page marker is found, with its line", pageMarks(MS),
      [{ line: 4, page: "514" }, { line: 8, page: "515" }]);
check("  a paper with no journal name still matches",
      pageMarks("<!-- p.7 begins here -->"), [{ line: 1, page: "7" }]);
check("  and one with spacing round the number",
      pageMarks("<!-- Analysis p. 121 begins here -->"), [{ line: 1, page: "121" }]);
check("the conversion log is not mistaken for a page marker",
      pageMarks("     (g) Pages numbered 514-529, read off the sheets. -->"), []);
check("  nor an ordinary comment", pageMarks("<!-- a note to self -->"), []);
check("a manuscript with no markers gives none", pageMarks("Just prose.\n\nMore prose."), []);
check("empty input is safe", pageMarks(""), []);

// The marker's own line is blanked for rendering, so the number has to attach to the first
// block AFTER it -- which is what keeps it beside the text that page actually starts with.
check("markers survive the cleanup that blanks their line",
      readableSource(MS).split("\n").length, MS.split("\n").length);
check("  and the blanked marker leaves the prose where it was",
      readableSource(MS).split("\n")[5], "Is there any number of people you should save?");

console.log("splitWidth (the divider, either way round)");
const box = { left: 0, right: 1280 };
const V = 1280;
// Texts on the RIGHT: dragging the divider left widens them.
check("texts on the right: dragging left widens them",
      splitWidth(800, box, false, V) > splitWidth(1000, box, false, V), true);
check("  the width is the distance to the right edge",
      splitWidth(1000, box, false, V), 280);
// Texts on the LEFT: the same drag has to run the other way, or it fights the user.
check("texts on the left: dragging right widens them",
      splitWidth(1000, box, true, V) > splitWidth(800, box, true, V), true);
check("  the width is the distance from the left edge",
      splitWidth(1000, box, true, V), 1000);
// The two are mirror images about the middle.
check("the two are mirror images",
      splitWidth(400, box, true, V), splitWidth(880, box, false, V));
// Neither side can be dragged away entirely.
check("the texts cannot be dragged shut", splitWidth(1279, box, false, V), 240);
check("  nor when swapped", splitWidth(1, box, true, V), 240);
check("the map cannot be dragged shut either", splitWidth(0, box, false, V), V - 120);
check("  nor when swapped", splitWidth(1280, box, true, V), V - 120);
// An offset container (a sidebar to the left of the app) must not shift the result.
check("an offset container is handled",
      splitWidth(1100, { left: 200, right: 1480 }, false, V), 380);

console.log("soleWinner (one pane at a time, on a narrow screen)");
const P = (o) => Object.assign({ map: false, text: false, argdown: false, notes: false }, o);
check("the pane just asked for wins", soleWinner(P({ map: true }), "text", true), "text");
check("  even when nothing else is up", soleWinner(P({}), "argdown", true), "argdown");
check("with nothing asked for, what is already up wins",
      soleWinner(P({ argdown: true }), null, true), "argdown");
check("  and the map comes first when several are",
      soleWinner(P({ map: true, text: true, notes: true }), null, true), "map");
check("  then the text", soleWinner(P({ text: true, argdown: true }), null, true), "text");
// Turning off the LAST pane must not leave an empty window with no way back.
check("nothing up at all falls back to the map", soleWinner(P({}), null, true), "map");
// And a manuscript that does not exist cannot be the one thing on screen.
check("the text cannot win when there is no manuscript",
      soleWinner(P({ map: true }), "text", false), "map");
check("  nor by being the only thing already up",
      soleWinner(P({ text: true }), null, false), "map");

console.log("sideLayout (the stack of texts down the right)");
const S = (o) => Object.assign({ map: true, argdown: false, notes: false, text: false }, o);
const shown = (r) => r.filter(x => x.open).map(x => x.id);
const sized = (r) => r.filter(x => x.sized).map(x => x.id);
const divs  = (r) => r.filter(x => x.dividerShown).map(x => x.divider);

let r = sideLayout(S({ argdown: true }));
check("one section open takes the whole column", [shown(r), sized(r), divs(r)],
      [["adpane"], [], []]);

r = sideLayout(S({ argdown: true, notes: true }));
check("two open: the first is sized, the last takes the rest",
      [shown(r), sized(r)], [["adpane", "notes"], ["adpane"]]);
check("  with one divider between them", divs(r), ["vsplit1"]);
check("  which resizes the section above it",
      r.find(x => x.divider === "vsplit1").resizes, "adpane");

r = sideLayout(S({ argdown: true, notes: true, text: true }));
check("three open: all but the last are sized",
      [shown(r), sized(r)], [["adpane", "notes", "ms"], ["adpane", "notes"]]);
check("  and there are two dividers", divs(r), ["vsplit1", "vsplit2"]);
check("  the lower one resizes the notes, not the Argdown",
      r.find(x => x.divider === "vsplit2").resizes, "notes");

// THE GAP BUG THIS SHAPE EXISTS TO PREVENT: with the Argdown closed, the notes must become the
// sized one and the manuscript take the remainder -- not leave the old sizing in place.
r = sideLayout(S({ notes: true, text: true }));
check("closing the top section re-sizes what is left",
      [shown(r), sized(r)], [["notes", "ms"], ["notes"]]);
check("  and the divider above the manuscript now resizes the notes",
      r.find(x => x.divider === "vsplit2").resizes, "notes");
check("  while the one above the notes is hidden, having nothing above it",
      r.find(x => x.divider === "vsplit1").dividerShown, false);

r = sideLayout(S({ text: true }));
check("the manuscript alone is not sized either", sized(r), []);
check("  and shows no divider", divs(r), []);

r = sideLayout(S({}));
check("nothing open means nothing shown", [shown(r), divs(r)], [[], []]);

check("an even share is offered before anything is dragged",
      sideLayout(S({ argdown: true, notes: true, text: true }))[0].share, "33.3%");

console.log("sideLayout — which way the texts run");
// Comparing two texts is a LEFT-TO-RIGHT job: the eye tracks across a line and back. Stacked, it
// becomes an up-and-down job and much harder to hold in the head. So with the map off — where
// there is a whole window's width to use — the texts go side by side. That is the "Check" case.
const axisOf = (o) => sideLayout(S(o))[0].axis;
check("the Check case runs side by side",
      axisOf({ map: false, argdown: true, text: true }), "row");
check("  with the map on there is not the width, so it stacks",
      axisOf({ map: true, argdown: true, text: true }), "column");
check("one text and no map is neither — nothing to compare it with",
      axisOf({ map: false, text: true }), "column");
check("three texts and no map still go side by side",
      axisOf({ map: false, argdown: true, notes: true, text: true }), "row");
check("nothing open stacks", axisOf({ map: false }), "column");

// The divider has to follow the axis, or it resizes along the wrong one.
let rr = sideLayout(S({ map: false, argdown: true, text: true }));
check("the divider still sits between the two",
      rr.filter(x => x.dividerShown).map(x => x.divider), ["vsplit2"]);
check("  and resizes the one before it", rr.find(x => x.divider === "vsplit2").resizes, "adpane");
check("  which is the sized one", rr.filter(x => x.sized).map(x => x.id), ["adpane"]);

console.log("scrollWithin (the pane scrolls, the page does not)");
// `scrollIntoView` walks up and scrolls EVERY scrollable ancestor, the document included, and
// `overflow:hidden` does not stop it — it forbids the reader scrolling, not the browser. One call
// could push the whole page up and take the toolbar off the top of the window, which loses every
// control in the app and cannot be scrolled back. So the pane is scrolled by hand instead.
const host = (clientHeight, offsetTop = 0) => ({ clientHeight, offsetTop, scrollTop: 0 });
const el = (offsetTop, offsetHeight = 20) => ({ offsetTop, offsetHeight });

let h = host(400);
scrollWithin(h, el(1000));
check("the target is centred in the pane", h.scrollTop, 1000 - (400 - 20) / 2);

h = host(400);
scrollWithin(h, el(10));
check("a target near the top does not scroll past it", h.scrollTop, 0);

h = host(400, 100);
scrollWithin(h, el(1100));
check("the host's own offset is taken off", h.scrollTop, 1000 - (400 - 20) / 2);

h = host(400);
scrollWithin(h, el(500, 600));
check("an element taller than the pane is put at its top", h.scrollTop, 500 + (600 - 400) / 2);

h = host(400);
scrollWithin(h, null);
check("a missing element is harmless", h.scrollTop, 0);
scrollWithin(null, el(100));
check("  and so is a missing host", true, true);

/* THE ABSTRACT, out of the front matter the same cleanup blanks.
 *
 * Read in the page rather than baked in by the builder, because a manuscript arrives three ways
 * and only one of them passes through the builder. That makes this parser shipped code with no
 * Node caller, which is exactly the kind of thing that rots — hence these.
 *
 * The shape that matters is pdf_to_source.py's: `abstract: >-` and two-space-indented lines
 * wrapped at 92 columns. A folded scalar joins with spaces; getting that wrong is visible, and
 * did happen — the 174-word Etievant abstract first came out as 17 one-line paragraphs.
 */
console.log("frontMatterAbstract");
const fm = (...lines) => ["---", 'title: "A paper"', ...lines, "---", "", "Body text."].join("\n");

check("a folded block is joined with spaces",
      frontMatterAbstract(fm("abstract: >-", "  One line of it", "  and the next line.")),
      "One line of it and the next line.");
check("  a blank line inside it is a paragraph break",
      frontMatterAbstract(fm("abstract: >-", "  First para.", "", "  Second para.")),
      "First para.\n\nSecond para.");
check("  chomping and indent indicators are accepted",
      frontMatterAbstract(fm("abstract: >2-", "  Folded anyway.")), "Folded anyway.");
check("a literal block keeps its newlines",
      frontMatterAbstract(fm("abstract: |", "  Line one.", "  Line two.")),
      "Line one.\nLine two.");
check("a quoted one-liner is unquoted",
      frontMatterAbstract(fm('abstract: "Short and quoted."')), "Short and quoted.");
check("  a bare one-liner is taken as it stands",
      frontMatterAbstract(fm("abstract: Short and bare.")), "Short and bare.");

// THE BLOCK MUST END AT THE NEXT KEY. Swallowing `licence:` into the abstract puts the file's
// metadata on screen as if the author had written it, which is worse than showing nothing.
check("the block stops at the next key",
      frontMatterAbstract(fm("abstract: >-", "  The abstract.", 'licence: "CC-BY-4.0"')),
      "The abstract.");
check("  and at the end of the front matter",
      frontMatterAbstract(["---", "abstract: >-", "  The abstract.", "---", "", "# Body",
                           "abstract: not this one"].join("\n")), "The abstract.");

// The papers that have none must produce none. Dewey, Ramsey and Miller are the real cases.
check("a file with no abstract gives nothing", frontMatterAbstract(fm('author: "Someone"')), "");
check("  nor does one with no front matter at all",
      frontMatterAbstract("# A chapter\n\nabstract: not front matter here"), "");
check("  nor an unterminated front matter",
      frontMatterAbstract("---\ntitle: \"Truncated\"\n"), "");
check("empty input is safe", frontMatterAbstract(""), "");
check("null is safe", frontMatterAbstract(null), "");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
