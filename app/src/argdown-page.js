/* argdown-page.js — what a built Ipsissima page is MADE OF, stated once.
 *
 * WHY THIS EXISTS. A page can be assembled from two directions. `build_argdown_viewer.mjs`
 * assembles one in Node, out of files on disk and esbuild bundles. The page itself assembles one
 * in a browser, out of the scripts already inlined in it, so that a reconstruction can be handed
 * to somebody as a single file they double-click. Same artifact, same template, two routes to it.
 *
 * The routes are irreducibly different at one point only — where the script text comes from —
 * and were different at four: each had its own marker regex, its own JSON escaper, its own
 * substitution loop, and, fatally, its own LIST OF WHICH SECTIONS A PAGE HAS.
 *
 * WHAT THAT COST, measured 27 Aug 2026. The builder's list had eight entries; the page's had
 * six. The two it lacked were HELP and STAMP. So every exported page shipped with `help.md`
 * missing — and the program writes into four elements that live INSIDE help.md (`helpstats`,
 * `helpArrangeNote`, `helpEdgeNote`, `helpkeys`). `statsLine` reached `$("helpstats").textContent`
 * on an element that was not there, threw, and took the rest of `render` with it: no Notes tab,
 * no relation key, and `setArrangement` never called, so the Exposition button was wired to
 * nothing. Four separate bug reports, one forgotten array entry, and nothing anywhere said so.
 *
 * So the list is here, and neither side keeps its own. More than that: the page no longer names
 * what it KEEPS. It names what it drops, and carries everything else it happens to have — which
 * is what makes adding a ninth section to the template safe. A keep-list has to be remembered;
 * a drop-list has to be argued for.
 *
 * Classic script, no build step: sets window.ArgdownPage and exports for Node, the same shape
 * `argdown-bundle.js` and `argdown-positions.js` use for exactly the same reason.
 */
/** @param {any} global */
(function (global) {
"use strict";

/** The sections of a page, in the order the template declares them.
 *
 *  These are the `<!-- INLINE:NAME -->` markers in `argdown-viewer.template.html`, and the same
 *  names go on the `data-part` attribute of every script the builder writes — because the PAGE
 *  reads them back when it exports a copy of itself, and a comment beside a script is a fragile
 *  thing to look something up by.
 *
 *  `checkTemplate` below asserts this list against the template on every build, so a marker
 *  added to the HTML and not added here stops the build rather than going quietly missing from
 *  every exported page. That is the check this file was written after wishing for.
 */
var PARTS = ["LIVEMAP_DEPS", "PARSER", "EDITOR", "EXPORTER", "PAYLOAD", "SHELL", "STAMP", "HELP"];

/** What a self-contained copy LEAVES OUT, and why each one earns its place here.
 *
 *   PARSER    515 KB of @argdown/core. The copy carries a graph that is already built; there is
 *             nothing left for it to parse. (It is also what makes the copy read-only: no
 *             parser means no redrawing from edited text.)
 *   EDITOR    346 KB of CodeMirror. Same reason, and see the note on `exportPage`: the editor
 *             is a click away online and in the app, so embedding one in every page sent to a
 *             student is weight carried for a need that is already met.
 *   EXPORTER  350 KB of `docx`. It writes the annotated Word file FROM comments; a copy is what
 *             you send after writing them.
 *   SHELL     145 KB of template-as-text, which exists so a page can export a page. A copy is
 *             the end of that chain: whoever receives it forwards the file itself.
 *
 * NOTHING ELSE MAY BE ADDED HERE WITHOUT A SIZE AND A REASON. Every other section is either what
 * draws the map (LIVEMAP_DEPS), what is being sent (PAYLOAD), or something small the program
 * cannot run without: HELP is 19 KB and holds four elements the renderer writes into; STAMP is
 * 300 bytes and is the only answer to "which build am I looking at".
 */
var EXPORT_DROPS = ["PARSER", "EDITOR", "EXPORTER", "SHELL"];

/* A fresh regex per call. This is a /g pattern, and a shared one carries `lastIndex` between
 * calls -- harmless under `replace`, silently skipping matches under `test` or `exec`. Cheap
 * enough that there is no reason to find out which callers are which. */
function marker() { return /[ \t]*<!--\s*INLINE:([A-Z_]+)\s*-->[ \t]*\n?/g; }

function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

/** Every marker name the template declares, in the order it declares them. */
function markers(html) {
  var out = [], m, re = marker();
  while ((m = re.exec(html))) if (out.indexOf(m[1]) < 0) out.push(m[1]);
  return out;
}

/** Substitute the marker for each section's script text.
 *
 *  Reports rather than throws, because the two callers want different volumes: the builder
 *  treats a part with nowhere to go as a broken build and stops; the page is substituting names
 *  it read out of its own DOM and has nothing to gain from an exception at the moment somebody
 *  clicked Export.
 *
 *  @param {string} html
 *  @param {Record<string,string>} parts
 *  @returns {{html: string, filled: string[], missing: string[]}} `missing` names parts that
 *           were handed in and have no marker to sit in.
 */
function fill(html, parts) {
  var seen = {};
  var out = html.replace(marker(), function (m, key) {
    seen[key] = true;
    return parts[key] != null ? parts[key] : "";
  });
  var missing = [];
  for (var k in parts) if (hasOwn(parts, k) && !seen[k]) missing.push(k);
  return { html: out, filled: Object.keys(seen), missing: missing };
}

/** Which sections a self-contained copy carries, given the sections the source page HAS.
 *
 *  A DROP-LIST, AND THE INVERSION IS THE POINT. The page used to answer this with a literal
 *  `{ LIVEMAP_DEPS: true, PAYLOAD: true, ... }`, which is a list of what to remember; this is a
 *  list of what to argue for. A section added to the template travels into every exported page
 *  by default and nobody has to know it was added.
 *
 *  PAYLOAD is forced on because it is the one section that is never copied: the exporter writes
 *  a fresh one. A page opened by dropping a file has no PAYLOAD script of its own to be found.
 *
 *  @param {string[]} available part names present in the source page
 *  @returns {Record<string, boolean>}
 */
function exportParts(available) {
  /** @type {Record<string, boolean>} */
  var want = {};
  for (var i = 0; i < available.length; i++)
    want[available[i]] = EXPORT_DROPS.indexOf(available[i]) < 0;
  want.PAYLOAD = true;
  return want;
}

/** JSON that is safe to sit inside a `<script>` body.
 *
 *  `</script` anywhere in a string would close the wrapper early. U+2028 and U+2029 are literal
 *  line terminators in JavaScript source — legal inside a JSON string, fatal inside a script
 *  element — and a manuscript pasted out of a word processor is exactly where they come from.
 */
function safeJSON(value) {
  return JSON.stringify(value)
    .replace(/<\/script/gi, "<\\/script")
    .replace(/[\u2028\u2029]/g, function (c) { return "\\u" + c.charCodeAt(0).toString(16); });
}

/** Does the template declare exactly the sections this file knows about?
 *
 *  Returns a list of complaints, empty when they agree. The builder calls it and refuses to
 *  write a page when it is not empty, which is the whole guard: a marker added to the HTML
 *  without being added to PARTS would otherwise be filled by the builder (which enumerates its
 *  own parts object) and dropped by the page (which would not know to carry it) — silently, and
 *  only in the copy somebody was sent.
 */
function checkTemplate(html) {
  var found = markers(html), out = [], i;
  for (i = 0; i < found.length; i++)
    if (PARTS.indexOf(found[i]) < 0)
      out.push("the template declares INLINE:" + found[i] + ", which argdown-page.js does not " +
               "list in PARTS — so an exported copy would not carry it");
  for (i = 0; i < PARTS.length; i++)
    if (found.indexOf(PARTS[i]) < 0)
      out.push("argdown-page.js lists " + PARTS[i] + ", but the template has no " +
               "INLINE:" + PARTS[i] + " marker for it");
  for (i = 0; i < EXPORT_DROPS.length; i++)
    if (PARTS.indexOf(EXPORT_DROPS[i]) < 0)
      out.push(EXPORT_DROPS[i] + " is on the export drop-list but is not a part");
  return out;
}

var API = {
  PARTS: PARTS, EXPORT_DROPS: EXPORT_DROPS,
  markers: markers, fill: fill, exportParts: exportParts, safeJSON: safeJSON,
  checkTemplate: checkTemplate
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownPage = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
