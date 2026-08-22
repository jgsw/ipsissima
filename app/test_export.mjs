/* test_export.mjs — the annotated manuscript, out to Word and to Markdown.
 *
 * The thing worth testing is the ANCHORING. A comment that lands on the wrong paragraph is worse
 * than one that does not appear at all, because it reads as the tutor's mistake rather than the
 * tool's, and there is nothing in the exported file to show it moved. */
import { blocks, runs, annotatedDocx, annotatedMarkdown } from "./argdown-export.src.mjs";

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

const TEXT = [
  "# I. Introduction",              // 1
  "",                               // 2
  "The opening paragraph, which",   // 3
  "runs over two lines.",           // 4
  "",                               // 5
  "## The reductio",                // 6
  "",                               // 7
  "The second paragraph.",          // 8
  "",                               // 9
  "The third and last.",            // 10
].join("\n");

console.log("blocks");
const bs = blocks(TEXT);
check("one block per paragraph, headings included", bs.length, 5);
check("  each knows the line it starts on", bs.map(b => b.line), [1, 3, 6, 8, 10]);
check("  and the line it ends on, so a mark can be placed inside it",
      bs.map(b => b.end), [1, 4, 6, 8, 10]);
check("  headings carry their level", bs.map(b => b.level), [1, 0, 2, 0, 0]);
check("  a wrapped paragraph is joined into one",
      bs[1].text, "The opening paragraph, which runs over two lines.");
check("blank input gives no blocks", blocks("").length, 0);
check("  and so does whitespace", blocks("\n\n   \n").length, 0);

console.log("runs (inline markdown)");
check("plain text is one run", runs("hello").map(r => r.constructor.name).length, 1);
check("bold, italic and code are split out",
      runs("a **b** c *d* e `f`").length, 6);
check("  text with no markup is left whole", runs("no markup here").length, 1);
check("  and empty text still yields a run, or Word writes nothing",
      runs("").length, 1);

console.log("annotatedMarkdown (anchoring)");
const marks = [
  { line: 3, label: "the question", kind: "comment", text: "Why paralysis?", author: "Comment" },
  { line: 8, label: "the reductio", kind: "note",    text: "Reconstructed as a reductio.",
    author: "Reconstructor's note" },
];
const md = annotatedMarkdown({ title: "T", author: "A", text: TEXT, marks });
const lines = md.split("\n").filter(l => l.trim());
const idxOf = (frag) => lines.findIndex(l => l.includes(frag));
check("the comment follows the paragraph it is about",
      idxOf("Why paralysis?") === idxOf("The opening paragraph") + 1, true);
check("  and the note follows its own",
      idxOf("Reconstructed as a reductio") === idxOf("The second paragraph") + 1, true);
check("  a comment does not attach to the paragraph before it",
      idxOf("Why paralysis?") > idxOf("I. Introduction"), true);
check("comments and notes are labelled apart",
      [lines[idxOf("Why paralysis?")].includes("**Comment on"),
       lines[idxOf("Reconstructed as a reductio")].includes("**Note on")], [true, true]);
check("headings keep their level", md.includes("## The reductio"), true);

// A mark past the end of the text must not vanish silently.
const over = annotatedMarkdown({ text: TEXT, marks: [{ line: 9999, label: "x", kind: "comment", text: "stranded" }] });
check("a mark past the end of the file is still written", over.includes("stranded"), true);

console.log("annotatedDocx");
const blob = await annotatedDocx({ title: "T", author: "A", text: TEXT, marks });
const buf = Buffer.from(await blob.arrayBuffer());
check("the result is a zip, which is what a .docx is",
      [buf[0], buf[1]], [0x50, 0x4b]);
check("  and it is not empty", buf.length > 4000, true);

// Unzip enough to see that the comments are real Word comments, anchored.
const { execFileSync } = await import("node:child_process");
const os = await import("node:os");
const fsm = await import("node:fs");
const pathm = await import("node:path");
const dir = fsm.mkdtempSync(pathm.join(os.tmpdir(), "docx-"));
fsm.writeFileSync(pathm.join(dir, "a.docx"), buf);
execFileSync("unzip", ["-o", "-q", pathm.join(dir, "a.docx"), "-d", dir]);
const doc = fsm.readFileSync(pathm.join(dir, "word", "document.xml"), "utf8");
const com = fsm.readFileSync(pathm.join(dir, "word", "comments.xml"), "utf8");
const count = (s, rx) => (s.match(rx) || []).length;
check("every mark becomes a Word comment", count(com, /<w:comment /g), 2);
check("  each anchored with a start", count(doc, /<w:commentRangeStart/g), 2);
check("  a matching end", count(doc, /<w:commentRangeEnd/g), 2);
check("  and a reference, or Word shows no marker in the margin",
      count(doc, /<w:commentReference/g), 2);
check("headings become Word heading styles", count(doc, /w:val="Heading/g) >= 2, true);
check("the comment text travels", com.includes("Why paralysis?"), true);
check("  and says which claim it is about", com.includes("the question"), true);
// WORD PUTS THE AUTHOR IN THE MARGIN beside the comment, so it has to say whose voice this is.
// A reconstructor's note is not somebody remarking on the work — it is the reading speaking about
// itself — and labelling it as a comment would misattribute every one of them to the tutor.
// The apostrophe arrives XML-escaped, which is correct and is what Word reads back.
check("the author names the kind of mark",
      /w:author="Reconstructor(&apos;|')s note"/.test(com), true);
check("  and a comment is not labelled as a note",
      count(com, /w:author="Comment"/g), 1);
fsm.rmSync(dir, { recursive: true, force: true });

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
