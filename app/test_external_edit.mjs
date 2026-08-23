/** What happens when somebody else changes the .argdown while it is open.
 *
 *  THE CASE THIS EXISTS FOR is not the external edit. It is OUR OWN SAVE. A file watcher fires
 *  on every write to the file, including the ones Ipsissima made, so the naive version announces
 *  "edited externally" every time the reader presses Save — which trains them to ignore the one
 *  message that will one day matter. Half of these checks are that saving is silent.
 *
 *  The decision logic is lifted out of the shipped template and run here, so the test exercises
 *  the page rather than a copy of it that can drift away.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tpl = fs.readFileSync(path.join(HERE, "argdown-viewer.template.html"), "utf8");

function sourceOf(name) {
  const at = tpl.search(new RegExp("(?:async )?function " + name + "\\("));
  if (at < 0) { console.error(name + " is not in the template"); process.exit(1); }
  let d = 0, e = at;
  for (let i = tpl.indexOf("{", at); i < tpl.length; i++) {
    if (tpl[i] === "{") d++;
    else if (tpl[i] === "}" && --d === 0) { e = i + 1; break; }
  }
  return tpl.slice(at, e);
}

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

/** The page's own `hostArgdownChanged`, with everything it leans on replaced by a recorder.
 *
 *  `adAdoptFromDisk` is stubbed rather than lifted: it drives CodeMirror and the renderer, and
 *  what this test is about is WHETHER it is called, not what it does when it is.
 */
function harness({ onDisk, fileNow, dirty }) {
  const log = { adopted: null, banner: null, choose: null, pending: null };
  const scope = {
    HOST: { basename: (p) => p.split("/").pop(), readText: async () => fileNow },
    HOST_PATH: "/papers/Wilson 2026/wilson.argdown",
    DIRTY: dirty,
    AD_ON_DISK: onDisk,
    AD_PENDING: null,
    adAdoptFromDisk(text) { log.adopted = text; scope.AD_ON_DISK = text; },
    adExtern(msg, choose) { log.banner = msg; log.choose = !!choose; },
  };
  const fn = new Function("S", `
    with (S) {
      ${sourceOf("hostArgdownChanged").replace(/^async function/, "return async function")}
    }`)(new Proxy(scope, {
      has: () => true,
      get: (t, k) => t[k],
      set: (t, k, v) => { t[k] = v; return true; },
    }));
  return { run: () => fn().then(() => { log.pending = scope.AD_PENDING; return log; }),
           scope };
}

const A = "[main]: The original text.\n";
const B = "[main]: Somebody else edited this.\n";

console.log("== an external edit to the .argdown");

console.log("\nour own save must be silent");
{
  // After `saveArgdown`, AD_ON_DISK is the text we just wrote. The watcher then fires on that
  // very write, and must say nothing at all.
  const h = harness({ onDisk: B, fileNow: B, dirty: false });
  const log = await h.run();
  check("a write we made raises no banner", log.banner, null);
  check("and reloads nothing", log.adopted, null);
}
{
  // A touch that changes no bytes — some editors write, then rewrite identically.
  const h = harness({ onDisk: A, fileNow: A, dirty: true });
  const log = await h.run();
  check("an identical rewrite is not an edit", log.banner, null);
  check("and does not threaten unsaved work", log.choose, null);
}

console.log("\nno unsaved changes: reload, and say so");
{
  const h = harness({ onDisk: A, fileNow: B, dirty: false });
  const log = await h.run();
  check("the new text is adopted", log.adopted, B);
  check("the reader is told, by name", log.banner,
        "wilson.argdown edited externally — reloaded from disk");
  check("with nothing to decide", log.choose, false);
}

console.log("\nunsaved changes: ask, and decide nothing");
{
  const h = harness({ onDisk: A, fileNow: B, dirty: true });
  const log = await h.run();
  check("nothing is adopted behind the reader's back", log.adopted, null);
  check("the banner says both things are true", log.banner,
        "wilson.argdown edited externally, and you have unsaved changes");
  check("and offers the choice", log.choose, true);
  check("the disk version is held, ready to load", log.pending, B);
  check("and what we believe disk holds is NOT updated", h.scope.AD_ON_DISK, A);
}

console.log("\nthe first event only establishes a baseline");
{
  // hostWatchArgdown reads the file to set AD_ON_DISK, but a watcher can beat that read home.
  const h = harness({ onDisk: null, fileNow: B, dirty: true });
  const log = await h.run();
  check("with no baseline, nothing is announced", log.banner, null);
  check("nothing is adopted", log.adopted, null);
  check("and the baseline is taken from the file", h.scope.AD_ON_DISK, B);
}

console.log("\nthe file going unreadable is not an edit");
{
  const log = { banner: null, adopted: null };
  const scope = {
    HOST: { basename: (p) => p.split("/").pop(),
            readText: async () => { throw new Error("ENOENT"); } },
    HOST_PATH: "/papers/x.argdown", DIRTY: true, AD_ON_DISK: A, AD_PENDING: null,
    adAdoptFromDisk(t) { log.adopted = t; },
    adExtern(m, c) { log.banner = m; },
  };
  const fn = new Function("S", `with (S) {
      ${sourceOf("hostArgdownChanged").replace(/^async function/, "return async function")}
    }`)(new Proxy(scope, { has: () => true, get: (t, k) => t[k],
                           set: (t, k, v) => { t[k] = v; return true; } }));
  await fn();
  check("a read failure says nothing", log.banner, null);
  check("and changes nothing", scope.AD_ON_DISK, A);
}

console.log();
if (fails) { console.log(`${fails} check(s) failed\n`); process.exit(1); }
console.log("all passed\n");
