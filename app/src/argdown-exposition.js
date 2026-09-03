/* argdown-exposition.js — the shape of a piece of writing, as a number and as a mark.
 *
 * WHAT THIS ANSWERS. Two articles can have the same claims and the same relations between them
 * and still make completely different demands on a reader. Horton states his central claims and
 * then argues for them; Williams argues for pages and the contention lands at the end. That
 * difference is the single most useful thing the exposition arrangement knows, and until now it
 * was only recoverable by tracing arrows by eye — which nobody does.
 *
 * THE MEASURE, AND ITS METAPHOR. Every relation runs reason -> claim. Rank both ends in reading
 * order and take the difference. A claim asserted before its justification arrives leaves the
 * reader holding a promise — a JUSTIFICATORY DEBT — until the reasons turn up:
 *
 *     reach > 0   the reasons arrive LATER than the claim: debt incurred, drawn BELOW the line
 *     reach < 0   the reasons were already given: the claim is earned, drawn ABOVE it
 *
 * A sound argument may do either. What it may not do is leave the debt outstanding at the end,
 * and what a reader feels is how long they were made to carry it.
 *
 * WEIGHTED BY DISTANCE, and this is the whole trick. Raw counts say nothing: across these
 * samples the split is about 50/50 in every paper, because most support sits a line or two from
 * what it supports and that is not a finding, it is prose. Each relation therefore contributes
 * `|reach| / claims` — the fraction of the text it spans — so a neighbour-to-neighbour edge
 * barely registers and a reach across half a paper dominates. Measured that way Williams and
 * Horton separate cleanly: weight at 73% of the text against 42%.
 *
 * (The renderer used to answer the same question by comparing CHAPTER indices, which is why the
 * distinction was invisible on a paper: a single-file article has one chapter, so every relation
 * fell on the same side and the encoding never varied. See the note on `debt` in
 * argdown-live-map.js.)
 *
 * Classic script, no build step: sets window.ArgdownExposition and exports for Node, so the
 * renderer, the page and the tests share one implementation.
 */
/** @param {any} global */
(function (global) {
"use strict";

/** Reading order: chapter first, then line. Claims that could not be placed have no rank and
 *  take no part — a relation with either end unplaced says nothing about the text's shape. */
function ranks(nodes) {
  var placed = (nodes || []).filter(function (n) { return n.pos && n.pos.line != null; });
  placed.sort(function (a, b) {
    return (a.pos.chapterIndex - b.pos.chapterIndex) || (a.pos.line - b.pos.line);
  });
  var map = {};
  for (var i = 0; i < placed.length; i++) map[placed[i].id] = i;
  return { rank: map, n: placed.length, placed: placed };
}

/** One entry per relation that has both ends placed.
 *
 *  `at` is where the CLAIM sits — the point in the text at which this support is spent, which is
 *  what "where does the argument land" means. `reach` is signed, in ranks.
 */
function reaches(edges, rank) {
  var out = [];
  for (var i = 0; i < (edges || []).length; i++) {
    var e = edges[i];
    var r = rank[e.from], c = rank[e.to];
    if (r == null || c == null) continue;
    out.push({ at: c, reach: r - c, attack: (e.type || "support") !== "support",
               from: e.from, to: e.to });
  }
  return out;
}

/** How far a relation must reach before its direction is worth remarking on.
 *
 *  Relative, so it means the same on a three-page paper and on a book, and floored so a very
 *  short reconstruction does not treat every edge as significant. */
function significant(n) { return Math.max(3, Math.round(n * 0.08)); }

/** Whether a relation puts the reader in debt: its reasons arrive after the claim they hold up. */
function isDebt(r) { return r.reach > 0; }

/** How many bins to cut a stretch of text into.
 *
 *  FEWER THAN IS TEMPTING. Thirty bins over fifty relations leaves most bins holding nothing and
 *  one or two holding everything, which draws as a flat line with an occasional spike — the
 *  reader sees noise where there is a shape. Roughly one bin per four claims gathers enough into
 *  each to make a curve, and the floor keeps a short section from being three fat blocks. */
function binCount(n) { return Math.max(8, Math.min(24, Math.round((n || 1) / 4))); }

/** The two-sided density: above the line, support that arrives after its claim; below, support
 *  already given. Weighted by span, binned along the text.
 *
 *  `range` rebases the horizontal axis onto a stretch of the text — a chapter or a section —
 *  instead of the whole reconstruction. WITHOUT IT A BAND'S MARK IS ALMOST ALL EMPTY: a section
 *  covering claims 10 to 20 of 62 puts every one of its relations into a sixth of the bins and
 *  leaves the rest at zero, so the picture is a flat line with a blip in it rather than the
 *  shape of that section. Rebasing is what makes a band's sparkline a zoom rather than a crop.
 */
function profile(rs, n, bins, range) {
  var lo = range ? range.from : 0;
  var hi = range ? range.to : Math.max(1, (n || 1) - 1);
  var span = Math.max(1, hi - lo);
  var B = bins || binCount(span + 1), up = [], dn = [], i;
  for (i = 0; i < B; i++) { up.push(0); dn.push(0); }
  for (i = 0; i < rs.length; i++) {
    var r = rs[i];
    var b = Math.min(B - 1, Math.max(0, Math.floor((r.at - lo) / span * B)));
    var w = Math.abs(r.reach) / (n || 1);
    if (r.reach > 0) up[b] += w; else dn[b] += w;
  }
  // SMOOTHED, lightly. A relation lands in one bin, but what it says about the text is true of
  // its neighbourhood; a 1-2-1 pass spreads it just enough that a curve emerges instead of a
  // picket fence, without inventing structure that is not there.
  var smooth = function (a) {
    var o = [];
    for (var k = 0; k < a.length; k++)
      o.push((a[Math.max(0, k - 1)] + 2 * a[k] + a[Math.min(a.length - 1, k + 1)]) / 4);
    return o;
  };
  up = smooth(up); dn = smooth(dn);
  var max = 0, all = [];
  for (i = 0; i < B; i++) {
    if (up[i] > max) max = up[i];
    if (dn[i] > max) max = dn[i];
    if (up[i] > 0) all.push(up[i]);
    if (dn[i] > 0) all.push(dn[i]);
  }
  // THE REFERENCE HEIGHT IS THE 80th PERCENTILE, not the tallest bin.
  //
  // These are weighted sums, and a weighted sum is dominated by its largest term: one bin where
  // a long relation lands can be several times the next, and scaling everything against it
  // leaves the whole mark hugging the axis with a single spike. Measured on the samples, that
  // put 3 of Williams's 30 half-bins above two-fifths of the height — a text chosen for being
  // lopsided, drawn as a flat line. Against the 80th percentile it is 23 of 30, and Horton and
  // Williams still look nothing like each other.
  //
  // The cost is that the top fifth of bins clip at full height, which is the ordinary bargain a
  // limiter makes: the peak stops saying exactly how big it is so that everything below it can
  // say anything at all.
  // ONE LINE, NOT TWO BANDS. Drawing the two directions as separate filled areas from a shared
  // midline looked right on paper and failed in practice: turned up loud enough to be legible,
  // both bands fill most of the height in most bins and the mark becomes a slab. A single net
  // curve is the ordinary shape of a sparkline, and reads.
  //
  // WHICH WAY IS UP, and why it is this way round. The obvious reading — up means the
  // justification reaches FORWARD through the text — quietly competes with the chart itself: the
  // horizontal axis IS the text, so "forward" already means rightward, and using height to say
  // it a second time makes the reader hold two spatial metaphors at once.
  //
  // The vertical axis is a LEDGER instead, which is what height conventionally carries and what
  // this program already called it: a claim asserted before its justification arrives puts the
  // reader in DEBT, and debt goes below the line. So
  //
  //     below   claims asserted here whose reasons come later — a promise the reader carries
  //     above   claims made here that their reasons have already earned
  //
  // What the net loses is a stretch doing a lot of both at once, which reads as zero. That is a
  // real loss and an acceptable one: such a stretch is not leaning either way, which is what a
  // flat line says.
  var net = [];
  for (i = 0; i < B; i++) net.push(dn[i] - up[i]);
  all.sort(function (a, b) { return a - b; });
  var mags = net.map(Math.abs).filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
  var ref = mags.length ? mags[Math.min(mags.length - 1, Math.floor(mags.length * 0.75))] : max;
  return { up: up, dn: dn, net: net, max: max, ref: ref || max || 1, bins: B };
}

/** Where a set of relations sits in the text, as a rank range. */
function extent(rs) {
  if (!rs.length) return null;
  var lo = rs[0].at, hi = rs[0].at;
  for (var i = 1; i < rs.length; i++) {
    if (rs[i].at < lo) lo = rs[i].at;
    if (rs[i].at > hi) hi = rs[i].at;
  }
  return { from: lo, to: hi };
}

/** Turn the volume up, with a limiter.
 *
 *  A power below one lifts the middle of the range without touching the ordering — the same move
 *  as a log axis, and for the same reason. 0.55 was picked against the three samples: 1.0 is
 *  invisible, 0.3 flattens the difference between a big excursion and a small one. `ref` is the
 *  80th-percentile height rather than the tallest bin (see `profile`), so the result is clamped:
 *  anything at or above that reference draws at full amplitude.
 */
function amplify(v, ref) {
  if (!(ref > 0)) return 0;
  return Math.min(1, Math.pow(v / ref, 0.55));
}

/** The same thing in a sentence, for a reader who would rather not read a chart.
 *
 *  `centre` is the weighted mean position of where the justifying work is DONE — where claims
 *  meet their reasons — as a fraction of the way through the text.
 *  `lean` runs from -1 (every claim earned before it is made) to +1 (every claim asserted first
 *  and argued for later, which is to say on credit).
 */
function verdict(rs, n) {
  var up = 0, dn = 0, csum = 0, wsum = 0;
  for (var i = 0; i < rs.length; i++) {
    var w = Math.abs(rs[i].reach) / (n || 1);
    if (rs[i].reach > 0) up += w; else dn += w;
    csum += (rs[i].at / (n || 1)) * w;
    wsum += w;
  }
  if (!wsum) return { centre: null, lean: 0, text: "no long-range support to describe" };
  var centre = csum / wsum, lean = (up - dn) / (up + dn);
  var where = centre > 0.62 ? "settles late"
            : centre < 0.42 ? "settles early" : "settles throughout";
  // `lean` is positive when the weight is DEBT — claims asserted ahead of their justification.
  // The reader-facing words stay temporal and neutral (INVENTORY A7, as re-amended): both
  // conventions ask something of a reader, and neither direction is graded.
  var how = lean > 0.2 ? "asserts, then argues — most reasons arrive after their claims"
          : lean < -0.2 ? "argues, then asserts — most reasons are given before their claims"
          : "some of each";
  return { centre: centre, lean: lean, where: where, how: how,
           text: where + " · " + how + " · the justifying is done by " +
                 Math.round(centre * 100) + "% through the text" };
}

/** The sparkline, as an SVG fragment.
 *
 *  ONE HUE, and the side of the line carries the whole distinction. Green and red already mean
 *  support and attack a few centimetres away on the same screen; a sparkline that used them for
 *  something else would be saying two things with one colour. Being a different kind of object
 *  from the map — a summary, not a relation — it should look like one.
 */
function sparkline(rs, n, opt) {
  var o = opt || {};
  var W = o.width || 170, H = o.height || 22, pad = o.pad == null ? 1.5 : o.pad;
  var p = profile(rs, n, o.bins, o.range || extent(rs));
  var mid = H / 2, amp = mid - pad;
  var x = function (i) { return pad + (i / (p.bins - 1 || 1)) * (W - 2 * pad); };
  var pts = [], i;
  for (i = 0; i < p.bins; i++) {
    var v = p.net[i];
    pts.push(x(i).toFixed(1) + "," +
             (mid - (v < 0 ? -1 : 1) * amplify(Math.abs(v), p.ref) * amp).toFixed(1));
  }
  return '<svg class="alm-spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H +
         '" aria-hidden="true">' +
         '<line x1="' + pad + '" y1="' + mid + '" x2="' + (W - pad) + '" y2="' + mid +
         '" class="alm-spark-axis"/>' +
         '<polygon points="' + pad + "," + mid + " " + pts.join(" ") + " " + (W - pad) + "," + mid +
         '" class="alm-spark-fill"/><polyline points="' + pts.join(" ") +
         '" class="alm-spark-line"/></svg>';
}

/** The same two bands as GEOMETRY rather than as markup.
 *
 *  The footer is HTML and takes the SVG string above; a band header is already inside an SVG and
 *  cannot nest one tidily, so it wants point lists it can hand to its own element builder. One
 *  computation, two shapes — not two implementations.
 *
 *  Returns null when there is nothing worth drawing: a band whose relations are all local has a
 *  flat line to show, and a flat line in a header is furniture that says nothing.
 */
function sparkPaths(rs, n, opt) {
  var o = opt || {};
  var W = o.width || 110, H = o.height || 14, pad = o.pad == null ? 1 : o.pad;
  // Rebased onto whatever stretch these relations occupy unless the caller says otherwise, so a
  // band's mark fills its own width instead of sitting in a sixth of it.
  var p = profile(rs, n, o.bins, o.range || extent(rs));
  if (!(p.max > 0)) return null;
  var mid = H / 2, amp = mid - pad;
  var x = function (i) { return pad + (i / (p.bins - 1 || 1)) * (W - 2 * pad); };
  var pts = [], i;
  for (i = 0; i < p.bins; i++) {
    var v = p.net[i];
    pts.push(x(i).toFixed(1) + "," +
             (mid - (v < 0 ? -1 : 1) * amplify(Math.abs(v), p.ref) * amp).toFixed(1));
  }
  return { width: W, height: H, mid: mid, line: pts.join(" "),
           area: pad + "," + mid + " " + pts.join(" ") + " " + (W - pad) + "," + mid };
}

/** Everything a caller needs for one stretch of text, in one call.
 *
 *  `keep` filters to the relations whose CLAIM falls inside a chapter or section — a relation
 *  belongs to the band where its support is spent, not where it comes from.
 */
function summarise(nodes, edges, keep) {
  var r = ranks(nodes);
  var all = reaches(edges, r.rank);
  var mine = keep ? all.filter(function (x) { return keep(x, r); }) : all;
  return { reaches: mine, n: r.n, verdict: verdict(mine, r.n), ranks: r };
}

var API = { ranks: ranks, reaches: reaches, profile: profile, verdict: verdict,
            sparkline: sparkline, sparkPaths: sparkPaths, summarise: summarise,
            significant: significant, extent: extent, binCount: binCount, amplify: amplify,
            isDebt: isDebt };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownExposition = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
