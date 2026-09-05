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
 * character after a metadata block's closing brace took a whole map to nothing, with the
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
import { toGraph, RUN, friendlyParseMessage } from "./argdown-graph.mjs";
import { traps } from "./argdown-editor.src.mjs";

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
// FOUND, NOT NAMED. This used to pin an exact string — `reviewed: "2026-08-18"}` followed by a
// particular argument title — and a node count of 23. Both were facts about one version of one
// reconstruction, so rebuilding the Darwin map under better instructions broke four checks in a
// test that is not about Darwin at all. The behaviour being pinned is the PARSER's: a YAML error
// inside any `{…}` empties the document in silence. So the test now finds a metadata block for
// itself and takes the map's size as it is.
// STATED AS AN EXISTENTIAL, because that is what the claim actually is. The first version of
// this pinned one exact string and a node count of 23 — facts about one version of one
// reconstruction — so rebuilding the Darwin map broke four checks in a test that is not about
// Darwin. The second version searched for the shape and found a different one, because WHERE
// the damage falls changes what the parser does: inside a premise-conclusion structure it
// empties the document AND reports; before a relation line it empties in silence.
//
// The claim worth pinning is neither of those positions. It is that SOME position in a real
// reconstruction produces the silent case — an emptied document with nothing raised anywhere —
// because that is what the viewer's guard exists for and what no error count would catch. So
// damage every metadata block in turn and require at least one to be silent.
const closes = [...darwin.matchAll(/\}/g)].map(m => m.index);
check("the fixture has metadata blocks to damage", closes.length > 0, true);
const realGood = parse(darwin);
check("the sample parses to its claims", realGood.nodes > 0, true);

let silent = 0, emptied = 0;
for (const i of closes) {
  const r = parse(darwin.slice(0, i + 1) + "Z" + darwin.slice(i + 1));
  if (r.threw) continue;
  if (r.nodes === 0) emptied++;
  if (r.nodes === 0 && r.reported === 0) silent++;
}
check(`a stray character after a closing brace empties the document (${emptied} of ${closes.length} places)`,
      emptied > 0, true);
check("  and in at least one place it does so with NOTHING raised anywhere",
      silent > 0, true);
check("  which is why an error count cannot be the signal", silent > 0 && emptied >= silent, true);

console.log("\nthe rule the viewer depends on");
// The guard is "empty now, not empty before" — so an empty file must stay legitimately empty
// rather than being reported as broken, or opening a new reconstruction would look like a fault.
check("an empty file is empty, not an error", parse("").nodes, 0);
check("  and so is one holding only a comment", parse("// nothing here yet\n").nodes, 0);

// THE TRANSLATION, held to what was measured (docs/EDITOR-PLAN.md §1): exactly one chevrotain
// shape is reworded, the parser's own long messages pass through untouched, and the raw words
// always survive on the end — the translation is ours, the authority is not.
console.log("\nthe one message worth translating");
{
  const eof = t => `Expecting token of type --> EOF <-- but found --> '${t}' <--`;
  const colon = friendlyParseMessage(eof("text without the colon"),
                                     "[claim] text without the colon");
  check("a bare reference followed by text points at the missing colon",
        /put a `:` after/.test(colon), true);
  const twice = friendlyParseMessage(eof("[b]:"), "[a]: One. [b]: Two.");
  check("  a second claim on the line is named as one",
        /each claim needs its own line/.test(twice), true);
  check("  and both keep the parser's own words",
        /The parser said: Expecting token/.test(colon) &&
        /The parser said: Expecting token/.test(twice), true);
  const official = "Invalid relation syntax. This may either be caused by a) an invalid " +
                   "relation parent or b) invalid indentation.";
  check("  the parser's own teaching passes through untouched",
        friendlyParseMessage(official, "+ [a]: x"), official);
  const other = "Expecting token of type --> Dedent <-- but found --> 'x' <--";
  check("  and an unmeasured shape is not guessed at",
        friendlyParseMessage(other, "x"), other);
}

// THE FOURTH TRAP: an unclosed bracket is not a syntax error, which is the trap — `[claim:
// text` parses as ordinary prose (measured 5 Sep 2026), so no claim is defined and nothing
// says so. The shapes that must NOT fire are as load-bearing as the one that must.
console.log("\nthe unclosed-title trap");
{
  const hits = t => traps(t).filter(d => /never closes/.test(d.message)).length;
  check("`[claim: text` with no closing bracket is flagged", hits("[claim: The text.\n"), 1);
  check("  the `<` variant too", hits("<arg: How it runs.\n"), 1);
  check("  a closed title does not fire", hits("[claim]: The text.\n"), 0);
  check("  a bracketed aside in prose does not fire",
        hits("[a]: He wrote [sic: as written] here.\n"), 0);
  check("  a relation line does not fire", hits("[a]: One.\n    <+ [b]: Two.\n"), 0);
  check("  a comment does not fire", hits("// [claim: not real\n"), 0);
}

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
