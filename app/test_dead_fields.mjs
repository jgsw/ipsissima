/* A field the renderer reads and the adapter never writes.
 *
 * WHY THIS EXISTS. `n.full` was read in three places in the renderer and set in none, from the
 * first commit of this repository -- carried out of the workspace Ipsissima was extracted from,
 * where something presumably wrote it. It looked alive for eleven months because it was always
 * read as `n.full || somethingElse`, so the live half answered and the dead half never showed.
 *
 * The moment a change depended on it alone, seven claims on the Miller map were clipped
 * mid-sentence in the box with the rest available nowhere, and the author found it by hovering.
 *
 * THAT IS THE WHOLE CLASS: a dead field is indistinguishable from a live one right up until it
 * is load-bearing, and no amount of testing the behaviour finds it, because until that day the
 * behaviour is correct. What finds it is asking the two sides of the boundary whether they agree
 * about the names.
 *
 *   node app/test_dead_fields.mjs
 *
 * One side is measured, not parsed: `toGraph` is RUN over the corpus and the keys it actually
 * produces are collected. The other is read out of the projection where the renderer copies a
 * graph node into a drawn one, which is the one place the two vocabularies meet.
 */
import { argdown } from "@argdown/core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const RENDERER = path.join(HERE, "src", "argdown-live-map.js");

let fails = 0, checks = 0;
const check = (ok, what, detail) => {
  checks++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}${detail ? "\n         " + detail : ""}`);
  if (!ok) fails++;
};

/* ------------------------------------------------------------------ what the adapter emits */

/** Every key that appears on a node of any map in the corpus. Measured rather than declared:
 *  a key the adapter can emit but never does is dead in the same way and for the same reason. */
function emittedKeys() {
  const keys = new Set();
  let files = 0;
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".argdown")) {
        let res;
        try { res = argdown.run({ input: fs.readFileSync(p, "utf8"), ...RUN }); }
        catch { return; }
        const g = toGraph(res);
        files++;
        for (const n of g.nodes || []) for (const k of Object.keys(n)) keys.add(k);
      }
    }
  };
  for (const dir of ["samples", "fixtures/display"]) {
    const base = path.join(REPO, dir);
    if (fs.existsSync(base)) walk(base);
  }
  return { keys, files };
}

/* A KEY THE CORPUS DOES NOT SHOW IS NOT NECESSARILY DEAD, and the first run of this lint
 * reported two that were perfectly alive:
 *
 *   `comment`  someone else's marginalia. Optional, and no map in the corpus carries one, so it
 *              never appears in a measured key set -- but `marginOf` writes it when it is there.
 *   `pos`      where in the manuscript a claim sits. Written by a LATER STAGE,
 *              `build_argdown_viewer.mjs`, long after `toGraph` has returned.
 *
 * So the question is not "does this corpus show it" but "does anything write it". Measuring the
 * corpus catches what is actually produced; scanning for an assignment catches what is optional
 * or produced downstream. A field that fails BOTH is `n.full`. */
function assignedAnywhere() {
  const keys = new Set();
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(e.name) && p !== RENDERER)
        for (const m of fs.readFileSync(p, "utf8").matchAll(/\.([A-Za-z_$][\w$]*)\s*=[^=]/g))
          keys.add(m[1]);
    }
  };
  walk(HERE);
  return keys;
}

/* ------------------------------------------------------------------ what the renderer reads */

/** The projection: the object literal where a graph node becomes a drawn node. Located by its
 *  first and last lines rather than by a line number, so it survives the file moving around. */
function projection(src) {
  const lines = src.split("\n");
  const from = lines.findIndex(l => l.includes("id: n.id, label: n.label || n.id"));
  if (from < 0) return null;
  const to = lines.findIndex((l, i) => i > from && l.includes("expandable: (hiddenBelow"));
  if (to < 0) return null;
  return lines.slice(from, to + 1).join("\n");
}

function readKeys(block) {
  const keys = new Set();
  for (const m of block.matchAll(/\bn\.([A-Za-z_$][\w$]*)/g)) keys.add(m[1]);
  return keys;
}

/* ------------------------------------------------------------------ the check */

const { keys: emitted, files } = emittedKeys();
check(files >= 5 && emitted.size > 10,
      `the adapter was run over the corpus (${files} files, ${emitted.size} keys)`);

const src = fs.readFileSync(RENDERER, "utf8");
const block = projection(src);
check(!!block, "the graph-to-renderer projection was found",
      block ? "" : "its first or last line has changed; update the anchors in this file");

if (block) {
  const read = readKeys(block);
  check(read.size > 10, `the projection reads ${read.size} fields off a graph node`);

  /* THE CHECK ITSELF. A name read here and produced by nothing is `n.full` again. */
  const written = assignedAnywhere();
  const alive = k => emitted.has(k) || written.has(k);
  const dead = [...read].filter(k => !alive(k)).sort();
  check(dead.length === 0,
        "every field the renderer reads is one the adapter emits",
        dead.length ? `read but never written: ${dead.join(", ")}` : "");

  /* AND THE OTHER DIRECTION, which is information rather than a fault: a key the adapter
   * computes and carries across that nothing on the far side ever asks for. Reported, not
   * failed -- some are read by other hosts, and the desktop app is one. */
  const rest = src.slice(0, src.indexOf(block)) + src.slice(src.indexOf(block) + block.length);
  const unread = [...emitted].filter(k => !readKeys(block).has(k))
    .filter(k => !new RegExp(`\\.${k}\\b`).test(rest)).sort();
  console.log(unread.length
    ? `  --    ${unread.length} emitted and never read here: ${unread.join(", ")}`
    : "  --    every emitted field is read somewhere");
}

/* ------------------------------------------------------------------ proving the check
 *
 * The rule this project holds every instrument to. A lint that cannot report a dead field is
 * worth nothing, and the way to know is to give it one. */
console.log("\n  mutations");
{
  const written = assignedAnywhere();
  const alive = k => emitted.has(k) || written.has(k);
  const mutated = block.replace("id: n.id,", "id: n.id, ghost: n.__nothingEverSetsThis || null,");
  const dead = [...readKeys(mutated)].filter(k => !alive(k));
  check(dead.includes("__nothingEverSetsThis"),
        "MUTATION caught: a field read but never written",
        "the lint passed with a dead read present");
}
{
  // And it must not cry wolf: a field that IS emitted must not be reported.
  const written2 = assignedAnywhere();
  const alive2 = k => emitted.has(k) || written2.has(k);
  const live = [...emitted][0];
  const mutated = block.replace("id: n.id,", `id: n.id, echo: n.${live} || null,`);
  const dead = [...readKeys(mutated)].filter(k => !alive2(k));
  check(!dead.includes(live), `MUTATION caught: a live field is not reported (${live})`,
        "the lint reported a field the adapter does emit");
}

console.log(`\n${checks} checks`);
if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log("the two sides of the boundary agree about the names");
