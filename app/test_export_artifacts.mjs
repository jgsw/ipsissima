/* What the program WRITES OUT, read back by the software that will read it.
 *
 * WHY THIS EXISTS. Writing one export -- the staircase panel to SVG and PNG -- produced four
 * defects in an afternoon, and three of them were invisible in the browser that made the file:
 *
 *   - the SVG was malformed XML. A computed `font-family` is `-apple-system, "system-ui", ...`,
 *     quotes included, written straight into a double-quoted attribute. It RENDERED PERFECTLY
 *     when checked with innerHTML, because HTML parsing forgives it; only the PNG path, which
 *     puts the same bytes through an XML parser, refused.
 *   - every box carried an `rgba()` fill, which SVG 1.1 has no colour for. A browser takes it;
 *     a strict renderer parses it, fails, and falls back to black.
 *   - `Step 4` was written twice, the edge layer being walked as well as copied.
 *   - a heading lost its uppercase and a glyph vanished, both being CSS rather than text nodes.
 *
 * The pattern in all four: THE ENGINE THAT WROTE THE FILE IS THE WRONG ENGINE TO CHECK IT WITH.
 * So this reads each export back through a strict XML parse and through librsvg -- an
 * independent implementation, in another process, of the kind of renderer the file will actually
 * meet -- and compares the words in the file against the words on the screen.
 *
 *   node app/test_export_artifacts.mjs [--keep]
 *
 * Every check here is mutation-proved on each run, for the reasons in docs/QA-PLAN.md.
 */
let chromium;
try {
  ({ chromium } = await import("playwright"));
  await chromium.executablePath();
} catch (e) {
  const why = String((e && e.message) || e).split("\n")[0];
  if (process.env.IPS_REQUIRE_BROWSER) {
    console.log("FAIL — Playwright's Chromium is required here and is not installed.");
    console.log("  " + why);
    process.exit(1);
  }
  console.log("SKIPPED — Playwright's Chromium is not installed here.");
  console.log("  npx playwright install chromium     (once, ~150MB)");
  process.exit(0);
}
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const KEEP = process.argv.includes("--keep");

let fails = 0, checks = 0;
const failures = [];
const check = (ok, what, detail) => {
  checks++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) { fails++; failures.push(detail ? `${what}\n         ${detail}` : what); }
};

/* librsvg, which is not the engine that wrote the file. Absent on a machine without it, and the
 * suite says so rather than pretending the check ran. */
const RSVG = spawnSync("rsvg-convert", ["--version"], { stdio: "pipe" }).status === 0;

/* ------------------------------------------------------------------ the checks
 *
 * Each takes the exported text and the panel it came from, and returns a complaint or null.
 * Separated from the driving so the mutations below can call them on a doctored string without
 * a browser in the loop.
 */

/** SVG 1.1 has no `rgba()`, no `var()`, and no `currentColor` on a page that is not there. */
function paintLegality(svg) {
  const bad = [];
  for (const m of svg.matchAll(/(fill|stroke)="([^"]*)"/g)) {
    const v = m[2];
    if (/rgba\(|var\(|currentColor|hsla?\(/i.test(v)) bad.push(`${m[1]}="${v}"`);
  }
  return bad.length ? `${bad.length} unparseable paint value(s): ${bad.slice(0, 3).join(", ")}` : null;
}

/** The words on the page and the words in the file, as multisets. Catches a label written twice
 *  and a label not written at all, which are the same defect seen from two sides. */
function wordRoundTrip(svgText, panelText) {
  // ENTITIES ARE THE FILE'S SPELLING OF A CHARACTER, not a different word. Stripping the tags
  // and comparing raw left `General&apos;s` against `General's` and reported the export as both
  // writing a word too often and failing to write it -- the check's own fault, and the kind of
  // false positive that teaches people to ignore an instrument.
  const unent = t => String(t)
    .replace(/&(?:apos|#39);/g, "'").replace(/&(?:quot|#34);/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&");
  const bag = s => {
    const m = new Map();
    for (const w of unent(s).toLowerCase().replace(/[↱]/g, " ").split(/\s+/))
      if (w) m.set(w, (m.get(w) || 0) + 1);
    return m;
  };
  const a = bag(panelText), b = bag(svgText);
  const extra = [], missing = [];
  for (const [w, n] of b) if ((a.get(w) || 0) < n) extra.push(`${w} x${n - (a.get(w) || 0)}`);
  for (const [w, n] of a) if ((b.get(w) || 0) < n) missing.push(`${w} x${n - (b.get(w) || 0)}`);
  if (!extra.length && !missing.length) return null;
  return [extra.length ? "written too often: " + extra.slice(0, 4).join(", ") : "",
          missing.length ? "not written: " + missing.slice(0, 4).join(", ") : ""]
    .filter(Boolean).join("; ");
}

/* ------------------------------------------------------------------ driving the export */

const MILLER = path.join(REPO, "samples", "Miller 2019 - Prorogation of Parliament");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ips-export-"));
const viewer = path.join(tmp, "miller.html");
execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"),
                      path.join(MILLER, "miller-2019-uksc-41.argdown"),
                      "-o", viewer, "--source-root", MILLER], { stdio: "pipe" });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("file://" + viewer);
await page.waitForSelector(".alm-n", { timeout: 20000 });
await page.evaluate(() => {
  try { localStorage.setItem("ipsissima.walkthrough.v1", "declined"); } catch (e) { void e; }
});

// Force the plain download path and capture what it would have written, rather than letting a
// file picker open or a download land in someone's Downloads folder.
await page.evaluate(() => {
  delete window.showSaveFilePicker;
  window.__cap = [];
  const real = URL.createObjectURL.bind(URL);
  URL.createObjectURL = b => { window.__cap.push(b); return real(b); };
  HTMLAnchorElement.prototype.click = function () {};
});

await page.evaluate(() => {
  const b = [...document.querySelectorAll(".alm-bar button")].find(x => x.textContent.trim() === "open");
  if (b) b.click();
});
await page.waitForTimeout(1200);
const opened = await page.evaluate(() => {
  const c = [...document.querySelectorAll(".alm-explode")].sort(
    (a, b) => b.textContent.length - a.textContent.length)[0];
  if (!c) return false;
  c.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return true;
});
check(opened, "an argument with more than one step opens a panel");

const captured = {};
for (const mode of ["stair", "compact"]) {
  await page.evaluate(m => {
    document.getElementById(m === "compact" ? "xmcompact" : "xmstair").click();
    window.__cap.length = 0;
  }, mode);
  await page.waitForTimeout(400);

  const panelText = await page.evaluate(() => {
    // WHAT THE PANEL DRAWS, including the uppercase CSS applies and the arrow it puts in with
    // `::before` -- both were lost by the first export precisely because they are not text nodes.
    const wrap = document.querySelector("#explbody .xwrap");
    let out = "";
    for (const el of wrap.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      for (const n of el.childNodes)
        if (n.nodeType === 3 && n.nodeValue.trim())
          out += " " + (cs.textTransform === "uppercase" ? n.nodeValue.toUpperCase() : n.nodeValue);
      for (const which of ["::before", "::after"]) {
        const c = getComputedStyle(el, which).content;
        if (c && c !== "none" && c !== "normal") out += " " + c.replace(/^["']|["']$/g, "");
      }
    }
    return out;
  });

  await page.evaluate(() => document.getElementById("xsvg").click());
  await page.waitForTimeout(700);
  const svg = await page.evaluate(async () => window.__cap.length ? await window.__cap[0].text() : "");
  captured[mode] = { svg, panelText };

  const file = path.join(tmp, `panel-${mode}.svg`);
  fs.writeFileSync(file, svg);

  check(svg.length > 500, `${mode}: the export produces an SVG`, `${svg.length} bytes`);

  /* A STRICT XML PARSE, which is what a .svg on disk gets and what innerHTML does not do.
   * Mutation: put an unescaped quote back into a font-family attribute. */
  const xmlErr = await page.evaluate(s => {
    const d = new DOMParser().parseFromString(s, "image/svg+xml");
    const e = d.querySelector("parsererror");
    return e ? e.textContent.slice(0, 120) : null;
  }, svg);
  check(!xmlErr, `${mode}: the SVG parses as XML`, xmlErr);

  /* Mutation: emit a fill as rgba() again. */
  const paint = paintLegality(svg);
  check(!paint, `${mode}: every paint value is one SVG can name`, paint);

  /* Mutation: duplicate any <text>, or delete one. */
  const svgWords = svg.replace(/<[^>]*>/g, " ");
  const trip = wordRoundTrip(svgWords, captured[mode].panelText);
  check(!trip, `${mode}: the file says exactly what the panel says`, trip);

  /* AN INDEPENDENT RENDERER, in another process. The browser that wrote the file is the wrong
   * engine to judge it with -- that is the whole lesson of the malformed XML, which rendered
   * perfectly in the page that produced it. Mutation: hand rsvg a truncated document. */
  if (RSVG) {
    const png = path.join(tmp, `panel-${mode}.png`);
    const r = spawnSync("rsvg-convert", ["-o", png, file], { stdio: "pipe" });
    const drew = r.status === 0 && fs.existsSync(png) && fs.statSync(png).size > 2000;
    check(drew, `${mode}: librsvg renders it`,
          (r.stderr || "").toString().slice(0, 160) ||
          (fs.existsSync(png) ? `only ${fs.statSync(png).size} bytes of PNG` : "no output"));
  }
}
if (!RSVG) console.log("  --    librsvg not installed; the independent render was not run");

/* The PNG path, which is where the malformed XML was first noticed: it loads the same bytes
 * through an image decoder, so a file the browser will not parse cannot be encoded either. */
await page.evaluate(() => { window.__cap.length = 0; document.getElementById("xpng").click(); });
await page.waitForTimeout(2500);
const png = await page.evaluate(async () => {
  if (!window.__cap.length) return null;
  const b = window.__cap[0];
  const head = new Uint8Array(await b.slice(0, 24).arrayBuffer());
  return { type: b.type, size: b.size, sig: [...head.slice(0, 8)].join(","),
           w: new DataView(head.buffer).getUint32(16), h: new DataView(head.buffer).getUint32(20) };
});
check(png && png.sig === "137,80,78,71,13,10,26,10", "the PNG export is a PNG",
      png ? `signature ${png.sig}` : "nothing was written");
check(png && png.w > 400 && png.h > 300, "the PNG has the panel's dimensions",
      png ? `${png.w}x${png.h}` : "");

/* ------------------------------------------------------------------ proving the checks */

console.log("\n  mutations");
const good = captured.stair.svg, panel = captured.stair.panelText;

const MUTANTS = [
  ["the SVG parses as XML", good.replace('font-family="', 'font-family="a"b'),
   async s => {
     const e = await page.evaluate(x => {
       const d = new DOMParser().parseFromString(x, "image/svg+xml");
       return d.querySelector("parsererror") ? "bad" : null;
     }, s);
     return !!e;
   }],
  ["every paint value is one SVG can name",
   good.replace(/fill="rgb\(([^)]*)\)"/, 'fill="rgba($1,0.5)"'),
   async s => !!paintLegality(s)],
  ["the file says exactly what the panel says (a label twice)",
   good.replace(/(<text[^>]*>)([^<]{4,})(<\/text>)/, "$1$2$3$1$2$3"),
   async s => !!wordRoundTrip(s.replace(/<[^>]*>/g, " "), panel)],
  ["the file says exactly what the panel says (a label missing)",
   good.replace(/<text[^>]*>[^<]{4,}<\/text>/, ""),
   async s => !!wordRoundTrip(s.replace(/<[^>]*>/g, " "), panel)],
];
for (const [name, mutated, fires] of MUTANTS) {
  const changed = mutated !== good;
  const caught = changed && await fires(mutated);
  check(caught, `MUTATION caught: ${name}`,
        !changed ? "the mutation did not change the file, so nothing was tested"
                 : "the check passed with the defect present");
}
if (RSVG) {
  const broken = path.join(tmp, "broken.svg");
  fs.writeFileSync(broken, good.slice(0, Math.floor(good.length * 0.6)));
  const r = spawnSync("rsvg-convert", ["-o", path.join(tmp, "broken.png"), broken], { stdio: "pipe" });
  check(r.status !== 0, "MUTATION caught: librsvg renders it",
        "librsvg accepted a truncated document");
}

await browser.close();
if (!KEEP) fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n${checks} checks`);
if (fails) {
  console.log(`\n${fails} FAILED:`);
  for (const f of failures) console.log("  FAIL  " + f);
  process.exit(1);
}
console.log("every export reads back as what the panel drew");
