/* argdown-editor.src.mjs — the Argdown editor, bundled into the viewer on demand.
 *
 * WHY A SEPARATE ENTRY POINT. The viewer is a single self-contained HTML file that people open
 * by double-clicking, and CodeMirror is 333 KB of it. Keeping the editor behind its own bundle
 * and its own INLINE marker means `--standalone` stays what it was and `--standalone --editor`
 * carries the extra weight — one codebase, two builds, no fork.
 *
 * WHAT IS AND IS NOT IN HERE. The highlighting is a StreamLanguage: line-oriented, approximate,
 * and cosmetic. The VALIDATION is not — it comes from the real @argdown/core already bundled
 * into the page, handed in by the host as `opts.lint`. That split is deliberate: a second
 * grammar would be a second opinion that can drift from the parser everyone else uses, and this
 * project has paid for one-rule-in-two-languages more than once. What this file adds on top are
 * the traps that are NOT parse errors — the ones that leave a file that parses cleanly and means
 * something other than what was written.
 */
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
         drawSelection, rectangularSelection, Decoration, ViewPlugin } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo,
         undoDepth, redoDepth } from "@codemirror/commands";
import { search, searchKeymap, highlightSelectionMatches, openSearchPanel } from "@codemirror/search";
import { StreamLanguage, HighlightStyle, syntaxHighlighting, bracketMatching,
         foldService, foldGutter, codeFolding, foldEffect, unfoldAll, foldedRanges }
  from "@codemirror/language";
import { linter, lintGutter, setDiagnostics } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";

/* ---------------------------------------------------------------- the language */

/** Argdown is line-oriented, so a per-line tokenizer covers nearly all of it. State carries only
 *  the two things that span lines: the `===` front-matter fence and `{…}` metadata. */
const argdownMode = StreamLanguage.define({
  name: "argdown",
  startState: () => ({ front: false, meta: 0 }),
  token(stream, state) {
    if (stream.sol()) {
      if (stream.match(/^===\s*$/)) { state.front = !state.front; return "meta"; }
      if (state.front) { stream.skipToEnd(); return "meta"; }
      if (stream.match(/^\s*\/\//)) { stream.skipToEnd(); return "comment"; }
      if (stream.match(/^#{1,6}\s/)) { stream.skipToEnd(); return "heading"; }
      // An inference line. Three or more hyphens is the safe one; exactly two opens an
      // expanded inference and is the trap the linter warns about.
      if (stream.match(/^\s*-{3,}\s*$/)) return "operator";
      if (stream.match(/^\s*--\s*$/)) return "invalid";
      if (stream.match(/^\s*\(\d+\)/)) return "number";
      if (stream.match(/^\s*(?:<?[+\-_]>?)(?=\s)/)) return "keyword";
      if (stream.match(/^\s+/)) return null;
    }
    if (state.meta) {
      if (stream.eat("{")) { state.meta++; return "meta"; }
      if (stream.eat("}")) { state.meta--; return "meta"; }
      stream.next();
      return "meta";
    }
    if (stream.eat("{")) { state.meta = 1; return "meta"; }
    if (stream.match(/^@?\[[^\]\n]*\]/)) return "variableName";
    if (stream.match(/^@?<[^>\n]*>/)) return "typeName";
    if (stream.match(/^#[\w-]+/)) return "labelName";
    if (stream.match(/^"[^"\n]*"/)) return "string";
    if (stream.match(/^\*\*[^*\n]+\*\*/)) return "strong";
    if (stream.match(/^[^[<{#"*\n]+/)) return null;
    stream.next();
    return null;
  }
});

const argdownHighlight = HighlightStyle.define([
  { tag: t.heading,      color: "var(--accent, #3a7bd5)", fontWeight: "600" },
  { tag: t.comment,      color: "var(--fg-dim, #777)", fontStyle: "italic" },
  { tag: t.meta,         color: "var(--fg-dim, #777)" },
  { tag: t.variableName, color: "#1d6fa5" },
  { tag: t.typeName,     color: "#7c3aed" },
  { tag: t.labelName,    color: "#c2410c" },
  { tag: t.string,       color: "#0f766e" },
  { tag: t.number,       color: "#8a6d1f" },
  { tag: t.keyword,      color: "#15803d", fontWeight: "600" },
  { tag: t.operator,     color: "#15803d", fontWeight: "700" },
  { tag: t.strong,       fontWeight: "700" },
  { tag: t.invalid,      color: "#b91c1c", textDecoration: "underline wavy" }
]);

/* ---------------------------------------------------------------- the traps */

/** PURE: the mistakes that leave a file which PARSES and means something else.
 *
 *  These are worth more than syntax errors, because the parser will not say a word about any of
 *  them. Each one is recorded in the argdown skill because it has already cost this project
 *  real work. Kept to the three that can be spotted from the text with no false positives —
 *  a warning nobody trusts is worse than no warning.
 */
export function traps(text) {
  const out = [];
  const lines = String(text).split("\n");
  let at = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], start = at;
    at += line.length + 1;
    if (/^\s*\/\//.test(line)) continue;

    // A LONE `--` OPENS AN EXPANDED INFERENCE and swallows the next line as its rule name. A
    // four-statement structure written this way comes back with three, exit code 0, nothing said.
    if (/^\s*--\s*$/.test(line))
      out.push({ from: start, to: start + line.length, severity: "error",
        message: "A lone `--` opens an expanded inference and eats the next line as its rule " +
                 "name — the claim below this will vanish from the map with no error. Use " +
                 "`-----` for an ordinary inference step." });

    // SYMBOL SHORTCODES REWRITE TEXT, headings included: `# III.A. The Types` becomes `III∀ …`,
    // and every reference to that heading then fails to match.
    const sc = line.match(/\.(A|E|~|v|->|<->|P|O)\./);
    if (sc)
      out.push({ from: start + sc.index, to: start + sc.index + sc[0].length, severity: "warning",
        message: `\`${sc[0]}\` is a symbol shortcode and will be rewritten (${sc[0]} → a logic ` +
                 `symbol). In a heading that silently breaks every reference to it. Write it ` +
                 `without the trailing dot.` });

    // AN UNDERSCORE INSIDE A WORD opens an italic range. Unpaired, it aborts the parse; paired,
    // it silently italicises and mangles an identifier.
    const us = line.match(/(?<![\\\w])[A-Za-z0-9]+_[A-Za-z0-9]/);
    if (us && !/^\s*\{/.test(line))
      out.push({ from: start + us.index, to: start + us.index + us[0].length, severity: "warning",
        message: "An underscore inside a word opens an italic range. Escape it as `\\_` — " +
                 "unpaired it stops the file parsing, paired it quietly italicises." });
  }
  return out;
}

/* ------------------------------------------------- claim names as handles */

/** `[a-claim]` and `<An Argument>` are how Argdown names things, so they are the handles: click
 *  one and the host can light it on the map and show the passage it came from. The read-only
 *  pane had this; moving to CodeMirror lost it, because the markup a `<pre>` was carrying is not
 *  how an editor draws text.
 *
 *  Only names the host says it KNOWS become links. An unresolved `[…]` stays plain text — in
 *  Argdown a bracketed phrase in prose is ordinary punctuation, and a link that does nothing is
 *  worse than none.
 */
const REF = /\[([^\[\]\n]+)\]|<([^<>\n]+)>/g;
const refMark = Decoration.mark({ class: "cm-ad-ref" });

function claimRefs(knows) {
  const build = view => {
    const out = [];
    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      REF.lastIndex = 0;
      let m;
      while ((m = REF.exec(text))) {
        const name = m[1] != null ? m[1] : m[2];
        if (!knows || !knows(name)) continue;
        out.push(refMark.range(from + m.index, from + m.index + m[0].length));
      }
    }
    // Decoration sets must be handed over in document order.
    out.sort((a, b) => a.from - b.from);
    return Decoration.set(out);
  };
  return ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = build(view); }
    update(u) { if (u.docChanged || u.viewportChanged) this.decorations = build(u.view); }
  }, { decorations: v => v.decorations });
}

/* ------------------------------------------------- folding */

/** Where a `{…}` metadata block runs, given the line it starts on. Returns null if there is none.
 *
 *  Provenance is the bulk of a finished reconstruction — `chapter`, `section`, `source`,
 *  `fidelity`, `reviewed` on every claim, often longer than the claim — and none of it is the
 *  argument. Folding it is how you get the structure back on one screen.
 */
function metaRange(state, line) {
  const text = line.text;
  const open = text.indexOf("{");
  if (open < 0) return null;
  let depth = 0, at = line.from + open;
  for (let n = line.number; n <= state.doc.lines; n++) {
    const l = state.doc.line(n);
    const from = n === line.number ? open : 0;
    for (let i = from; i < l.text.length; i++) {
      const ch = l.text[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return { from: at + 1, to: l.from + i };
      }
    }
  }
  return null;
}

/** The Argdown fold rule. Two things are worth folding and neither has a syntax tree to hang
 *  off, because the highlighting is a StreamLanguage: metadata blocks, and headings down to the
 *  next heading of the same or higher level. */
const argdownFolds = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart);

  // A HEADING IS ASKED FIRST. Argdown puts `{isGroup: true}` on the heading line itself, so the
  // metadata rule below matched it and folded away four words instead of the section — which is
  // exactly what folding a heading is for.
  const h = /^(#{1,6})\s/.exec(line.text);
  if (h) {
    for (let n = line.number + 1; n <= state.doc.lines; n++) {
      const l = state.doc.line(n);
      const m = /^(#{1,6})\s/.exec(l.text);
      if (m && m[1].length <= h[1].length)
        return n - 1 > line.number ? { from: line.to, to: state.doc.line(n - 1).to } : null;
    }
    return state.doc.lines > line.number
      ? { from: line.to, to: state.doc.line(state.doc.lines).to } : null;
  }

  // A claim whose metadata sits on the following line folds the two together, so the claim
  // stays and its provenance goes. Folding only the braces would leave a stub line behind.
  if (line.number < state.doc.lines && !/^\s*\{/.test(line.text) && line.text.trim()) {
    const next = state.doc.line(line.number + 1);
    if (/^\s*\{/.test(next.text)) {
      const r = metaRange(state, next);
      if (r) return { from: line.to, to: r.to + 1 };
    }
  }
  const own = metaRange(state, line);
  if (own && own.to > own.from) return own;

  return null;
});

/** Every metadata block in the document, for the fold-the-lot command. */
function allMetaRanges(state) {
  const out = [];
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    if (!/^\s*\{/.test(line.text)) continue;
    const r = metaRange(state, line);
    if (!r || r.to <= r.from) continue;
    // Fold it onto the claim above where there is one, so the provenance disappears rather
    // than leaving a row of empty braces down the margin.
    const prev = n > 1 ? state.doc.line(n - 1) : null;
    out.push(prev && prev.text.trim() && !/^\s*\{/.test(prev.text)
      ? { from: prev.to, to: r.to + 1 } : r);
    const end = state.doc.lineAt(r.to);
    n = end.number;
  }
  return out;
}

/* ---------------------------------------------------------------- the editor */

export function create(parent, opts) {
  const o = opts || {};
  const numbers = new Compartment();
  // The history lives in a compartment SO IT CAN BE THROWN AWAY. Reconfiguring the compartment
  // rebuilds the field from nothing, which is the documented way to give CodeMirror a fresh
  // past. See `loadText`.
  const past = new Compartment();
  const lintSource = view => {
    const text = view.state.doc.toString();
    const found = traps(text).concat(o.lint ? (o.lint(text) || []) : []);
    const len = view.state.doc.length;
    return found.map(d => ({
      from: Math.max(0, Math.min(d.from, len)),
      to: Math.max(0, Math.min(d.to == null ? d.from + 1 : d.to, len)),
      severity: d.severity || "error",
      message: d.message
    })).filter(d => d.to >= d.from);
  };
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: o.doc || "",
      extensions: [
        numbers.of(o.lineNumbers === false ? [] : [lineNumbers(), highlightActiveLineGutter()]),
        past.of(history()), drawSelection(), rectangularSelection(), bracketMatching(),
        highlightActiveLine(), highlightSelectionMatches(),
        search({ top: true }),
        argdownMode, syntaxHighlighting(argdownHighlight),
        codeFolding({ placeholderText: "…" }), argdownFolds, foldGutter(),
        claimRefs(o.knowsClaim),
        // A plain click follows the link; the editor keeps the click too, so the caret still
        // lands where you pressed and you can carry on typing there.
        EditorView.domEventHandlers({
          mousedown(e, view) {
            const t = /** @type {any} */ (e.target);
            const el = t && t.closest && t.closest(".cm-ad-ref");
            if (!el || !o.onClaimClick) return false;
            const name = el.textContent.replace(/^[[<]|[\]>]$/g, "");
            o.onClaimClick(name);
            return false;
          }
        }),
        EditorView.theme({
          ".cm-ad-ref": { textDecoration: "underline dotted", textUnderlineOffset: "2px",
                          cursor: "pointer" },
          ".cm-ad-ref:hover": { background: "var(--accent, #3a7bd5)", color: "#fff",
                                textDecoration: "none" }
        }),
        lintGutter(),
        // Slow on purpose: re-linting runs the real parser, and doing that on every keystroke
        // would fight the live preview for the same idle time.
        linter(/** @type {any} */ (lintSource), { delay: 400 }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        EditorView.lineWrapping,
        EditorView.updateListener.of(u => { if (u.docChanged && o.onChange) o.onChange(view.state.doc.toString()); })
      ]
    })
  });
  return {
    view,
    getText: () => view.state.doc.toString(),
    /** Replace the document with `next`, dispatching only what actually differs.
     *
     *  WHY NOT JUST REPLACE THE WHOLE THING. This is how a comment written on the MAP reaches the
     *  file, and a whole-document replacement makes that one edit look, to every part of
     *  CodeMirror, like the reader having deleted the file and typed a new one. Undo then throws
     *  away far more than the comment; the cursor jumps to the top; every folded metadata block
     *  unfolds. Sending the changed span instead means the comment is an ordinary small edit —
     *  which is what it is — and one press of undo takes it back off.
     *
     *  Prefix and suffix are compared by code unit, which is exact for this purpose: a boundary
     *  landing inside a surrogate pair still describes a correct replacement, only a slightly
     *  larger one than strictly necessary.
     */
    setText(next) {
      const cur = view.state.doc.toString();
      if (next === cur) return;
      const max = Math.min(cur.length, next.length);
      let a = 0;
      while (a < max && cur.charCodeAt(a) === next.charCodeAt(a)) a++;
      let b = 0;
      while (b < max - a &&
             cur.charCodeAt(cur.length - 1 - b) === next.charCodeAt(next.length - 1 - b)) b++;
      view.dispatch({
        changes: { from: a, to: cur.length - b, insert: next.slice(a, next.length - b) },
        // The edit came from elsewhere in the program, so the reader's selection should stay
        // where they left it rather than following the change.
        scrollIntoView: false
      });
    },
    /** A DIFFERENT FILE, not an edit of this one — replace the document and forget the past.
     *
     *  `setText` is right for every edit that comes from elsewhere in the program, because those
     *  ARE edits of the open file and should be undoable. Opening another reconstruction is not,
     *  and routing it through `setText` left the old file's history in place: holding Ctrl-Z
     *  after opening a second map walked back through the swap and rebuilt the FIRST map's text
     *  inside the second one's editor, one keystroke at a time. The file on disk was untouched,
     *  which made it look like a display fault rather than an edit — and one more press of Save
     *  would have written it.
     *
     *  Reconfiguring the compartment is what drops the history; the document is replaced whole,
     *  because there is no relationship between the two texts worth preserving a diff over.
     */
    loadText(next) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: next },
        selection: { anchor: 0 },
        scrollIntoView: true
      });
      view.dispatch({ effects: past.reconfigure([]) });
      view.dispatch({ effects: past.reconfigure(history()) });
    },
    /** How much there is to undo, so a caller can offer the control only when it does something.
     *  A button that is always there and usually inert teaches nothing about what it undoes. */
    undoDepth: () => undoDepth(view.state),
    redoDepth: () => redoDepth(view.state),
    /** Undo and redo, callable from outside the editor.
     *
     *  `historyKeymap` only fires when the editor has FOCUS, and the edits most in need of undo —
     *  a comment written or deleted on the map — happen when it does not. The history was being
     *  recorded correctly the whole time; there was simply no way to reach it from where the
     *  reader was standing. */
    undo: () => undo(view),
    redo: () => redo(view),
    hasFocus: () => view.hasFocus,
    setLineNumbers(on) {
      view.dispatch({ effects: numbers.reconfigure(on ? [lineNumbers(), highlightActiveLineGutter()] : []) });
    },
    openSearch: () => openSearchPanel(view),
    /** Fold every metadata block at once — the command the whole feature exists for. Returns
     *  how many it folded, so a caller can say so instead of appearing to do nothing. */
    foldProvenance() {
      const ranges = allMetaRanges(view.state);
      if (ranges.length) view.dispatch({ effects: ranges.map(r => foldEffect.of(r)) });
      return ranges.length;
    },
    unfoldAll: () => unfoldAll(view),
    foldedCount() {
      let n = 0;
      const set = foldedRanges(view.state);
      set.between(0, view.state.doc.length, () => { n++; });
      return n;
    },
    /** Put a line in the middle of the pane and the cursor on it — used when something outside
     *  the editor points at a claim. */
    goToLine(n) {
      const line = view.state.doc.line(Math.max(1, Math.min(n, view.state.doc.lines)));
      view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true,
                      effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
      // `preventScroll`: focusing the editor otherwise scrolls every ancestor to bring it into
      // view, the document included, which pushes the app's toolbar off the top of the window.
      view.contentDOM.focus({ preventScroll: true });
    },
    setDiagnostics: ds => view.dispatch(setDiagnostics(view.state, ds || [])),
    /** Put a claim's own line in view without stealing the keyboard — used when the map points
     *  at it, where the reader is working in the map and not in the text. */
    revealLine(n) {
      const line = view.state.doc.line(Math.max(1, Math.min(n, view.state.doc.lines)));
      view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy()
  };
}

if (typeof window !== "undefined")
  /** @type {any} */ (window).ArgdownEditor = { create, traps };
