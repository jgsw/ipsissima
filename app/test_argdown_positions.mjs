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
}

console.log("\npositions: precision order");
{
  const sources = {
    "A.md": ["# Top", "x".repeat(140),
             "# S", "ritual opacity ceremony " + "filler ".repeat(30)].join("\n")
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

console.log(`\n${fail ? "FAILED" : "all checks passed"} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
