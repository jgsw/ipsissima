/** The bundled Argdown parser: still current, and still the same answer as the real CLI.
 *
 *  TWO FAILURES ARE POSSIBLE AND ONLY ONE IS OBVIOUS. The bundle is a committed build artifact,
 *  so it can go stale — someone edits argdown-shim.src.mjs, or upgrades @argdown/*, and forgets
 *  to run build_argdown_shim.mjs. It can also be perfectly fresh and WRONG, if a pipeline in the
 *  shim stops matching what the CLI does. The first is caught by rebuilding and comparing; the
 *  second by running both on the corpus and diffing.
 *
 *  The comparison needs app/node_modules, so it is skipped where there is no real CLI to compare
 *  against — but the staleness check is not, because that one matters most on a machine that is
 *  about to publish.
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const SHIM = path.join(ROOT, "ipsissima-mcp", "src", "ipsissima_mcp", "vendor", "argdown-cli.mjs");
const REAL = path.join(HERE, "node_modules", ".bin", "argdown");

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok || !detail ? "" : `\n          ${detail}`}`);
  if (!ok) fails++;
};

/* ---- 1. the committed bundle is what this source builds ---- */
check("the bundle is committed", fs.existsSync(SHIM),
      `${SHIM} is missing — run: node app/build_argdown_shim.mjs`);

if (fs.existsSync(SHIM) && fs.existsSync(path.join(HERE, "node_modules", "esbuild"))) {
  const before = fs.readFileSync(SHIM);
  execFileSync(process.execPath, [path.join(HERE, "build_argdown_shim.mjs")], { stdio: "ignore" });
  const after = fs.readFileSync(SHIM);
  const same = before.equals(after);
  if (!same) fs.writeFileSync(SHIM, before);   // leave the tree as we found it
  check("the bundle is up to date with its source", same,
        "rebuilding changed it — run: node app/build_argdown_shim.mjs, and commit the result");
}

/* ---- 2. it answers exactly what the real CLI answers ---- */
const samples = fs.existsSync(path.join(ROOT, "samples"))
  ? fs.readdirSync(path.join(ROOT, "samples"), { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const dir = path.join(ROOT, "samples", d.name);
        const f = fs.readdirSync(dir).find(n => n.endsWith(".argdown"));
        return f && path.join(dir, f);
      }).filter(Boolean)
  : [];

const strip = s => s.replace(/\x1b\[[0-9;]*m/g, "").replace(/Successfully exported.*/g, "")
                    .split("\n").filter(l => l.trim()).join("\n");

if (!fs.existsSync(REAL)) {
  console.log("  --    no app/node_modules — skipping the comparison with the real CLI");
} else if (!samples.length) {
  console.log("  --    no samples — skipping the comparison with the real CLI");
} else {
  const MODES = ["all", "with-title", "with-relations", "with-more-than-one-relation",
                 "top-level", "not-used-in-argument"];
  for (const s of samples) {
    const name = path.basename(s);
    const a = spawnSync(REAL, [ "map", s, "--format", "dot", "--stdout" ], { encoding: "utf8" });
    const b = spawnSync(process.execPath, [SHIM, "map", s, "--format", "dot", "--stdout"],
                        { encoding: "utf8" });
    check(`${name}: same map as the real CLI`, strip(a.stdout) === strip(b.stdout));

    const td = fs.mkdtempSync(path.join(os.tmpdir(), "shim-"));
    const ta = path.join(td, "real"), tb = path.join(td, "shim");
    spawnSync(REAL, ["json", s, "--outputDir", ta], { encoding: "utf8" });
    spawnSync(process.execPath, [SHIM, "json", s, "--outputDir", tb], { encoding: "utf8" });
    const read = d => { const f = (fs.existsSync(d) ? fs.readdirSync(d) : []).find(n => n.endsWith(".json"));
                        return f ? fs.readFileSync(path.join(d, f), "utf8") : null; };
    check(`${name}: same JSON as the real CLI`, read(ta) !== null && read(ta) === read(tb));
    fs.rmSync(td, { recursive: true, force: true });
  }

  // The selection modes are what the SELECTION MODES table in the checker's report is built
  // from, and a mode the shim silently ignored would show as six equal counts rather than an
  // error — which is also what a `selection:` block in the frontmatter looks like.
  const s = samples[0];
  for (const m of MODES) {
    const a = spawnSync(REAL, ["map", s, "--format", "dot", "--stdout", "--statement-selection", m],
                        { encoding: "utf8" });
    const b = spawnSync(process.execPath, [SHIM, "map", s, "--format", "dot", "--stdout",
                                           "--statement-selection", m], { encoding: "utf8" });
    check(`--statement-selection ${m}`, strip(a.stdout) === strip(b.stdout));
  }
}

/* ---- 3. a file that does not parse is reported, not swallowed ---- */
const bad = path.join(os.tmpdir(), `shim-broken-${process.pid}.argdown`);
fs.writeFileSync(bad, "[A]: fine\n\n<_ [B\n");
const r = spawnSync(process.execPath, [SHIM, "map", bad, "--format", "dot", "--stdout"],
                    { encoding: "utf8" });
check("a broken file exits non-zero", r.status !== 0, `status was ${r.status}`);
check("  and says where, in the CLI's own words",
      /Argdown syntax errors/.test(r.stderr) && /At 3:1/.test(r.stderr),
      JSON.stringify((r.stderr || "").slice(0, 120)));
check("  without a JavaScript stack on top of it", !/No "ast" field/.test(r.stderr));
fs.rmSync(bad, { force: true });

console.log(fails ? `\n${fails} failure(s)` : "\nthe bundled parser agrees with the CLI");
process.exit(fails ? 1 : 0);
