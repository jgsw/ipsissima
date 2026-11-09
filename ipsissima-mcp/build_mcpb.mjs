/** Pack Ipsissima-MCP as a .mcpb bundle — the double-click install for Claude Desktop.
 *
 *      node ipsissima-mcp/build_mcpb.mjs
 *
 *  WHY `server.type: "uv"` AND NOT A VENDORED PYTHON. The bundle format offers three ways to
 *  ship a Python server and two of them are closed to this one. Claude ships a Node runtime and
 *  NOT a Python one, so a bundle cannot assume an interpreter is there; and the format's own
 *  documentation says a traditional bundle "cannot portably bundle compiled dependencies" —
 *  which is all of ours, pymupdf and onnxruntime and cv2 and lxml and pydantic-core. The `uv`
 *  runtime is the one that works: the host provisions Python and installs what pyproject.toml
 *  declares, for the platform it is actually on.
 *
 *  It is also what keeps this small. Vendoring the dependencies would mean 464 MB, of which
 *  285 MB is the OCR chain alone (cv2 121, onnxruntime 77, rapidocr 33, numpy/PIL/shapely/
 *  networkx 54) — measured, and per platform. This way the bundle is the source and the parser.
 *
 *  WHAT IS STAGED, AND WHY NOT JUST THIS FOLDER. The tests build wheels, the eval corpus is
 *  large, and neither belongs in something a reader installs. So a clean copy is assembled here
 *  rather than packing the working directory and hoping .mcpbignore catches everything.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const OUT = path.join(HERE, "build", "mcpb");
const CLI = path.join(ROOT, "app", "node_modules", "@anthropic-ai", "mcpb", "dist", "cli", "cli.js");

/* ---- the version is pyproject's, and the manifest has to agree ---- */
const pyproject = fs.readFileSync(path.join(HERE, "pyproject.toml"), "utf8");
const pyVersion = (pyproject.match(/^version = "([^"]+)"/m) || [])[1];
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "manifest.json"), "utf8"));
if (manifest.version !== pyVersion) {
  console.error(`manifest.json says ${manifest.version}, pyproject.toml says ${pyVersion}.`);
  console.error("They are the same release; edit both.");
  process.exit(1);
}

/* ---- stage ---- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// THE PACKAGE, MINUS WHAT ONLY A DEVELOPER WANTS. `vendor/` and `docs/` are the point and are
// copied in full: the parser and the prompts are what make this work when installed rather than
// checked out.
fs.cpSync(path.join(HERE, "src"), path.join(OUT, "src"), {
  recursive: true,
  filter: (src) => !/(^|[\\/])(__pycache__|\.pytest_cache)([\\/]|$)/.test(src)
});
for (const f of ["manifest.json", "README.md"])
  fs.copyFileSync(path.join(HERE, f), path.join(OUT, f));

// UNPETRIFY TRAVELS INSIDE, as source beside ipsissima_mcp, rather than as a requirement. The
// converters are its package now (Nov 2026), and a bundle that asked PyPI for it would install
// whichever release PyPI had rather than the one this bundle was tested with -- or nothing, before
// the first one is published. So its source is staged under src/, where setuptools finds both
// packages, and the staged pyproject asks for its dependencies instead of for it.
const UNP = path.join(ROOT, "unpetrify");
fs.cpSync(path.join(UNP, "src", "unpetrify"), path.join(OUT, "src", "unpetrify"), {
  recursive: true,
  filter: (src) => !/(^|[\\/])(__pycache__|\.pytest_cache)([\\/]|$)/.test(src)
});
const deps = (text) => (text.match(/^dependencies = \[\n([\s\S]*?)^\]/m) || [])[1] || "";
const unpDeps = deps(fs.readFileSync(path.join(UNP, "pyproject.toml"), "utf8"));
if (!/"unpetrify[><=]/.test(pyproject) || !unpDeps.trim()) {
  console.error("pyproject.toml no longer asks for unpetrify, or unpetrify declares nothing; " +
                "the staging below assumes both.");
  process.exit(1);
}
const own = deps(pyproject).split("\n").filter(l => l.trim() && !/"unpetrify[><=]/.test(l));
const merged = [...new Set([...own, ...unpDeps.split("\n").filter(l => l.trim())]
  .map(l => l.trim()))].map(l => "  " + l).join("\n") + "\n";
fs.writeFileSync(path.join(OUT, "pyproject.toml"),
  pyproject.replace(deps(pyproject), merged)
           .replace(/\n# IN A CHECKOUT, UNPETRIFY[\s\S]*?\[tool\.uv\.sources\]\n[^\n]*\n/, "\n"));
fs.copyFileSync(path.join(ROOT, "LICENSE"), path.join(OUT, "LICENSE"));
fs.copyFileSync(path.join(ROOT, "app", "desktop", "src-tauri", "icons", "source.png"),
                path.join(OUT, "icon.png"));

// .mcpbignore belongs in the staged copy, not the repository: it is the bundle's statement about
// itself, and the things it excludes are things this script never stages in the first place. It
// is here so that packing the folder by hand gives the same result as packing it with this.
fs.writeFileSync(path.join(OUT, ".mcpbignore"),
  "# A `uv` bundle declares its dependencies and does not carry them.\n" +
  ".venv/\nserver/lib/\n__pycache__/\n*.pyc\nbuild/\ndist/\n");

/* ---- the parser has to be in there, or the checker cannot run ---- */
const parser = path.join(OUT, "src", "ipsissima_mcp", "vendor", "argdown-cli.mjs");
if (!fs.existsSync(parser)) {
  console.error("the bundled Argdown parser is missing — run: node app/build_argdown_shim.mjs");
  process.exit(1);
}
const docs = fs.readdirSync(path.join(OUT, "src", "ipsissima_mcp", "docs")).filter(f => f.endsWith(".md"));
if (docs.length < 5) {
  console.error(`only ${docs.length} documents staged; the server serves nine.`);
  process.exit(1);
}

/* ---- validate, then pack ---- */
execFileSync(process.execPath, [CLI, "validate", path.join(OUT, "manifest.json")],
             { stdio: "inherit" });
execFileSync(process.execPath, [CLI, "pack", OUT, path.join(HERE, "build", `ipsissima-mcp-${pyVersion}.mcpb`)],
             { stdio: "inherit" });

const bundle = path.join(HERE, "build", `ipsissima-mcp-${pyVersion}.mcpb`);
console.error(`\n${path.relative(ROOT, bundle)} — ${(fs.statSync(bundle).size / 1048576).toFixed(1)} MB`);
