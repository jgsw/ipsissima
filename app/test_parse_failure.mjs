/* test_parse_failure.mjs — how the parser fails, which is not how you would expect.
 *
 *   node app/test_parse_failure.mjs
 *
 * THE TRAP. `argdown.run` does not throw on every syntax error, and for one important class it
 * does not throw at all: a `{…}` metadata block and the `===` front matter are YAML, and a YAML
 * error inside one is caught, logged, and turned into an EMPTY DOCUMENT. Nothing is raised,
 * `parserErrors` and `lexerErrors` both stay at zero, and the caller gets a perfectly ordinary
 * graph with no claims in it.
 *
 * WHY THAT MATTERS HERE. The viewer parses on every pause while you type, and its rule is that a
 * parse error must never blank the map — half the keystrokes in a line leave the file invalid,
 * and a picture that vanished at each of them would be unusable. That rule was written as a
 * `try/catch`, so it protected against the errors that throw and none of these. Typing one stray
 * character after a metadata block's closing brace took a 23-claim map to nothing, with the
 * header still reporting "edited".
 *
 * So the viewer treats an empty graph as a failure when the last good one was not empty, and
 * these tests hold the two halves of that: the parser really does behave this way, and it really
 * does still throw or report for the errors it does catch. If a future Argdown starts throwing
 * here, the first test fails and the guard can be simplified — which is the point of pinning it.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;

function check(name, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

/** What the viewer does: parse, and count what came back. Never throws. */
function parse(text) {
  try {
    const res = argdown.run({ input: text, ...RUN });
    return { threw: false, nodes: (toGraph(res).nodes || []).length,
             reported: (res.parserErrors || []).length + (res.lexerErrors || []).length };
  } catch (e) {
    return { threw: true, nodes: 0, reported: 0 };
  }
}

const GOOD = `[main]: A contention.
    {note: "fine"}
    + [reason]: Because of this.
`;

console.log("== how the parser fails\n");
console.log("a file that is fine");
const good = parse(GOOD);
check("parses", good.threw, false);
check("  and has its claims", good.nodes, 2);
check("  and reports nothing", good.reported, 0);

console.log("\na YAML error in a metadata block — the silent class");
// ON A REAL FILE, and that is the point. A toy fixture happens to report `parserErrors: 1` for
// the same mistake; the Darwin sample reports nothing at all. So the error counts cannot be
// trusted as the signal, and an emptied document is all a caller reliably gets.
const darwin = fs.readFileSync(path.join(HERE, "..", "samples",
  "Darwin 1859 - Natural selection", "darwin-natural-selection.argdown"), "utf8");
const anchor = 'reviewed: "2026-08-18"}\n    + <The Divergence Argument>';
check("the fixture still contains the line this edits", darwin.includes(anchor), true);
const realGood = parse(darwin);
check("the sample parses to its claims", realGood.nodes, 23);

// One stray character after the closing brace, which is what a model writing Argdown gets wrong
// and what a reader gets wrong reaching for the end of a line.
const realBroken = parse(darwin.replace(anchor, 'reviewed: "2026-08-18"}Z\n    + <The Divergence Argument>'));
check("does NOT throw", realBroken.threw, false);
check("  and reports NO parser or lexer error — nothing, on a real file",
      realBroken.reported, 0);
check("  but empties the document, which is the only signal there is", realBroken.nodes, 0);
check("  so 23 claims become 0 with nothing raised anywhere",
      realGood.nodes > 0 && realBroken.nodes === 0 && realBroken.reported === 0, true);

console.log("\na structural error — the class that IS reported");
const structural = parse("[a]: text\n  \n    ++ [b]: nope\n");
check("comes back with no claims as well",
      structural.nodes === 0 || structural.reported > 0, true);

console.log("\nthe rule the viewer depends on");
// The guard is "empty now, not empty before" — so an empty file must stay legitimately empty
// rather than being reported as broken, or opening a new reconstruction would look like a fault.
check("an empty file is empty, not an error", parse("").nodes, 0);
check("  and so is one holding only a comment", parse("// nothing here yet\n").nodes, 0);

// The guard lives in the viewer template; this holds the wiring so the two cannot drift apart
// silently, which is the same reason test_argdown_positions.mjs exists.
console.log("\nthe guard is wired in the viewer");
const tpl = fs.readFileSync(path.join(HERE, "argdown-viewer.template.html"), "utf8");
check("schedulePreview checks for an emptied graph", /if \(!n && LAST_GOOD_N > 0/.test(tpl), true);
check("  and the baseline is set wherever a map is drawn",
      /function redrawFrom\(graph\)\{[\s\S]{0,400}?LAST_GOOD_N =/.test(tpl), true);

console.log();
if (fails) { console.log(`${fails} FAILED\n`); process.exit(1); }
console.log("all passed\n");
