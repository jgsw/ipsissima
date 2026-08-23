/* argdown-bundle.js — one file carrying the reconstruction AND the text it is a reading of.
 *
 * WHY THIS EXISTS. A tutor reconstructs a student's essay, writes comments against its moves,
 * and sends back the annotated Word file. But the reconstruction itself — the map, and the
 * comments in their place on it — needs BOTH the .argdown and the manuscript it cites, and a
 * student who is handed two files and told to put them in a folder and point an app at the
 * folder has been handed a task, not feedback. The folder is right for the author, who works in
 * Markdown and wants the files live on disk. It is wrong for everybody the work is sent TO.
 *
 * So a bundle is a folder collapsed into one file: the reconstruction, then every source it
 * cites, attached at the end.
 *
 * IT IS STILL A VALID .argdown, and that is the whole design. The attachment is written as
 * Argdown LINE COMMENTS, which the parser discards; a bundle and the same file without its
 * attachment produce identical graphs, node for node and comment for comment. So the extension
 * does not change, `check_argdown.py` still checks it, `build_argdown_viewer.mjs` still builds
 * from it, the drop handler still opens it, and nothing in the toolchain had to learn a format.
 *
 * WHY LINE COMMENTS AND NOT THE BLOCK FORMS. Argdown accepts three comment syntaxes, and the
 * two block forms can both be closed early by the text being carried — an essay containing an
 * HTML comment, or a fenced code block holding C, ends the attachment mid-sentence and spills
 * prose into the reconstruction, where Argdown reads some of it as claims. A line comment
 * cannot be closed by anything except a newline, and we control where the newlines go. So
 * there is no escaping rule here, because there is nothing to escape.
 *
 *   //>argdown-bundle 1
 *   //>meta {"created":"2026-08-21T10:00:00.000Z"}
 *   //>file source/essay.md
 *   //| # The essay
 *   //|
 *   //| Text with --> and === and {metadata: "blocks"} in it, carried safely.
 *   //>end
 *
 * Classic script, no build step: sets window.ArgdownBundle and exports for Node, so the page
 * and the builder share one implementation of the format.
 */
/** @param {any} global */
(function (global) {
"use strict";

var VERSION = 1;
var OPEN = "//>argdown-bundle";
var LINE = "//|";
var END  = "//>end";

/** Does this text carry an attachment? Cheap enough to call on every file that is opened. */
function isBundle(text) {
  return firstMarker(String(text == null ? "" : text)) >= 0;
}

/** The index of the line that opens the attachment, or -1. Line-anchored: a `//>argdown-bundle`
 *  appearing INSIDE a carried source is prefixed with `//|` and cannot be mistaken for one. */
function firstMarker(text) {
  var lines = text.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++)
    if (lines[i].indexOf(OPEN) === 0) return i;
  return -1;
}

/** The reconstruction alone, with any attachment removed. Idempotent, and safe on a file that
 *  never had one. */
function strip(text) {
  var s = String(text == null ? "" : text);
  var at = firstMarker(s);
  if (at < 0) return s;
  return s.split(/\r?\n/).slice(0, at).join("\n").replace(/\n+$/, "") + "\n";
}

/** Attach sources to a reconstruction.
 *
 *  files: [{ path, text }] — the manuscript in reading order, paths exactly as the .argdown
 *  cites them, so that what comes back out is what a folder would have given.
 *
 *  Any existing attachment is replaced rather than appended to: a bundle opened, edited and
 *  saved must not grow a second copy of the essay each time round.
 */
function attach(argdown, files, meta) {
  var out = [strip(argdown).replace(/\n+$/, ""), "", OPEN + " " + VERSION];
  var m = {};
  if (meta) for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) m[k] = meta[k];
  m.created = m.created || new Date().toISOString();
  out.push("//>meta " + JSON.stringify(m));
  (files || []).forEach(function (f) {
    if (!f || !f.path) return;
    out.push("//>file " + f.path);
    // An empty line is written as a bare `//|` with no trailing space, because editors that
    // trim trailing whitespace on save are common and one that did would otherwise silently
    // change the carried text.
    String(f.text == null ? "" : f.text).split(/\r?\n/).forEach(function (l) {
      out.push(l === "" ? LINE : LINE + " " + l);
    });
  });
  out.push(END, "");
  return out.join("\n");
}

/** Take a bundle apart. Returns null for a file that is not one.
 *
 *  Tolerant on the way in: an unknown `//>` directive is skipped rather than fatal, and a
 *  truncated file with no `//>end` yields what it does have. A bundle arrives by email, and a
 *  mail client that mangled the last line should cost the reader the last paragraph, not the
 *  whole reconstruction.
 */
function detach(text) {
  var s = String(text == null ? "" : text);
  var at = firstMarker(s);
  if (at < 0) return null;
  var lines = s.split(/\r?\n/);
  var version = parseInt((lines[at].slice(OPEN.length) || "").trim(), 10) || 1;
  var meta = {}, files = [], cur = null, truncated = true;

  for (var i = at + 1; i < lines.length; i++) {
    var l = lines[i];
    if (l.indexOf(END) === 0) { truncated = false; break; }
    if (l.indexOf(LINE) === 0) {
      if (!cur) continue;                       // content before any //>file: nothing to hold it
      var body = l.slice(LINE.length);
      // Exactly one separating space is removed, so a line that was itself indented keeps its
      // indentation — which in Markdown is the difference between a paragraph and a code block.
      cur.lines.push(body.charAt(0) === " " ? body.slice(1) : body);
      continue;
    }
    if (l.indexOf("//>file ") === 0) {
      cur = { path: l.slice(8).trim(), lines: [] };
      files.push(cur);
      continue;
    }
    if (l.indexOf("//>meta ") === 0) {
      try { meta = JSON.parse(l.slice(8)) || {}; } catch (e) { meta = {}; }
      continue;
    }
    // Anything else inside the attachment is a directive from a later version of this format,
    // or damage. Neither is a reason to refuse the file.
  }

  return {
    version: version,
    meta: meta,
    truncated: truncated,
    argdown: lines.slice(0, at).join("\n").replace(/\n+$/, "") + "\n",
    files: files.filter(function (f) { return f.path; })
                .map(function (f) { return { path: f.path, text: f.lines.join("\n") }; })
  };
}

var API = { attach: attach, detach: detach, strip: strip, isBundle: isBundle, VERSION: VERSION };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownBundle = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
