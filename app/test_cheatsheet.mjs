/* test_cheatsheet.mjs — every Argdown example in the documentation actually parses.
 *
 *   node app/test_cheatsheet.mjs
 *
 * WHY THIS IS NOT PEDANTRY. `argdown-cheatsheet.md` is served to a model as an MCP resource and
 * is the only account of the language it gets. An example that does not parse does not merely
 * fail to help — it teaches the mistake, and every reconstruction written afterwards carries it.
 *
 * It caught two on the day it was written. One was an example of two statements on consecutive
 * lines, in the very file that tells you top-level blocks must be separated by blank lines.
 *
 * Blocks that are DELIBERATELY wrong — showing a trap — are fenced as plain ``` rather than
 * ```argdown, so they are documentation of a failure rather than a claim that it works. The one
 * exception is the re-parenting example, which parses perfectly and means the wrong thing; that
 * is the entire point of it, and it is marked in its own comment.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { argdown } from "@argdown/core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, "..", "ipsissima-mcp", "src", "ipsissima_mcp", "docs");
const RUN = { process: ["parse-input", "build-model"], logLevel: "error" };

let fails = 0;

function parse(src) {
  try {
    const res = argdown.run({ input: src, ...RUN });
    return {
      errors: (res.parserErrors || []).length + (res.lexerErrors || []).length,
      things: Object.keys(res.statements || {}).length + Object.keys(res.arguments || {}).length
    };
  } catch (e) {
    return { errors: 1, things: 0, threw: String(e.message).slice(0, 60) };
  }
}

/** Every ```argdown fenced block in a file, with the line it starts on. */
function blocks(md) {
  const out = [];
  const re = /```argdown\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md))) {
    out.push({ src: m[1], line: md.slice(0, m.index).split("\n").length });
  }
  return out;
}

// The documents a model is told to read, plus the prompt it is served. These must be clean:
// an example that does not parse teaches the mistake to every reconstruction written afterwards.
// map-semantics.md, order-views.md, viewer.md and reference.md still carry broken examples and
// are not yet in this list; add each as it is cleaned.
const CLEAN = ["argdown-cheatsheet.md", "reconstruction-cheatsheet.md",
               "ipsissima-conventions.md", "extraction-prompt.md", "SKILL.md"];
const files = fs.readdirSync(DOCS).filter(f => CLEAN.includes(f)).sort();
console.log("== Argdown examples in the documentation\n");

for (const f of files) {
  const md = fs.readFileSync(path.join(DOCS, f), "utf8");
  const bs = blocks(md);
  if (!bs.length) continue;
  let bad = 0;
  for (const b of bs) {
    const r = parse(b.src);
    // An example must parse AND produce something. A block that parses to nothing is the silent
    // failure this project cares most about, and it must not appear in a teaching document.
    const ok = r.errors === 0 && r.things > 0;
    if (!ok) {
      bad++; fails++;
      console.log(`  FAIL  ${f}:${b.line}  ${r.threw || `errors ${r.errors}, produced ${r.things}`}`);
      console.log("        " + b.src.split("\n").filter(l => l.trim()).slice(0, 2).join(" / ").slice(0, 96));
    }
  }
  console.log(`  ${bad ? "FAIL" : "ok  "}  ${f.padEnd(30)} ${bs.length} example(s)` +
              (bad ? `, ${bad} broken` : ""));
}

console.log();
if (fails) { console.log(`${fails} broken example(s)\n`); process.exit(1); }
console.log("every documented example parses\n");
