/* test_relation_colours.mjs — every relation Argdown can emit has a colour of its own.
 *
 *   node app/test_relation_colours.mjs
 *
 * THE FAILURE THIS PINS. The renderer looks a relation up by Argdown's own `relationType`
 * string and falls back to `REL.support` when it finds nothing. A fallback is the right
 * behaviour for an unknown name; it is the wrong behaviour for a name Argdown emits routinely,
 * because the map then draws an objection in the green that means "this is a reason for that".
 * Nothing fails, nothing is logged, and the picture asserts the opposite of the file.
 *
 * It had happened twice over. The table said `contradiction`; Argdown says `contradictory`, so
 * every `><` drew as support — four of them in the shipped Akhlaghi map. And `model.mode:
 * strict` renames all three relations, emitting `entails`, `contrary` and `contradictory` and
 * never `support` or `attack` at all, so a strict map drew its attacks green as well.
 *
 * So this asks Argdown rather than a list written by hand: parse files that use every relation
 * in both modes, collect what comes out, and require the table to cover it.
 */
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const RUN_MODEL = () => RUN.model;

const HERE = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const check = (name, ok, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
};

/** The table the renderer actually uses, read out of the source rather than duplicated here. */
function relationTable() {
  const src = fs.readFileSync(path.join(HERE, "src", "argdown-live-map.js"), "utf8");
  const m = src.match(/const REL = \{([\s\S]*?)\n\};/);
  if (!m) throw new Error("could not find the REL table in argdown-live-map.js");
  return new Set([...m[1].matchAll(/^\s*([A-Za-z]+)\s*:/gm)].map(x => x[1]));
}

const LOOSE = `[A]: alpha.
    + [S]: supports.
    - [T]: attacks.
    >< [C]: contradicts.

<Arg>: an argument.
    + [A]

<Arg>
    _ [U]: undercuts.
`;

const STRICT = `===
model:
    mode: strict
===

[A]: alpha.
    + [S]: entails.
    - [T]: contrary.
    >< [C]: contradictory.
`;

function typesIn(text) {
  const res = argdown.run({ input: text, ...RUN });
  const g = toGraph(res);
  return new Set((g.edges || []).map(e => e.type));
}

console.log("== relation colours\n");

const REL = relationTable();
console.log(`the table covers: ${[...REL].sort().join(", ")}\n`);

for (const [label, text] of [["loose mode", LOOSE], ["strict mode", STRICT]]) {
  const got = typesIn(text);
  check(`${label} parses to relations`, got.size > 0, "no edges came back at all");
  const missing = [...got].filter(t => !REL.has(t));
  check(`  every ${label} relation has its own entry`, missing.length === 0,
        `these fall through to REL.support and draw GREEN: ${missing.join(", ")}`);
  console.log(`        emitted: ${[...got].sort().join(", ")}`);
}

/* The regression itself, on the file it was found in. A shipped sample drawing four objections
 * as support is the case that made this worth a test rather than a comment. */
const sample = path.join(HERE, "..", "samples",
  "Akhlaghi 2023 - Transformative experience and revelatory autonomy",
  "akhlaghi-revelatory-autonomy.argdown");
if (fs.existsSync(sample)) {
  const got = typesIn(fs.readFileSync(sample, "utf8"));
  const missing = [...got].filter(t => !REL.has(t));
  check("the Akhlaghi sample draws nothing as the wrong relation", missing.length === 0,
        `uncoloured: ${missing.join(", ")}`);
}

/* ONE FILE MUST NOT CHANGE HOW THE NEXT ONE PARSES. `RUN` is spread into every request, a
 * spread is shallow, and Argdown merges a file's front matter into the request's `model` -- so
 * a single strict-mode file used to leave `mode: strict` in the shared object and every later
 * parse in the process inherited it. `rebuild_viewers.mjs` builds every viewer in one process
 * and the editor re-parses on every pause in typing, so the blast radius was the whole session.
 */
{
  const before = typesIn(LOOSE);
  typesIn(STRICT);
  const after = typesIn(LOOSE);
  const same = [...before].sort().join(",") === [...after].sort().join(",");
  check("a strict-mode file does not make later parses strict", same,
        `loose gave ${[...before].sort().join(",")} before and ` +
        `${[...after].sort().join(",")} after a strict file was parsed`);
  check("  and the shared config is left as it was found",
        JSON.stringify(RUN_MODEL()) === '{"removeTagsFromText":true}',
        `RUN.model is now ${JSON.stringify(RUN_MODEL())}`);
}

/* A name Argdown does NOT emit must still fall back rather than throw — the fallback is right
 * for the unknown case and this keeps a future tightening from removing it. */
check("an unknown relation still has somewhere to fall back to", REL.has("support"),
      "REL.support is the fallback and must exist");

/* ------------------------------------------------- the other hand-written table */
/* SAME CLASS OF BUG, found the same day. Two implementations carry a list of Argdown's symbol
 * shortcodes -- the checker's `SHORTCODES` and the editor's linter regex -- and BOTH were
 * missing the same four: `.^.` `.v_.` `.<>.` `.[].`. A heading containing one is silently
 * rewritten by the parser, which breaks every `selectedSections` and `folded=` reference to it,
 * and neither implementation said a word.
 *
 * So ask the parser instead of comparing the two copies against each other, which would have
 * agreed while both were wrong. */
console.log("\n== symbol shortcodes\n");

const LOGIC = [".A.", ".E.", ".~.", ".v.", ".->.", ".<->.", ".P.", ".O.",
               ".^.", ".v_.", ".<>.", ".[]."];
{
  // The parser's own table, read after a parse rather than remembered.
  const cfg = { process: ["parse-input", "build-model", "build-map", "export-json"],
                model: { removeTagsFromText: true }, logLevel: "error" };
  argdown.run({ input: "[a]: x.\n", ...cfg });
  const known = new Set(Object.keys(cfg.model.shortcodes || {}));
  const unknown = LOGIC.filter(s => !known.has(s));
  check("every code this test names is real", unknown.length === 0, `not in the parser: ${unknown}`);

  // The Python checker's copy.
  const py = fs.readFileSync(path.join(HERE, "..", "ipsissima-mcp", "src", "ipsissima_mcp",
                                       "check_argdown.py"), "utf8");
  const block = py.match(/SHORTCODES = \{([\s\S]*?)\}/)[1];
  const inPy = LOGIC.filter(s => block.includes(`"${s}"`));
  check("the checker's SHORTCODES covers all twelve", inPy.length === LOGIC.length,
        `missing: ${LOGIC.filter(s => !inPy.includes(s))}`);

  // The editor's linter regex, applied rather than read.
  const ed = fs.readFileSync(path.join(HERE, "argdown-editor.src.mjs"), "utf8");
  const src = ed.match(/const sc = line\.match\((\/.*?\/)\);/)[1];
  const re = new RegExp(src.slice(1, -1));
  const missed = LOGIC.filter(s => { const m = `x ${s} y`.match(re); return !m || m[0] !== s; });
  check("  and the editor's linter warns on all twelve", missed.length === 0,
        `not matched exactly: ${missed}`);
  check("  without firing on ordinary prose",
        !re.test("a sentence. Another one.") && !re.test("version 1.0. Next"), true);
}

console.log();
if (fails) { console.log(`${fails} FAILED\n`); process.exit(1); }
console.log("all passed\n");
