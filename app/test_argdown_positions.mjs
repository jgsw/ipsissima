#!/usr/bin/env node
/* test_argdown_positions.mjs — the two implementations of "where in the text is this claim"
 * must agree.
 *
 * `argdown_provenance.py` computes positions for the report that `check_argdown.py
 * --source-root` prints; `argdown-positions.js` computes them for the exposition-ordered view.
 * One rule, two languages, and nothing but this file keeping them in step. If they drift, the
 * report and the picture disagree about where a claim sits — which is exactly the class of
 * quietly-wrong assertion the provenance work exists to catch, so it is worth a test that
 * fails loudly.
 *
 * Part 1 is fixtures: small, self-contained, and the only part that runs everywhere.
 * Part 2 is the cross-check against the real book, skipped with a notice when the manuscript
 * is not on this machine. A fixture proves the rule; only the book proves the rule survives
 * 356 real claims.
 *
 *   node test_argdown_positions.mjs [path to the book folder]
 */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { execFileSync } from "child_process";
import { argdown } from "@argdown/node";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.resolve(HERE, "src");
const SKILL = path.resolve(HERE, "..", "ipsissima-mcp", "src", "ipsissima_mcp");
const require = createRequire(import.meta.url);
const P = require(path.join(BUILD, "argdown-positions.js"));

// A multi-file reconstruction to cross-check the two implementations against. There is no
// published one large enough to be worth it, so this reads IPSISSIMA_CORPUS, or a folder given
// as an argument, and skips cleanly when it has neither.
const BOOK_DEFAULT = process.env.IPSISSIMA_CORPUS || "";

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const eq = (name, got, want) =>
  ok(name, JSON.stringify(got) === JSON.stringify(want),
     `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

/* ------------------------------------------------------------------ 1. fixtures */

console.log("\nreading order");
{
  const yml = [
    "project:", "  type: book", "book:", '  title: "X"', "  chapters:",
    '    - "Intro/Preface.md"',
    '    - part: "Part 1"', "      chapters:",
    '        - "Part 1/A.md" ',                       // trailing space, as in the real file
    '        - "Part 1/B.qmd"',
    "date: now", '    - "Never/Reached.md"'
  ].join("\n");
  eq("chapters in document order, not alphabetical",
     P.readingOrder(yml), ["Intro/Preface.md", "Part 1/A.md", "Part 1/B.qmd"]);
  eq("stops at the end of the book: block", P.readingOrder(yml).length, 3);
  eq("no project file is not a crash", P.readingOrder(""), []);

  // THE NATIVE PROJECT FILE. Same idea as Quarto's block without the wrapper, so a Quarto user
  // can paste theirs across and everyone else writes six lines. Quoting is optional: the old
  // reader REQUIRED it and returned nothing at all for a file written the way most people
  // write YAML, which is a silent empty reading order.
  const native = [
    "title: My Book", "chapters:",
    "  - intro.md",
    "  - part: Part One", "    chapters:",
    "      - a.md", "      - b.md",
    "output: somewhere", "  - never.md"
  ].join("\n");
  eq("native file, unquoted paths", P.readingOrder(native), ["intro.md", "a.md", "b.md"]);
  eq("a key with a VALUE ends the list too", P.readingOrder(native).includes("never.md"), false);
  eq("parts do not become chapters", P.readingOrder(native).includes("Part One"), false);
}

console.log("\nsection spans");
{
  const src = ["# One", "a", "## One.a", "b", "# Two", "c"].join("\n");
  const h = P.headingIndex(src);
  eq("headings found with their levels", h.map(x => [x.line, x.level, x.text]),
     [[1, 1, "One"], [3, 2, "One.a"], [5, 1, "Two"]]);
  eq("a section runs to the next heading of its level or higher",
     P.sectionSpan(h, "One", 6), [1, 4]);
  eq("a subsection stops at its own level", P.sectionSpan(h, "One.a", 6), [3, 4]);
  eq("the last section runs to the end", P.sectionSpan(h, "Two", 6), [5, 6]);
  eq("an unknown section has no span", P.sectionSpan(h, "Nope", 6), null);
}

console.log("\nparagraph location");
{
  const para = w => w + " " + "filler ".repeat(20);
  const lines = ["# S",
    para("ritual opacity distinguishes ceremony from routine behaviour"),
    para("nations are imagined communities anderson modernity print capitalism"),
    "short line, under the paragraph threshold"];
  const hit = P.locateParagraph(
    "Nations are imagined communities: the members will never know their fellows.",
    lines, 2, 4);
  eq("the claim lands on the paragraph it came from", hit.line, 3);
  ok("and clears the acceptance threshold", hit.score >= P.MIN_SCORE, "score " + hit.score);

  const miss = P.locateParagraph("Entirely unrelated vocabulary about taxation policy.",
                                 lines, 2, 4);
  eq("no match returns no line, not a wrong one", miss.line, null);

  eq("a claim with no content words is not placed",
     P.locateParagraph("It is so.", lines, 2, 4).line, null);
  eq("the search is confined to the range it is given",
     P.locateParagraph("nations imagined communities anderson", lines, 2, 2).line, null);

  // Ties go to the earliest, so a claim restated later sits where it is first made.
  const twice = ["# S", para("opacity ritual ceremony"), para("opacity ritual ceremony")];
  eq("ties go to the earliest paragraph",
     P.locateParagraph("opacity ritual ceremony", twice, 2, 3).line, 2);
}

console.log("\nquotation location");
{
  const src = ["# S", "Nothing here.", "He wrote that culture is a process, not a thing, and",
               "that this matters."].join("\n");
  eq("a verbatim quotation gives its line",
     P.findQuote("culture is a process, not a thing", src), 3);
  eq("smart quotes and dashes fold",
     P.findQuote("culture is a process — not a thing", src.replace("not", "not")), null);
  eq("an elided quotation needs both halves, in order",
     P.findQuote("He wrote that culture ... this matters", src), 3);
  eq("a quotation that is not there gives nothing",
     P.findQuote("culture is a fixed inheritance", src), null);
  // Bates carries thirteen soft hyphens mid-line; Python dropped them and this did not.
  eq("a soft hyphen in the source is invisible, as it is to Python",
     P.findQuote("be offered for free", "should be \u00adoffered for free"), 1);
}

console.log("\npositions: precision order");
{
  const sources = {
    "A.md": ["# Top", "x".repeat(140),
             "# S", "ritual opacity ceremony " + "filler ".repeat(60)].join("\n")
  };
  const yml = 'book:\n  chapters:\n    - "A.md"\n';
  const nodes = [
    { id: "q", chapter: "A.md", section: "S", detail: 'He said "ritual opacity ceremony" here.' },
    { id: "d", chapter: "A.md", section: "S", detail: "unrelated", line: 2 },
    { id: "p", chapter: "A.md", section: "S", detail: "ritual opacity ceremony" },
    { id: "h", chapter: "A.md", section: "S", detail: "taxation policy revenue" },
    { id: "c", chapter: "A.md", detail: "no section at all" },
    { id: "o", chapter: "Outside.md", section: "S", detail: "not in the book" },
    { id: "n", detail: "no chapter at all" }
  ];
  const { byId } = P.positions(nodes, sources, yml);
  eq("a located quotation wins", [byId.q.precision, byId.q.line], ["quotation", 4]);
  eq("a declared line beats the section search", [byId.d.precision, byId.d.line], ["declared", 2]);
  eq("otherwise the best paragraph in the section", [byId.p.precision, byId.p.line],
     ["paragraph", 4]);
  eq("no paragraph match falls back to the heading", [byId.h.precision, byId.h.line],
     ["heading", 3]);
  eq("no section means chapter-only", [byId.c.precision, byId.c.line], ["chapter-only", null]);
  eq("a file the book does not list is flagged and sorted last",
     [byId.o.inBook, byId.o.chapterIndex], [false, 1]);
  ok("a claim with no chapter gets no position at all", byId.n === undefined);
}

console.log("\npositions: an argument is placed by its conclusion");
{
  // An <Argument> has no words of its own, so nothing above places it. Its main conclusion has
  // words, and an argument is made where it LANDS.
  const para = w => w + " " + "filler ".repeat(60);
  const sources = {
    "A.md": ["## 1. First", para("ritual opacity ceremony"),
             "## 2. Second", para("kinship exchange reciprocity"),
             para("totem sacrifice offering"),
             para("regress premise inference tortoise")].join("\n"),
    "B.md": ["## 1. Elsewhere", para("other file entirely words")].join("\n")
  };
  const yml = 'chapters:\n  - "A.md"\n  - "B.md"\n';
  const st = (id, detail) => ({ id, label: id, chapter: "A.md", detail });
  const nodes = [
    st("early", "ritual opacity ceremony"),          // line 2, section 1
    st("mid",   "kinship exchange reciprocity"),     // line 4, section 2
    st("late",  "totem sacrifice offering"),         // line 5, section 2
    st("nowhere", "taxation tariff revenue customs"),
    { id: "far", label: "far", chapter: "B.md", detail: "other file entirely words" },
    // Lands at its conclusion, NOT at its earliest premise — which is the point: this argument
    // borrows a premise from section 1 and is argued in section 2.
    { id: "lands", kind: "argument", chapter: "A.md", conclusion: "late",
      conclusionText: "totem sacrifice offering" },
    // A conclusion written inline in the premise-conclusion structure gets an auto-generated
    // title and no map node. It is still a statement with words.
    { id: "inline", kind: "argument", chapter: "A.md", conclusion: "Untitled 1",
      conclusionText: "regress premise inference tortoise" },
    { id: "inlineQuote", kind: "argument", chapter: "A.md", conclusion: "Untitled 2",
      conclusionText: "A step the paper does not spell out.",
      conclusionSource: '"kinship exchange reciprocity"' },
    // The argument's OWN evidence wins over anything taken from its conclusion.
    { id: "quoted", kind: "argument", chapter: "A.md",
      detail: 'The step from "regress premise inference tortoise" onwards.',
      conclusion: "early", conclusionText: "ritual opacity ceremony" },
    { id: "declared", kind: "argument", chapter: "A.md", line: 3,
      conclusion: "late", conclusionText: "totem sacrifice offering" },
    // A conclusion in another file gives a line number that means nothing in this one.
    { id: "crossFile", kind: "argument", chapter: "A.md", conclusion: "far" },
    // Nothing to go on stays unplaced rather than guessing.
    { id: "empty", kind: "argument", chapter: "A.md", conclusion: null },
    // WHAT THE REJECTED FALLBACK WOULD HAVE DONE. Placing an argument at its last placed member
    // puts it after every premise BY CONSTRUCTION, which manufactures the finding
    // `argdown-exposition` measures. An unfindable conclusion leaves the argument unplaced.
    { id: "lostConclusion", kind: "argument", chapter: "A.md", conclusion: "nowhere",
      conclusionText: "taxation tariff revenue customs" }
  ];
  const { byId } = P.positions(nodes, sources, yml);
  eq("an argument lands at its main conclusion",
     [byId.lands.precision, byId.lands.line], ["inference", 5]);
  eq("  and so is banded by the section it is argued in, not the one it borrows from",
     [byId.early.section, byId.lands.section], ["1. First", "2. Second"]);
  eq("an inline conclusion is placed by its own words",
     [byId.inline.precision, byId.inline.line], ["inference", 6]);
  eq("  and by its quotation before its words",
     [byId.inlineQuote.precision, byId.inlineQuote.line], ["inference", 4]);
  eq("the argument's own quotation wins",
     [byId.quoted.precision, byId.quoted.line], ["quotation", 6]);
  eq("a declared line wins", [byId.declared.precision, byId.declared.line], ["declared", 3]);
  eq("a conclusion in another chapter is not used",
     [byId.crossFile.precision, byId.crossFile.line], ["chapter-only", null]);
  eq("an argument with no conclusion stays unplaced",
     [byId.empty.precision, byId.empty.line], ["chapter-only", null]);
  eq("an unfindable conclusion leaves the argument unplaced, not at its last premise",
     [byId.lostConclusion.precision, byId.lostConclusion.line], ["chapter-only", null]);
  // THE ASYMMETRY IS DELIBERATE. A statement whose words are not in the text is the
  // reconstructor's own; placing it from its neighbours would invent a position.
  eq("a statement is never placed from its neighbours",
     [byId.nowhere.precision, byId.nowhere.line], ["chapter-only", null]);
}

console.log("\npositions: the band, derived once");
{
  // `##` SECTIONS. `pdf_to_source.py` writes a paper's sections as `#`; `html_to_source.py`
  // writes the article title as `#` and its sections as `##`, because that is what the
  // publisher's markup says. Banding on level 1 puts such a paper in a single band.
  const para = w => w + " " + "filler ".repeat(60);
  const sources = {
    "A.md": ["# The Article", para("abstract words before any section"),
             "## 1. First", para("ritual opacity ceremony"),
             "## 2. Second", para("kinship exchange reciprocity")].join("\n")
  };
  const yml = 'chapters:\n  - "A.md"\n  - "C.md"\n';
  const nodes = [
    { id: "s1", chapter: "A.md", detail: "ritual opacity ceremony" },
    { id: "s2", chapter: "A.md", detail: "kinship exchange reciprocity" },
    { id: "front", chapter: "A.md", detail: "abstract words before any section" },
    // A declared `section:` is the FALLBACK for the band, not the winner. It still scopes the
    // paragraph search, which is what it is for — but a located quotation places the claim
    // wherever the words actually are, and the band follows the words.
    { id: "misdeclared", chapter: "A.md", section: "2. Second",
      detail: 'He wrote "ritual opacity ceremony" of them.' },
    // A chapter whose text was not supplied — a bundle built without it, a folder half copied.
    // There is no line to derive a band from, and what the claim declares is all there is.
    { id: "unplaced", chapter: "C.md", section: "3. Third", detail: "anything at all" }
  ];
  const { byId } = P.positions(nodes, sources, yml);
  eq("sections written as ## are the bands", [byId.s1.section, byId.s2.section],
     ["1. First", "2. Second"]);
  eq("a claim before the first section has no band", byId.front.section, null);
  eq("a located quotation bands the claim where the words are, not where it says",
     [byId.misdeclared.precision, byId.misdeclared.section], ["quotation", "1. First"]);
  eq("a claim whose source is missing falls back to its declared section",
     [byId.unplaced.line, byId.unplaced.section], [null, "3. Third"]);
  eq("  and the text before the first section is flagged as the opening",
     [byId.front.opening, byId.s1.opening], [true, false]);
  eq("  which a claim with no line never is", byId.unplaced.opening, false);
}

/* THE THREE PLACEMENT RULES OF 26 SEP 2026, each with the case that prompted it. The first two
 * exist in Python too, and are cross-checked against it below on a fixture of their own — the
 * book that the big cross-check reads has neither an unquoted verbatim claim nor a note. */
const FIX = {
  "P.md": [
    "---", "title: A paper",
    "abstract: >-", "  Small fees sharply reduce the take-up of useful products among the poor.",
    "---", "",
    "<!-- converted text; repaired: Small fees sharply reduce the take-up of useful products among the poor -->",
    "", "# 1. Findings", "",
    "We find that small fees sharply reduce the take-up of useful products among the poor, " +
      "and the effect is large across ten evaluations in four countries of the world.[^1]" + " " + "These words make the section a stretch of real prose rather than a heading alone. ".repeat(5),
    "", "# 2. Notes on method", "",
    "Randomised evaluations compared free distribution with a range of small prices charged " +
      "at the point of sale, so the comparison isolates the effect of price itself.[^2]" + " " + "These words make the section a stretch of real prose rather than a heading alone. ".repeat(5),
    "", "# Notes", "",
    "[^1]: Ten evaluations were pooled, and the pooled estimate hides a great deal of variation.",
    "", "[^2]: The prices were set by lottery in each village and never announced in advance.",
    "    A second paragraph of the second note, indented as Markdown requires, says more.",
    "", "Unindented text after the notes is not a note at all, and is the text proper again.",
    ""
  ].join("\n"),
  "H.md": [
    "## 1. Body", "",
    "The body sentence carries the mark of the first note, as a publisher's page would do.[^1]" + " " + "These words make the section a stretch of real prose rather than a heading alone. ".repeat(5),
    "", "## 2. More", "", "A second section, because one heading alone does not divide a text." + " " + "These words make the section a stretch of real prose rather than a heading alone. ".repeat(5),
    "", "## Footnotes", "", "[[[1]]]", "",
    "The note's words are a paragraph of their own, not indented, as the HTML route writes them.",
    ""
  ].join("\n")
};

console.log("\npositions: the claim's own words are a quotation");
{
  const yml = 'chapters:\n  - "P.md"\n';
  const { byId } = P.positions([
    // Written as the author's sentence with no quotation marks — the house style — and
    // punctuation differing. It used to fall through to the paragraph search.
    { id: "own", chapter: "P.md",
      detail: "small fees sharply reduce the take-up of useful products among the poor" },
    // The same words in the front matter's abstract and in a converter's note must NOT win: the
    // claim goes to the text, where the paragraph at line 11 has them.
    { id: "short", chapter: "P.md", detail: "small fees" },
    { id: "arg", kind: "argument", chapter: "P.md",
      detail: "small fees sharply reduce the take-up of useful products among the poor" }
  ], FIX, yml);
  eq("a claim whose text IS the author's words is placed as a quotation",
     [byId.own.precision, byId.own.line], ["quotation", 11]);
  ok("  not in the front matter's copy of the abstract, nor in the converter's note",
     byId.own.line > 7, "placed at line " + byId.own.line);
  ok("a claim too short to be told from coincidence is not placed by its words",
     byId.short.precision !== "quotation", byId.short.precision);
  ok("an <Argument>'s text is its reconstructor's summary, not a passage",
     byId.arg.precision !== "quotation", byId.arg.precision);
}

/* WHICH OCCURRENCE (recommendation 4, 27 Sep 2026). A claim's words often stand in several
 * places -- the front matter's copy of the abstract, the printed abstract, the body, a page the
 * pinpoint names -- and the earliest used to win. The cases are Bates's (findings drawn in the
 * abstract, one off its pinpoint's page), Wilson's (the contention in the YAML front matter) and
 * Wolff's (two quotations, the first listed later in the text than the second). */
const PAD = " These words make the paragraph a stretch of real prose rather than a stub.".repeat(3);
const E = [
  "---", "title: A paper", 'subtitle: "A study of price and use in poor households"',
  "abstract: >-", "  Tiny fees sharply cut the adoption of useful products.", "---", "",
  "<!-- p.30 begins here -->", "",
  "> Abstract. Tiny fees sharply cut the adoption of useful products. We also find that " +
    "paying does not make people use a product.", "",
  "# 1 Results", "",
  "Across ten trials, tiny fees sharply cut the adoption of useful products, by as much as " +
    "eighty per cent." + PAD, "",
  // Not beside the marker: a paragraph beside one may run across the break (pageRangeOfLines).
  "A paragraph between, so the finding above is wholly on the thirtieth page." + PAD, "",
  "<!-- p.34 begins here -->", "",
  "We repeat the finding: tiny fees sharply cut the adoption of useful products." + PAD, "",
  "Paying does not make people use a product, on the evidence of two further trials." + PAD, "",
  "Abstract ideas are formed by custom, as Hume says, and this sentence is the text." + PAD, "",
  "<!-- p.36 begins here -->", "",
  "# 2 Discussion", "",
  "The second quotation stands here: the price of a thing shapes its use." + PAD, "",
  "Later still, we find again that paying does not make people use a product." + PAD, ""
];
const EF = [
  "# A title", "", "## Abstract", "",
  "The argument is that ceremonies bind a community together over time.", "",
  "## 1 Introduction", "",
  "We argue here that ceremonies bind a community together over time, and more besides." + PAD,
  ""
];
const EFIX = { "E.md": E.join("\n"), "F.md": EF.join("\n") };
const at = (lines, s) => lines.findIndex(l => l.includes(s)) + 1;
// The claims, as a map would write them; placed below by both languages.
const EMAP = [
  { t: "abs",      d: 'It finds that "tiny fees sharply cut the adoption of useful products".' },
  { t: "pin",      d: 'It finds that "tiny fees sharply cut the adoption of useful products".', pin: "p. 34" },
  { t: "pinpair",  d: 'It finds that "tiny fees sharply cut the adoption of useful products".', pin: "pp. 30, 34" },
  { t: "pinmiss",  d: 'It finds that "tiny fees sharply cut the adoption of useful products".', pin: "p. 121" },
  { t: "own",      d: "paying does not make people use a product" },
  { t: "ownpin",   d: "paying does not make people use a product", pin: "p. 36" },
  { t: "onlyabs",  d: 'The abstract says "We also find that paying" as its bridge.' },
  { t: "onlyfront", d: 'Its subtitle is "A study of price and use in poor households".' },
  { t: "multi",    d: 'Both "the price of a thing shapes its use" and "by as much as eighty per cent".' },
  { t: "multipin", d: 'Both "the price of a thing shapes its use" and "by as much as eighty per cent".', pin: "p. 36" },
  { t: "headed",   d: 'It says "ceremonies bind a community together over time".', ch: "F.md" }
];
const EWANT = {
  abs: at(E, "Across ten trials"), pin: at(E, "We repeat the finding"),
  pinpair: at(E, "Across ten trials"), pinmiss: at(E, "Across ten trials"),
  own: at(E, "Paying does not make"), ownpin: at(E, "Later still"),
  onlyabs: at(E, "> Abstract."), onlyfront: at(E, "subtitle:"),
  multi: at(E, "Across ten trials"), multipin: at(E, "The second quotation"),
  headed: at(EF, "We argue here")
};

console.log("\npositions: which of several places a claim's words stand");
{
  const { byId } = P.positions(EMAP.map(c => ({ id: c.t, chapter: c.ch || "E.md", detail: c.d,
                                                 pinpoint: c.pin })),
                               EFIX, 'chapters:\n  - "E.md"\n  - "F.md"\n');
  const line = t => byId[t] && byId[t].line;
  eq("the body, not the front matter's copy nor the printed abstract", line("abs"), EWANT.abs);
  eq("  the page the pinpoint cites, when the words are on it", line("pin"), EWANT.pin);
  eq("  a pinpoint naming the abstract's page and the body's still gets the body",
     line("pinpair"), EWANT.pinpair);
  eq("  a pinpoint naming a page the text does not carry changes nothing",
     line("pinmiss"), EWANT.pinmiss);
  eq("the claim's own words follow the same rule", line("own"), EWANT.own);
  eq("  and their pinpoint too", line("ownpin"), EWANT.ownpin);
  eq("words found only in the abstract are placed there", line("onlyabs"), EWANT.onlyabs);
  eq("  and words found only in the front matter, there", line("onlyfront"), EWANT.onlyfront);
  eq("of two quotations, the earlier in the text, not the first listed",
     line("multi"), EWANT.multi);
  eq("  unless the pinpoint cites the other's page", line("multipin"), EWANT.multipin);
  eq("a section headed Abstract is an abstract too", line("headed"), EWANT.headed);
  const z = P.textZones(E);
  eq("a paragraph opening with the word as a label is an abstract; one about abstract ideas is not",
     [z[at(E, "> Abstract.") - 1], z[at(E, "Abstract ideas") - 1]], ["abstract", ""]);
}

console.log("\npages: the pages a line may be on");
{
  const L = ["intro", "<!-- p.9 begins here -->", "", "<!-- p.10 begins here -->", "",
             "a paragraph under two markers", "", "a paragraph between", "",
             "a paragraph above one", "", "<!-- p.11 begins here -->",
             "<!-- a converter's note -->", "after"];
  const r = P.pageRangeOfLines(L);
  eq("a paragraph under stacked markers may have begun on the page before the first", r[5], [8, 10]);
  eq("  one beside no marker is on its page alone", r[7], [10, 10]);
  eq("  one just above a marker may run on to it", r[9], [10, 11]);
  eq("  and a converter's one-line comment does not separate it from its marker", r[13], [10, 11]);
  eq("nothing before the first marker has a page", r[0], null);
  // The same answer as Python on every paged source in the samples, line by line: the checker
  // reports a pinpoint off its page by Python's reading, and the map places by this one.
  const SAMPLES = path.join(HERE, "..", "samples"), files = [];
  for (const d of fs.existsSync(SAMPLES) ? fs.readdirSync(SAMPLES) : []) {
    const src = path.join(SAMPLES, d, "source");
    if (!fs.existsSync(src)) continue;
    for (const f of fs.readdirSync(src))
      if (f.endsWith(".md") && /begins here/.test(fs.readFileSync(path.join(src, f), "utf8")))
        files.push(path.join(src, f));
  }
  const py = JSON.parse(execFileSync("python3", ["-c",
    "import json,sys; sys.path.insert(0, sys.argv[1]); import argdown_provenance as p; " +
    "print(json.dumps([p.page_ranges(open(f, encoding='utf-8').read().split('\\n')) " +
    "for f in sys.argv[2:]]))", SKILL, ...files], { encoding: "utf8", maxBuffer: 64 << 20 }));
  const js = files.map(f => P.pageRangeOfLines(fs.readFileSync(f, "utf8").split("\n")));
  ok(`the pages of every line of ${files.length} paged sources agree with Python`,
     files.length > 3 && JSON.stringify(js) === JSON.stringify(py),
     files.filter((f, i) => JSON.stringify(js[i]) !== JSON.stringify(py[i]))
       .map(f => path.basename(f)).join(", "));
}

console.log("\npositions: a note is read at its mark");
{
  const yml = 'chapters:\n  - "P.md"\n  - "H.md"\n';
  const { byId } = P.positions([
    { id: "n1", chapter: "P.md", detail: 'The note says "the pooled estimate hides a great deal of variation".' },
    { id: "n2b", chapter: "P.md", detail: 'Its second paragraph "indented as Markdown requires, says more".' },
    { id: "after", chapter: "P.md", detail: '"is not a note at all, and is the text proper again"' },
    { id: "html", chapter: "H.md", detail: '"a paragraph of their own, not indented"' },
    { id: "body", chapter: "P.md", detail: '"compared free distribution with a range of small prices"' }
  ], FIX, yml);
  eq("a claim quoted from a note is placed at the note's mark",
     [byId.n1.line, byId.n1.note, byId.n1.noteLine], [11, "1", 19]);
  eq("  and banded by the section that marks it, not by Notes", byId.n1.section, "1. Findings");
  eq("  and keeps its precision: the words are still found", byId.n1.precision, "quotation");
  eq("an indented second paragraph belongs to its note", [byId.n2b.line, byId.n2b.note], [15, "2"]);
  eq("an unindented line ends a Markdown note", [byId.after.note, byId.after.section],
     [undefined, "Notes"]);
  eq("the HTML route's [[[n]]] notes are read at their mark too",
     [byId.html.line, byId.html.note, byId.html.section], [3, "1", "1. Body"]);
  eq("a claim in the text proper is left alone", [byId.body.line, byId.body.note], [15, undefined]);
}

console.log("\nbands: only headings that divide the text decide the level");
{
  const prose = w => w + " " + "and the argument runs on through a sentence of ordinary prose ".repeat(8);
  // A BOOK'S TITLE PAGE ABOVE AN ESSAY: two `##` headings with nothing under them, and the
  // essay's own sections at `####`. Counting every heading banded the essay on the title page.
  const james = ["## ESSAYS", "", "#### IN", "", "## POPULAR PHILOSOPHY.", "",
                 "### THE WILL TO BELIEVE.", "", prose("a dedication before the first section"), "",
                 "#### I.", "", prose("live and dead hypotheses"), "",
                 "#### II.", "", prose("the option is forced"), ""].join("\n");
  const b = P.bandsOf(james);
  eq("a title page's headings, with no prose under them, do not decide the level",
     [b.level, b.bands.map(x => x.heading)], [4, ["I.", "II."]]);
  eq("  and a heading with nothing under it bounds nothing — the text after it is the opening",
     P.sectionAt(b.bands, 9), null);

  // A WEB PAGE: navigation set as headings that are nothing but links.
  const web = ["### [Environment](https://example.org/env)", "", prose("site furniture"), "",
               "# Transcript", "", prose("the speech itself"), "",
               "### [National](https://example.org/nat)", "", prose("more furniture"), ""].join("\n");
  eq("headings that are only links are navigation, not sections", P.bandsOf(web).bands, []);

  // BACK MATTER: never decides, still bounds once the level is chosen.
  const one = ["# 1. The only section", "", prose("the argument"), "",
               "# References", "", prose("a list of works"), ""].join("\n");
  eq("one section and a reference list is not a divided text", P.bandsOf(one).level, 0);
  const two = ["# 1. First", "", prose("the argument"), "", "# 2. Second", "", prose("more"), "",
               "# Notes", "", prose("the notes"), ""].join("\n");
  eq("  but where the text IS divided, back matter bounds a band of its own, marked as such",
     P.bandsOf(two).bands.map(x => [x.heading, x.back]),
     [["1. First", false], ["2. Second", false], ["Notes", true]]);

  // A HEADING BROKEN ACROSS TWO LINES by the converter: its "section" is the rest of its title.
  const broken = ["# 3 In funding interventions, start by funding the most cost-",
                  "effective interventions first, and keep going", "",
                  "# 4 If the budget changes", "", prose("the whole paper"), ""].join("\n");
  eq("a heading with only a few words under it does not decide the level either",
     P.bandsOf(broken).level, 0);
}

console.log("\nbands: a text no heading divides is banded by its printed pages");
{
  const prose = w => w + " " + "the essay continues without a single heading of its own ".repeat(8);
  const text = ["Title of the essay", "", prose("an opening before any page marker"), "",
                "<!-- p.101 begins here -->", "", prose("the first printed page"), "",
                "<!-- p.102 begins here -->", "", prose("the second printed page"), "",
                "<!-- Ethics p.103 begins here -->", "", prose("a page marked with its volume"), ""
               ].join("\n");
  eq("the converters' page markers are read, with or without a volume's name",
     P.pageMarks(text).map(m => m.page), ["101", "102", "103"]);
  const b = P.bandsOf(text);
  eq("with no heading to divide it, the text is banded by page, named for the page",
     [b.paged, b.bands.map(x => x.heading)], [true, ["p. 101", "p. 102", "p. 103"]]);
  const { byId } = P.positions([
    { id: "p2", chapter: "E.md", detail: '"the second printed page"' },
    { id: "pre", chapter: "E.md", detail: '"an opening before any page marker"' }
  ], { "E.md": text }, 'chapters:\n  - "E.md"\n');
  eq("a claim is banded by the page it is on, and flagged as on a printed page",
     [byId.p2.section, byId.p2.page], ["p. 102", true]);
  eq("  and what comes before the first page is the opening",
     [byId.pre.section, byId.pre.opening], [null, true]);
  eq("a single page is not a division",
     P.bandsOf(["<!-- p.1 begins here -->", prose("one page only")].join("\n")).bands, []);
  const w = P.wordCounts({ "E.md": text });
  eq("the word counts follow the pages, and say they are pages",
     w.sections["E.md"].map(x => [x.heading, x.page]),
     [["", false], ["p. 101", true], ["p. 102", true], ["p. 103", true]]);
}

console.log("\npositions: where in its paragraph a claim falls");
{
  const line = "First the author defines ritual opacity with care. Then the author argues that " +
               "ceremony differs from routine, and finally concludes that opacity marks ceremony.[^1]";
  const text = ["# 1. One", "", line + " " + "and more prose follows here ".repeat(10), "",
                "# 2. Two", "", "a second section of prose ".repeat(15), "",
                "[^1]: A note on the concluding sentence."].join("\n");
  const { byId } = P.positions([
    { id: "last", chapter: "C.md", detail: '"concludes that opacity marks ceremony"' },
    { id: "first", chapter: "C.md", detail: '"defines ritual opacity with care"' },
    { id: "mid", chapter: "C.md", detail: "the author argues that ceremony differs from routine" },
    { id: "note", chapter: "C.md", detail: '"A note on the concluding sentence"' }
  ], { "C.md": text }, 'chapters:\n  - "C.md"\n');
  eq("claims from one paragraph share its line", [byId.first.line, byId.mid.line, byId.last.line],
     [3, 3, 3]);
  ok("  and their offsets follow the order the paragraph makes them in",
     byId.first.col < byId.mid.col && byId.mid.col < byId.last.col,
     JSON.stringify([byId.first.col, byId.mid.col, byId.last.col]));
  ok("a claim read from a note sits where the note's mark is, after the sentence it glosses",
     byId.note.line === 3 && byId.note.col > byId.last.col,
     JSON.stringify([byId.note.line, byId.note.col]));
}

console.log("\npositions: echoes — where else the text states a claim");
{
  const prose = w => w + " " + "and the argument continues through ordinary prose ".repeat(8);
  const src = {
    "E.md": ["---", "abstract: We argue that small fees sharply reduce take-up among the poor.",
             "---", "", "# 1. Introduction", "",
             prose("We argue that small fees sharply reduce take-up among the poor."), "",
             "# 2. Evidence", "",
             prose("Ten trials show that small fees sharply reduce the take-up of products."), "",
             "# 3. Notes on method", "",
             prose("Prices were set by lottery.[^1]"), "",
             "[^1]: The lottery is where the claim is restated once more, in a note.", ""].join("\n"),
    "B.md": prose("Chapter five will show that small fees sharply reduce take-up.")
  };
  const yml = 'chapters:\n  - "B.md"\n  - "E.md"\n';
  const { byId } = P.positions([{ id: "c", chapter: "E.md",
    detail: '"small fees sharply reduce the take-up of products"',
    echoes: ["We argue that small fees sharply reduce take-up among the poor.",
             "“The lottery is where the claim is restated once more”",
             "Chapter five will show that small fees sharply reduce take-up.",
             "small fees sharply reduce the take-up of products",
             "words that are not in the text anywhere at all"] }], src, yml);
  const e = byId.c.echoes || [];
  eq("an echo is placed in the text, not in the front matter's copy of the abstract",
     [e[0] && e[0].line, e[0] && e[0].section], [7, "1. Introduction"]);
  eq("an echo in a note sits at the note's mark", [e[1] && e[1].line, e[1] && e[1].note], [15, "1"]);
  eq("an echo in another file is found there — a book announcing a later chapter",
     [e[2] && e[2].chapter, e[2] && e[2].chapterIndex], ["B.md", 0]);
  eq("an echo in the claim's own paragraph, and one not in the text, are left out", e.length, 3);
  eq("the claim itself stays where it is argued", [byId.c.line, byId.c.section], [11, "2. Evidence"]);
}

console.log("\nword counts: the bands, the opening, and not the converter's notes");
{
  const w = P.wordCounts(FIX);
  eq("sections are the band-level headings, in order, with the line each starts on",
     w.sections["P.md"].map(s => [s.heading, s.line]),
     [["", 0], ["1. Findings", 9], ["2. Notes on method", 13], ["Notes", 17]]);
  eq("the front matter and the HTML comment are not counted as the author's words",
     w.bySection["P.md"][""], 0);
  eq("## sections are counted, as they are banded", Object.keys(w.bySection["H.md"]),
     ["", "1. Body", "2. More", "Footnotes"]);
  eq("the total is the sum of the sections",
     w.byChapter["P.md"], w.sections["P.md"].reduce((a, s) => a + s.words, 0));
}

console.log("\nthe note and own-words rules agree with Python");
{
  // One rule in two languages, on a fixture of its own: the book cross-check further down reads
  // a manuscript with no notes and no unquoted verbatim claims, so it cannot see these.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "argpos-rules-"));
  for (const [f, text] of Object.entries(FIX)) fs.writeFileSync(path.join(dir, f), text);
  const map = [
    "[own]: small fees sharply reduce the take-up of useful products among the poor",
    '    {chapter: "P.md", echoes: ["compared free distribution with a range of small prices"]}',
    "  + [n1]: The note says \"the pooled estimate hides a great deal of variation\".",
    '      {chapter: "P.md"}',
    "  + [n2b]: Its second paragraph is \"indented as Markdown requires, says more\".",
    '      {chapter: "P.md"}',
    "  + [html]: The HTML note is \"a paragraph of their own, not indented\" here.",
    '      {chapter: "H.md"}',
    ""
  ].join("\n");
  const file = path.join(dir, "rules.argdown");
  fs.writeFileSync(file, map);
  const graph = toGraph(await argdown.runAsync({ input: map, ...RUN }));
  const { byId } = P.positions(graph.nodes, FIX, 'chapters:\n  - "P.md"\n  - "H.md"\n');
  const js = {};
  for (const n of graph.nodes) if (byId[n.id]) js[n.label] = byId[n.id];
  const cli = path.join(HERE, "node_modules", ".bin", "argdown");
  execFileSync(cli, ["json", file, "--outputDir", dir], { stdio: "ignore" });
  const py = JSON.parse(execFileSync("python3",
    [path.join(SKILL, "argdown_provenance.py"), path.join(dir, "rules.json"), dir],
    { encoding: "utf8" }));
  // Where each language finds the echo: the JS places it for the view, the Python verifies it
  // for the checker, and they must be talking about the same line.
  const pyEcho = JSON.parse(execFileSync("python3", ["-c",
    "import json,sys; sys.path.insert(0, sys.argv[1]); import argdown_provenance as p; " +
    "d = json.load(open(sys.argv[2])); " +
    "print(json.dumps([[e['title'], e['status'], e['line']] for e in p.check_echoes(d, sys.argv[3])]))",
    SKILL, path.join(dir, "rules.json"), dir], { encoding: "utf8" }));
  fs.rmSync(dir, { recursive: true, force: true });
  eq("an echo is found at the same line in both languages",
     pyEcho, [["own", "exact", (js.own.echoes || [])[0] && js.own.echoes[0].line]]);
  const titles = ["own", "n1", "n2b", "html"];
  eq("both languages place every fixture claim at the same line, with the same precision",
     titles.map(t => [t, py[t] && py[t].line, py[t] && py[t].precision]),
     titles.map(t => [t, js[t] && js[t].line, js[t] && js[t].precision]));
  eq("  and both say which note a claim was read from",
     titles.map(t => (py[t] && py[t].note) || null), titles.map(t => (js[t] && js[t].note) || null));
}

console.log("\nthe choice among several places agrees with Python");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "argpos-occ-"));
  for (const [f, text] of Object.entries(EFIX)) fs.writeFileSync(path.join(dir, f), text);
  const q = s => s.replace(/"/g, '\\"');
  // Under one root, because a statement with no relation never reaches the map.
  const map = "[root]: The fixture's claims, each a reason for this.\n" +
    EMAP.map(c => `  + [${c.t}]: ${c.d}\n      {chapter: "${c.ch || "E.md"}"` +
                  (c.pin ? `, pinpoint: "${q(c.pin)}"` : "") + "}\n").join("");
  const file = path.join(dir, "occ.argdown");
  fs.writeFileSync(file, map);
  const graph = toGraph(await argdown.runAsync({ input: map, ...RUN }));
  const { byId } = P.positions(graph.nodes, EFIX, 'chapters:\n  - "E.md"\n  - "F.md"\n');
  const js = {};
  for (const n of graph.nodes) if (byId[n.id]) js[n.label] = byId[n.id];
  const cli = path.join(HERE, "node_modules", ".bin", "argdown");
  execFileSync(cli, ["json", file, "--outputDir", dir], { stdio: "ignore" });
  const py = JSON.parse(execFileSync("python3",
    [path.join(SKILL, "argdown_provenance.py"), path.join(dir, "occ.json"), dir],
    { encoding: "utf8" }));
  fs.rmSync(dir, { recursive: true, force: true });
  const titles = EMAP.map(c => c.t);
  eq("the map's reading of every fixture claim is the one the fixture wants",
     titles.map(t => [t, js[t] && js[t].line]), titles.map(t => [t, EWANT[t]]));
  eq("  and Python places each at the same line, with the same precision",
     titles.map(t => [t, py[t] && py[t].line, py[t] && py[t].precision]),
     titles.map(t => [t, js[t] && js[t].line, js[t] && js[t].precision]));
}

console.log("\nthe band is derived in ONE place");
{
  // THIS IS WHAT THE TEST IS FOR. The rule lived in `positions` and was then worked out AGAIN by
  // both hosts, and the build's copy drifted: it still filtered headings to level 1 after the
  // rule had moved to `bandLevel`, so every paper whose sections are `##` built a viewer with no
  // sections at all — the same defect, fixed once and left standing in a second copy.
  const hosts = [["the build", "build_argdown_viewer.mjs"],
                 ["the viewer template", "argdown-viewer.template.html"]];
  for (const [what, file] of hosts) {
    const src = fs.readFileSync(path.join(HERE, file), "utf8");
    ok(what + " does not re-derive the band from the headings",
       !/\.section\s*=/.test(src.replace(/pos\.section\s*=\s*pos\.section/g, "")),
       "an assignment to `.section` outside argdown-positions.js is a second copy of the rule");
  }
}

console.log("\ndocument-order seating: the key, not the layout");
{
  // The layout itself needs a DOM and dagre, so it is verified in the browser. What CAN be
  // checked here is the key the seating sorts on, which is where the bug was: a node's section
  // ordinal alone cannot order two claims in the SAME section, and using the line alone breaks
  // the outer level. The key must be the pair, compared section-first.
  const key = n => [n.order == null ? Infinity : n.order,
                    n.docLine == null ? Infinity : n.docLine];
  const before = (a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
  const props = [
    { id: "prop-i", order: 1, docLine: 64 }, { id: "prop-ii", order: 1, docLine: 66 },
    { id: "prop-iii", order: 1, docLine: 72 }, { id: "prop-iv", order: 1, docLine: 74 }
  ];
  eq("same section: claims order by line, not by dagre's whim",
     props.slice().reverse().sort((a, b) => before(key(a), key(b))).map(p => p.id),
     ["prop-i", "prop-ii", "prop-iii", "prop-iv"]);

  // The book map defines claims early and files them under later sections, so the line alone
  // would drag a whole section leftwards. Section wins.
  const secs = [
    { id: "late-section-early-line", order: 24, docLine: 60 },
    { id: "early-section-late-line", order: 3, docLine: 900 }
  ];
  eq("different sections: the section ordinal wins over the line",
     secs.slice().sort((a, b) => before(key(a), key(b))).map(s => s.id),
     ["early-section-late-line", "late-section-early-line"]);

  eq("a node with neither key sorts last, rather than to the front",
     [{ id: "none" }, { id: "has", order: 5, docLine: 1 }]
       .sort((a, b) => before(key(a), key(b))).map(n => n.id), ["has", "none"]);
}

/* ------------------------------------------------- 2. cross-check against the book */

const book = process.argv[2] ? path.resolve(process.argv[2]) : BOOK_DEFAULT;
if (!book) { /* falls through to the skip below */ }
const argdownFile = path.join(book, "_argument.argdown");

console.log("\ncross-check: argdown-positions.js vs argdown_provenance.py");
if (!fs.existsSync(argdownFile)) {
  console.log("  skip  no multi-file reconstruction to cross-check against");
  console.log("        pass a folder as an argument, or set IPSISSIMA_CORPUS");
} else {
  const source = fs.readFileSync(argdownFile, "utf8");
  const res = await argdown.runAsync({ input: source, ...RUN });
  const graph = toGraph(res);

  // Everything the nodes cite, read once.
  const sources = {};
  for (const n of graph.nodes) {
    if (!n.chapter || n.chapter in sources) continue;
    const p = path.join(book, n.chapter);
    sources[n.chapter] = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  }
  const quarto = fs.readFileSync(path.join(book, "_quarto.yml"), "utf8");
  const { byId } = P.positions(graph.nodes, sources, quarto);

  // The Python side, through the same Argdown JSON export it reads in production.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "argpos-"));
  const cli = path.join(HERE, "node_modules", ".bin", "argdown");
  execFileSync(cli, ["json", argdownFile, "--outputDir", tmp], { stdio: "ignore" });
  const exported = path.join(tmp, fs.readdirSync(tmp).find(f => f.endsWith(".json")));
  const py = JSON.parse(execFileSync("python3",
    [path.join(SKILL, "argdown_provenance.py"), exported, book],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  fs.rmSync(tmp, { recursive: true, force: true });

  // Python keys by claim title; the graph keys by map-node id, whose label IS the title.
  const js = {};
  for (const n of graph.nodes) if (byId[n.id]) js[n.label] = byId[n.id];

  // THE TWO POPULATIONS ARE NOT THE SAME, AND SHOULD NOT BE. Python walks every statement in
  // the document; the JS sees only what the MAP draws. Those differ in two legitimate ways:
  // a statement used as a premise or conclusion inside an argument has no map node of its own
  // (the argument carries it), and an argument node is not a statement at all. So the test
  // asserts agreement on the OVERLAP — every claim both can see — and reports the rest rather
  // than failing on it. What would be a real defect is the two disagreeing about a claim they
  // can both see.
  const shared = Object.keys(js).filter(t => py[t]);
  const differ = [];
  for (const t of shared) {
    const a = js[t], b = py[t];
    if (a.line !== b.line || a.precision !== b.precision ||
        a.chapterIndex !== b.chapter_index || a.chapter !== b.chapter)
      differ.push(`${t}: js ${a.precision}@${a.line} vs py ${b.precision}@${b.line}`);
  }
  const pyOnly = Object.keys(py).filter(t => !js[t]);
  const jsOnly = Object.keys(js).filter(t => !py[t]);

  console.log(`  ${Object.keys(py).length} placed by python, ${Object.keys(js).length} by js, ` +
              `${shared.length} in both`);
  console.log(`  python-only ${pyOnly.length} (statements drawn inside an argument), ` +
              `js-only ${jsOnly.length} (argument nodes)`);
  ok("the overlap is most of the map", shared.length > 250, `only ${shared.length} shared`);
  ok("every shared position agrees — chapter, line and precision", differ.length === 0,
     differ.slice(0, 10).join("\n          "));
  ok("no argument node is mistaken for a statement",
     jsOnly.every(t => res.arguments && res.arguments[t]),
     jsOnly.filter(t => !(res.arguments && res.arguments[t])).slice(0, 8).join(", "));

  // The measurements that justified the build, asserted so a regression is visible.
  const xs = new Set(Object.values(js).filter(p => p.line != null)
    .map(p => p.chapterIndex + ":" + p.line));
  const prec = {};
  for (const p of Object.values(js)) prec[p.precision] = (prec[p.precision] || 0) + 1;
  console.log("  precision: " + JSON.stringify(prec));
  ok(`the axis is not a staircase — ${xs.size} distinct positions`, xs.size > 200,
     "the paragraph locator has stopped working; heading precision alone gives 94");
}

/* ------------------------------------------------- 3. cross-check against every sample
 *
 * THE BOOK IS PRIVATE, SO THE CROSS-CHECK ABOVE USUALLY SKIPS, and the two languages drifted
 * where nothing looked: on 27 Sep 2026 they placed ten claims differently across the samples
 * and the private corpus -- among several quotations the JS took the earliest and the Python
 * the first listed, and only the Python knew a soft hyphen is invisible. So every sample is
 * placed by both, as the report and the picture each place it, and every claim both can see
 * must land at the same line with the same precision. About nine seconds. */
{
  const SAMPLES = path.join(HERE, "..", "samples");
  const venv = path.join(HERE, "..", ".venv", "bin", "python3");
  const py = fs.existsSync(venv) ? venv : "python3";
  const cli = path.join(HERE, "node_modules", ".bin", "argdown");
  console.log("\ncross-check: every sample, placed by both languages");
  let both = 0, maps = 0;
  const differ = [];
  if (fs.existsSync(SAMPLES) && fs.existsSync(cli)) {
    for (const d of fs.readdirSync(SAMPLES)) {
      const dir = path.join(SAMPLES, d);
      if (!fs.statSync(dir).isDirectory()) continue;
      const ad = fs.readdirSync(dir).find(f => f.endsWith(".argdown"));
      if (!ad) continue;
      const file = path.join(dir, ad);
      const graph = toGraph(argdown.run({ input: fs.readFileSync(file, "utf8"), ...RUN }));
      const sources = {};
      for (const n of graph.nodes) {
        if (!n.chapter || n.chapter in sources) continue;
        const f = path.join(dir, n.chapter);
        sources[n.chapter] = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
      }
      const yml = "chapters:\n" + Object.keys(sources).map(c => `  - "${c}"`).join("\n") + "\n";
      const { byId } = P.positions(graph.nodes, sources, yml);
      const js = {};
      for (const n of graph.nodes) if (byId[n.id]) js[n.label] = byId[n.id];
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "argpos-sample-"));
      execFileSync(cli, ["json", file, "--outputDir", tmp], { stdio: "ignore" });
      const exported = path.join(tmp, fs.readdirSync(tmp).find(f => f.endsWith(".json")));
      // The JSON export drops the front matter, so its `defaults:` are applied from the file,
      // as check_argdown.py applies them.
      const placed = JSON.parse(execFileSync(py, ["-c",
        "import json,sys; sys.path.insert(0, sys.argv[1]); import argdown_provenance as p; " +
        "d = json.load(open(sys.argv[2])); p.apply_defaults(d, p.read_frontmatter(sys.argv[4]) or {}); " +
        "print(json.dumps(p.text_positions(d, sys.argv[3], p.check_quotations(d, sys.argv[3]))))",
        SKILL, exported, dir, file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
      fs.rmSync(tmp, { recursive: true, force: true });
      maps++;
      for (const t of Object.keys(js)) {
        if (!placed[t]) continue;
        both++;
        if (js[t].line !== placed[t].line || js[t].precision !== placed[t].precision)
          differ.push(`${d.slice(0, 24)} / ${t.slice(0, 36)}: js ${js[t].precision}@${js[t].line}` +
                      ` py ${placed[t].precision}@${placed[t].line}`);
      }
    }
  }
  if (!maps) console.log("  skip  no samples, or no Argdown CLI, to cross-check against");
  else {
    ok(`${maps} samples, ${both} claims placed by both`, both > 500, `only ${both}`);
    ok("  and every one at the same line, with the same precision", differ.length === 0,
       differ.slice(0, 8).join("\n          "));
  }
}

/* ------------------------------------------------------------------ the border rule ---- */
/* THE SECOND RULE THIS FILE POLICES, and it is here for the reason the first one is.
 *
 * `quotation` is the one fidelity level with a fact of the matter, and the map draws it as a
 * solid border — a claim asserting that these are the author's own words. Until now the border
 * was CHECKED only when `build_argdown_viewer.mjs` was given `--source-root`: that is the sole
 * caller of `--derive-fidelity`. A folder opened in the app, a folder dropped on the standalone,
 * a bundle, and every exported page drew the border AS DECLARED — and those are the ordinary
 * ways to read a reconstruction now.
 *
 * So the rule exists in JavaScript too (`ArgdownPositions.isVerbatim`) and the app can check
 * rather than believe. Python's copy cannot go — `--fix` writes markers with it and the MCP
 * reading checks use it — so the two are pinned against each other here, exactly as the
 * positions rule above is.
 *
 * Measured when this was written: 251 adjudicated claims across the published corpus, 251
 * agreements, 0 disagreements. Re-measured 3 Sep 2026, when the page began adjudicating
 * borders itself: 512 and 512.
 *
 * SHOWN ABLE TO FAIL, 3 Sep 2026: replacing foldPunctuation's " " with "X" (punctuation no
 * longer folds away) fails four checks here, including the corpus cross-check with
 * `py=quotation js=paraphrase` disagreements. A harness that has never failed is worth
 * nothing. */
{
  const fold = P.foldPunctuation, verb = P.isVerbatim;
  ok("punctuation and case fold away", verb("The cat sat", "the cat, sat on the mat"));
  ok("  and trimming at the ends stays verbatim", verb("cat sat", "the cat sat on the mat"));
  ok("a word dropped INSIDE is not verbatim", !verb("cat mat", "the cat sat on the mat"));
  ok("  nor is a word substituted",
     !verb("the cat lay on the mat", "the cat sat on the mat"));
  ok("an empty claim is never verbatim", !verb("", "anything at all"));

  // THE ONE PLACE THE TWO LANGUAGES CAN DRIFT. Python's `\w` is Unicode-aware and JavaScript's
  // is ASCII-only, so `[^\w\s]` would treat an accented letter as punctuation here and as a
  // letter there. On a corpus containing Etiévant that is not hypothetical.
  eq("an accented letter is a letter, not punctuation",
     fold("Etiévant argues"), "etiévant argues");
  eq("  and a dash between words is punctuation",
     fold("well-known case"), "well known case");
  eq("  as is an em dash", fold("a claim — and its hedge"), "a claim and its hedge");
}

/* THE FIXTURES PROVE THE RULE; ONLY THE CORPUS PROVES THE TWO LANGUAGES AGREE. Same reasoning
 * as the book cross-check above, and the same shape: run Python's `--derive-fidelity` over each
 * sample, ask the JavaScript the same question of the same claims, and require every answer to
 * match. Skipped with a notice where the Argdown CLI or the venv is missing, so a bare checkout
 * still runs everything that does not need them. */
{
  const SAMPLES = path.join(HERE, "..", "samples");
  const venv = path.join(HERE, "..", ".venv", "bin", "python3");
  const py = fs.existsSync(venv) ? venv : "python3";
  const CHECK = path.join(HERE, "..", "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py");
  let agree = 0, disagree = 0, ran = 0;
  const bad = [];
  if (fs.existsSync(SAMPLES) && fs.existsSync(CHECK)) {
    for (const dir of fs.readdirSync(SAMPLES)) {
      const d = path.join(SAMPLES, dir);
      if (!fs.statSync(d).isDirectory()) continue;
      const ad = fs.readdirSync(d).find(f => f.endsWith(".argdown"));
      const srcDir = path.join(d, "source");
      if (!ad || !fs.existsSync(srcDir)) continue;
      let declared;
      try {
        declared = JSON.parse(execFileSync(py, [CHECK, path.join(d, ad), "--source-root", d,
                                                "--derive-fidelity"],
                                           { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
      } catch { continue; }
      const body = fs.readdirSync(srcDir).filter(f => f.endsWith(".md"))
        .map(f => fs.readFileSync(path.join(srcDir, f), "utf8")).join("\n\n");
      const res = argdown.run({ input: fs.readFileSync(path.join(d, ad), "utf8"), ...RUN });
      const g = toGraph(res);
      for (const [title, want] of Object.entries(declared)) {
        const node = g.nodes.find(x => x.label === title || x.id === title);
        const text = node ? (node.detail || node.label) : null;
        if (!text) continue;
        ran++;
        const got = P.isVerbatim(text, body) ? "quotation" : "paraphrase";
        if (got === want) agree++;
        else { disagree++; if (bad.length < 4) bad.push(`${dir.slice(0, 22)} / ${title.slice(0, 34)}: py=${want} js=${got}`); }
      }
    }
  }
  if (!ran) console.log("  skip  no corpus to cross-check the border rule against");
  else ok(`the border rule agrees with Python on all ${ran} adjudicated claims`,
          disagree === 0, bad.join("\n          "));
}

console.log(`\n${fail ? "FAILED" : "all checks passed"} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
