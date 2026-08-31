/* The JavaScript half of the pair, against the SAME vectors ipsissima-mcp/tests/test_validity.py
 * runs. Two implementations of one decision procedure will drift; this is what stops them. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const V = require(path.join(HERE, "src", "argdown-validity.js"));
const VECTORS = JSON.parse(fs.readFileSync(
  path.join(HERE, "..", "ipsissima-mcp", "tests", "validity-vectors.json"), "utf8"));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let fails = 0;

for (const c of VECTORS.cases) {
  const got = V.checkStep(c.premises, c.conclusion);
  const problems = [];

  if (got.supported !== c.supported)
    problems.push(`supported=${got.supported}, expected ${c.supported}`);
  else if (!c.supported) {
    if (c.error_contains && !String(got.error || "").includes(c.error_contains))
      problems.push(`error ${JSON.stringify(got.error)} does not mention ${JSON.stringify(c.error_contains)}`);
  } else {
    for (const key of ["valid", "irrelevant", "consistent"])
      if (key in c && !same(got[key], c[key]))
        problems.push(`${key}=${JSON.stringify(got[key])}, expected ${JSON.stringify(c[key])}`);
    if (got.valid && got.countermodel !== null) problems.push("valid but carries a countermodel");
    if (!got.valid && got.countermodel === null) problems.push("invalid but names no countermodel");
  }

  if (problems.length) { fails++; console.log(`  FAIL  ${c.name}`); problems.forEach(p => console.log(`          ${p}`)); }
  else console.log(`  ok    ${c.name}`);
}

console.log();
if (fails) { console.log(`${fails} of ${VECTORS.cases.length} failed`); process.exit(1); }
console.log(`all ${VECTORS.cases.length} vectors pass`);
