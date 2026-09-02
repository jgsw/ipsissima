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

/** NOTHING IS CUT OFF, measured on the picture rather than on the arithmetic that made it.
 *
 * WHY. The canvas used to be sized from the panel's scrolling column, on the assumption that
 * every box was inside it. A classic scrollbar appearing after the layout had measured that
 * column made the assumption false: the last box hung fifteen pixels past its right edge, hidden
 * on screen by the panel's own padding, and the exported file was sliced down that edge. It was
 * reported from a PNG, by eye, because nothing here looked.
 *
 * The background rect is stripped and the rest drawn on a transparent canvas, so what is
 * measured is the ALPHA -- every stroke, letter and arrowhead, and nothing about what colour the
 * panel happens to be. That is what makes this work in the dark scheme too.
 */
function drawnMargin(page) {
  return svg => page.evaluate(async s => {
    const m = s.match(/width="(\d+)" height="(\d+)"/);
    if (!m) return "the file declares no size";
    const w = +m[1], h = +m[2];
    const bare = s.replace(/<rect width="\d+" height="\d+"[^>]*\/>/, "");
    const img = new Image();
    const drew = await new Promise(res => {
      img.onload = () => res(true); img.onerror = () => res(false);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(bare);
    });
    if (!drew) return "the file could not be drawn";
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0);
    const d = c.getContext("2d").getImageData(0, 0, w, h).data;
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 12) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 < 0) return "the file draws nothing";
    const edge = Math.min(x0, y0, w - 1 - x1, h - 1 - y1);
    return edge >= 4 ? null
      : `ink ${edge}px from the edge of a ${w}x${h} file ` +
        `(left ${x0}, top ${y0}, right ${w - 1 - x1}, bottom ${h - 1 - y1})`;
  }, svg);
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
const margin = drawnMargin(page);
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

  /* Mutation: shift the drawing sideways so it runs off its own canvas. */
  const edge = await margin(svg);
  check(!edge, `${mode}: nothing is cut off at the edge of the file`, edge);

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

/* AND IT IS THE SAME PICTURE. The PNG is the SVG drawn onto a canvas at twice the size, so a
 * complete SVG is a complete PNG -- but only if the canvas is the size the file says. Checked
 * rather than assumed, since "the exported PNG always includes the whole panel" is the promise
 * and this is the last link in it. */
const sameSize = await page.evaluate(s => {
  const m = s.match(/width="(\d+)" height="(\d+)"/);
  return m ? { w: +m[1] * 2, h: +m[2] * 2 } : null;
}, captured.compact.svg);
check(png && sameSize && png.w === sameSize.w && png.h === sameSize.h,
      "the PNG is the whole of the SVG, at twice the size",
      png && sameSize ? `PNG ${png.w}x${png.h}, SVG x2 ${sameSize.w}x${sameSize.h}` : "");


/* ------------------------------------------------------------------ the column that moves
 *
 * THE DEFECT ITSELF, reproduced. Both layouts must measure their column before they have given
 * the wrap a height -- the boxes are absolutely positioned, so until they are placed nothing has
 * one. Where scrollbars take space rather than floating over the content, that measurement is
 * read off a panel which is not yet scrolling, and the fifteen pixels the scrollbar then claims
 * come out of a column every box has already been sized against.
 *
 * Headless Chromium draws overlay scrollbars and will not do this on request, so the narrowing
 * is staged instead: the padding grows the moment `.xwrap` is given an inline height, which is
 * exactly when a real scrollbar appears and exactly too late for the layout that measured it.
 * Against the code before the fix this puts the last box 15px past the wrap and takes the
 * export's right-hand margin to nothing, which is what was reported from the Cribb map.
 */
await page.addStyleTag({ content:
  '#explbody:has(.xwrap[style*="height"]){padding-right:calc(1rem + 15px)}' });
await page.evaluate(() => { window.__cap.length = 0; document.getElementById("xmstair").click(); });
await page.waitForTimeout(500);

const overhang = await page.evaluate(() => {
  const wrap = document.querySelector("#explbody .xwrap");
  if (!wrap) return null;
  const wr = wrap.getBoundingClientRect();
  let over = -1e9;
  for (const b of wrap.querySelectorAll(".xstep,.xconcl"))
    over = Math.max(over, b.getBoundingClientRect().right - wr.right);
  return { over: Math.round(over), width: Math.round(wr.width),
           measured: Number(wrap.dataset.avail) };
});
check(overhang && overhang.over <= 1,
      "no box hangs past the column when a scrollbar takes it after the layout",
      overhang ? `the widest box overhangs by ${overhang.over}px ` +
                 `(laid out against ${overhang.measured}, column is now ${overhang.width})`
               : "the panel drew no wrap");

await page.evaluate(() => { window.__cap.length = 0; document.getElementById("xsvg").click(); });
await page.waitForTimeout(600);
const narrowed = await page.evaluate(async () => window.__cap.length ? await window.__cap[0].text() : "");
const narrowEdge = await margin(narrowed);
check(!narrowEdge, "the export survives the column narrowing under the layout", narrowEdge);

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
  /* THE REPORTED DEFECT, in the shape it actually had: everything shifted sideways until the
   * right-hand edge of the last box is off the canvas. 30px against a 16px margin leaves 14px
   * of the drawing outside the file. */
  ["nothing is cut off at the edge of the file",
   good.replace(/(<rect width="\d+" height="\d+"[^>]*\/>)/, '$1<g transform="translate(30,0)">')
       .replace("</svg>", "</g></svg>"),
   async s => !!(await margin(s))],
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
