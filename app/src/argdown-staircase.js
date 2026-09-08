/* argdown-staircase.js — the "explode" panel's engine: one argument's PCS drawn as a
 * staircase of steps (full sentences) or a compact two-column flowchart (short names), plus
 * the SVG/PNG serialisers that copy what is actually on screen.
 *
 * EXTRACTED from argdown-viewer.template.html (8 Sep 2026) so the App's viewer and the
 * Pandoc export filter draw the same panel from the same code — the move argdown-live-map.js
 * and argdown-graph.mjs made before it. The comments inside are the original ones; the only
 * changes are the seams:
 *
 *   - what was read from viewer globals is now passed in: `opts.onMap(title)` says whether a
 *     claim is drawn on the map (so its line is clickable), `opts.onGo(title)` performs the
 *     travel, and the save/error paths of the PNG export are callbacks;
 *   - explSizeCard, which wrote the dialog card's width, is now cardWidth(steps) returning
 *     the number — the host owns its dialog;
 *   - buildSVG takes the body element (and the element whose background the picture copies)
 *     instead of finding the viewer's #explbody itself;
 *   - the panel CSS that was id-scoped to #explbody ships here, scoped to the .xbody class
 *     that draw() puts on the body, with fallbacks on the host theme variables.
 *
 * A HOST DRAWS A PANEL WITH ONE CALL:
 *
 *   var steps = ArgdownStaircase.draw(node.pcs, bodyEl, {
 *     mode: "stair" | "compact",
 *     onMap: function(title){ return true; },   // optional: makes claim lines clickable
 *     onGo:  function(title){ ... }             // optional: what the click does
 *   });
 *
 * draw() runs the layout TWICE when the first pass's column was narrowed under it by an
 * appearing scrollbar — the lesson recorded in the explDraw comment below, learned on the
 * Cribb map, kept here so both hosts have it. */
(function (global) {
"use strict";

var styled = false;
function injectStyle(){
  if (styled || document.getElementById("alm-stair-style")) { styled = true; return; }
  styled = true;
  var s = document.createElement("style");
  s.id = "alm-stair-style";
  s.textContent = "\n" +
".xbody .xstep{border:1px solid var(--line,#c9ced8);border-radius:9px;padding:.5rem .65rem;margin:0 0 .1rem}\n" +
".xbody .xstep h4{margin:0 0 .35rem;font-size:.85em;font-weight:600;opacity:.72;text-transform:uppercase;letter-spacing:.04em}\n" +
".xbody .xline{display:flex;gap:.5rem;align-items:baseline;padding:.18rem .3rem;border-radius:5px}\n" +
".xbody .xline .num{opacity:.55;font-variant-numeric:tabular-nums;flex:none}\n" +
".xbody .xclaim{cursor:pointer}\n" +
".xbody .xclaim:hover{background:rgba(58,123,213,.11)}\n" +
".xbody .xrule{font-style:italic;opacity:.8;font-size:.85em;margin-top:.3rem}\n" +
".xbody .xarrow{text-align:center;color:#3a9d5d;font-size:1.05em;margin:.15rem 0}\n" +
".xbody .xconcl{border:1px solid #8fbf9f;background:rgba(143,191,159,.12);border-radius:9px;padding:.5rem .65rem;margin:0 0 .1rem}\n" +
".xbody .xbad{color:#cc3b3b} .xbody .xgood{color:#3a9d5d}\n" +
"/* A line CARRIED DOWN from the step above is not a new premise -- subdued, with a\n" +
"   turn-and-enter arrow, so the step still reads on its own. */\n" +
".xbody .xline.xcarry{opacity:.62}\n" +
".xbody .xline.xcarry .num::before{content:\"\\21b1\";margin-right:.28rem;opacity:.8}\n" +
".xbody .xcarry .xfrom{font-size:.78em;opacity:.75;font-style:italic;white-space:nowrap;margin-left:.35rem}\n" +
"/* ---- the staircase: the same steps travelling down and to the right ---- */\n" +
".xbody.stair{position:relative}\n" +
".xbody.stair .xwrap{position:relative}\n" +
".xbody.stair .xstep,.xbody.stair .xconcl{position:absolute;box-sizing:border-box;margin:0}\n" +
".xbody.stair .xedges{position:absolute;inset:0;overflow:visible;pointer-events:none}\n" +
".xbody.stair .xedges path{stroke:#3a9d5d;stroke-width:1.6;fill:none}\n" +
"/* What a one-input step becomes: a few words on the arrow instead of a box. */\n" +
".xbody.stair .xedges text{fill:var(--fg-dim,#667);font-size:11px;font-style:italic}\n" +
"/* In the compact view a box holds short names, so it should not stretch its lines. */\n" +
".xbody.compact .xline{padding:.1rem .3rem}\n" +
".xbody.compact .xstep,.xbody.compact .xconcl{padding:.4rem .55rem}\n" +
".xbody.compact .xstep h4{margin-bottom:.25rem}\n" +
".xbody.compact .xrule{margin-top:.25rem;font-size:.8em}\n";
  document.head.appendChild(s);
}

function explSteps(rows){
  var out = [], run = [], concluded = {}, prev = null, step = 0;
  rows.forEach(function(r){
    if (r.role === "premise") { run.push(r); return; }
    step++;
    var inputs = r.uses ? r.uses.map(Number) : null;
    var pool = run.concat(prev ? [prev] : []);
    var chosen = inputs ? pool.filter(function(x){ return inputs.indexOf(x.n) >= 0; }) : pool;
    // A declared `uses` may name a line from further back than this step's own run.
    if (inputs) rows.forEach(function(x){
      if (inputs.indexOf(x.n) >= 0 && chosen.indexOf(x) < 0 && x !== r) chosen.push(x); });
    chosen.sort(function(a, b){ return a.n - b.n; });
    out.push({ rule: r.rule, verdict: r.verdict, concl: r, n: step,
               inputs: chosen.map(function(x){
                 return { row: x, from: concluded[x.n] || 0 }; }) });
    concluded[r.n] = step;
    run = []; prev = r;
  });
  return out;
}

/* A claim's SHORT NAME. The compact layout is compact because it draws these rather than the
 * sentences they name.
 *
 * `Untitled 1` IS NOT A NAME. It is what the Argdown parser calls a statement written without
 * one -- `(5) A domain that is normatively loaded...` in the Cribb map's Master Argument -- and
 * drawing it tells the reader nothing whatever, while looking exactly like a name somebody
 * chose. Reported from that map, where the compact view read "Untitled 1" and "Untitled 2".
 *
 * So an untitled line shows its SENTENCE, and shows all of it: the box wraps. Cutting it to the
 * length a name would have been was the first version and it is the wrong trade -- a name can be
 * short because it is a name, whereas half a sentence with an ellipsis is just half a sentence.
 * A row like this is taller than its neighbours, and that is the honest shape of a map whose
 * author did not name that claim. */
function explTitleOf(r){
  if (r.title && !/^Untitled \d+$/.test(r.title)) return r.title;
  return r.text || r.title || "";
}

/* One premise or conclusion. Clickable when the claim exists on the map in its own right --
 * an intermediate that lives only inside this argument has nowhere to travel to. */
function explLine(r, into, carriedFrom, titlesOnly, opts){
  var on = r.title && opts && opts.onMap && opts.onMap(r.title);
  var d = document.createElement("div");
  d.className = "xline" + (on ? " xclaim" : "") + (carriedFrom ? " xcarry" : "");
  var num = document.createElement("span");
  num.className = "num"; num.textContent = "(" + r.n + ")";
  var txt = document.createElement("span");
  txt.textContent = titlesOnly ? explTitleOf(r) : (r.text || r.title || "");
  d.appendChild(num); d.appendChild(txt);
  if (carriedFrom && !titlesOnly) {
    var f = document.createElement("i");
    f.className = "xfrom";
    f.textContent = "from step " + carriedFrom;
    txt.appendChild(f);
  }
  if (on && opts && opts.onGo) {
    d.title = "Show this claim on the map";
    d.onclick = function(){ opts.onGo(r.title); };
  }
  into.appendChild(d);
  return d;
}

/* `lone` when this step is the whole argument. "STEP 1" then promises a step 2 that does not
 * exist, and the box is not one stage of anything -- it is the argument. */
function explStepBox(st, titlesOnly, lone, opts){
  var box = document.createElement("div");
  box.className = "xstep";
  var h = document.createElement("h4");
  h.textContent = (lone ? "The argument" : "Step " + st.n) +
                  (st.rule ? " · " + st.rule : "");
  box.appendChild(h);
  st.inputs.forEach(function(i){ explLine(i.row, box, i.from, titlesOnly, opts); });
  if (st.verdict && st.verdict.state) {
    var v = document.createElement("div");
    v.className = "xrule " + (st.verdict.state === "invalid" ? "xbad" :
                              st.verdict.state === "valid" ? "xgood" :
                              st.verdict.state === "stale" ? "xbad" : "");
    v.textContent = st.verdict.state === "valid" ? "checked: the conclusion follows"
                  : st.verdict.state === "invalid" ? "checked: the conclusion does NOT follow"
                  : st.verdict.state === "stale"
                      ? "NOT checked: a claim here was edited after it was formalized"
                  : "a rule is named, but nothing checks it";
    box.appendChild(v);
  }
  return box;
}

function explConclBox(st, titlesOnly, opts){
  var c = document.createElement("div");
  c.className = "xconcl";
  explLine(st.concl, c, 0, titlesOnly, opts);
  return c;
}

/* A STEP WITH ONE INPUT IS NOT WORTH A BOX. Its only premise is the conclusion drawn directly
 * above it, so the box restates that sentence, greys it out, and says nothing else -- correct,
 * and no help at all to the reader this panel exists for. Such a step becomes the label on the
 * arrow instead, which is what it is: `and therefore`. */
function explCollapses(st){
  return st.inputs.length === 1 && st.inputs[0].from > 0;
}

function explEdgeLabel(st){
  var t = "Step " + st.n + (st.rule ? " · " + st.rule : "");
  if (st.verdict && st.verdict.state === "valid") t += " · checked";
  else if (st.verdict && st.verdict.state === "invalid") t += " · does NOT follow";
  return t;
}

/* The boxes of a layout, in order, each with whatever should be written on the edge arriving
 * at it. Shared by both layouts so they cannot drift apart. */
function explStages(steps, titlesOnly, opts){
  var out = [], lone = steps.length === 1;
  steps.forEach(function(st){
    var fold = explCollapses(st);
    if (!fold) out.push({ el: explStepBox(st, titlesOnly, lone, opts), label: "", kind: "step" });
    out.push({ el: explConclBox(st, titlesOnly, opts), kind: "concl",
               label: fold ? explEdgeLabel(st) : "" });
  });
  return out;
}

/* THE MEASUREMENTS BOTH LAYOUTS WORK FROM, in one place so the panel and the window it opens in
 * cannot disagree about them. */
var EXPL_MEASURE = 680;   // one box of full sentences -- about a hundred characters at 14px
var EXPL_INDENT  = 27;    // the staircase's tread
var EXPL_COL     = 300;   // a compact box, which holds a short name rather than a sentence
var EXPL_GAPX    = 44;    // between the compact view's two columns
var EXPL_ROWIN   = 40;    // its own, longer, tread
var EXPL_CHROME  = 34;    // what the panel takes around the diagram: body padding and border

/* HOW WIDE THE WINDOW ASKS TO BE.
 *
 * The card was a flat `min(58rem, 95vw)` whatever it held, and both layouts spend whatever they
 * are given -- so a one-step argument, which travels nowhere, got the same column a seven-box
 * staircase needs and set its premises in lines of a hundred and thirty characters, the longest
 * lines in the feature. Reported that way: wider than it needs to be, and it ought to vary with
 * the travel.
 *
 * So a box gets ONE MEASURE and keeps it, and what varies is the TRAVEL -- the offset that makes
 * the chain a shape rather than a stack. A long staircase asks for about what it asked for
 * before; everything shorter asks for less, in proportion to how far it has to go.
 *
 * THE WIDER OF THE TWO LAYOUTS, not the one showing. Those two buttons are for comparing the
 * views, which means pressing them one after the other, and a card that resized underneath them
 * would move them out from under the cursor doing it.
 */
function explCardWidth(steps){
  var boxes = 0;
  steps.forEach(function(st){ boxes += explCollapses(st) ? 1 : 2; });
  // A single step is squared up rather than stepped, so it travels nowhere and asks for the
  // measure alone -- which is the case that was reported.
  var stair = EXPL_MEASURE +
    (steps.length === 1 ? 0 : EXPL_INDENT * Math.max(0, boxes - 1));
  var compact = EXPL_COL * 2 + EXPL_GAPX + EXPL_ROWIN * Math.max(0, steps.length - 1);
  return Math.max(stair, compact) + EXPL_CHROME;
}

var XNS = "http://www.w3.org/2000/svg";

/* `h` IS THE WRAP'S OWN HEIGHT, and getting that wrong is what made every panel scroll.
 *
 * The layer is `position:absolute;inset:0` but carries a `height` attribute, so the attribute
 * wins and the element is exactly that tall whatever the wrap is. Both layouts were handing it
 * the accumulated `top`, which still carried the trailing gap below the last box -- 26 pixels of
 * transparent nothing hanging past the bottom of the diagram, and enough to put `#explbody` into
 * overflow on panels that fitted perfectly well.
 *
 * That is where the reported clipping actually began: a scrollbar nobody needed, appearing after
 * the layout had measured its column, taking fifteen pixels out of it. */
function explEdgeLayer(wrap, w, h){
  var svg = document.createElementNS(XNS, "svg");
  svg.setAttribute("class", "xedges");
  svg.setAttribute("width", String(Math.round(w)));
  svg.setAttribute("height", String(Math.round(h)));
  var defs = document.createElementNS(XNS, "defs");
  defs.innerHTML = '<marker id="xah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" ' +
    'markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#3a9d5d"/></marker>';
  svg.appendChild(defs);
  wrap.appendChild(svg);
  return svg;
}

/* `via` is the y of the horizontal run. It defaults to halfway, which is right when the boxes
 * are stacked; in the compact view a conclusion box is centred in a row that a taller step box
 * sets the height of, so halfway between its bottom and the next row lands INSIDE that step box
 * and the edge is drawn straight through the text. Callers that know the row's real bottom pass
 * it, and the run clears both boxes. */
function explElbow(svg, x1, y1, x2, y2, label, via){
  var mid = via == null ? y1 + (y2 - y1) / 2 : via;
  var pth = document.createElementNS(XNS, "path");
  pth.setAttribute("d", "M" + x1 + "," + y1 + " L" + x1 + "," + mid +
                        " L" + x2 + "," + mid + " L" + x2 + "," + y2);
  pth.setAttribute("marker-end", "url(#xah)");
  svg.appendChild(pth);
  if (label) {
    var t = document.createElementNS(XNS, "text");
    t.setAttribute("x", String(Math.max(x1, x2) + 10));
    t.setAttribute("y", String(mid));
    t.setAttribute("dominant-baseline", "middle");
    t.textContent = label;
    svg.appendChild(t);
  }
}

/* STAIRCASE. The boxes travelling down and to the right, joined by drawn edges, so the chain is
 * a shape rather than a sequence. Down rather than up: a panel scrolls downward, and rising
 * would put each conclusion above the premises that reach it.
 *
 * Absolutely positioned HTML rather than SVG text, so every line still wraps for free; the
 * edges are an SVG overlay measured after layout rather than a guess at where the boxes went. */
function explStair(steps, body, width, opts){
  body.className = "xbody stair";
  var wrap = document.createElement("div");
  wrap.className = "xwrap";
  body.appendChild(wrap);

  var stages = explStages(steps, false, opts);

  // Indent enough to read as a stair, but never so much that the last box is a sliver.
  // MEASURED off the wrap rather than computed from the body: the body is padded, and guessing
  // that padding put every box 8px over and gave the panel a horizontal scrollbar. `width`, when
  // given, is a column already known to survive a scrollbar -- see `explDraw`.
  var avail = width || wrap.clientWidth;
  wrap.dataset.avail = String(avail);
  /* NO STAIR FOR A SINGLE STEP. The offset is there to show progression, and between two boxes
   * there is none to show -- indented, it reads as a wonky column rather than a descent. Squared
   * up, with the arrow running straight down, it is the shape a single inference has had for as
   * long as premises have been written above a line. */
  var indent = steps.length === 1 ? 0
    : Math.max(8, Math.min(EXPL_INDENT, (avail - 280) / Math.max(1, stages.length - 1)));
  var w = avail - indent * (stages.length - 1);

  stages.forEach(function(st, i){
    st.el.style.left = Math.round(indent * i) + "px";
    st.el.style.width = Math.round(w) + "px";
    wrap.appendChild(st.el);
  });
  var top = 0, gap = 26;
  stages.forEach(function(st){
    st.top = top; st.el.style.top = Math.round(top) + "px";
    top += st.el.offsetHeight + gap;
  });
  var tall = Math.round(top - gap);
  wrap.style.height = tall + "px";

  var svg = explEdgeLayer(wrap, avail, tall);
  for (var i = 0; i < stages.length - 1; i++) {
    explElbow(svg, indent * i + 26, stages[i].top + stages[i].el.offsetHeight,
                   indent * (i + 1) + 26, stages[i + 1].top, stages[i + 1].label);
  }
}

/* COMPACT. The same chain drawn from the claims' short names rather than their sentences, which
 * is what lets it be a flowchart: a step and the conclusion it reaches sit SIDE BY SIDE on one
 * row, and the rows descend to the right. Two columns, so the conclusions line up down the page
 * and the chain can be followed by running an eye down the right-hand side.
 *
 * The names are the reconstructor's, not the source's, so this is the view to think WITH and
 * the full-text one to check against. */
function explCompact(steps, body, width, opts){
  body.className = "xbody stair compact";
  var wrap = document.createElement("div");
  wrap.className = "xwrap";
  body.appendChild(wrap);

  var rows = [], lone = steps.length === 1;
  steps.forEach(function(st){
    var fold = explCollapses(st);
    rows.push({ step: fold ? null : explStepBox(st, true, lone, opts),
                concl: explConclBox(st, true, opts),
                label: fold ? explEdgeLabel(st) : "" });
  });

  // `width`, when given, is a column already known to survive a scrollbar -- see `explDraw`.
  var avail = width || wrap.clientWidth;
  wrap.dataset.avail = String(avail);
  // A longer stride than the full-text view takes, because here the travel IS the diagram:
  // short boxes leave the width to spend, and spending it is what makes the chain a shape.
  var rowIn = EXPL_ROWIN, gapX = EXPL_GAPX;
  var maxIn = rowIn * (rows.length - 1);
  var colW = Math.min(EXPL_COL, Math.floor((avail - maxIn - gapX) / 2));
  /* CENTRED IN WHATEVER IT WAS GIVEN. The card is sized to the wider of the two layouts, so that
   * pressing one mode button does not move the other out from under the cursor; the cost is that
   * the compact view, which is the narrower, has room left over. Spent as a margin on both sides
   * it reads as a centred diagram rather than as one that has come up short on the right. */
  var slack = Math.max(0, Math.round((avail - (colW * 2 + gapX + maxIn)) / 2));
  var stepX = function(i){ return slack + rowIn * i; };
  var conclX = function(i){ return slack + rowIn * i + colW + gapX; };

  rows.forEach(function(r, i){
    if (r.step) {
      r.step.style.left = stepX(i) + "px"; r.step.style.width = colW + "px";
      wrap.appendChild(r.step);
    }
    r.concl.style.left = conclX(i) + "px"; r.concl.style.width = colW + "px";
    wrap.appendChild(r.concl);
  });

  // BOTH boxes are centred in their row, so the arrow between them runs level whichever of the
  // two is the taller. Each box then records where its own edges ended up: the row's bounds are
  // not the box's, and drawing the edges from the row left every downward arrow starting in
  // mid-air below the conclusion it was meant to leave.
  var top = 0, gap = 30;
  rows.forEach(function(r){
    var sh = r.step ? r.step.offsetHeight : 0, ch = r.concl.offsetHeight;
    var h = Math.max(sh, ch);
    if (r.step) r.step.style.top = Math.round(top + (h - sh) / 2) + "px";
    r.concl.style.top = Math.round(top + (h - ch) / 2) + "px";
    r.mid = top + h / 2;
    r.bottom = top + h;
    r.leaves = top + (h - ch) / 2 + ch;              // the conclusion box's own bottom edge
    r.enters = r.step ? top + (h - sh) / 2 : top + (h - ch) / 2;   // and the next box's own top
    top += h + gap;
  });
  var tall = Math.round(top - gap);
  wrap.style.height = tall + "px";

  var svg = explEdgeLayer(wrap, avail, tall);
  rows.forEach(function(r, i){
    if (r.step) {           // across: the step reaches its conclusion
      var pth = document.createElementNS(XNS, "path");
      pth.setAttribute("d", "M" + (stepX(i) + colW) + "," + r.mid +
                            " L" + conclX(i) + "," + r.mid);
      pth.setAttribute("marker-end", "url(#xah)");
      svg.appendChild(pth);
    }
    if (i < rows.length - 1) {   // down: that conclusion feeds the next step
      var nx = rows[i + 1].step ? stepX(i + 1) + 26 : conclX(i + 1) + 26;
      explElbow(svg, conclX(i) + 26, r.leaves, nx, rows[i + 1].enters, rows[i + 1].label,
                r.bottom + gap / 2);
    }
  });
}

/* ---------------------------------------------------------------- exporting the staircase
 *
 * SERIALISED FROM WHAT IS ON SCREEN, not laid out a second time. The panel has already measured
 * every box and wrapped every line at the width it actually has; re-deriving that for the export
 * would be a second implementation of the same arithmetic, free to disagree with the first, and
 * the reader would find out only by comparing the file with the panel.
 *
 * So the boxes come from their own bounding rectangles, and each line of text from
 * `Range.getClientRects()` -- one rectangle per rendered line, which is the browser reporting
 * where it put the words rather than this code guessing.
 */
function explEffectiveOpacity(el, stop){
  var o = 1;
  for (var n = el; n && n !== stop; n = n.parentElement) {
    var v = parseFloat(getComputedStyle(n).opacity);
    if (!isNaN(v)) o *= v;
  }
  return o;
}

/* QUOTES INCLUDED, and that is the whole reason this is a function rather than three replaces.
 * A computed `font-family` is `-apple-system, "system-ui", "Segoe UI", ...` -- double quotes and
 * all -- and writing that into a double-quoted XML attribute ends the attribute early and makes
 * the file unparseable. The browser hid it: injected with innerHTML the SVG rendered perfectly,
 * because HTML parsing forgives it, and it was only the PNG path -- which loads the same bytes
 * through an XML parser -- that refused. A .svg written to disk would have failed the same way,
 * in a viewer the reader could not debug. */
/* SVG 1.1 HAS NO `rgba()`. A browser takes it, because CSS Color 4 says so and the same string
 * came out of `getComputedStyle`; a standalone renderer parses the presentation attribute
 * strictly, fails, and falls back to BLACK. Reported from Inkscape as "it comes out black" --
 * and that is exactly what it was: `.xstep` has no background, so its computed fill is
 * `rgba(0, 0, 0, 0)`, which every box in the file carried.
 *
 * So the alpha comes out of the colour and goes where SVG keeps it, in its own attribute. */
function explPaint(css){
  var m = String(css == null ? "" : css).match(/rgba?\(([^)]+)\)/);
  if (!m) return { paint: css || "none", alpha: 1 };
  var p = m[1].split(/[,\s/]+/).filter(function(x){ return x.length; }).map(Number);
  var a = p.length > 3 ? p[3] : 1;
  if (!(a > 0)) return { paint: "none", alpha: 0 };
  return { paint: "rgb(" + p[0] + "," + p[1] + "," + p[2] + ")", alpha: a };
}

function explEsc(t){
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** CSS can put text on the page that is in no text node at all. `::before` carries the
 *  turn-and-enter arrow on a carried line, and a walker over text nodes cannot see it -- the
 *  first export dropped it silently, which is the failure mode an export must not have. */
function explPseudoRuns(root, ox, oy){
  var out = [];
  root.querySelectorAll("*").forEach(function(el){
    if (el.closest(".xedges")) return;          // copied wholesale, like its text
    ["::before", "::after"].forEach(function(which){
      var cs = getComputedStyle(el, which);
      var c = cs.content;
      if (!c || c === "none" || c === "normal") return;
      var txt = c.replace(/^["']|["']$/g, "");
      if (!txt.trim()) return;
      var r = el.getBoundingClientRect();
      var size = parseFloat(cs.fontSize) || 12;
      out.push({ x: r.left - ox, y: r.top - oy + (r.height + size * 0.72) / 2, w: r.width,
                 size: size, weight: cs.fontWeight, style: cs.fontStyle, fill: cs.color,
                 opacity: explEffectiveOpacity(el, root.parentElement),
                 family: cs.fontFamily, text: txt });
    });
  });
  return out;
}

/** Every rendered line under `root`, as {x, y, size, weight, style, fill, opacity, text}. */
function explTextRuns(root, ox, oy){
  var out = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
  while ((n = walk.nextNode())) {
    var raw = n.nodeValue;
    if (!/\S/.test(raw)) continue;
    var el = n.parentElement, cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    // THE EDGE LAYER IS INSIDE THE WRAP, and its labels are copied wholesale further down. Left
    // in, this walk found them again and wrote every one twice -- reported as "Step 4 appears
    // twice", in both layouts, because both draw their edges the same way.
    if (el.closest(".xedges")) continue;
    // The DRAWN text, not the source text: a step heading is uppercased by CSS, and exporting
    // the node's own value put it back into sentence case in the file.
    if (cs.textTransform === "uppercase") raw = raw.toUpperCase();
    else if (cs.textTransform === "lowercase") raw = raw.toLowerCase();
    var size = parseFloat(cs.fontSize) || 12;
    var op = explEffectiveOpacity(el, root.parentElement);
    // Group the characters into the lines the browser actually drew them on. A range over one
    // character reports the line box it landed in; consecutive characters sharing a top are one
    // line. Cheap enough at panel size, and exact, which guessing at wrap points is not.
    var r = document.createRange(), line = null;
    for (var i = 0; i < raw.length; i++) {
      r.setStart(n, i); r.setEnd(n, i + 1);
      var rects = r.getClientRects();
      if (!rects.length) { if (line) line.text += raw[i]; continue; }
      var b = rects[0];
      if (!line || Math.abs(b.top - line.top) > 1) {
        if (line) out.push(line);
        line = { top: b.top, left: b.left, right: b.right, size: size, weight: cs.fontWeight,
                 style: cs.fontStyle, fill: cs.color, opacity: op, height: b.height,
                 family: cs.fontFamily, text: raw[i] };
      } else {
        line.text += raw[i];
        line.right = b.right;
      }
    }
    if (line) out.push(line);
  }
  return out.map(function(l){
    return { x: l.left - ox,
             // The baseline, from the line box the browser reported. Centring the em within the
             // line box is what a line box IS, so this lands where the text did.
             y: l.top - oy + (l.height + l.size * 0.72) / 2,
             w: Math.max(0, l.right - l.left),
             size: l.size, weight: l.weight, style: l.style, fill: l.fill,
             opacity: l.opacity, family: l.family, text: l.text.replace(/\s+$/, "") };
  }).filter(function(l){ return l.text.length; });
}

function explBuildSVG(body, bgEl){
  var wrap = body && body.querySelector(".xwrap");
  if (!wrap) return null;
  var wr = wrap.getBoundingClientRect();
  var pad = 16;

  /* THE PICTURE IS AS BIG AS WHAT IS IN IT, and that is a correction.
   *
   * Sizing the canvas from the wrap's own rectangle assumed every box was inside it. A classic
   * scrollbar appearing after the layout had measured its column made that false -- the last box
   * hung fifteen pixels past the wrap's right edge, hidden on screen by the panel's padding, and
   * the exported file was cut off down that edge with nothing in the browser to show it.
   *
   * Measuring what is actually drawn cannot be wrong in that way, whatever the layout did. It
   * also trims the dead column the compact view leaves at the right, which the wrap's width kept
   * and which no reader wanted in a picture.
   */
  var lo = { x: Infinity, y: Infinity }, hi = { x: -Infinity, y: -Infinity };
  function grow(x0, y0, x1, y1){
    if (x0 < lo.x) lo.x = x0;
    if (y0 < lo.y) lo.y = y0;
    if (x1 > hi.x) hi.x = x1;
    if (y1 > hi.y) hi.y = y1;
  }

  // The boxes, with the corners and colours they are drawn with on screen.
  var boxes = [];
  wrap.querySelectorAll(".xstep,.xconcl").forEach(function(b){
    var r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    var o = { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height,
              rx: parseFloat(cs.borderTopLeftRadius) || 0,
              sw: parseFloat(cs.borderTopWidth) || 1,
              fill: explPaint(cs.backgroundColor), stroke: explPaint(cs.borderTopColor) };
    boxes.push(o);
    // The stroke straddles the edge, so half of it is outside the rectangle it is drawn on.
    grow(o.x - o.sw / 2, o.y - o.sw / 2, o.x + o.w + o.sw / 2, o.y + o.h + o.sw / 2);
  });

  // The edges are already SVG in the wrap's own coordinates, so they only need shifting.
  var edges = wrap.querySelector(".xedges"), inner = [];
  if (edges) {
    edges.querySelectorAll("path").forEach(function(p){
      if (p.closest("defs")) return;
      inner.push('<path d="' + p.getAttribute("d") + '" fill="none" stroke="#3a9d5d" ' +
                 'stroke-width="1.6" marker-end="url(#xah)"/>');
    });
    edges.querySelectorAll("text").forEach(function(t){
      inner.push('<text x="' + t.getAttribute("x") + '" y="' + t.getAttribute("y") +
                 '" font-size="11" font-style="italic" fill="#667" ' +
                 'dominant-baseline="middle">' + explEsc(t.textContent) + '</text>');
    });
    /* THE ARROWHEAD AND THE LABEL BOTH OVERHANG. `getBBox` reports a path's geometry without its
     * marker, and the label on a collapsed step is set beyond the turn of the elbow, where no box
     * reaches. So the geometry gets a few pixels of slack for the head, and each label is
     * measured from the rectangle it was actually laid out in. */
    if (inner.length) {
      var gb = edges.getBBox();
      grow(gb.x - 6, gb.y - 6, gb.x + gb.width + 6, gb.y + gb.height + 6);
      edges.querySelectorAll("text").forEach(function(t){
        var q = t.getBoundingClientRect();
        grow(q.left - wr.left, q.top - wr.top, q.right - wr.left, q.bottom - wr.top);
      });
    }
  }

  var runs = explTextRuns(wrap, wr.left, wr.top).concat(explPseudoRuns(wrap, wr.left, wr.top));
  runs.forEach(function(l){ grow(l.x, l.y - l.size, l.x + (l.w || 0), l.y + l.size * 0.3); });

  if (!isFinite(lo.x) || !isFinite(lo.y)) return null;
  var W = Math.ceil(hi.x - lo.x) + pad * 2, H = Math.ceil(hi.y - lo.y) + pad * 2;
  var ox = pad - lo.x, oy = pad - lo.y;
  var parts = [];

  var bg = explPaint(getComputedStyle(bgEl || body).backgroundColor);
  parts.push('<rect width="' + W + '" height="' + H + '" fill="' + explEsc(bg.paint) + '"' +
             (bg.alpha < 1 ? ' fill-opacity="' + bg.alpha + '"' : "") + '/>');

  boxes.forEach(function(o){
    parts.push('<rect x="' + (o.x + ox).toFixed(1) + '" y="' + (o.y + oy).toFixed(1) +
               '" width="' + o.w.toFixed(1) + '" height="' + o.h.toFixed(1) +
               '" rx="' + o.rx +
               '" fill="' + explEsc(o.fill.paint) + '"' +
               (o.fill.alpha < 1 ? ' fill-opacity="' + o.fill.alpha + '"' : "") +
               ' stroke="' + explEsc(o.stroke.paint) + '"' +
               (o.stroke.alpha < 1 ? ' stroke-opacity="' + o.stroke.alpha + '"' : "") +
               ' stroke-width="' + o.sw + '"/>');
  });

  if (inner.length)
    parts.push('<g transform="translate(' + ox.toFixed(1) + ',' + oy.toFixed(1) + ')">' +
               inner.join("") + '</g>');

  runs.forEach(function(l){
    var c = explPaint(l.fill), op = l.opacity * c.alpha;
    parts.push('<text x="' + (l.x + ox).toFixed(1) + '" y="' + (l.y + oy).toFixed(1) +
               '" font-family="' + explEsc(l.family) + '" font-size="' + l.size +
               '" font-weight="' + explEsc(l.weight) + '" font-style="' + explEsc(l.style) +
               '" fill="' + explEsc(c.paint) + '"' +
               (op < 0.995 ? ' opacity="' + op.toFixed(2) + '"' : "") +
               '>' + explEsc(l.text) + '</text>');
  });

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
         '" viewBox="0 0 ' + W + ' ' + H + '">' +
         '<defs><marker id="xah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" ' +
         'markerHeight="7" orient="auto-start-reverse">' +
         '<path d="M0,0 L10,5 L0,10 z" fill="#3a9d5d"/></marker></defs>' +
         parts.join("") + "</svg>";
}

function explFileName(label, mode, ext){
  var base = (label || "argument")
    .replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return base + (mode === "compact" ? " (compact)" : "") + "." + ext;
}


/* PNG at twice the size, because the panel's type is small and a screenshot of it is the thing
 * this exists to be better than. A DATA url rather than a blob: an SVG drawn from a blob URL
 * taints the canvas in some engines, and a tainted canvas fails at `toBlob` with a security
 * error rather than anywhere a reader could act on. */
function explPngFromSvg(svg, name, cb){
  var save = (cb && cb.save) || function(){};
  var showErr = (cb && cb.onError) || function(){};
  if (!svg) return;
  var m = svg.match(/width="(\d+)" height="(\d+)"/);
  var w = m ? +m[1] : 900, h = m ? +m[2] : 700, k = 2;
  var img = new Image();
  img.onload = function(){
    var c = document.createElement("canvas");
    c.width = w * k; c.height = h * k;
    var g = c.getContext("2d");
    g.setTransform(k, 0, 0, k, 0, 0);
    g.drawImage(img, 0, 0, w, h);
    try {
      c.toBlob(function(b){
        if (b) save(b, name);
        else showErr("The image could not be encoded, so nothing was saved.");
      }, "image/png");
    } catch (e) {
      showErr("This browser would not let the picture be read back out of the canvas (" +
              ((e && e.message) || e) + "). The SVG export does not have this limit.");
    }
  };
  img.onerror = function(){
    showErr("The picture could not be drawn for export. The SVG export writes the same thing " +
            "without going through an image.");
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}


/* THE DOUBLE PASS, verbatim in spirit from the viewer's explDraw. Both layouts must measure
 * the width they have before they have given the wrap a height: the boxes are absolutely
 * positioned, so until they are placed nothing has one. On a machine with classic scrollbars
 * that measurement is taken from a panel which is not yet scrolling -- and the moment the
 * wrap gets its height the scrollbar appears and takes fifteen pixels out of the column every
 * box was just sized against. So the width that survived is read off the finished layout and
 * HANDED to a second pass. Twice is enough -- the second pass is told, so there is nothing
 * left to discover. */
function draw(rows, body, opts){
  injectStyle();
  opts = opts || {};
  var steps = explSteps(rows || []);
  var layout = opts.mode === "compact" ? explCompact : explStair;
  body.textContent = "";
  layout(steps, body, null, opts);
  var wrap = body.querySelector(".xwrap");
  var have = wrap ? wrap.clientWidth : 0;
  if (wrap && have > 0 && Math.abs(Number(wrap.dataset.avail) - have) >= 1) {
    body.textContent = "";
    layout(steps, body, have, opts);
  }
  return steps;
}

var API = { draw: draw,
            steps: explSteps, titleOf: explTitleOf, collapses: explCollapses,
            cardWidth: explCardWidth,
            stair: explStair, compact: explCompact,
            buildSVG: explBuildSVG, pngFromSvg: explPngFromSvg,
            fileName: explFileName, esc: explEsc, paint: explPaint,
            injectStyle: injectStyle };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownStaircase = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
