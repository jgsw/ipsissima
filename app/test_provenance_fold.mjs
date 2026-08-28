/** "Fold the provenance" must work on every reconstruction in the corpus.
 *
 *  WHAT WENT WRONG. `allMetaRanges` required a metadata block to START its line — `/^\s*\{/` —
 *  and a reconstruction is just as likely to trail it after the claim on the same line. Four of
 *  the seven published samples are written that way, so the button reported **no provenance to
 *  fold** on the Wilson map, which has 170 blocks in it. Reported from use.
 *
 *  WHY A TEST AND NOT A FIXTURE. The two layouts are a house-style choice that varies between
 *  runs of the extraction prompt, not something the reader controls, so the next rebuild can move
 *  a sample from one form to the other. A fixture in one style would have gone on passing while
 *  the corpus drifted into the other. **The corpus itself is the test**: every published map,
 *  whatever style it is written in, must have provenance it can fold.
 *
 *  THE SHIPPED SOURCE IS WHAT RUNS. The two functions are lifted out of `argdown-editor.src.mjs`
 *  rather than copied here, because a copy is a second implementation and this bug is exactly
 *  what a second implementation hides. They need only a few methods of CodeMirror's `Text`, so
 *  the stub below provides those and nothing else.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = path.resolve(HERE, "..", "samples");
const src = fs.readFileSync(path.join(HERE, "argdown-editor.src.mjs"), "utf8");

/** Pull one top-level `function name(...) {...}` out of the module.
 *
 *  BY INDENTATION, NOT BY COUNTING BRACES. Both of these functions are about braces and contain
 *  them in string and regex literals — `indexOf("{")`, `/^\s*\{/` — so a counting scanner has to
 *  understand JavaScript's lexical grammar to get past them, and the first draft of this test
 *  did not. A top-level function in this file ends at a `}` in column zero, which is a fact about
 *  the file rather than about the language, and is checked below.
 */
function lift(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} is not in argdown-editor.src.mjs`);
  const end = src.indexOf("\n}\n", start);
  if (end < 0) throw new Error(`${name} does not end at a brace in column zero`);
  return src.slice(start, end + 3);
}

const FNS = new Function(`${lift("metaRange")}\n${lift("allMetaRanges")}\nreturn { metaRange, allMetaRanges };`)();

/** The slice of CodeMirror's `EditorState` these two functions actually use. */
function stateOf(text) {
  const lines = text.split("\n");
  const from = [];
  let at = 0;
  for (const l of lines) { from.push(at); at += l.length + 1; }
  const line = n => ({ number: n, text: lines[n - 1], from: from[n - 1],
                       to: from[n - 1] + lines[n - 1].length });
  return {
    doc: {
      lines: lines.length,
      length: text.length,
      line,
      lineAt(pos) {
        for (let n = lines.length; n >= 1; n--) if (from[n - 1] <= pos) return line(n);
        return line(1);
      }
    }
  };
}

const ranges = text => FNS.allMetaRanges(stateOf(text));

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

console.log("both places a reconstruction writes its metadata");
check("on its own line, under the claim",
      ranges('[A]: a claim.\n    {fidelity: "quotation"}\n').length, 1);
check("trailing the claim on the same line — the case that was missed",
      ranges('[A]: a claim. {fidelity: "quotation"}\n').length, 1);
check("  and a file written entirely that way folds every one",
      ranges('[A]: one. {fidelity: "quotation"}\n[B]: two. {fidelity: "paraphrase"}\n').length, 2);
check("a block spanning several lines is one range",
      ranges('[A]: a claim. {fidelity: "quotation",\n  note: "spread over\n  three lines"}\n').length, 1);

console.log("\nand a brace that is not metadata is left alone");
// A METADATA BLOCK OPENS WITH A KEY. Once the block need not begin the line, a bare `{` is not
// enough to go on: philosophy prose contains braces, and folding a claim's own words away would
// be a far worse failure than not folding its provenance.
check("a set in the claim's prose is not provenance",
      ranges("[A]: the set {a, b} is defined thus.\n").length, 0);
check("  but real metadata beside it still folds",
      ranges('[A]: the set {a, b} is thus. {fidelity: "quotation"}\n').length, 1);

console.log("\nevery published reconstruction has provenance it can fold");
// THE INVARIANT THE BUG BROKE. Not a count -- counts move whenever a map is rebuilt -- but the
// thing the reader is promised: press the button on any map in this repository and something
// happens.
let checked = 0;
for (const dir of fs.readdirSync(SAMPLES, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const root = path.join(SAMPLES, dir.name);
  const file = fs.readdirSync(root).find(f => f.endsWith(".argdown"));
  if (!file) continue;
  const n = ranges(fs.readFileSync(path.join(root, file), "utf8")).length;
  checked++;
  check(`  ${file.replace(/\.argdown$/, "").slice(0, 40)} — ${n} to fold`, n > 0, true);
}
check("and there were samples to check", checked > 0, true);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
