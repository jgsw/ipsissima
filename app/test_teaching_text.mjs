/* What the program says about itself stays true: the teaching text is held to the program.
 *
 *   node app/test_teaching_text.mjs
 *
 * F8(b) (docs/values/INVENTORY.md, admitted 27 Sep 2026): teaching text describes the controls
 * as they are rendered now, and is held to them by machinery rather than by care. The clarity
 * audit of the same day found seventeen places where it had drifted -- the walkthrough sending
 * readers to "Layout ▸ Study" a fortnight after the layout was renamed Follow, the help calling
 * the fold badge ⊕ and the study card calling it ⊞ while the map drew "+3", a "kinds" control
 * that had been "hashtags" for weeks. Nothing was charged with noticing, so nothing did.
 *
 * TEACHING TEXT here is everything a reader is told: help.md, about.md, the README and the
 * site's front page, and every string the page and its renderers show -- the walkthrough, the
 * cards, tooltips and messages. Code comments are not teaching text and are stripped first
 * (esbuild, whitespace-minified, so a comment can never be mistaken for a string).
 *
 * Three rules:
 *   1. A MENU PATH NAMES WHAT IS THERE. "File ▸ X", "View ▸ X", "Layout ▸ X", "How to use ▸ X",
 *      "Open… ▸ X": X must be an item that menu, panel or list actually has, spelled as it is.
 *   2. A GLYPH NAMED IS A GLYPH DRAWN, and the fold badge is described as it is drawn: a glyph
 *      the page never draws may not be named, and no glyph but "+N" or "−" is called "the badge".
 *   3. A RETIRED NAME STAYS RETIRED. app/vocabulary.json lists the words the reader no longer
 *      meets, with what replaced each; none may appear in teaching text.
 *
 * Mutation-tested when written: see the note beside each rule.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");

let fails = 0, checks = 0;
function check(ok, what, detail) {
  checks++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}` + (ok || detail == null ? "" : `\n          ${detail}`));
  if (!ok) fails++;
}

/* ------------------------------------------------------------ the teaching text */
/** A script's strings, with its comments gone. Whitespace-minified by esbuild, which removes
 *  comments and leaves string contents alone; what is left inside strings that looks like a
 *  comment is CSS in a stylesheet literal, and goes too. */
function codeText(src) {
  const out = esbuild.transformSync(src, { minifyWhitespace: true, legalComments: "none", loader: "js", charset: "utf8" }).code;
  return out.replace(/\/\*[\s\S]*?\*\//g, " ");
}
/** A page's words: its markup's text and its attributes, and its scripts' strings. */
function pageText(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => codeText(m[1]));
  const markup = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
                     .replace(/<!--[\s\S]*?-->/g, " ");
  const attrs = [...markup.matchAll(/\b(?:title|aria-label|placeholder)="([^"]*)"/g)].map(m => m[1]);
  const text = markup.replace(/<[^>]+>/g, " ");
  return [text, ...attrs, ...scripts].join("\n");
}
const markdownText = md => md.replace(/<!--[\s\S]*?-->/g, " ");
const decode = s => s.replace(/&#8230;/g, "…").replace(/&hellip;/g, "…").replace(/&#9656;/g, "▸")
                     .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&times;/g, "×");
const flat = s => decode(s).replace(/\\n/g, " ").replace(/\s+/g, " ");

const SOURCES = {
  "app/help.md": markdownText(read("app/help.md")),
  "app/about.md": markdownText(read("app/about.md")),
  "README.md": markdownText(read("README.md")),
  "site/index.md": markdownText(read("site/index.md")),
  "the page": pageText(read("app/argdown-viewer.template.html")),
  "the map": codeText(read("app/src/argdown-live-map.js")),
  "the mechanism": codeText(read("app/src/argdown-mechanism.js")),
  "the staircase": codeText(read("app/src/argdown-staircase.js")),
  "the editor": codeText(read("app/argdown-editor.src.mjs"))
};
for (const k of Object.keys(SOURCES)) SOURCES[k] = flat(SOURCES[k]);

/* ------------------------------------------------------------ what is there to name */
const TEMPLATE = read("app/argdown-viewer.template.html");
const LIB_RS = read("app/desktop/src-tauri/src/lib.rs");
const HELP = read("app/help.md");

/** Each native menu's items, by the menu's own name. */
const MENUS = {};
for (const m of LIB_RS.matchAll(/SubmenuBuilder::new\(app, "([^"]+)"\)([\s\S]*?)\.build\(\)\?;/g)) {
  const items = [...m[2].matchAll(/item\("[^"]+", "([^"]+)"/g)].map(x => x[1]);
  if (/\.fullscreen\(\)/.test(m[2])) items.push("Enter Full Screen");
  MENUS[m[1]] = items;
}
/** The Layout menu's presets, and its one checkbox. */
MENUS.Layout = [...TEMPLATE.matchAll(/\{ id: "[a-z]+",\s+label: "([^"]+)",\s+hint:/g)].map(m => m[1])
  .concat(["Texts on the left"]);
/** How to use: its topics, and the entries the contents list adds around them. */
MENUS["How to use"] = [...HELP.matchAll(/^## (.+)$/gm)].map(m => m[1].trim())
  .concat(["Take the walkthrough", "Study this map", "About Ipsissima"]);
/** The opening panel's doors, which the web page's Open… brings back. */
MENUS["Open…"] = [...TEMPLATE.matchAll(/<button class="plain" id="pick[a-z]*"[^>]*>([^<]+)<\/button>/g)]
  .map(m => decode(m[1]).trim());
/** About's tabs. */
MENUS.About = [...read("app/about.md").matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
/** Paths into programs that are not this one, named as those programs name them. */
const FOREIGN = new Set(["Settings ▸ Advanced"]);

/* ------------------------------------------------------------ rule 1: menu paths */
console.log("a menu path names what is there");
check(Object.keys(MENUS).length >= 8 && MENUS.File && MENUS.File.length >= 8 && MENUS.Layout.length >= 5 &&
      MENUS["How to use"].length >= 20 && MENUS["Open…"].length >= 2,
      "the menus were read (a lint that reads nothing passes everything)",
      JSON.stringify(Object.fromEntries(Object.entries(MENUS).map(([k, v]) => [k, v.length]))));
const bad = [];
for (const [where, text] of Object.entries(SOURCES)) {
  for (const m of text.matchAll(/(File|Edit|View|Help|Layout|How to use|Open…|About|Settings) ▸ /g)) {
    const menu = m[1], rest = text.slice(m.index + m[0].length);
    if (FOREIGN.has(menu + " ▸ " + rest.split(/[\s.,;:)*]/)[0])) continue;
    const items = MENUS[menu === "Help" && !MENUS.Help ? "_" : menu] || [];
    // The longest item the text begins with, ending at a word boundary.
    const hit = items.filter(it => rest.startsWith(it) && !/[A-Za-z]/.test(rest.charAt(it.length) || " "))
                     .sort((a, b) => b.length - a.length)[0];
    if (!hit) bad.push(`${where}: “${menu} ▸ ${rest.slice(0, 40)}…”`);
  }
}
// Mutation: write "Layout ▸ Study" back into the walkthrough -> fails with that path named.
check(bad.length === 0, "every “Menu ▸ Item” names an item that menu has, spelled as it is",
      bad.join("\n          "));

/* ------------------------------------------------------------ rule 1b: links into the help */
console.log("\na link into How to use opens a page that is there");
{
  // EVERY DOORBELL HAS A DOOR. A link names its topic by title (`data-help="…"`, or
  // `openHelpTopic("…")`), so renaming a topic without its links leaves the link opening the
  // contents instead of the answer -- quietly, which is the failure this file exists to stop.
  // The raw sources, not the reader's text: these live in markup and code, not in prose.
  const TOPICS = new Set([...HELP.matchAll(/^## (.+)$/gm)].map(m => m[1].trim()));
  // As the page resolves it: string concatenation joined, entities decoded, whitespace collapsed
  // (openHelpTopic collapses it too, so a link wrapped across two lines of help.md still works).
  const unesc = x => x.replace(/'\s*\+\s*'/g, "").replace(/"\s*\+\s*"/g, "")
    .replace(/&#39;/g, "'").replace(/\\u2019/g, "\u2019").replace(/\\'/g, "'")
    .replace(/\s+/g, " ").trim();
  const links = [];
  for (const f of ["app/argdown-viewer.template.html", "app/src/argdown-live-map.js",
                   "app/src/argdown-mechanism.js", "app/help.md"]) {
    const src = read(f).replace(/<!--[\s\S]*?-->/g, " ");
    for (const m of src.matchAll(/data-help="([^"]*)"/g))
      if (!/^' \+ \w+ \+ '$/.test(m[1])) links.push([f, unesc(m[1])]);   // head()'s own template
    for (const m of src.matchAll(/openHelpTopic\("([^"]*)"\)/g)) links.push([f, unesc(m[1])]);
    for (const m of src.matchAll(/\{ help: "([^"]*)" \}/g)) links.push([f, unesc(m[1])]);
    for (const m of src.matchAll(/\.dataset\.help = "([^"]*)"/g)) links.push([f, unesc(m[1])]);
    for (const m of src.matchAll(/head\("[^"]*", "([^"]*)"\)/g)) links.push([f, unesc(m[1])]);
  }
  // "" is the contents page itself, which is always there.
  const dead = links.filter(([, t]) => t !== "" && !TOPICS.has(t));
  check(links.length >= 30, "the links were read", String(links.length));
  // Mutation: rename "## The key" in help.md -> the key card's float button and every link to it fail.
  check(dead.length === 0, "every link names a topic help.md has",
        dead.map(([f, t]) => `${f}: “${t}”`).join("\n          "));
}

/* ------------------------------------------------------------ rule 2: glyphs */
console.log("\na glyph named is a glyph drawn, and the badge is named as drawn");
const RENDERERS = SOURCES["the map"] + SOURCES["the mechanism"] + SOURCES["the staircase"] + SOURCES["the page"];
const GLYPHS = ["⊕", "⊞", "▾", "▼", "▲", "↻", "⟳", "⇄", "⚑"];
const TEACHING = ["app/help.md", "the page", "the map", "the mechanism", "README.md", "site/index.md"];
const undrawn = [];
for (const g of GLYPHS) {
  // Drawn = present in the renderers' strings outside a sentence about it. The crude but honest
  // test: some string uses the glyph with no letters on either side (a label, a badge, a pill).
  const drawn = new RegExp(`(^|[^A-Za-z])${g}([^A-Za-z]|$)`).test(RENDERERS.replace(/badge/g, ""));
  for (const w of TEACHING)
    if (!drawn && SOURCES[w].includes(g)) undrawn.push(`${w} names ${g}, which nothing draws`);
}
// Mutation: put "click its ⊕" back in help.md -> fails (the map draws "+N", never ⊕).
check(undrawn.length === 0, "no glyph is named that the page does not draw", undrawn.join("\n          "));
const badges = [];
for (const w of TEACHING)
  for (const m of SOURCES[w].matchAll(/([⊕⊞▾▼▲⟳⇄⚑◫]) badge|badge ([⊕⊞▾▼▲⟳⇄⚑◫])|the ([⊕⊞]) (?:under|below)/g))
    badges.push(`${w}: “${SOURCES[w].slice(Math.max(0, m.index - 30), m.index + 40)}”`);
// Mutation: write "press the ⊞ badge" back into the study card -> fails.
check(badges.length === 0, "the fold badge is called by what it draws (+N, −), never ⊞ or ⊕",
      badges.join("\n          "));

/* ------------------------------------------------------------ rule 3: retired names */
console.log("\na retired name stays retired");
const VOCAB = JSON.parse(read("app/vocabulary.json"));
check(Array.isArray(VOCAB.retired) && VOCAB.retired.length >= 5, "the retired words were read");
const used = [];
for (const r of VOCAB.retired) {
  const re = new RegExp(r.pattern, r.flags || "");
  for (const w of (r.in || Object.keys(SOURCES)))
    for (const m of SOURCES[w].matchAll(new RegExp(re.source, (re.flags.includes("g") ? re.flags : re.flags + "g"))))
      used.push(`${w}: “${SOURCES[w].slice(Math.max(0, m.index - 25), m.index + 35)}” — say ${r.use}`);
}
// Mutation: restore "the kinds buttons" in help.md, or "by-position view" in a message -> fails.
check(used.length === 0, "none of app/vocabulary.json's retired words is in the teaching text",
      used.join("\n          "));

console.log(`\n${fails ? "FAILED" : "all passed"} — ${checks - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
