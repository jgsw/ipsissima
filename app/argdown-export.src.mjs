/* argdown-export.src.mjs — the annotated manuscript, as a Word file or as Markdown.
 *
 * WHAT THIS IS FOR. A tutor reads a student's essay, reconstructs its argument here, and writes
 * comments against the argumentative moves. The comments are the point, and they are no use
 * living in an .argdown file the student cannot open. This puts them back on the essay, as REAL
 * WORD COMMENTS anchored to the passage each one is about — the thing the student already knows
 * how to read, in the margin where they expect to find it.
 *
 * WHY THE `docx` PACKAGE RATHER THAN PANDOC. Pandoc's WASM build is 55.9 MB, which is not a
 * dependency a single-file HTML page can carry; and pandoc cannot emit Word comments anyway, so
 * it would have meant unzipping its output and writing comments.xml by hand. `docx` is 350 KB
 * bundled (101 KB over the wire) and has the comment API natively.
 *
 * ANCHORING. Every mark carries the manuscript LINE its claim was located at. That line is not
 * stored anywhere — it is recomputed from the live text on every build — so a comment cannot
 * come to point at the wrong paragraph the way a saved offset would.
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel,
         CommentRangeStart, CommentRangeEnd, CommentReference } from "docx";

/** Split a manuscript into blocks, each remembering the line it started on. */
export function blocks(text) {
  const lines = String(text == null ? "" : text).split("\n");
  const out = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) { cur = null; continue; }
    if (!cur) { cur = { line: i + 1, lines: [] }; out.push(cur); }
    cur.lines.push(raw);
  }
  return out.map(b => {
    const joined = b.lines.join(" ").replace(/\s+/g, " ").trim();
    const h = /^(#{1,6})\s+(.*)$/.exec(b.lines[0]);
    return h
      ? { line: b.line, level: h[1].length, text: h[2].trim(), end: b.line + b.lines.length - 1 }
      : { line: b.line, level: 0, text: joined, end: b.line + b.lines.length - 1 };
  }).filter(b => b.text);
}

/** Inline Markdown, reduced to the runs Word needs. Deliberately shallow: emphasis, strong and
 *  code are what academic prose actually uses, and anything cleverer risks mangling the text. */
export function runs(s) {
  const out = [];
  const rx = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`/g;
  let at = 0, m;
  while ((m = rx.exec(s))) {
    if (m.index > at) out.push(new TextRun(s.slice(at, m.index)));
    if (m[2] != null) out.push(new TextRun({ text: m[2], bold: true }));
    else if (m[4] != null) out.push(new TextRun({ text: m[4], italics: true }));
    else out.push(new TextRun({ text: m[5], font: "Consolas" }));
    at = rx.lastIndex;
  }
  if (at < s.length) out.push(new TextRun(s.slice(at)));
  return out.length ? out : [new TextRun("")];
}

const HEADINGS = [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
                  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

/** The annotated manuscript as a .docx Blob.
 *
 *  marks: [{ line, label, kind, text, author }] — one per comment or note, `line` being the
 *  manuscript line its claim was located at.
 */
export async function annotatedDocx(opts) {
  const { title, author, text } = opts;
  const marks = (opts.marks || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));
  const bs = blocks(text);

  // Word wants every comment declared once, by id, and then referenced from the body.
  const comments = marks.map((m, i) => ({
    id: i,
    author: m.author || "Reconstruction",
    date: new Date(),
    children: [new Paragraph({
      children: [
        new TextRun({ text: (m.kind === "note" ? "Note" : "Comment") + " on “" +
                            (m.label || "") + "”", bold: true }),
        new TextRun({ text: "", break: 1 }),
        ...runs(String(m.text || ""))
      ]
    })]
  }));

  const body = [];
  if (title) body.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
  if (author) body.push(new Paragraph({ children: [new TextRun({ text: author, italics: true })] }));

  let next = 0;
  for (const b of bs) {
    // Every mark that falls inside this block, or before the next one starts, belongs here.
    const mine = [];
    while (next < marks.length && (marks[next].line || 0) <= b.end) mine.push(next++);
    const children = [];
    for (const i of mine) children.push(new CommentRangeStart(i));
    children.push(...runs(b.text));
    for (const i of mine) {
      children.push(new CommentRangeEnd(i));
      children.push(new TextRun({ children: [new CommentReference(i)] }));
    }
    body.push(new Paragraph(
      b.level ? { children, heading: HEADINGS[b.level] } : { children }));
  }
  // Marks past the end of the text still have to go somewhere, or a comment would vanish.
  if (next < marks.length) {
    const children = [];
    for (let i = next; i < marks.length; i++) children.push(new CommentRangeStart(i));
    children.push(new TextRun({ text: "(comments on material not found in this file)",
                                italics: true }));
    for (let i = next; i < marks.length; i++) {
      children.push(new CommentRangeEnd(i));
      children.push(new TextRun({ children: [new CommentReference(i)] }));
    }
    body.push(new Paragraph({ children }));
  }

  const doc = new Document({ comments: { children: comments }, sections: [{ children: body }] });
  return Packer.toBlob(doc);
}

/** The same thing as Markdown, for anyone who would rather not open Word.
 *  Comments become blockquoted asides directly under the passage they are about. */
export function annotatedMarkdown(opts) {
  const { title, author, text } = opts;
  const marks = (opts.marks || []).slice().sort((a, b) => (a.line || 0) - (b.line || 0));
  const bs = blocks(text);
  const out = [];
  if (title) out.push("# " + title, "");
  if (author) out.push("*" + author + "*", "");
  let next = 0;
  for (const b of bs) {
    out.push(b.level ? "#".repeat(b.level) + " " + b.text : b.text, "");
    while (next < marks.length && (marks[next].line || 0) <= b.end) {
      const m = marks[next++];
      out.push("> **" + (m.kind === "note" ? "Note" : "Comment") + " on “" + (m.label || "") +
               "”** — " + String(m.text || "").replace(/\n+/g, " "), "");
    }
  }
  for (let i = next; i < marks.length; i++) {
    const m = marks[i];
    out.push("> **" + (m.kind === "note" ? "Note" : "Comment") + " on “" + (m.label || "") +
             "”** — " + String(m.text || "").replace(/\n+/g, " "), "");
  }
  return out.join("\n");
}

/* The bundle's entry point. Attached to `window` rather than exported, because the page loads
   this as a plain script alongside the others and has no module loader of its own. */
if (typeof window !== "undefined") {
  window.__EXPORT__ = { annotatedDocx, annotatedMarkdown, blocks, runs };
}
