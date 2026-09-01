/* Which maps this branch actually changed, and by how much.
 *
 * NOT A TEST, and deliberately not a gate. Everything else in the suite answers "is this
 * correct"; this answers the other half of the question, which is the author's time:
 *
 *   "There have been A LOT of changes recently; and testing all these as a human clicking around
 *    on maps will be time consuming and unlikely to pull out all problems."
 *
 * No instrument makes the clicking-around unnecessary -- a picture can be wrong in ways nobody
 * has thought to assert about. What an instrument can do is make it AIMED: render every map
 * before and after, and say which four of the eleven a change actually touched, so the looking
 * goes there instead of being spread thin.
 *
 *   node app/qa_visual_diff.mjs [--ref main] [--maps N] [--keep]
 *
 * EXPLICITLY NOT A PASS/FAIL BASELINE. A screenshot gate on a laid-out map with real fonts
 * produces false failures on every machine that is not the one that recorded it, and the cost of
 * that is everybody learning to ignore a red build. This always exits 0. It is a reading list.
 */
let chromium;
try {
  ({ chromium } = await import("playwright"));
  await chromium.executablePath();
} catch {
  console.log("Playwright's Chromium is not installed — npx playwright install chromium");
  process.exit(0);
}
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const argv = process.argv.slice(2);
const REF = argv[argv.indexOf("--ref") + 1] && argv.includes("--ref") ? argv[argv.indexOf("--ref") + 1] : "main";
const LIMIT = argv.includes("--maps") ? Number(argv[argv.indexOf("--maps") + 1]) || 99 : 99;
const KEEP = argv.includes("--keep");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ips-diff-"));
const treeDir = path.join(tmp, "before");

function samples() {
  const base = path.join(REPO, "samples");
  return fs.readdirSync(base)
    .map(d => ({ name: d.split(" ")[0], dir: path.join(base, d) }))
    .filter(x => fs.statSync(x.dir).isDirectory())
    .map(x => ({ ...x, src: fs.readdirSync(x.dir).find(f => f.endsWith(".argdown")) }))
    .filter(x => x.src)
    .slice(0, LIMIT);
}

/** The tree as it was at `ref`, beside the one we have. A worktree rather than a stash: nothing
 *  in the working copy is touched, so this is safe to run with edits in progress. */
function checkoutBefore() {
  execFileSync("git", ["worktree", "add", "--detach", treeDir, REF], { cwd: REPO, stdio: "pipe" });
  // The build needs dependencies, and a worktree has none of its own.
  fs.symlinkSync(path.join(HERE, "node_modules"), path.join(treeDir, "app", "node_modules"));
}

function build(fromTree, s, out) {
  execFileSync("node", [path.join(fromTree, "app", "build_argdown_viewer.mjs"),
                        path.join(s.dir, s.src), "-o", out, "--source-root", s.dir],
               { stdio: "pipe" });
}

/** Fraction of pixels that differ, counted in the browser rather than with an image library:
 *  two canvases, one subtraction, no dependency. A tolerance of 8 per channel absorbs the
 *  antialiasing that differs between two runs of the same renderer. */
async function fractionChanged(page, a, b) {
  return page.evaluate(async ([p, q]) => {
    const load = src => new Promise(res => {
      const i = new Image(); i.onload = () => res(i); i.src = src;
    });
    const [ia, ib] = await Promise.all([load(p), load(q)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    if (!w || !h) return { changed: 1, note: "one side did not render" };
    const grab = img => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, w, h).data;
    };
    const A = grab(ia), B = grab(ib);
    let n = 0;
    for (let i = 0; i < A.length; i += 4)
      if (Math.abs(A[i] - B[i]) > 8 || Math.abs(A[i + 1] - B[i + 1]) > 8 ||
          Math.abs(A[i + 2] - B[i + 2]) > 8) n++;
    return { changed: n / (w * h),
             note: ia.width !== ib.width || ia.height !== ib.height
               ? `size ${ia.width}x${ia.height} -> ${ib.width}x${ib.height}` : "" };
  }, [a, b]);
}

/* ------------------------------------------------------------------ run */

const list = samples();
console.log(`comparing ${list.length} maps against ${REF}\n`);
let before;
try { checkoutBefore(); before = true; }
catch (e) {
  console.log(`could not check out ${REF}: ${String(e.message || e).split("\n")[0]}`);
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const shots = await browser.newPage();
const rows = [];

for (const s of list) {
  const outA = path.join(tmp, s.name + "-before.html");
  const outB = path.join(tmp, s.name + "-after.html");
  let built = true;
  try { build(treeDir, s, outA); build(REPO, s, outB); }
  catch (e) { built = false; rows.push({ name: s.name, err: String(e.message || e).slice(0, 80) }); }
  if (!built) continue;

  /* TWO STATES, and the second is the one that matters. Photographing only the opening view --
   * every section folded -- reported 0.00% across twelve commits of real renderer work, because
   * rule names, verdict marks, section headers and everything inside a section are simply not on
   * screen there. A tool that says "nothing changed" about a fortnight of changes is worse than
   * no tool: it tells the reader not to look. */
  const shot = async (f, open) => {
    await shots.goto("file://" + f);
    await shots.waitForSelector(".alm-n", { timeout: 20000 });
    await shots.evaluate(() => {
      try { localStorage.setItem("ipsissima.walkthrough.v1", "declined"); } catch (e) { void e; }
      const w = document.getElementById("walk"); if (w) w.hidden = true;
    });
    if (open) {
      await shots.evaluate(() => {
        const b = /** @type {HTMLButtonElement|undefined} */ (
          [...document.querySelectorAll(".alm-bar button")]
            .find(x => x.textContent.trim() === "open"));
        if (b) b.click();
      });
      await shots.waitForTimeout(1200);
    }
    await shots.waitForTimeout(700);
    return "data:image/png;base64," + (await shots.screenshot({ type: "png" })).toString("base64");
  };

  let worst = 0, note = "", which = "";
  for (const [label, open] of /** @type {[string, boolean][]} */ ([["folded", false], ["open", true]])) {
    const a = await shot(outA, open), b = await shot(outB, open);
    const r = await fractionChanged(page, a, b);
    if (r.changed * 100 > worst) { worst = r.changed * 100; note = r.note; which = label; }
  }
  rows.push({ name: s.name, pct: worst, note, which });
}

await browser.close();
try { execFileSync("git", ["worktree", "remove", "--force", treeDir], { cwd: REPO, stdio: "pipe" }); }
catch { /* the temp dir goes below anyway */ }
if (!KEEP) fs.rmSync(tmp, { recursive: true, force: true });

rows.sort((a, b) => (b.pct || 0) - (a.pct || 0));
const bar = p => "#".repeat(Math.min(30, Math.round(p / 2))) || (p > 0 ? "." : "");
console.log("  map                 changed  where");
console.log("  " + "-".repeat(52));
for (const r of rows) {
  if (r.err) { console.log(`  ${r.name.padEnd(18)}  build failed — ${r.err}`); continue; }
  console.log(`  ${r.name.padEnd(18)} ${r.pct.toFixed(2).padStart(6)}%  ` +
              `${(r.pct > 0.05 ? r.which : "").padEnd(7)}${bar(r.pct)}` +
              (r.note ? "  " + r.note : ""));
}
const touched = rows.filter(r => r.pct > 0.05);
console.log(`\n${touched.length} of ${rows.length} maps changed against ${REF}.` +
            (touched.length ? "  Look at " + touched.slice(0, 4).map(r => r.name).join(", ") + "."
                            : "  Nothing to look at."));
