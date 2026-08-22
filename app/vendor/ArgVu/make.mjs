#!/usr/bin/env node
/* make.mjs — regenerate ArgVuSansMono-Regular.woff2 from the upstream .otf.
 *
 * The .otf is the file the Argdown project publishes; the .woff2 is what gets embedded, because
 * it is 189 KB against 294 KB and this page is carried around as a single file. Both are kept:
 * the .otf so the provenance of what we ship is checkable, the .woff2 so the build does not need
 * a font toolchain.
 *
 *   node make.mjs        (needs: python3 -m pip install --user fonttools brotli)
 */
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
execFileSync("python3", ["-c", `
from fontTools.ttLib import TTFont
f = TTFont("${path.join(HERE, "ArgVuSansMono-Regular-8.2.otf")}")
f.flavor = "woff2"
f.save("${path.join(HERE, "ArgVuSansMono-Regular.woff2")}")
print("wrote ArgVuSansMono-Regular.woff2")
`], { stdio: "inherit" });
