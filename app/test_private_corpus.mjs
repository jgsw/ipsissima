/* test_private_corpus.mjs — the coverage that cannot be published, run when it is there.
 *
 *   IPSISSIMA_PRIVATE_CORPUS=/path/to/folder node app/test_private_corpus.mjs
 *
 * Some of what is most worth testing cannot live in this repository: articles in copyright, and
 * Argdown's own sample maps, which belong to that project. `fixtures/private-corpus.json` names
 * them; the files themselves sit wherever the author keeps them.
 *
 * THE RULE THIS FILE OBEYS. A clone with no private corpus must be GREEN and must still be told
 * what exists — a skip that says nothing is how coverage quietly stops running. So an absent
 * folder is a skip with a reason, an absent FILE is named, and a present file is actually
 * exercised rather than merely counted.
 *
 * What it exercises is the part the public corpus is worst at: Argdown's own maps use the whole
 * language, including the constructs no reconstruction in `samples/` happens to contain.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(HERE, "..", "fixtures", "private-corpus.json");

let fails = 0;
const check = (name, ok, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
};

console.log("== the private corpus\n");

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const root = process.env[manifest.env];

if (!root || !fs.existsSync(root)) {
  console.log(`  SKIP  ${manifest.env} is ${root ? "set to a folder that is not there" : "not set"}`);
  console.log(`        ${manifest.entries.length} private fixtures are not being exercised.`);
  console.log("        They are named in fixtures/private-corpus.json; docs/CORPUS.md says why.");
  console.log("\nskipped\n");
  process.exit(0);
}

console.log(`  ${manifest.env} = ${root}\n`);

/** Every relation Argdown emits must have a colour, or it draws as green support. */
const REL = new Set([...fs.readFileSync(path.join(HERE, "src", "argdown-live-map.js"), "utf8")
  .match(/const REL = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s*([A-Za-z]+)\s*:/gm)].map(x => x[1]));

const missing = [];
let drawn = 0;

for (const e of manifest.entries) {
  const p = path.join(root, e.path);
  if (!fs.existsSync(p)) { missing.push(e); continue; }
  if (e.role !== "display" || e.format !== "argdown") continue;

  const name = path.basename(e.path);
  let res;
  try {
    res = argdown.run({ input: fs.readFileSync(p, "utf8"), ...RUN });
  } catch (err) {
    check(`${name} parses`, false, String(err).slice(0, 200));
    continue;
  }
  const g = toGraph(res);
  const n = (g.nodes || []).length;
  // An emptied document is the silent failure `test_parse_failure.mjs` exists for: the parser
  // reports nothing and hands back a map with no claims in it.
  check(`${name} parses to a map`, n > 0, `0 nodes — ${e.catches}`);
  if (n === 0) continue;
  drawn++;

  const types = [...new Set((g.edges || []).map(x => x.type))];
  const uncoloured = types.filter(t => !REL.has(t));
  check(`  every relation in it has a colour`, uncoloured.length === 0,
        `these draw as green support: ${uncoloured.join(", ")}`);
  console.log(`        ${n} nodes, ${(g.edges || []).length} edges [${types.sort().join(", ")}]`);
}

console.log();
if (missing.length) {
  console.log(`  ${missing.length} named fixture(s) are not in the folder:`);
  for (const e of missing) console.log(`      ${e.path}  — would catch: ${e.catches}`);
  console.log();
}
console.log(`  ${drawn} display fixture(s) exercised, ${missing.length} absent\n`);

if (fails) { console.log(`${fails} FAILED\n`); process.exit(1); }
console.log("all passed\n");
