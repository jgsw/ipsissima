/* argdown-host.js — the desktop host, when there is one.
 *
 * ONE HTML FILE, TWO HOSTS. Ipsissima is a single self-contained page, and that is the property
 * worth protecting: it is emailable, it opens by double-clicking, it needs no install. This
 * module does not fork that. It detects whether the page is running inside the Tauri shell and,
 * if it is, offers the shell's own file access; if it is not, it reports itself unavailable and
 * every existing browser path runs exactly as before. The same file is the web app and the
 * desktop app's frontend.
 *
 * WHY THE DESKTOP SHELL IS NOT A LUXURY. In a browser, the good path — open a folder read-write
 * and save the .argdown back where it was found — is `showDirectoryPicker`, which exists only in
 * Chromium. Measured 21 Aug 2026 (see Toolchain notes): in WebKit the whole map, both panes and
 * every mark render identically and `showDirectoryPicker` is `undefined`. So a Safari or Firefox
 * reader gets a degraded Ipsissima today, and the desktop shell is what levels them up rather
 * than what serves the people already best served.
 *
 * WHAT IT GAINS BEYOND PARITY:
 *   * real paths — no handle to keep alive, no permission that lapses when the tab closes
 *   * no per-session prompt before writing a file the reader themselves opened
 *   * WATCHING the manuscript, which the web has no equivalent of at all. Edit the essay in
 *     Zettlr and the passage under the claim updates. That is the author's own workflow and it
 *     was simply impossible in a page.
 *
 * POLICY LIVES IN THE PAGE, NOT HERE. This module knows how to read a directory and write a
 * file; it does not know which extensions are sources, what a project file is called, or which
 * .argdown wins when a folder holds two. That is `loadDropped`'s business and it is already
 * written. So what follows is deliberately primitive, and the page composes it the same way it
 * composes a drop.
 *
 * Classic script, no build step, inert in a browser: sets window.ArgdownHost and exports for
 * Node so the desktop build can test it headlessly.
 */
(function (global) {
"use strict";

/* `withGlobalTauri` is set in tauri.conf.json precisely so that this file can be a plain script
 * with no imports and no bundler step -- the frontend is built by esbuild without npm deps, and
 * adding @tauri-apps/api to it would mean the browser build carried a module it can never use. */
var T = global.__TAURI__ || null;
var available = !!(T && T.core && T.fs && T.dialog);

/* Paths are joined with "/" on every platform. Rust's `Path` accepts forward slashes on Windows,
 * and Tauri's `path.join` is async -- one await per path component, over a folder of chapters,
 * for a separator that does not need choosing. */
function join(dir, name) {
  if (!dir) return name;
  return dir.replace(/[\/\\]+$/, "") + "/" + name;
}
function dirname(p) {
  var i = String(p || "").replace(/\\/g, "/").lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}
function basename(p) {
  var s = String(p || "").replace(/\\/g, "/");
  return s.slice(s.lastIndexOf("/") + 1);
}

function pickDirectory() {
  return T.dialog.open({ directory: true, multiple: false });
}

function pickFile(exts) {
  return T.dialog.open({
    multiple: false,
    filters: [{ name: "Argdown", extensions: exts || ["argdown", "ad"] }]
  });
}

function pickSavePath(suggested) {
  return T.dialog.save({
    defaultPath: suggested || "reconstruction.argdown",
    filters: [{ name: "Argdown", extensions: ["argdown"] }]
  });
}

function readText(abs) { return T.fs.readTextFile(abs); }
function writeText(abs, text) { return T.fs.writeTextFile(abs, text); }

/* Folders that are never a manuscript, skipped before they are walked. `Old versions` is this
 * workspace's own convention and holds superseded drafts of the very files being read: walking
 * it would offer the reader four stale copies of their chapter and no way to tell which is
 * which. The rest are the usual machinery. */
var SKIP_DIRS = ["node_modules", ".git", "Old versions", "__pycache__", ".argument-history",
                 "Background Readings", "Submission"];

/** Every file under `dir`, as { rel, abs }, depth-first and in directory order.
 *
 *  CAPPED, and the cap is a real one rather than a gesture: this runs on whatever folder the
 *  reader chose, and someone will one day point it at their home directory. It stops rather than
 *  hanging, and says it stopped.
 */
async function readDirDeep(dir, opts) {
  opts = opts || {};
  var maxEntries = opts.maxEntries || 4000;
  var out = [], truncated = false;

  async function walk(abs, rel, isRoot) {
    if (truncated) return;
    var entries;
    try { entries = await T.fs.readDir(abs); }
    catch (e) {
      // A SUBFOLDER THAT WILL NOT READ IS NOT A FAILED OPEN -- but the folder the reader
      // actually chose is. Swallowing that one turned "the host refused this path" into
      // "nothing readable in that folder", which sends someone looking for a missing file
      // when the real answer is that the app is not allowed to look there at all.
      if (isRoot) throw e;
      return;
    }
    for (var i = 0; i < entries.length; i++) {
      if (out.length >= maxEntries) { truncated = true; return; }
      var e = entries[i];
      if (e.name.charAt(0) === ".") continue;
      if (e.isDirectory) {
        if (SKIP_DIRS.indexOf(e.name) >= 0) continue;
        await walk(join(abs, e.name), join(rel, e.name), false);
      } else if (e.isFile) {
        out.push({ rel: rel ? join(rel, e.name) : e.name, abs: join(abs, e.name) });
      }
    }
  }
  await walk(dir, "", true);
  return { files: out, truncated: truncated };
}

/** Watch some files and call back when any of them changes on disk.
 *
 *  ONLY EVER THE MANUSCRIPT. The .argdown is the file the editor holds, and watching it would
 *  mean a save from another window silently replacing what the reader is typing. The manuscript
 *  is read-only in Ipsissima by design -- "a reconstruction must never be able to alter the text
 *  it is a reconstruction OF" -- so it is exactly the file that is safe to reload underneath the
 *  reader, and exactly the one they want reloaded.
 *
 *  Debounced, because an editor writing a file produces several events and one of them arrives
 *  while the file is empty.
 */
async function watch(paths, cb, delayMs) {
  if (!available || !T.fs.watch || !paths || !paths.length) return function () {};
  var timer = null;
  try {
    var stop = await T.fs.watch(paths, function (event) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { cb(event); }, delayMs == null ? 250 : delayMs);
    }, { delayMs: 300, recursive: false });   // Tauri debounces too; 2000ms is its default
    return function () { if (timer) clearTimeout(timer); try { stop(); } catch (e) {} };
  } catch (e) {
    return function () {};
  }
}

/** Files the OS handed us — a double-clicked .argdown, or one dropped on the app icon.
 *
 *  The Rust side QUEUES these, because on macOS the open event can arrive before the webview
 *  exists and a launch-by-double-click would otherwise open an empty window. So the page asks
 *  for whatever is waiting as soon as it is ready, and separately listens for later ones.
 */
function onOpenPaths(cb) {
  if (!available) return;
  T.event.listen("ipsissima://open-paths", function (e) {
    var paths = (e && e.payload) || [];
    if (paths.length) cb(paths);
  });
  // Whatever arrived before this listener existed.
  T.core.invoke("take_pending_open").then(function (paths) {
    if (paths && paths.length) cb(paths);
  }).catch(function () {});
}

/** Menu items chosen by the reader. The payload is the item's id; the page decides what it does.
 *
 *  Nothing here interprets the id. The whole point of routing the menu back into the page is that
 *  a menu item and the button beside it run the SAME handler — two implementations of "Open" that
 *  drift apart is precisely what a native menu usually costs.
 */
function onMenu(cb) {
  if (!available) return;
  T.event.listen("ipsissima://menu", function (e) {
    if (e && e.payload) cb(String(e.payload));
  });
}

var API = {
  available: available,
  onMenu: onMenu,
  join: join, dirname: dirname, basename: basename,
  pickDirectory: pickDirectory, pickFile: pickFile, pickSavePath: pickSavePath,
  readText: readText, writeText: writeText, readDirDeep: readDirDeep,
  watch: watch, onOpenPaths: onOpenPaths,
  SKIP_DIRS: SKIP_DIRS
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
global.ArgdownHost = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
