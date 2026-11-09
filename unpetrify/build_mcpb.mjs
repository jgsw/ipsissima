/** Pack Unpetrify as a .mcpb bundle — the double-click install for Claude Desktop.
 *
 *      node unpetrify/build_mcpb.mjs
 *
 *  THE SAME SHAPE AS IPSISSIMA-MCP'S BUNDLE, for the reasons ipsissima-mcp/build_mcpb.mjs gives:
 *  `server.type: "uv"`, because Claude ships no Python and the dependencies are compiled
 *  (pymupdf, onnxruntime, cv2, lxml), so the host provisions Python and installs what
 *  pyproject.toml declares for the platform it is on. The bundle is the source and nothing else.
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
fs.cpSync(path.join(HERE, "src"), path.join(OUT, "src"), {
  recursive: true,
  filter: (src) => !/(^|[\\/])(__pycache__|\.pytest_cache|[^\\/]*\.egg-info)([\\/]|$)/.test(src)
});
for (const f of ["manifest.json", "pyproject.toml", "README.md", "LICENSE"])
  fs.copyFileSync(path.join(HERE, f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, ".mcpbignore"),
  "# A `uv` bundle declares its dependencies and does not carry them.\n" +
  ".venv/\n__pycache__/\n*.pyc\nbuild/\ndist/\n");

/* ---- validate, then pack ---- */
execFileSync(process.execPath, [CLI, "validate", path.join(OUT, "manifest.json")],
             { stdio: "inherit" });
const bundle = path.join(HERE, "build", `unpetrify-${pyVersion}.mcpb`);
execFileSync(process.execPath, [CLI, "pack", OUT, bundle], { stdio: "inherit" });
console.error(`\n${path.relative(ROOT, bundle)} — ${(fs.statSync(bundle).size / 1048576).toFixed(1)} MB`);
