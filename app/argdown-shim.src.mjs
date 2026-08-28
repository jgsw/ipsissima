#!/usr/bin/env node
/** The two Argdown commands the reconstruction checker uses, and deliberately nothing else.
 *
 *  WHY THIS EXISTS. `check_argdown.py` shells out to the Argdown CLI for ground truth about
 *  whether a file parses and what map it makes. That is the right call -- a second parser in
 *  Python would be a second opinion, and the whole point is to agree with the tool that will
 *  actually read the file. But it meant the Python package could not be installed on its own:
 *  the CLI lived in `app/node_modules`, so using the MCP server required cloning the repository
 *  and running `npm install` in a directory that has nothing to do with it, and the server
 *  located the CLI by a path only a source checkout has.
 *
 *  It also did not work on Windows at all. The lookup was for `node_modules/.bin/argdown`, and
 *  npm does not write an extensionless shim there -- the release build proved that on the same
 *  day this was written, failing with ENOENT on `.bin/esbuild` for exactly that reason.
 *
 *  So this file is bundled to one self-contained `.mjs` and shipped INSIDE the Python package.
 *  What the server needs from the outside world is now `node` on the PATH and nothing else: no
 *  clone, no npm install, no path back into the repository, and the same spelling on all three
 *  platforms.
 *
 *  FAITHFUL, NOT MERELY SIMILAR. Both pipelines below were chosen by diffing their output
 *  against the real CLI's on the corpus until it matched byte for byte, including the six
 *  `--statement-selection` modes. `colorize` is in the JSON pipeline because the CLI's `json`
 *  command puts `color` and `fontColor` on every statement and leaving it out changed the file;
 *  `build-map` is NOT, because the CLI's `json` output has no `map` key and adding one changed
 *  it the other way.
 *
 *  The bundle is ESM with a `require` shim banner -- see build_argdown_shim.mjs for why neither
 *  pure format survives Argdown's mixed dependency tree. `main()` rather than top-level await so
 *  that the entry point does not itself depend on which format wins that argument.
 *
 *  Usage, matching the CLI's own spelling for these two:
 *      node argdown-cli.mjs json FILE --outputDir DIR
 *      node argdown-cli.mjs map  FILE --format dot --stdout [--statement-selection MODE]
 */
import fs from "fs";
import path from "path";
import { argdown } from "@argdown/node";

const MAP_PROCESS = ["parse-input", "build-model", "build-map",
                     "transform-closed-groups", "colorize", "export-dot"];
const JSON_PROCESS = ["parse-input", "build-model", "colorize", "export-json"];

/** The selection modes the checker asks for, and the only ones accepted. Checked rather than
 *  passed through, because an unknown mode is IGNORED by the map builder rather than refused --
 *  which would show up in the report as six identical node counts, indistinguishable from a
 *  `selection:` block in the frontmatter legitimately overriding them all. */
const MODES = ["all", "with-title", "with-relations", "with-more-than-one-relation",
               "top-level", "not-used-in-argument"];

function fail(msg) { process.stderr.write(msg + "\n"); process.exit(1); }

/** The parser's complaints in the CLI's own layout, because `parser_message` in the Python
 *  reads them and a reader about to edit the file needs the line number most. Without colour:
 *  the caller is a pipe, and the escape sequences were noise there and a decoding hazard. */
function reportSyntaxErrors(file, res) {
  const errs = [...(res.lexerErrors || []), ...(res.parserErrors || [])];
  if (!errs.length) return false;
  const lines = [`Argdown syntax errors in ${file}: ${errs.length}`, ""];
  for (const e of errs) {
    const t = e.token || e;
    const line = t.startLine ?? t.line ?? "?";
    const col = t.startColumn ?? t.column ?? 1;
    lines.push(`At ${line}:${col}`, e.message || String(e), "");
  }
  process.stderr.write(lines.join("\n"));
  return true;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const file = argv[1];
  const flag = (name) => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1]; };

  if (!command || !file || !["map", "json"].includes(command))
    fail("usage: argdown-cli.mjs (map|json) FILE [--outputDir DIR] [--statement-selection MODE]");
  if (!fs.existsSync(file)) fail(`no such file: ${file}`);

  const input = fs.readFileSync(file, "utf8");
  const selection = flag("--statement-selection");
  if (selection && !MODES.includes(selection))
    fail(`unknown --statement-selection: ${selection}\nexpected one of: ${MODES.join(", ")}`);
  const request = {
    input,
    process: command === "map" ? MAP_PROCESS : JSON_PROCESS,
    logLevel: "error",
    // The cast is the argv boundary: the value has just been checked against MODES above, which
    // is the same list the type enumerates.
    ...(selection ? { selection: { statementSelectionMode: /** @type {any} */ (selection) } } : {})
  };

  // PARSE FIRST AND STOP IF IT FAILED. Running the whole pipeline over a file that did not parse
  // makes the model plugin throw `No "ast" field in response` and bury the real syntax error
  // under a JavaScript stack -- precisely the noise the Python side then has to strip back off.
  const parsed = await argdown.runAsync({ ...request, process: ["parse-input"] });
  if (reportSyntaxErrors(file, parsed)) process.exit(1);

  const res = await argdown.runAsync(request);
  if (reportSyntaxErrors(file, res)) process.exit(1);
  if (res.exceptions && res.exceptions.length)
    fail(res.exceptions.map(e => e.message || String(e)).join("\n"));

  if (command === "map") {
    if (typeof res.dot !== "string") fail("the map export produced nothing");
    process.stdout.write(res.dot.endsWith("\n") ? res.dot : res.dot + "\n");
  } else {
    const dir = flag("--outputDir");
    if (!dir) fail("json needs --outputDir");
    fs.mkdirSync(dir, { recursive: true });
    if (typeof res.json !== "string") fail("the json export produced nothing");
    fs.writeFileSync(path.join(dir, path.basename(file).replace(/\.[^.]+$/, "") + ".json"),
                     res.json, "utf8");
  }
}

main().catch(e => fail(e && e.stack ? e.stack : String(e)));
