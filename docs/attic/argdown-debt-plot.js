/* RETIRED 20 Aug 2026 — no longer wired into any viewer, and no longer bundled into one.
 *
 * The author's call, and a fair one: it produced something interesting now and again but was a
 * curiosity rather than a view worth a permanent tab. What it was FOR — seeing a claim and its
 * support far apart in the text — the Manuscript view now shows directly, as a long line, with
 * the reach-weighted stroke already carrying the emphasis this plot was carrying with distance
 * from the diagonal. Kept as history; do not wire it back in without a reason.
 *
 * argdown-debt-plot.js — where the order of exposition comes apart from the order of reasons.
 *
 * ONE POINT PER SUPPORT EDGE, not per claim:
 *
 *     x = where the CLAIM sits in the manuscript
 *     y = where its SUPPORT sits
 *
 * NEITHER SIDE OF THE DIAGONAL IS A FAULT, and the encoding must not imply otherwise. Analytic
 * philosophy's standard advice is to announce the thesis and argue for it afterwards — Pryor's
 * writing guide: "You should make the structure of your paper obvious to the reader. Your reader
 * shouldn't have to exert any effort to figure it out." On that convention a claim SHOULD arrive
 * before its support, and points above the diagonal are the paper doing what it was told.
 *
 * The two conventions get neutral names here:
 *
 *     ANTICIPATED  the claim is stated first, its support arrives later. The roadmap style.
 *                  The reader is told where they are going and asked to hold it briefly.
 *     PREPARED     the support is laid down first and the claim follows. Williams's style in
 *                  this paper: 0 of 45 supports anticipated. It asks the reader to follow an
 *                  unfolding argument and keep the shape of it in their head.
 *
 * So colour carries DIRECTION and nothing else, in a pair with no good/bad reading; size and
 * opacity carry MAGNITUDE, which is the thing that actually taxes a reader whichever way it
 * runs. What is worth looking at is not a side of the line but a long reach, and — more useful
 * still — a point that departs from the convention the rest of the text follows.
 *
 * WHY EDGES AND NOT CLAIMS. The obvious plot is x = position in the text, y = the claim's place
 * in the justification order — and it cannot be built, because a DAG has no canonical linear
 * order. Any y you invent is one of many topological sorts, so "distance from the diagonal"
 * measures your tie-breaking rule rather than the book. (Tried it: a rank correlation between
 * text order and a depth-then-load ordering came out at rho = +0.001 on the book map, which
 * looks like a devastating finding and is actually an artefact of ranking 292 claims by a
 * quantity with 7 distinct values.)
 *
 * A support RELATION, though, is a fact about two claims, and the text either gives you the
 * reason first or it does not. So the diagonal is real: y = x means the support sits exactly
 * where the claim does.
 *
 *     ABOVE the diagonal — anticipated: the support arrives after the claim it bears on, and
 *                          the height above the line is how long the reader holds it.
 *     BELOW the diagonal — prepared: the text builds up to the claim.
 *     ON it              — support and claim sit together, which is most of ordinary prose.
 *
 * A text legitimately does all three. What the plot shows is the BALANCE, and where the outliers
 * are — which is the fabula/syuzhet question in the only form that admits an answer.
 *
 * Classic script, no build step; sets window.ArgdownDebtPlot.
 */
(function (global) {
"use strict";

var NS = "http://www.w3.org/2000/svg";
function el(name, attrs) {
  var e = document.createElementNS(NS, name);
  for (var k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  return e;
}

/** Rank every placed claim by where it sits in the manuscript, and note where chapters start. */
function ranks(nodes) {
  var placed = nodes.filter(function (n) { return n.pos && n.pos.line != null; });
  placed.sort(function (a, b) {
    return a.pos.chapterIndex - b.pos.chapterIndex || a.pos.line - b.pos.line;
  });
  var rank = {}, bounds = [], seen = null;
  placed.forEach(function (n, i) {
    rank[n.id] = i;
    if (n.pos.chapterIndex !== seen) {
      seen = n.pos.chapterIndex;
      bounds.push({ at: i, chapter: n.pos.chapter, inBook: n.pos.inBook });
    }
  });
  return { rank: rank, bounds: bounds, n: placed.length, nodes: placed };
}

/**
 * container — an element to fill
 * graph     — { nodes:[{id,label,pos}], edges:[{from,to,type}] }
 * options   — { onSelect(nodeId) }
 */
function createDebtPlot(container, graph, options) {
  var opt = options || {};
  container.innerHTML = "";
  container.classList.add("adp");
  injectStyle();

  var R = ranks(graph.nodes || []);
  if (R.n < 2) {
    container.innerHTML = '<p class="adp-empty">No claims could be placed in the manuscript, ' +
      'so there is nothing to plot. Build the viewer with <code>--source-root</code>.</p>';
    return { destroy: function () { container.innerHTML = ""; } };
  }

  // Edges run reason -> claim. Support only: the diagonal's meaning is about justification, and
  // an objection is not owed to the claim it attacks.
  var pts = [];
  (graph.edges || []).forEach(function (e) {
    if ((e.type || "support") !== "support") return;
    if (!(e.from in R.rank) || !(e.to in R.rank)) return;
    pts.push({ x: R.rank[e.to], y: R.rank[e.from], from: e.from, to: e.to,
               gap: R.rank[e.from] - R.rank[e.to] });
  });

  var PAD = { l: 62, r: 18, t: 18, b: 54 };
  // Caption FIRST and in normal flow, not floated over the top-right of the plot. Once it had
  // to explain that neither direction is a fault it grew long enough to sit on top of the data.
  var caption = document.createElement("div");
  caption.className = "adp-cap";
  container.appendChild(caption);

  var svg = el("svg", { class: "adp-svg" });
  var gRoot = el("g");
  svg.appendChild(gRoot);
  container.appendChild(svg);

  var tip = document.createElement("div");
  tip.className = "adp-tip";
  tip.hidden = true;
  container.appendChild(tip);

  var labelOf = {};
  (graph.nodes || []).forEach(function (n) { labelOf[n.id] = n.label || n.id; });
  var chapterName = function (c) {
    return String(c || "").replace(/^.*\//, "").replace(/\.(md|qmd)$/i, "");
  };

  function draw() {
    var W = container.clientWidth || 700;
    var H = container.clientHeight || 520;
    // Square plotting area: the diagonal must be at 45°, or "distance from the line" is read
    // wrong. Better to leave margin than to stretch the axis.
    var side = Math.max(120, Math.min(W - PAD.l - PAD.r, H - PAD.t - PAD.b));
    var x0 = PAD.l, y0 = PAD.t + Math.max(0, (H - PAD.t - PAD.b - side) / 2);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    gRoot.innerHTML = "";

    var sx = function (r) { return x0 + (r / (R.n - 1)) * side; };
    var sy = function (r) { return y0 + side - (r / (R.n - 1)) * side; };

    // No shaded half. Tinting the region above the diagonal marked one of the two conventions
    // as the notable one, which is a judgement the plot is in no position to make.

    // Chapter boundaries on both axes. With a single chapter — a paper rather than a book —
    // there is exactly one boundary, at the origin, and labelling it says nothing: skip the
    // gridlines entirely rather than draw a rotated filename along the axis.
    var showBounds = R.bounds.length > 1;
    R.bounds.forEach(function (b) {
      if (!showBounds) return;
      var px = sx(b.at), py = sy(b.at);
      gRoot.appendChild(el("line", { class: "adp-grid", x1: px, x2: px, y1: y0, y2: y0 + side }));
      gRoot.appendChild(el("line", { class: "adp-grid", x1: x0, x2: x0 + side, y1: py, y2: py }));
      // Chapters can start a few claims apart, so full names collide into an unreadable band.
      // Steeper rotation plus a hard trim; the axis is a ruler, not a table of contents.
      var name = b.inBook ? chapterName(b.chapter) : "not in the book";
      if (name.length > 22) name = name.slice(0, 21).trimEnd() + "…";
      var t = el("text", { class: "adp-chlabel" + (b.inBook ? "" : " adp-outside"),
                           x: px + 3, y: y0 + side + 11,
                           transform: "rotate(50 " + (px + 3) + " " + (y0 + side + 11) + ")" });
      t.textContent = name;
      t.appendChild(el("title")).textContent = b.chapter || name;
      gRoot.appendChild(t);
    });

    gRoot.appendChild(el("rect", { class: "adp-frame", x: x0, y: y0, width: side, height: side }));
    gRoot.appendChild(el("line", { class: "adp-diag",
      x1: sx(0), y1: sy(0), x2: sx(R.n - 1), y2: sy(R.n - 1) }));

    // Size and opacity carry the MAGNITUDE, colour only the direction. Splitting on the sign
    // alone put 222 of 304 points in the "debt" colour, which is the same error as calling
    // every backward edge debt: support arriving one claim later is a sentence, not a finding.
    // Near-diagonal points recede to faint specks and the outliers carry the picture.
    var far = function (g) { return Math.min(1, Math.abs(g) / 40); };
    pts.forEach(function (p) {
      var w = far(p.gap);
      var c = el("circle", { class: "adp-pt " + (p.gap > 0 ? "is-anticipated" : "is-prepared"),
                             cx: sx(p.x), cy: sy(p.y), r: 2.2 + w * 4,
                             "fill-opacity": (0.25 + w * 0.65).toFixed(2) });
      c.addEventListener("mouseenter", function () {
        tip.hidden = false;
        tip.innerHTML = "<b>" + esc(labelOf[p.to]) + "</b><br>" +
          (p.gap > 0 ? "stated first; supported <b>" + p.gap + " claims later</b> by "
                     : "prepared: already supported " + (-p.gap) + " claims earlier by ") +
          "<b>" + esc(labelOf[p.from]) + "</b>";
        var r = container.getBoundingClientRect();
        tip.style.left = Math.min(sx(p.x) + 12, r.width - 240) + "px";
        tip.style.top = (sy(p.y) + 12) + "px";
      });
      c.addEventListener("mouseleave", function () { tip.hidden = true; });
      if (opt.onSelect) c.addEventListener("click", function () { opt.onSelect(p.to, p.from); });
      gRoot.appendChild(c);
    });

    var ax = el("text", { class: "adp-axis", x: x0 + side / 2, y: H - 8,
                          "text-anchor": "middle" });
    ax.textContent = "the claim's place in the manuscript →";
    gRoot.appendChild(ax);
    var ay = el("text", { class: "adp-axis", x: 14, y: y0 + side / 2,
                          "text-anchor": "middle",
                          transform: "rotate(-90 14 " + (y0 + side / 2) + ")" });
    ay.textContent = "where its support sits →";
    gRoot.appendChild(ay);
  }

  // Report the SPREAD and the CONVENTION, not a count either side of the line. Almost every
  // support sits a claim or two from what it bears on; saying "222 of 304 are above the line"
  // makes ordinary prose sound like a structural fault, which is the misreading this plot
  // exists to prevent.
  var near = pts.filter(function (p) { return Math.abs(p.gap) < 5; }).length;
  var mid = pts.filter(function (p) { var g = Math.abs(p.gap); return g >= 5 && g < 25; }).length;
  var far25 = pts.filter(function (p) { return Math.abs(p.gap) >= 25; });
  var reaching = pts.filter(function (p) { return Math.abs(p.gap) >= 5; });
  var ant = reaching.filter(function (p) { return p.gap > 0; }).length;
  var prep = reaching.length - ant;

  // Which convention does this text follow? Only the relations that REACH say anything: a
  // support one claim away is prose, not a policy. And the useful outlier is the one that
  // departs from the text's own practice, not from an absolute.
  // REACH discriminates where the count does not. On the Williams the two directions are
  // almost even by count -- 23 anticipated, 22 prepared -- and reading only that would say the
  // paper has no policy. But the anticipated ones stretch at most 8 claims, which is ordinary
  // prose stating a thing and supporting it just after, while the prepared ones reach 50: the
  // local texture is mixed and the long-range architecture is entirely build-then-conclude.
  var maxOf = function (side) {
    return side.length ? Math.max.apply(null, side.map(function (p) { return Math.abs(p.gap); })) : 0;
  };
  var antMax = maxOf(pts.filter(function (p) { return p.gap > 0; }));
  var prepMax = maxOf(pts.filter(function (p) { return p.gap < 0; }));
  var mode = "";
  if (reaching.length >= 5) {
    var share = ant / reaching.length;
    mode = share >= 0.75
      ? "Of those that reach, <b>" + ant + " of " + reaching.length + "</b> state the claim " +
        "first — the roadmap convention. The <b>" + prep + "</b> prepared ones depart from it."
      : share <= 0.25
      ? "Of those that reach, <b>" + prep + " of " + reaching.length + "</b> lay the support " +
        "down first — the text builds to its claims. The <b>" + ant + "</b> anticipated ones " +
        "depart from it."
      : "Of those that reach, <b>" + ant + "</b> state the claim first and <b>" + prep +
        "</b> prepare it.";
    mode += " Longest reach: <b>" + antMax + "</b> claims anticipating, <b>" + prepMax +
            "</b> preparing" +
            (prepMax > antMax * 2 ? " — the long-range structure builds to its claims even " +
                                    "where the local texture is mixed."
             : antMax > prepMax * 2 ? " — the long-range structure announces, whatever the " +
                                      "local texture does." : ".");
  }
  caption.innerHTML =
    "<b>" + pts.length + "</b> support relations. <b>" + near + "</b> sit within 5 claims of " +
    "what they support; <b>" + mid + "</b> reach 5–25 away; <b>" + far25.length +
    "</b> reach 25+. " + mode +
    "<br><span class='adp-note'>Neither direction is a fault — above the line is the " +
    "announce-then-argue convention, below it the build-then-conclude one. Distance from the " +
    "line is what a reader has to carry.</span>";

  draw();
  var ro = typeof ResizeObserver === "function" ? new ResizeObserver(draw) : null;
  if (ro) ro.observe(container);
  else global.addEventListener("resize", draw);

  return {
    redraw: draw,
    stats: function () {
      return { points: pts.length, claims: R.n, within5: near, mid: mid,
               far: far25.length, farLate: late };
    },
    destroy: function () {
      if (ro) ro.disconnect(); else global.removeEventListener("resize", draw);
      container.innerHTML = "";
      container.classList.remove("adp");
    }
  };
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; });
}

var styled = false;
function injectStyle() {
  if (styled || document.getElementById("adp-style")) { styled = true; return; }
  styled = true;
  var s = document.createElement("style");
  s.id = "adp-style";
  s.textContent = "" +
".adp{position:relative;width:100%;height:100%;display:flex;flex-direction:column;" +
  "font-family:system-ui,-apple-system,sans-serif}" +
/* MUST come with the display rule above. `hidden` hides an element only through the user-agent
   rule `[hidden]{display:none}`, and any class selector setting `display` outranks it — so the
   moment `.adp` became a flex column, the host's `#debt.hidden = true` stopped having any
   effect and the plot showed on top of the Map and Source tabs. */
".adp[hidden]{display:none}" +
".adp-svg{flex:1;min-height:0;width:100%;display:block}" +
".adp-empty{padding:2rem;color:var(--fg-dim,#666)}" +
".adp-frame{fill:none;stroke:var(--alm-group-line,#c9c4b8);stroke-width:1}" +
".adp-grid{stroke:var(--alm-group-line,#c9c4b8);stroke-opacity:.45;stroke-dasharray:2 4}" +
".adp-diag{stroke:var(--fg-dim,#888);stroke-width:1.4;stroke-dasharray:6 4}" +
".adp-pt{cursor:pointer;fill-opacity:.62;stroke:none}" +
/* Blue and amber, not green and red. The earlier pair read as good-and-bad, and the direction
   of a support relation carries no such verdict: above the line is the convention every
   undergraduate is taught, below it the one Williams writes by. Hue says WHICH; size and
   opacity say HOW FAR, which is the part that costs the reader something. */
".adp-pt.is-anticipated{fill:#2f6fb5}" +
".adp-pt.is-prepared{fill:#c98a20}" +
".adp-pt:hover{fill-opacity:1;stroke:var(--fg,#222);stroke-width:1.2}" +
".adp-chlabel{font-size:9px;fill:var(--fg-dim,#777)}" +
".adp-chlabel.adp-outside{fill:#c2410c;font-style:italic}" +
".adp-axis{font-size:11px;fill:var(--fg-dim,#666)}" +
".adp-cap{flex:0 0 auto;padding:.55rem .9rem .6rem;font-size:11px;line-height:1.5;" +
  "color:var(--fg-dim,#666);border-bottom:1px solid var(--alm-group-line,#e6e2d8)}" +
".adp-cap .adp-note{display:block;margin-top:.3rem;opacity:.8;font-size:10px}" +
".adp-tip{position:absolute;pointer-events:none;background:var(--alm-bar-bg,rgba(255,255,255,.97));" +
  "border:1px solid var(--alm-group-line,#ddd);border-radius:6px;padding:.4rem .55rem;" +
  "font-size:11px;line-height:1.5;max-width:230px;box-shadow:0 2px 8px rgba(0,0,0,.12);z-index:5}" +
"@media (prefers-color-scheme:dark){.adp-tip{background:rgba(30,32,36,.97)}}";
  document.head.appendChild(s);
}

var API = { createDebtPlot: createDebtPlot, ranks: ranks };
if (typeof module !== "undefined" && module.exports) module.exports = API;
global.ArgdownDebtPlot = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
