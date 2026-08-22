/* test_host.mjs — the desktop host adapter, tested without a desktop.
 *
 * WHY THIS IS WORTH TESTING HEADLESSLY. Everything `argdown-host.js` does happens at the moment
 * a reader opens a folder, and the failures are the quiet kind: a chapter skipped because a
 * filter was wrong, a path joined with the wrong separator so nothing is found, a walk that
 * follows `Old versions/` and offers four stale copies of the same essay. None of that throws.
 * You would notice it as "the Manuscript view is empty", days later, and blame the reconstruction.
 *
 * So the Tauri API is faked — it is a handful of async functions over a plain object — and the
 * walk runs against a fixture tree built here. What this does NOT test is whether Tauri's own
 * fs plugin behaves as documented; that is what running the app checks.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOST_SRC = path.join(HERE, "src", "argdown-host.js");

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

/* A fixture that contains every shape the walk has to get right: a nested source folder, a
 * project file, the workspace's own `Old versions/` convention, a dotfile, a build folder, and
 * a file type that is none of Ipsissima's business. */
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ipsissima-host-"));
const write = (rel, text) => {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
};
write("paper.argdown", "[A]: a claim.\n");
write("_quarto.yml", 'chapters:\n  - "source/paper.md"\n');
write("source/paper.md", "# Paper\n\nBody.\n");
write("source/notes.qmd", "# Notes\n");
write("source/paper (clean).pdf", "%PDF-1.4 not text");
write("Old versions/paper.argdown", "[A]: the SUPERSEDED one.\n");
write("Old versions/source/paper.md", "stale\n");
write("node_modules/pkg/index.md", "not the manuscript\n");
write(".hidden/secret.md", "no\n");

/* The fake host. Deliberately shaped like Tauri v2's: readDir returns entries with names and
 * kind flags and no paths, which is the detail the adapter has to join for itself. */
const fakeTauri = {
  core: { invoke: async () => [] },
  event: { listen: async () => () => {} },
  dialog: {},
  fs: {
    readDir: async (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).map((e) => ({
        name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile(), isSymlink: e.isSymbolicLink()
      })),
    readTextFile: async (p) => fs.readFileSync(p, "utf8"),
    writeTextFile: async (p, t) => fs.writeFileSync(p, t),
    watch: async () => () => {}
  }
};

globalThis.__TAURI__ = fakeTauri;
const require = createRequire(import.meta.url);
const HOST = require(HOST_SRC);

console.log("detection");
check("a host is detected when Tauri is present", HOST.available, true);

console.log("paths");
check("join", HOST.join("/a/b", "c.md"), "/a/b/c.md");
check("  a trailing separator does not double", HOST.join("/a/b/", "c.md"), "/a/b/c.md");
check("  an empty dir gives the bare name", HOST.join("", "c.md"), "c.md");
check("dirname", HOST.dirname("/a/b/c.md"), "/a/b");
check("basename", HOST.basename("/a/b/c.md"), "c.md");
// Windows hands back backslashes; the adapter has to read them even though it writes "/".
check("  and both survive a Windows path",
      [HOST.dirname("C:\\Users\\x\\p.argdown"), HOST.basename("C:\\Users\\x\\p.argdown")],
      ["C:\\Users\\x", "p.argdown"]);

console.log("walking a real folder");
const listed = await HOST.readDirDeep(root);
const rels = listed.files.map((f) => f.rel).sort();
check("every readable file is found, with its path relative to the folder", rels,
      ["_quarto.yml", "paper.argdown",
       "source/notes.qmd", "source/paper (clean).pdf", "source/paper.md"]);
check("  `Old versions/` is never walked",
      rels.some((r) => r.indexOf("Old versions") === 0), false);
check("  nor is node_modules", rels.some((r) => r.indexOf("node_modules") === 0), false);
check("  nor are dotfolders", rels.some((r) => r.indexOf(".hidden") === 0), false);
check("  it did not truncate", listed.truncated, false);
check("  and the absolute path is right",
      fs.readFileSync(listed.files.find((f) => f.rel === "source/paper.md").abs, "utf8"),
      "# Paper\n\nBody.\n");

// `Old versions/` is skipped by name, and that is the one entry in SKIP_DIRS that is this
// workspace's own convention rather than a general one — worth asserting so a tidy-up cannot
// quietly drop it and reintroduce four stale copies of every chapter.
check("SKIP_DIRS still covers the workspace's own convention",
      HOST.SKIP_DIRS.indexOf("Old versions") >= 0, true);

console.log("the cap is real");
for (let i = 0; i < 60; i++) write(`bulk/f${i}.md`, "x");
const capped = await HOST.readDirDeep(root, { maxEntries: 20 });
check("a huge folder stops rather than hanging", capped.files.length <= 20, true);
check("  and says that it stopped", capped.truncated, true);

console.log("reading and writing");
const target = path.join(root, "paper.argdown");
await HOST.writeText(target, "[A]: edited in place.\n");
check("writeText replaces the file", fs.readFileSync(target, "utf8"), "[A]: edited in place.\n");
check("  and readText reads it back", await HOST.readText(target), "[A]: edited in place.\n");

console.log("without a host");
delete globalThis.__TAURI__;
delete require.cache[require.resolve(HOST_SRC)];
const BARE = require(HOST_SRC);
check("in a browser the adapter reports itself unavailable", BARE.available, false);
// The page tests `HOST` for truthiness and never calls into it otherwise; what matters is only
// that merely loading the file in a browser cannot throw.
check("  and loading it is still harmless", typeof BARE.join, "function");

fs.rmSync(root, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
