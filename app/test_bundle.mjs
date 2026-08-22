/* test_bundle.mjs — the one-file container: a reconstruction with its manuscript attached.
 *
 * TWO THINGS MUST HOLD, and everything else here is detail.
 *
 *   1. The bundle is still a valid .argdown. Attaching a manuscript must not change the graph
 *      by one node, one edge or one comment — otherwise the whole design is off, because the
 *      point of writing the attachment as line comments was that the toolchain would not have
 *      to learn a format.
 *   2. The text comes back out byte for byte. This carries a student's essay to a marker and
 *      back; a container that quietly loses an indent has silently changed a code block into a
 *      paragraph, and nothing downstream can tell.
 *
 * So the fixture is deliberately hostile: it holds every delimiter that could close an
 * attachment early, plus the format's own directives, plus the indentation and blank lines that
 * a naive line-prefix scheme mangles.
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const B = require(path.join(HERE, "src", "argdown-bundle.js"));

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

const AD = `[Thesis]: Ritual has ethical value. {comment: "is this too strong?", chapter: "source/essay.md"}
  <+ <Coordination>: It coordinates.

<Coordination>

(1) Coordination is valuable. {note: "imputed"}
(2) Ritual coordinates.
-----
(3) Ritual is valuable.
`;

/* Every delimiter that could end an attachment early, and the format's own syntax quoted inside
 * the payload, which is the attack a line-prefixed container has to survive. */
const ESSAY = [
  "# The essay",
  "",
  "A paragraph with an HTML comment <!-- like this --> in it.",
  "",
  "```c",
  "/* a C block comment */",
  "```",
  "",
  "    an indented code block, four spaces",
  "        deeper still",
  "",
  "===",
  "front-matter-looking, but not",
  "===",
  "",
  "//>end",
  "//>file evil.md",
  "//| pretending to be an attachment",
  "",
  "A final line with {metadata: \"looking\"} braces.",
].join("\n");

const PROJECT = 'chapters:\n  - "source/essay.md"\n';

console.log("the parser cannot see the attachment");
{
  const g = (src) => {
    const res = argdown.run({ input: src, ...RUN });
    const gr = toGraph(res);
    return {
      nodes: gr.nodes.length, edges: gr.edges.length,
      labels: gr.nodes.map(n => n.label).sort(),
      comments: gr.nodes.map(n => n.comment || null),
      notes: gr.nodes.map(n => n.note || null)
    };
  };
  const bundled = B.attach(AD, [{ path: "source/essay.md", text: ESSAY },
                                { path: "argdown-project.yml", text: PROJECT }]);
  check("a bundle parses to exactly the graph the bare file does", g(bundled), g(AD));
  check("  and the bundle really is bigger than the file", bundled.length > AD.length, true);
  check("  it is recognised as one", B.isBundle(bundled), true);
  check("  a plain reconstruction is not", B.isBundle(AD), false);
}

console.log("the manuscript survives the trip");
{
  const bundled = B.attach(AD, [{ path: "source/essay.md", text: ESSAY },
                                { path: "argdown-project.yml", text: PROJECT }]);
  const out = B.detach(bundled);
  check("both files come back", out.files.map(f => f.path),
        ["source/essay.md", "argdown-project.yml"]);
  check("  the essay byte for byte, delimiters and all", out.files[0].text, ESSAY);
  check("  the project file too", out.files[1].text, PROJECT);
  check("  and it was not truncated", out.truncated, false);
  check("  the reconstruction comes back unchanged", out.argdown.trim(), AD.trim());
  check("  with a creation date recorded", typeof out.meta.created, "string");
}

console.log("attaching twice does not attach twice");
{
  const once  = B.attach(AD, [{ path: "source/essay.md", text: ESSAY }]);
  const twice = B.attach(once, [{ path: "source/essay.md", text: ESSAY }]);
  const count = (s) => (s.match(/^\/\/>argdown-bundle/gm) || []).length;
  check("one attachment, not two", count(twice), 1);
  check("  and the essay is still whole", B.detach(twice).files[0].text, ESSAY);
  // The dates differ, so compare everything else.
  check("  re-attaching is otherwise a no-op",
        twice.replace(/"created":"[^"]*"/, ""), once.replace(/"created":"[^"]*"/, ""));
}

console.log("stripping");
{
  const bundled = B.attach(AD, [{ path: "source/essay.md", text: ESSAY }]);
  check("strip gives back the reconstruction", B.strip(bundled).trim(), AD.trim());
  check("  and is harmless on a file that never had one", B.strip(AD).trim(), AD.trim());
  check("  detach on a plain file says so rather than guessing", B.detach(AD), null);
}

console.log("damage");
{
  // A MANGLED BUNDLE SHOULD COST THE LAST PARAGRAPH, NOT THE RECONSTRUCTION. These arrive by
  // email and get opened in editors that rewrite line endings and trim the final newline.
  const bundled = B.attach(AD, [{ path: "source/essay.md", text: ESSAY }]);
  const cut = bundled.split("\n").slice(0, -4).join("\n");
  const out = B.detach(cut);
  check("a truncated bundle still yields the reconstruction", out.argdown.trim(), AD.trim());
  check("  and says it was truncated", out.truncated, true);
  check("  and gives back the essay it did receive", out.files[0].text.startsWith("# The essay"), true);

  const crlf = B.detach(bundled.replace(/\n/g, "\r\n"));
  check("CRLF line endings survive", crlf.files[0].text, ESSAY);

  check("no files at all is still a readable bundle",
        B.detach(B.attach(AD, [])).files.length, 0);
  check("  and a file with no text is empty, not missing",
        B.detach(B.attach(AD, [{ path: "empty.md", text: "" }])).files[0], { path: "empty.md", text: "" });
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
