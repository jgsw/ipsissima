/** Bundle the Argdown shim into the Python package.
 *
 *      node build_argdown_shim.mjs
 *
 *  WHY THE OUTPUT IS COMMITTED. It is a build artifact in someone else's source tree, which is
 *  normally a smell. The alternative is worse: a wheel built from a source checkout would need
 *  Node and an `npm install` at PACKAGING time, so anyone running `pip install .` without a
 *  JavaScript toolchain would get a package whose checker cannot run -- and the whole purpose of
 *  the shim is that installing the server should not require a JavaScript toolchain.
 *
 *  So the artifact is committed, and `test_argdown_shim.mjs` fails if it has drifted from this
 *  source or from the real CLI's output. Regenerate it whenever `@argdown/*` is upgraded.
 */
import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "ipsissima-mcp", "src", "ipsissima_mcp",
                      "vendor", "argdown-cli.mjs");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(HERE, "argdown-shim.src.mjs")],
  outfile: OUT,
  bundle: true,
  // NODE, not browser: this one is meant to have fs and path, unlike everything else the build
  // produces.
  platform: "node",
  // ESM PLUS A `require` SHIM, because the dependency tree is mixed and neither pure format
  // survives it. Straight `esm` leaves the CommonJS packages' `require` calls pointing at a stub
  // that throws `Dynamic require of "path" is not supported`. Straight `cjs` fixes those and
  // breaks the other half: something in the tree calls `createRequire(import.meta.url)`, and in
  // CJS output `import.meta.url` is replaced by `undefined`, so it throws before main() is even
  // reached. ESM keeps `import.meta.url` real, and the banner gives the CommonJS half the
  // `require` it expects. Both failures were found by running the bundle, not by reading it.
  format: "esm",
  banner: { js: "import { createRequire as __createRequire } from 'module';\n"
                + "const require = __createRequire(import.meta.url);" },
  target: "node18",
  // MINIFIED, unusually for something committed. Nobody reads bundled vendor code, the tests are
  // what say whether it is right, and it halves what both the repository and the wheel carry:
  // 5.4 MB to 2.7 MB.
  minify: true,
  legalComments: "none",
  absWorkingDir: HERE
});

const kb = Math.round(fs.statSync(OUT).size / 1024);
console.error(`wrote ${path.relative(path.join(HERE, ".."), OUT)} (${kb} KB)`);
