#!/usr/bin/env python3
"""Provenance analysis for Argdown reconstructions: quotations, line positions, debt.

Three things live here, used by check_argdown.py and by backfill_lines.py.

WHY QUOTATIONS NEED CHECKING. A reconstruction cannot otherwise distinguish the source's
words from the reconstructor's. Tolerable when mapping your own thinking; not tolerable
when mapping someone else's paper, where the reconstruction is itself a scholarly claim.
A fidelity marker that is merely ASSERTED is worth little -- so `quotation` is made
falsifiable: find the quoted string in the source, or say it is not there.

WHY LINE POSITIONS. The order in which claims appear in a text and the order in which they
justify one another are different structures, and the interesting places are where they
come apart. Section metadata is far too coarse to see that -- a section running to several
thousand words collapses to one point and the picture becomes a staircase. Locating a
quotation gives an exact line for free; everything else falls back to its section heading.

NOTE ON WHAT IS AND IS NOT THE FABULA. It is tempting to treat the justification DAG as the
"real" order that the text presents out of sequence. It is not. In narrative theory the
fabula has a determinate order; here there are three things -- the text's order, the
reconstructor's DAG, and the author's actual order of reasons, which is precisely what is
contested. The DAG is another arrangement, not the underlying truth. Hence the quotation
check: the justification order is an interpretation and should be legible as one.
"""

import difflib
import os
import re

# Quoted spans of at least this many characters are treated as quotations worth checking.
# Shorter runs are usually a scare-quoted term rather than a citation.
MIN_QUOTE = 10

QUOTED = re.compile(r'[“”"«]([^“”"»]{%d,})[“”"»]'
                    % MIN_QUOTE)

_SUBS = {
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "«": '"', "»": '"', "–": "-", "—": "-",
    "…": "...", " ": " ",
}


# Markup, not content. Emphasis around a quoted word is the commonest cause of a false
# "near miss": the manuscript says _obscure_ or *contrast* and the reconstruction quotes the
# bare word, which is a faithful quotation of what the sentence says. Argdown's own backslash
# escaping of `_` in statement text lands here too.
_INVISIBLE = set("*_`\\")


def normalise(text):
    """Fold the differences that do not matter, and report where each character came from.

    Returns (normalised_text, line_of[i]) so a match can be turned back into a line number.
    Whitespace runs collapse to one space; smart quotes, dashes and ellipses are
    folded; markdown emphasis is dropped.
    """
    norm, lines, _ = normalise_indexed(text)
    return norm, lines


def normalise_indexed(text):
    """As `normalise`, and additionally where each output character came from.

    `src_of[i]` is the index into the ORIGINAL text of the character that produced output
    character `i`. The quotation-context checks need it. They locate a span in normalised
    space -- which is the only space in which a quotation can be matched at all, since that is
    what folds smart quotes and line breaks -- and then have to read the SENTENCE around it in
    the real text, where the line breaks, headings and punctuation still exist. Without the
    map back, a quotation that stops one word short of its own refutation is indistinguishable
    from one that runs to the end of its sentence.
    """
    out, lines, src = [], [], []
    line = 1
    prev_space = False
    for i, ch in enumerate(text):
        if ch == "\n":
            line += 1
        if ch in _INVISIBLE:
            continue
        rep = _SUBS.get(ch, ch)
        if rep.isspace() or ch == "\n":
            if prev_space:
                continue
            out.append(" ")
            lines.append(line)
            src.append(i)
            prev_space = True
            continue
        prev_space = False
        for c in rep:
            out.append(c)
            lines.append(line)
            src.append(i)
    return "".join(out), lines, src


def quote_parts(quote):
    """Split a quotation on elision, and drop a trailing ellipsis.

    Authors quote with gaps: "I aim to show that approach 2 ... must ultimately collapse".
    Both halves must appear, in order, but not adjacently. A trailing ellipsis just means
    the quotation was cut short, so only the part before it is required.
    """
    q = normalise(quote)[0].strip()
    q = re.sub(r"\.{3,}\s*$", "", q).strip()
    parts = [p.strip() for p in re.split(r"\s*\.{3,}\s*", q) if p.strip()]
    return [p for p in parts if len(p) >= 4]


def find_quote(quote, source_text):
    """Locate a quotation in a source.

    Returns (status, line, detail) where status is one of:
      "exact"      -- found verbatim (after normalisation); line is where it starts
      "near"       -- not found, but something very like it is there; likely drift
      "absent"     -- nothing resembling it
    """
    parts = quote_parts(quote)
    if not parts:
        return ("absent", None, "quotation too short to check once elisions are removed")

    norm, line_of = normalise(source_text)
    hay = norm.lower()

    spans = _locate_parts(parts, hay)
    if spans:
        return ("exact", line_of[spans[0][0]], None)

    # Not found. Is something close to it present? Slide a window the length of the longest
    # part and keep the best match, so drift is reported as drift rather than fabrication.
    probe = max(parts, key=len)
    best, best_at = 0.0, None
    step = max(1, len(probe) // 4)
    for i in range(0, max(1, len(norm) - len(probe)), step):
        window = norm[i:i + len(probe)]
        r = difflib.SequenceMatcher(None, probe.lower(), window.lower()).ratio()
        if r > best:
            best, best_at = r, i
    if best >= 0.75 and best_at is not None:
        return ("near", line_of[best_at],
                f"closest match {best:.0%}: “{norm[best_at:best_at + len(probe)][:70]}…”")
    return ("absent", None, f"best resemblance anywhere in the file is only {best:.0%}")


def _locate_parts(parts, hay):
    """Every part of an elided quotation, in order, as (start, end) spans of `hay`.

    Returns None unless all of them are present in order. Factored out of `find_quote` because
    the quotation-context checks need the SPANS, not just the first line, and two copies of a
    search rule drift -- which here would mean the sentence printed beside a verdict came from
    a different occurrence than the one the verdict was about.
    """
    spans, pos = [], 0
    for part in parts:
        idx = hay.find(part.lower(), pos)
        if idx < 0:
            return None
        spans.append((idx, idx + len(part)))
        pos = idx + len(part)
    return spans


# --------------------------------------------------------------------------- #
# Quotation CONTEXT: what the quotation was taken away from
# --------------------------------------------------------------------------- #
#
# THE CHECK THIS EXISTS TO ADD. Verifying that a quoted span appears verbatim in its source
# establishes far less than it appears to. Stern's four illustrations of "misreporting" -- using
# an author's words to make it seem he is saying something he is certainly not saying -- quote
# ACCURATELY in three cases out of four, and every one of those three would come back `exact`:
#
#   * a hedged disjunct quoted while the author's own unhedged correction, in the same sentence,
#     is left outside the quotation marks;
#   * a partial claim ("some drives do x") quoted in support of a universal one, with the
#     "whereas some drives do the exact opposite" that follows it dropped;
#   * a passage quoted as evidence for a term the passage never uses.
#
# His structural point is that misreporting ADVERTISES a commitment to meaning through a
# recognised meaning-seeking technique -- direct quotation -- while sacrificing it: "the
# importance of the currency is necessarily assumed in the act of debasing it." A verbatim
# checker verifies the currency. It cannot see the debasement, because the debasement is
# entirely a matter of what the span was cut away FROM.
#
# So none of what follows is a judgement about a quotation. Every one of these is a fact about
# where the span sits in its own sentence, reported so the reconstructor can look at what they
# cut. A quotation that runs to the end of its sentence is silent here, which is most of them.
#
# (Stern's fourth case -- words replaced inside the span -- needs nothing new: it does not
# match, and comes back `near`. It is in the fixture as proof of that.)

# Tuned for PRECISION, not recall. A flag nobody reads is worse than no flag, and "or" and
# "while" are common enough in innocent continuations that a wider net would fire constantly.
# These are the connectives that mark the continuation as CORRECTING or CONTRADICTING what
# precedes it -- which is the only case worth interrupting the reader for.
CORRECTIVE = {
    "or", "but", "whereas", "although", "though", "yet", "however", "rather", "instead",
    "unless", "except", "nevertheless", "nonetheless", "albeit", "conversely",
    "not", "never", "no",
}
CORRECTIVE_PHRASES = (
    "more coarsely", "more clearly", "more precisely", "more exactly", "more accurately",
    "that is", "in fact", "in truth", "at least", "on the contrary", "strictly speaking",
    "to be precise", "properly speaking", "or rather",
)

# Words whose loss changes what was claimed. A dropped negation is the worst of them, and a
# dropped quantifier is Stern's second case exactly.
LEADING_HEDGES = {
    "some", "many", "most", "few", "several", "certain", "sometimes", "often", "usually",
    "typically", "generally", "occasionally", "perhaps", "maybe", "arguably", "seemingly",
    "apparently", "allegedly", "supposedly", "nearly", "almost", "roughly", "largely",
    "mostly", "partly", "possibly", "probably", "might", "may", "could", "seems", "appears",
    "not", "never", "hardly", "rarely", "seldom",
}

# How far apart the halves of an elided quotation may sit before the elision is doing work the
# reader cannot see. Two sentences or so.
MAX_ELISION = 200

_SENT_END = re.compile(r"""[.!?]["'\u201d\u2019)\]]*(?=\s|$)""")


def _block_bounds(raw, i, j):
    """The paragraph containing raw[i:j], with markdown headings as hard edges.

    Normalisation folds a heading into the paragraph after it. Without this, "does the
    quotation run to the end of its sentence" would read a heading and the sentence beneath it
    as one sentence, and every quotation of a section's first sentence would look truncated.
    """
    lo = raw.rfind("\n\n", 0, i)
    lo = 0 if lo < 0 else lo + 2
    hi = raw.find("\n\n", j)
    hi = len(raw) if hi < 0 else hi
    for m in re.finditer(r"(?m)^\#{1,6} .*$", raw[lo:hi]):
        s, e = lo + m.start(), lo + m.end()
        if e <= i:
            lo = max(lo, e)
        elif s >= j:
            hi = min(hi, s)
    return lo, hi


def sentence_bounds(raw, i, j):
    """The sentence containing raw[i:j], as indices into `raw`."""
    lo, hi = _block_bounds(raw, i, j)
    start = lo
    for m in _SENT_END.finditer(raw, lo, i):
        start = m.end()
    end = hi
    m = _SENT_END.search(raw, max(j - 1, lo), hi)
    if m:
        end = m.end()
    return start, end


_SUFFIXES = ("ations", "ation", "ingly", "ising", "izing", "ments", "ment", "ions", "ion",
             "ings", "ing", "edly", "ies", "ied", "ers", "er", "est", "ally", "ally", "ly",
             "es", "ed", "s")


# Function words that survive `content_words` but carry no claim. Local to the imported-term
# check: STOP itself is tuned for PARAGRAPH MATCHING, and widening it would move every claim's
# located position and put the Python and JS position rules out of step.
#
# `alone`, `merely` and `only` are deliberately NOT here. A quotation-fidelity claim that adds
# "alone" to what the source says has changed what was claimed, and that is the case this check
# is for -- on the Williams it is a true hit, not noise.
GLOSS_STOP = frozenset("""
those these thereby therefore thus hence whether while when where moreover further furthermore
itself himself herself themselves oneself upon without within against among between during
again still even quite rather already always never ever perhaps indeed however nonetheless
cannot shall must ought given makes make made take taken gives given goes come comes case cases
thing things point points way ways part parts kind kinds sort sorts terms sense means
""".split())


def _stem(w):
    """A crude stem, for asking whether a source uses a word AT ALL.

    Not linguistics -- just enough that `mixed` is not reported as absent from a text that says
    `mixes`. The check it serves asks whether a term appears nowhere in the cited file, and an
    inflection is the same term.
    """
    w = w.lower()
    for suf in _SUFFIXES:
        # 3, not 4: at 4 neither `mixed` nor `mixes` stemmed at all and the pair was still
        # reported as a term the source never uses. Over-stemming only makes the check more
        # permissive, which is the direction this particular error should lean.
        if len(w) - len(suf) >= 3 and w.endswith(suf):
            return w[:-len(suf)]
    return w


def _leading_word(head):
    """The last word before the quotation, if it is one whose loss changes the claim."""
    words = re.findall(r"[A-Za-z']+", head)
    if not words:
        return None
    last = words[-1].lower()
    return last if last in LEADING_HEDGES else None


def _continuation(tail):
    """The rest of the sentence, if it opens by correcting or contradicting what came before."""
    rest = tail.lstrip()
    rest = re.sub(r"^[,;:\u2014-]+\s*", "", rest)
    if not rest:
        return None
    low = rest.lower()
    for phrase in CORRECTIVE_PHRASES:
        if low.startswith(phrase):
            return rest
    first = re.match(r"[A-Za-z']+", low)
    if first and first.group(0) in CORRECTIVE:
        return rest
    return None


def quotation_context(doc, source_root, quote_results):
    """For every quotation that IS verbatim, what sits immediately around it in the source.

    Only `exact` quotations are examined: a quotation that does not match is already reported
    by `check_quotations`, and there is no span to read a sentence around.
    """
    merged = merged_statements(doc)
    cache, out = {}, []
    for q in quote_results:
        if q["status"] != "exact" or not q.get("chapter"):
            continue
        path = os.path.join(source_root, q["chapter"])
        if path not in cache:
            try:
                with open(path, encoding="utf-8", errors="replace") as fh:
                    cache[path] = fh.read()
            except OSError:
                cache[path] = None
        raw = cache[path]
        if raw is None:
            continue
        norm, _line_of, src_of = normalise_indexed(raw)
        spans = _locate_parts(quote_parts(q["quote"]), norm.lower())
        if not spans:
            continue

        # Widest elision the quotation bridges, measured in normalised characters.
        gap = max((b[0] - a[1] for a, b in zip(spans, spans[1:])), default=0)

        # EACH PART GETS ITS OWN SENTENCE. An elided quotation has no single sentence: taking
        # the span from the first part's start to the last part's end and asking for "the
        # sentence" containing it returned everything between them, headings included. What
        # the reconstructor cut is at the two OUTER edges -- what precedes the first part, and
        # what follows the last -- so each is read in its own sentence.
        i0 = src_of[spans[0][0]]
        j0 = src_of[spans[0][1] - 1] + 1
        i1 = src_of[spans[-1][0]]
        j1 = src_of[spans[-1][1] - 1] + 1
        a_start, a_end = sentence_bounds(raw, i0, j0)
        z_start, z_end = sentence_bounds(raw, i1, j1)
        head, tail = raw[a_start:i0], raw[j1:z_end]
        complete = not re.sub(r"""[\s.,;:!?"'\u201d\u2019)\]]+""", "", tail)

        rec = merged.get(q["title"], {})
        absent = []
        if (rec.get("data") or {}).get("fidelity") == "quotation":
            have = {_stem(w) for w in re.findall(r"[a-z]{4,}", norm.lower())}
            # STRIP TAGS FIRST. `#core`, `#background`, `#scope` and `#dispute` live in the
            # statement text, and reading them as the claim's own words made this fire on
            # nearly every quotation-fidelity claim in all three sample reconstructions --
            # reporting `core` as a term Gettier never uses. The check is for Stern's third
            # case, a term IMPORTED into the report of what the author explicitly claims;
            # a tag is the reconstructor's filing, not a word in the claim at all.
            body = re.sub(r"(?<!\S)\#[A-Za-z][\w-]*", " ", rec.get("text", ""))
            absent = sorted({w for w in content_words(body)
                             if w not in GLOSS_STOP and _stem(w) not in have},
                            key=len, reverse=True)

        nxt = raw[z_end:_block_bounds(raw, z_end, z_end)[1]].strip()
        out.append(dict(
            title=q["title"], quote=q["quote"], chapter=q["chapter"], line=q.get("line"),
            sentence=" ".join(raw[a_start:a_end].split()),
            sentence_last=(" ".join(raw[z_start:z_end].split())
                           if (z_start, z_end) != (a_start, a_end) else None),
            after=" ".join(nxt.split())[:160],
            complete=complete,
            dropped=_leading_word(head),
            continues=_continuation(tail),
            gap=gap if gap > MAX_ELISION else 0,
            absent_terms=absent,
        ))
    return out


# --------------------------------------------------------------------------- #
# Fidelity, warrants, and the declared reading policy
# --------------------------------------------------------------------------- #

FIDELITY_LEVELS = ("quotation", "paraphrase", "compression", "interpretation", "imputation")

# The levels at which the reconstructor's own philosophy has entered the reconstruction, and
# which therefore owe a reason. `compression` does not: reducing several sentences to one is
# still reporting.
DEPARTURES = ("interpretation", "imputation")

# Stern's account of what actually generates the "openness" a charitable reading then fills.
# A PROMPT, NOT A JAIL -- any other value is accepted and simply listed, because the point of
# the field is that the reason was written down, not that it fell into a taxonomy.
WARRANTS = {
    "enthymeme":      "the argument is invalid without it and plainly relies on it",
    "hyperbole":      "read as overstatement rather than as the position",
    "sloppy-phrasing": "read as imprecise expression of a different claim",
    "secret-sign":    "read as a signal to knowing readers rather than at face value",
    "other-texts":    "supported by what the author says elsewhere",
    "coherence":      "chosen because it makes the surrounding text hang together",
    "convention":     "the field's standard reading of this passage",
}

POLICY_VALUES = {
    "aim":      ("fit", "appropriation"),
    "unit":     ("meaning", "commitment"),
    "mode":     ("coherence", "truth", "soundness", "agreement", "interest"),
    "strength": ("minimal", "ordinary", "strong"),
}


def merged_nodes(doc):
    """Every claim AND every argument, with metadata merged across members.

    Arguments carry fidelity like any other node, and usually should: assembling premises into
    a numbered structure is the reconstructor's work even when every step is the author's.
    """
    out = dict(merged_statements(doc))
    for title, arg in (doc.get("arguments") or {}).items():
        rec = out.setdefault(title, dict(text="", data={}))
        for m in (arg.get("members") or []) + [arg]:
            if not rec["text"] and (m.get("text") or "").strip():
                rec["text"] = m["text"].strip()
            for k in PROVENANCE_FIELDS:
                v = (m.get("data") or {}).get(k)
                if rec["data"].get(k) is None and v is not None:
                    rec["data"][k] = v
    return out


def fidelity_of(doc):
    """Declared fidelity per node. Unmarked is left None, NOT defaulted to `compression`.

    The documented default is compression, and for drawing a node that is right. For measuring
    a reconstruction it is not: "the reconstructor did not say" and "the reconstructor said
    compression" are different facts, and collapsing them lets an unmarked file report as a
    scrupulously sourced one.
    """
    out = {}
    for title, rec in merged_nodes(doc).items():
        f = (rec.get("data") or {}).get("fidelity")
        out[title] = f if f in FIDELITY_LEVELS else None
    return out


# A claim shorter than this is not tested for being verbatim: a six-word claim can coincide with
# the source by accident, and calling that a quotation would be worse than asking.
MIN_VERBATIM = 30


# Two verbatim runs of at least this many characters, sitting this far apart in the source but
# adjacent in the claim, are a splice. Both thresholds are deliberately high: ordinary paraphrase
# shares short phrases with its source all the time, and a check that fires on those is a check
# nobody reads.
SPLICE_RUN = 40
SPLICE_GAP = 120


def spliced_claims(doc, source_root):
    """Claims that join two distant passages of the source without marking the join.

    THE CASE THIS CATCHES, and it is Stern's again. A claim can quote accurately twice and still
    misreport, by running two separated sentences together as though the author had written one.

    NOT AN ERROR BY ITSELF. A splice often captures an author's meaning better than either
    passage alone does, and compressing distant material is a legitimate thing for a
    reconstruction to do. The author's rule: say so in the claim's `note:`. What is not
    acceptable is leaving a reader to discover the join.
    The author of this map did it on his own paper: the source reads '...or the sciences. Rather,
    the philosophical methods...' and the claim ran the two halves together with the sentence
    boundary removed. Marked as an elision it is honest; unmarked it presents as continuous
    something the author wrote as two thoughts.

    The machinery for MARKED elisions already existed -- `quote_parts` splits on `...` and
    `MAX_ELISION` reports when the two halves sit too far apart. This is the same measurement for
    the unmarked case, where nothing declares that a join happened at all.

    Returns [(title, gap, left, right)] -- the two runs and how far apart they are in the source.
    """
    out = []
    cache = {}
    for title, rec in merged_nodes(doc).items():
        text = re.sub(r"(?<!\S)\#[A-Za-z][\w-]*", " ", rec.get("text") or "").strip()
        chapter = (rec.get("data") or {}).get("chapter")
        if not chapter or len(text) < SPLICE_RUN * 2:
            continue
        if "..." in text or "\u2026" in text:
            continue                      # the join IS marked; that is what we want
        if chapter not in cache:
            try:
                with open(os.path.join(source_root, chapter), encoding="utf-8",
                          errors="replace") as fh:
                    cache[chapter] = normalise(fh.read())[0].lower()
            except OSError:
                cache[chapter] = None
        body = cache[chapter]
        if not body:
            continue
        claim = normalise(text)[0].lower()
        blocks = [b for b in difflib.SequenceMatcher(None, claim, body, autojunk=False)
                  .get_matching_blocks() if b.size >= SPLICE_RUN]
        # HOW MUCH OF THE CLAIM IS THE SOURCE'S? A paraphrase that borrows a phrase from here
        # and a phrase from there is not misreporting -- it is a paraphrase, and synthesising
        # distant material is what compression IS. The problem is a claim made mostly OF the
        # source's words, joined without a mark, which reads as one continuous passage however
        # its fidelity is labelled. So the runs must account for most of the claim before this
        # says anything.
        covered = sum(b.size for b in blocks)
        if not claim or covered / len(claim) < 0.6:
            continue
        for a, b in zip(blocks, blocks[1:]):
            gap = b.b - (a.b + a.size)
            if gap >= SPLICE_GAP:
                out.append((title, gap, claim[a.a:a.a + a.size][-46:],
                            claim[b.a:b.a + b.size][:46]))
                break
    return out


def derived_quotation(doc, source_root):
    """Which claims ARE the source's words, computed rather than declared.

    WHY THIS IS COMPUTED AND NOT ASKED FOR. `quotation` is the one fidelity level with a fact of
    the matter: either a reader can find the claim, in these words, in the source, or they
    cannot. Asking for it produced a marker that was wrong 8 times in 14 on the Carroll and 4 in
    23 on the Horton -- always in the same direction, and for the same understandable reason. A
    claim carrying an exact quotation in its `source:` field FEELS like a quotation, and the
    distinction between *the claim is the words* and *the claim is supported by the words* is
    real but easy to elide while writing.

    Clarifying the instruction halved the rate and did not remove it. So the instruction is not
    the fix: the field is. `paraphrase`, `compression`, `interpretation` and `imputation` are
    judgements and stay declared; `quotation` is a fact and is now derived, on the same
    principle that made the quotation check falsifiable in the first place.

    NOT WRITTEN BACK INTO THE FILE. Computed fresh on every run, for the reason the line backfill
    was dropped: a stored value asserts something that goes quietly wrong the moment the source
    is edited, which is the failure this whole apparatus exists to prevent.

    Returns {title: True/False/None} -- None where the claim is too short to test or has no
    readable source.
    """
    out, cache = {}, {}
    for title, rec in merged_nodes(doc).items():
        text = re.sub(r"(?<!\S)\#[A-Za-z][\w-]*", " ", rec.get("text") or "").strip()
        chapter = (rec.get("data") or {}).get("chapter")
        if not chapter or len(text) < MIN_VERBATIM:
            out[title] = None
            continue
        if chapter not in cache:
            try:
                with open(os.path.join(source_root, chapter), encoding="utf-8",
                          errors="replace") as fh:
                    cache[chapter] = fh.read()
            except OSError:
                cache[chapter] = None
        body = cache[chapter]
        # EXACT **OR NEAR**, and the distinction matters. Measured across the six reference maps,
        # of 126 claims declared `quotation` the claim text came back 25 exact, 62 near and 38
        # absent. The 62 are light rewordings that make a quoted sentence stand alone -- Darwin's
        # "If during the long course of ages ..." with the "If" dropped -- and calling those
        # paraphrases would be pedantic and would empty the category of most of its members.
        #
        # The 38 ABSENT are the real thing: a summary in the reconstructor's own words wearing a
        # solid border, which tells a reader of the map that they are looking at the author's.
        out[title] = None if body is None else find_quote(text, body)[0] in ("exact", "near")
    return out


def fidelity_disputes(doc, source_root):
    """Where the declared fidelity and the computed one disagree.

    Two kinds, and only the first is an error:
      `overclaimed` -- declared `quotation`, but the claim's own words are not in the source.
                       Demonstrably wrong, and the correction is always `paraphrase` or weaker.
      `underclaimed` -- the claim IS verbatim but declares something weaker. Harmless, and
                       occasionally deliberate, but worth knowing: it is free precision lost.
    """
    fid = fidelity_of(doc)
    got = derived_quotation(doc, source_root)
    over = sorted(t for t, v in got.items() if v is False and fid.get(t) == "quotation")
    under = sorted(t for t, v in got.items()
                   if v is True and fid.get(t) not in (None, "quotation"))
    return over, under


def warrant_gaps(doc):
    """Departures from the text that do not say why, and the census of those that do.

    Returns (unwarranted, census, odd) where `unwarranted` lists interpretation/imputation
    nodes carrying no `warrant`, flagged for whether a prose `note` at least explains them.
    """
    nodes = merged_nodes(doc)
    fid = fidelity_of(doc)
    unwarranted, census, odd = [], {}, []
    for title, rec in nodes.items():
        data = rec.get("data") or {}
        w = data.get("warrant")
        f = fid.get(title)
        if f in DEPARTURES:
            if w:
                census[w] = census.get(w, 0) + 1
            else:
                unwarranted.append(dict(title=title, fidelity=f, note=bool(data.get("note"))))
        elif w:
            odd.append(dict(title=title, fidelity=f, warrant=w))
    return sorted(unwarranted, key=lambda d: (d["fidelity"], d["title"])), census, odd


def fidelity_rewrites(doc, source_root, quote_results=None):
    """What `--fix` would change: claim id -> (from, to), for the two adjudicable levels only.

    THE DEMOTION TARGET IS CHOSEN BY EVIDENCE, not guessed. The objection to writing a correction
    into someone's file was that the tool knows a claim is NOT a quotation without knowing which
    weaker level applies -- and `paraphrase` (a close restatement) is a stronger claim than
    `compression` (several sentences reduced to one), so defaulting to it can still overclaim.

    But the file says which. A claim carrying a `source:` quotation that verifies is a rewording
    of a specific passage: that is a paraphrase. A claim carrying none is standing in for material
    the reconstructor gathered: that is a compression. So the tool picks on what is there rather
    than on a default, and the residual judgement is gone.

    `interpretation` and `imputation` are never touched. They are judgements about the reading,
    not facts about the words, and no evidence in the source bears on them.
    """
    verified = {q["title"] for q in (quote_results or []) if q["status"] == "exact"}
    got = derived_quotation(doc, source_root)
    declared = fidelity_of(doc)
    out = {}
    for title, verbatim in got.items():
        was = declared.get(title)
        if was in ("interpretation", "imputation"):
            continue
        if verbatim is True and was != "quotation":
            out[title] = (was, "quotation")
        elif verbatim is False and was == "quotation":
            out[title] = (was, "paraphrase" if title in verified else "compression")
    return out


def apply_fidelity_rewrites(path, rewrites):
    """Rewrite the markers in place. Returns the ids actually changed.

    READ-MODIFY-WRITE on the claim's OWN metadata block. A claim id appears wherever the file
    references it (`+ [claim]`), and only its DEFINITION carries metadata -- rewriting the first
    match instead corrected six markers out of thirty-eight and silently missed the rest.
    """
    text = open(path, encoding="utf-8").read()
    done = []
    for cid, (was, now) in rewrites.items():
        pat = 'fidelity: "%s"' % was if was else None
        for m in re.finditer(r"\[" + re.escape(cid) + r"\]\s*:", text):
            nxt = re.search(r"(?m)^\s*(?:[+\-]>?\s*)?(?:\(\d+\)\s*)?\[[^\]]+\]\s*:",
                            text[m.end():])
            end = m.end() + (nxt.start() if nxt else min(len(text) - m.end(), 2000))
            seg = text[m.end():end]
            if pat and pat in seg:
                text = text[:m.end()] + seg.replace(pat, 'fidelity: "%s"' % now, 1) + text[end:]
                done.append(cid)
                break
            if not pat and "fidelity:" not in seg and "{" in seg:
                seg2 = seg.replace("{", '{fidelity: "%s", ' % now, 1)
                text = text[:m.end()] + seg2 + text[end:]
                done.append(cid)
                break
    if done:
        open(path, "w", encoding="utf-8").write(text)
    return done


def reconstruction_policy(path):
    """The declared reading policy, and any values outside the documented vocabulary.

    Returns (policy, unknown). An absent block is not an error -- it is the thing to report.
    """
    fm = read_frontmatter(path) or {}
    pol = fm.get("reconstruction")
    if not isinstance(pol, dict):
        return None, []
    unknown = [(k, v) for k, v in pol.items()
               if k in POLICY_VALUES and v not in POLICY_VALUES[k]]
    unknown += [(k, v) for k, v in pol.items() if k not in POLICY_VALUES]
    return pol, unknown


# --------------------------------------------------------------------------- #
# Interpretive load: how much of the argument is the reconstructor's own
# --------------------------------------------------------------------------- #

def interpretive_load(doc):
    """Per contention: the fewest of the reconstructor's own claims any route to it passes.

    THE QUESTION. Fidelity records, node by node, how far each claim sits from the source's
    words. It does not say what that adds up to. The thing a reader of a reconstruction wants
    to know is whether the argument reaching the thesis can be run on reported material at all,
    or whether every route to it goes through claims the author never made. Stern's "third
    thing" -- neither the philosopher's words nor the interpreter's own view, but an unowned
    hybrid -- is exactly the second case, and this is what it looks like in a graph.

    Zero means some route to this contention uses only reported material; it does not mean the
    argument is good, and it does not mean the route is the interesting one. Above zero means
    EVERY route passes through the reconstructor, and the number is how many of their claims
    the cheapest route needs.

    NOT a criticism. A paper whose whole contribution is a reading will score above zero
    everywhere, correctly. That is what `aim: appropriation` declares in front matter, and it
    is why the number is reported beside the declaration rather than on its own.
    """
    fid = fidelity_of(doc)
    own = {t: 1 if fid.get(t) in DEPARTURES else 0 for t in merged_nodes(doc)}

    kids = {}
    for a, b, kind in title_edges(doc):
        own.setdefault(a, 0)
        own.setdefault(b, 0)
        if kind == "support":
            kids.setdefault(b, []).append(a)

    contrib = contribution(doc)
    apex = sorted(t for t, c in contrib.items() if c["apex"])

    # Cheapest route from t down to a leaf, counting the reconstructor's own claims on the way.
    # A cycle has no finite cheapest route; it is also a genuine defect nothing else here looks
    # for, so it is returned rather than silently treated as a dead end.
    memo, busy, cycles = {}, set(), []

    def cost(t):
        if t in memo:
            return memo[t]
        if t in busy:
            cycles.append(t)
            return None
        busy.add(t)
        best, via = None, None
        for c in kids.get(t, []):
            sub = cost(c)
            if sub is None:
                continue
            if best is None or sub[0] < best:
                best, via = sub[0], c
        busy.discard(t)
        memo[t] = (own.get(t, 0) + best, via) if best is not None else (own.get(t, 0), None)
        return memo[t]

    out = []
    for c in apex:
        # THE CONTENTION'S OWN FIDELITY IS REPORTED SEPARATELY, and it is not folded into the
        # load. `load` answers "how much of the argument REACHING this is mine"; whether the
        # contention itself is mine is a different and larger fact. Carroll states no conclusion
        # anywhere, so the contention of any map of him is an imputation -- and with only the
        # load reported that map read 0, the cleanest possible score, while resting on a claim
        # its author never made.
        own_fid = fid.get(c)
        routes = [(cost(k), k) for k in kids.get(c, [])]
        routes = [(r, k) for r, k in routes if r is not None]
        if not routes:
            out.append(dict(contention=c, load=None, path=[], fidelity=own_fid))
            continue
        (best, _), first = min(routes, key=lambda rk: rk[0][0])
        path, node = [], first
        while node is not None:
            path.append(node)
            node = (memo.get(node) or (0, None))[1]
        out.append(dict(contention=c, load=best, path=path, fidelity=own_fid))

    # Departures that nothing supports AND that hold something up: premises supplied by the
    # reconstructor and argued for nowhere. These are the joints the reading hangs from.
    #
    # BOTH HALVES ARE NEEDED. Requiring only "nothing supports it" listed every objection in
    # all three sample reconstructions -- `begs-the-question`, `closure-can-be-denied`,
    # `domestication-disanalogy` -- as though they were load-bearing premises. An objection
    # reaches the argument by ATTACKING it, holds nothing up, and is the reconstructor openly
    # disagreeing rather than quietly assuming. Publishing those as the assumptions the reading
    # rests on would be the same error the `inert` cut list nearly made.
    holds_up = {}
    for a, b, kind in title_edges(doc):
        if kind == "support":
            holds_up[a] = holds_up.get(a, 0) + 1
    leaves = sorted(
        (dict(title=t, supports=holds_up.get(t, 0), fidelity=fid.get(t))
         for t in own
         if fid.get(t) in DEPARTURES and not kids.get(t) and holds_up.get(t)),
        key=lambda d: (-d["supports"], d["title"]))

    # Inferences the reconstructor drew, as opposed to premises they supplied. An argument node
    # never appears in the edge graph -- `title_edges` resolves it to its main conclusion -- so
    # it can never be a leaf, and a marked one would otherwise go unreported.
    inferences = sorted(t for t in (doc.get("arguments") or {}) if fid.get(t) in DEPARTURES)

    marked = sum(1 for t in fid if fid[t])
    return dict(contentions=out, leaves=leaves, inferences=inferences,
                cycles=sorted(set(cycles)),
                marked=marked, total=len(fid),
                census={f: sum(1 for v in fid.values() if v == f) for f in FIDELITY_LEVELS})


def iter_members(doc):
    """Every statement member in the JSON export, with its title."""
    for title, st in (doc.get("statements") or {}).items():
        for m in st.get("members") or []:
            yield title, m


PROVENANCE_FIELDS = ("chapter", "section", "line", "lineSource", "source",
                     "fidelity", "warrant", "note")


def read_frontmatter(path):
    """The `===` fenced block at the top of an .argdown file, as a dict.

    THE CLI'S JSON EXPORT DROPS FRONT MATTER -- `argdown json` returns arguments, statements,
    relations, sections and tags, and nothing else -- so it has to be read from the file. The
    core parser's own response DOES carry `frontMatter`, which is what the JS side uses; only
    this half needs its own reader, and the two must agree.

    Deliberately a small hand parser rather than a YAML dependency: what it has to understand is
    `defaults:` and one level of `key: "value"` beneath it.
    """
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return {}
    # SKIP A COMMENT HEADER FIRST. Every reconstruction in this repo opens with a `//` block
    # explaining the argument's form, and `re.match` anchored at index 0 silently returned {}
    # for any such file -- so `defaults:` stopped applying the moment a file was documented,
    # every claim reported "no chapter", and the whole map dropped out of the Order view with
    # no error anywhere. VERIFIED against the CLI: it honours a frontmatter block placed after
    # comments exactly as it honours one at the top, so the two readers disagreed, and the
    # file-parsing half was the wrong one.
    head = re.match(r"(?:\s*(?://[^\n]*\n|/\*.*?\*/\s*))*", text, re.S)
    text = text[head.end():] if head else text
    mo = re.match(r"\s*===\s*\n(.*?)\n===\s*(\n|$)", text, re.S)
    if not mo:
        return {}
    out, section, indent = {}, None, None
    for line in mo.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        lead = len(line) - len(line.lstrip())
        kv = re.match(r"\s*([\w-]+)\s*:\s*(.*)$", line)
        if not kv:
            continue
        key, val = kv.group(1), kv.group(2).strip()
        if not val:
            section, indent = key, lead
            out.setdefault(key, {})
            continue
        # STRIP A TRAILING INLINE COMMENT. The scaffolded `reconstruction:` block carries one on
        # every line -- `aim: fit   # fit | appropriation` -- and without this the value read is
        # the whole rest of the line, so every declared dimension came back as a word outside
        # its own vocabulary. Quoted values are taken between the quotes, which handles a
        # comment after the closing quote too; `chapter: "x.md"  # the source` previously
        # survived `.strip('"')` as `x.md"  # the source` and pointed at no file.
        if val[:1] in ("\"", "'"):
            end = val.find(val[0], 1)
            val = val[1:end] if end > 0 else val[1:]
        else:
            val = re.split(r"\s+#", val, 1)[0].strip().strip('"').strip("'")
        if section is not None and lead > indent:
            out[section][key] = val
        else:
            section = None
            out[key] = val
    return out


def apply_defaults(doc, defaults):
    """Fill in provenance every claim would otherwise have to repeat.

    `chapter` is identical on every claim of a single-source reconstruction and `reviewed` is
    the date of the pass -- together about 15% of the bytes of a finished map, typed once per
    claim and wrong the moment a file is renamed. Declared once in front matter instead:

        ===
        defaults:
          chapter: "source/the-paper.md"
          reviewed: "2026-08-18"
        ===

    A value written ON a claim always wins, so a map drawing on two sources still says which is
    which where it matters. Applied to the parsed document rather than to the text, so what the
    CLI validates is ordinary Argdown either way.
    """
    d = (defaults or {}).get("defaults") or {}
    if not d:
        return doc
    for st in (doc.get("statements") or {}).values():
        for m in (st.get("members") or []) + [st]:
            data = m.setdefault("data", {}) if isinstance(m.get("data"), dict) or "data" not in m \
                else m["data"]
            if isinstance(data, dict):
                for k, v in d.items():
                    data.setdefault(k, v)
    for arg in (doc.get("arguments") or {}).values():
        for m in (arg.get("members") or []) + [arg]:
            if isinstance(m.get("data"), dict) or "data" not in m:
                m.setdefault("data", {})
                for k, v in d.items():
                    m["data"].setdefault(k, v)
    return doc


def merged_statements(doc):
    """Per claim: its text, and its provenance metadata gathered across ALL its members.

    A claim is an equivalence class, and its members are every place the .argdown mentions it:
    the definition that carries `{chapter: ...}` and every bare `+ [claim]` reference elsewhere,
    which carries nothing. Reading only the FIRST member therefore loses the metadata of any
    claim referenced before it is defined -- which on the book map silently unplaced several
    well-connected claims, `iteration` (7 edges, #core) among them, and made them look like
    reconstruction gaps when the metadata was there all along.

    First non-null wins per field, so a definition still beats a later restatement.
    """
    out = {}
    for title, st in (doc.get("statements") or {}).items():
        rec = out.setdefault(title, dict(text="", data={}))
        for m in (st.get("members") or []) + [st]:
            if not rec["text"] and (m.get("text") or "").strip():
                rec["text"] = m["text"].strip()
            d = m.get("data") or {}
            for k in PROVENANCE_FIELDS:
                if rec["data"].get(k) is None and d.get(k) is not None:
                    rec["data"][k] = d[k]
    return out


def locate_elsewhere(quote, source_root, exclude, order=None):
    """Which OTHER chapter holds this quotation verbatim, if any. (chapter, line) or None.

    THE ONE THING A RECONSTRUCTION CANNOT SURVIVE IS MATERIAL MOVING BETWEEN FILES. Measured on
    the book, ordinary drafting costs nothing at all -- typo fixes, rewrites, insertions,
    deletions, reordering paragraphs, even renaming a heading all leave 100% of claims on the
    passage they were on, because positions are recomputed from the live text and the section is
    only a search narrowing. But `chapter:` is a PATH, and a path either resolves or does not: move
    a section into another file and every claim citing the old one is orphaned at once.

    Until now the tool could only say the quotation was absent, and the author had to find where
    it went by hand. Since the other chapters are right there, it can say where instead -- which
    turns a silent orphaning into a one-line correction.

    ONLY EXACT MATCHES COUNT. A near match in a different file is not evidence of a move; it is
    two passages that resemble each other, which in a book about one subject is unremarkable. A
    suggestion has to be safe to act on without re-reading the chapter, or it is worse than none.
    """
    for chapter in (order or []):
        if chapter == exclude:
            continue
        try:
            with open(os.path.join(source_root, chapter), encoding="utf-8",
                      errors="replace") as fh:
                text = fh.read()
        except OSError:
            continue
        status, line, _detail = find_quote(quote, text)
        if status == "exact":
            return chapter, line
    return None


def check_quotations(doc, source_root):
    """Verify every quoted span against the source file its claim cites.

    Quotations appear in two places in practice: inside the statement text, and inside the
    `source:` metadata, which is where a reconstruction usually parks the author's exact
    words. Both are checked.
    """
    results = []
    cache = {}
    # Fall back to the claim's own chapter when the member carrying the quotation has none:
    # a `+ [claim]` reference repeating the text is not a claim about a different source, and
    # reporting it as "no-chapter" is a false alarm about the reconstructor's own file.
    merged = merged_statements(doc)
    for title, m in iter_members(doc):
        data = m.get("data") or {}
        chapter = data.get("chapter") or merged.get(title, {}).get("data", {}).get("chapter")
        for field in ("text", "source"):
            blob = m.get("text") if field == "text" else data.get("source")
            if not blob:
                continue
            for mo in QUOTED.finditer(blob):
                quote = mo.group(1)
                if not chapter:
                    results.append(dict(title=title, field=field, quote=quote,
                                        chapter=None, status="no-chapter", line=None,
                                        detail="claim cites no chapter, so nothing to check against"))
                    continue
                path = os.path.join(source_root, chapter)
                if path not in cache:
                    try:
                        with open(path, encoding="utf-8", errors="replace") as fh:
                            cache[path] = fh.read()
                    except OSError as e:
                        cache[path] = None
                        cache[path + "::err"] = str(e)
                text = cache[path]
                if text is None:
                    results.append(dict(title=title, field=field, quote=quote,
                                        chapter=chapter, status="missing-file", line=None,
                                        detail=cache.get(path + "::err", "unreadable")))
                    continue
                if not text.strip():
                    results.append(dict(title=title, field=field, quote=quote,
                                        chapter=chapter, status="empty-file", line=None,
                                        detail="the cited file is empty"))
                    continue
                status, line, detail = find_quote(quote, text)
                rec = dict(title=title, field=field, quote=quote,
                           chapter=chapter, status=status, line=line, detail=detail)
                # NOT HERE -- SO WHERE? Only asked when the cited file failed to produce it, so
                # the common case costs nothing: a book with everything in its place never opens
                # a second file.
                if status in ("absent", "missing-file", "empty-file"):
                    order = _chapter_order(doc, source_root)
                    found = locate_elsewhere(quote, source_root, chapter, order)
                    if found:
                        rec["moved_to"], rec["moved_line"] = found
                results.append(rec)
    return results


def _chapter_order(doc, source_root, _cache={}):
    """Every markdown file that could hold a displaced quotation, best candidates first.

    THE CITED ORDER IS NOT ENOUGH, and the reason is worth stating because it defeated the first
    version: `reading_order` falls back to "the chapters the reconstruction cites", and a claim
    whose `chapter:` is wrong is BY DEFINITION not citing the file its words are now in. Splitting
    a paper in two and re-running found nothing at all, because the new half was not on the list.

    So the search is over what is on DISK: the project's own order first, since that is the
    manuscript as its author describes it, then any other markdown beside it.
    """
    key = os.path.abspath(source_root)
    if key not in _cache:
        cited = []
        for _t, m in iter_members(doc):
            ch = (m.get("data") or {}).get("chapter")
            if ch and ch not in cited:
                cited.append(ch)
        order = list(reading_order(source_root, cited))
        for dirpath, dirs, files in os.walk(source_root):
            # NOT WORKING FILES. The converter leaves `.raw-extraction.txt` beside every source,
            # and it contains the whole paper -- so the first version of this cheerfully advised
            # pointing twenty-three claims at a hidden scratch dump. A suggestion the author
            # should not take is worse than none, because it costs them the time to see why.
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "Old versions"]
            for f in sorted(files):
                if f.startswith(".") or not f.lower().endswith((".md", ".markdown")):
                    continue
                rel = os.path.relpath(os.path.join(dirpath, f), source_root)
                if rel not in order:
                    order.append(rel)
        _cache[key] = order
    return _cache[key]


def heading_lines(source_root, chapter):
    """Map each markdown heading in a source file to its line number."""
    return {h["text"]: h["line"] for h in reversed(heading_index(source_root, chapter))}


def heading_index(source_root, chapter):
    """Every markdown heading in a source file: line, level and text, in document order."""
    path = os.path.join(source_root, chapter)
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            lines = fh.readlines()
    except OSError:
        return []
    out = []
    for i, ln in enumerate(lines, 1):
        mo = re.match(r"^(#{1,6})\s+(.*?)\s*(?:\{.*\})?\s*$", ln)
        if mo:
            out.append(dict(line=i, level=len(mo.group(1)), text=mo.group(2).strip()))
    return out


# --------------------------------------------------------------------------- #
# Paragraph location: which paragraph OF ITS OWN SECTION a claim came from
# --------------------------------------------------------------------------- #
#
# The section heading is far too coarse to be an x-axis. On the book map 324 of 339 claims
# resolved to a heading, which put 336 claims at 94 distinct positions and stacked 19 of them
# on one -- so 154 of 265 support edges had both ends at the same point and drew as stubs.
# The exposition-order picture that whole strand exists to produce was a staircase.
#
# The fix is to score each PARAGRAPH of the claim's section against the claim's own words and
# take the best. Two constraints make it safe rather than clever:
#
#   * The search is confined to the claim's own section. The author said which section the
#     claim belongs to; this only asks WHERE IN IT. So the locator can refine a position but
#     never contradict the metadata, and can never move a claim out of the cluster the map
#     draws it in. A claim whose section says one thing and whose words match another is a
#     problem for the reconstructor to fix, not for a heuristic to paper over.
#   * It is computed fresh on every run, never written back. A stored line number is a claim
#     about a manuscript that is still being edited, and would be quietly wrong the first time
#     a paragraph moved -- the exact failure this strand exists to prevent.
#
# Below MIN_SCORE the claim keeps its heading position. That is not a failure: a claim that
# compresses a whole section genuinely belongs at the top of it.

MIN_SCORE = 0.30
MIN_PARA = 120          # characters; shorter lines are headings, list stubs and stray notes

STOP = frozenset("""
the a an of and or to in is are be that this it as for with on by not but its which what who
whom whose can could would should may might must will shall do does did have has had from at
than then so if we our they their them there here about into over under more most less least
such no nor only own same too very just also one two both each any all some other others being
been was were
""".split())


def content_words(text):
    """The words a claim and a paragraph can be compared on.

    Four letters and up, which drops the articles and prepositions that any two sentences of
    English share; then an explicit stop list for the long function words that survive it.
    """
    return [w for w in re.findall(r"[a-z]{4,}", (text or "").lower()) if w not in STOP]


def section_span(headings, section, total_lines):
    """The line range of a named section: from its heading to the next of the same or higher
    level. Nested subsections stay inside their parent, which is what a claim tagged with the
    parent section should be searched against."""
    for i, h in enumerate(headings):
        if h["text"] != section:
            continue
        end = total_lines
        for nxt in headings[i + 1:]:
            if nxt["level"] <= h["level"]:
                end = nxt["line"] - 1
                break
        return h["line"], end
    return None


def locate_paragraph(claim_text, lines, lo, hi):
    """The line of the paragraph in lines[lo-1:hi] that best matches the claim.

    Returns (line, score), or (None, 0.0) when nothing in range clears MIN_SCORE. Ties go to
    the earliest paragraph, so a claim restated later in a section is placed where it is first
    made.
    """
    want = {}
    for w in content_words(claim_text):
        want[w] = want.get(w, 0) + 1
    total = sum(want.values())
    if not total:
        return (None, 0.0)
    best, best_line = 0.0, None
    for i in range(max(1, lo), min(hi, len(lines)) + 1):
        raw = lines[i - 1].strip()
        if len(raw) < MIN_PARA or raw.startswith("#"):
            continue
        have = set(content_words(raw))
        score = sum(c for w, c in want.items() if w in have) / total
        if score > best:
            best, best_line = score, i
    return (best_line, best) if best >= MIN_SCORE else (None, best)


def resolve_lines(doc, source_root, quote_results=None, locate=True):
    """Best available source line for every claim.

    Precision, best first: a located quotation gives the exact line; a hand-written `{line: N}`
    is taken as declared; otherwise the claim's section is found and the best-matching
    PARAGRAPH within it located; failing that the section heading gives the top of the passage.
    Every position is labelled with how it was got, so a reader can tell how much weight it
    bears -- and so the map can draw the difference.

    `locate=False` disables the paragraph search and restores heading-level positions, which
    is what the cross-check against the JS implementation compares against.
    """
    exact = {}
    for r in (quote_results or []):
        if r["status"] == "exact" and r["line"]:
            exact.setdefault(r["title"], r["line"])

    headings, bodies = {}, {}

    def source_lines(chapter):
        if chapter not in bodies:
            try:
                with open(os.path.join(source_root, chapter), encoding="utf-8",
                          errors="replace") as fh:
                    bodies[chapter] = fh.read().splitlines()
            except OSError:
                bodies[chapter] = []
        return bodies[chapter]

    out = {}
    for title, rec in merged_statements(doc).items():
        data = rec["data"]
        chapter, section = data.get("chapter"), data.get("section")
        if title in exact:
            out[title] = dict(line=exact[title], source="quotation", chapter=chapter)
            continue
        if data.get("line"):
            out[title] = dict(line=int(data["line"]), source=data.get("lineSource", "declared"),
                              chapter=chapter)
            continue
        if chapter and section:
            if chapter not in headings:
                headings[chapter] = heading_index(source_root, chapter)
            span = section_span(headings[chapter], section, len(source_lines(chapter)))
            if span:
                lo, hi = span
                if locate:
                    ln, _ = locate_paragraph(rec["text"], source_lines(chapter), lo + 1, hi)
                    if ln:
                        out[title] = dict(line=ln, source="paragraph", chapter=chapter)
                        continue
                out[title] = dict(line=lo, source="heading", chapter=chapter)
                continue
        # WHOLE-FILE FALLBACK -- what makes byte-faithful sources workable.
        #
        # Sources no longer carry inserted headings, so a paper printed as continuous prose
        # offers no section to scope by. Before this, every such claim dropped to `chapter-only`,
        # which is no position at all: on the Williams that was 23 of 62 claims, and on the
        # Gettier 6 of 33, all piled at the top of their file.
        #
        # The scoping was a safety rail, not a precondition. MEASURED on the Williams while its
        # editorial headings were still present: of the 21 claims with a section and no
        # quotation, 20 land on exactly the SAME paragraph when the search runs over the whole
        # file instead. So the rail costs one claim and buys byte-faithful sources.
        #
        # Kept behind `locate` like the scoped search, and mirrored in argdown-positions.js --
        # ONE rule in two languages, which test_argdown_positions.mjs exists to keep in step.
        if chapter and locate and source_lines(chapter):
            ln, _ = locate_paragraph(rec["text"], source_lines(chapter), 1,
                                     len(source_lines(chapter)))
            if ln:
                out[title] = dict(line=ln, source="paragraph", chapter=chapter)
                continue
        if chapter:
            out[title] = dict(line=None, source="chapter-only", chapter=chapter)
    return out


# --------------------------------------------------------------------------- #
# Where a claim sits in the text, and how far its support is from it
# --------------------------------------------------------------------------- #

# A project file is looked for under these names, in this order. `argdown-project.yml` is the
# native one; `_quarto.yml` is read as well so a Quarto user needs to write nothing new.
#
# NO LEADING UNDERSCORE on the native name, deliberately: `@argdown/node` ignores `**/_*`
# relative to the working directory, so an `_argdown-project.yml` would be invisible from some
# directories and fine from others -- the same trap that makes `_argument.argdown` unfindable.
PROJECT_FILES = ("argdown-project.yml", "argdown_project.yml",
                 "argdown-project.yaml", "argdown_project.yaml", "_quarto.yml")


def parse_project(text):
    """The ordered source files in a project file, and any `part:` groupings.

    ONE PARSER FOR BOTH SHAPES. Quarto nests its list under `book:`; the native file puts
    `chapters:` at the top level. They are otherwise the same idea, which is the point -- a
    Quarto user can paste their block across, and anyone else writes six lines.

        title: My Book
        chapters:
          - intro.md
          - part: Part One
            chapters:
              - a.md

    Quoting is optional. The old reader required it and silently returned NOTHING for a file
    written without quotes, which is how most people write YAML.
    """
    order, parts, title = [], [], None
    depth_of_chapters = None
    part_indent = None
    part = None
    for line in (text or "").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        mo = re.match(r"^\s*title:\s*[\"']?(.+?)[\"']?\s*$", line)
        if mo and title is None:
            title = mo.group(1)
        if re.match(r"^\s*chapters:\s*$", line):
            if depth_of_chapters is None:
                depth_of_chapters = indent
            continue
        # ANY key at or outside the list's own indent ends it -- with a value or without.
        # Testing only for valueless keys let `date: now` through, and a `- "file.md"` after it
        # was collected as a chapter. The old reader used "any unindented line", which is the
        # same intent stated more bluntly.
        if depth_of_chapters is not None and indent <= depth_of_chapters and \
                re.match(r"^\s*[\w-]+\s*:", line) and not re.match(r"^\s*chapters\s*:", line):
            depth_of_chapters = None                      # left the list
            continue
        mo = re.match(r"^\s*-\s*part:\s*[\"']?(.+?)[\"']?\s*$", line)
        if mo:
            part = mo.group(1)
            parts.append(dict(name=part, chapters=[]))
            part_indent = indent
            continue
        mo = re.match(r"^\s*-\s*[\"']?([^\"'#]+?\.(?:md|qmd|markdown|txt))[\"']?\s*$", line)
        if mo and depth_of_chapters is not None:
            name = mo.group(1).strip()
            order.append(name)
            # A FILE AT TOP LEVEL AFTER A PART BLOCK IS NOT IN THAT PART. Assigning every item
            # to `parts[-1]` put this book's Afterword -- listed at top level after Part III --
            # inside Part III, reported as 6 chapters where the file lists 5. The reading order
            # was right throughout; only the grouping was wrong, which shows up as a band drawn
            # round the wrong thing rather than as anything failing.
            #
            # Membership is decided against the indent of the `- part:` LINE, not against the
            # first item seen: a file listed under a part is indented past it, one that has
            # returned to book level is not. Keying off the first item instead broke a project
            # whose very first entry was a part, which has no top-level item to learn from.
            if parts and part_indent is not None and indent > part_indent:
                parts[-1]["chapters"].append(name)
    return dict(order=order, parts=parts, title=title)


def read_project(source_root, cited=None):
    """The manuscript's reading order, however the user has expressed it -- or none at all.

    THE SINGLE-FILE CASE MUST NEED NO CONFIGURATION. Requiring a project file to state the
    reading order of one file is absurd, and it was a hard error: the viewer builder refused to
    build at all without `_quarto.yml`. Reconstructing one paper is the common case and now
    needs nothing but the paper.

    Resolution, in order:
      1. `argdown-project.yml` (or `.yaml`) beside the sources -- the native project file;
      2. `_quarto.yml` -- so an existing Quarto project keeps working untouched;
      3. the chapters the reconstruction itself cites, in the order it first cites them.

    Rule 3 is exactly right for one file and defensible for several: it is the reconstructor's
    own sequence, which beats sorting paths alphabetically -- alphabetical order is not reading
    order, and that was the reason this function existed in the first place. The rule used is
    returned so the caller can say which it was rather than leaving the reader to guess.
    """
    for name in PROJECT_FILES:
        path = os.path.join(source_root, name)
        try:
            with open(path, encoding="utf-8") as fh:
                got = parse_project(fh.read())
        except OSError:
            continue
        if got["order"]:
            return dict(got, rule=name, path=path)
    cited = list(dict.fromkeys(cited or []))
    return dict(order=cited, parts=[], title=None,
                rule="cited" if cited else "none", path=None)


def reading_order(source_root, cited=None):
    """The flat ordered chapter list. See `read_project` for how it is found."""
    return read_project(source_root, cited)["order"]


def text_positions(doc, source_root, quote_results=None, locate=True):
    """A single sortable position in the manuscript for every claim.

    (chapter index in reading order, line within that chapter). Claims citing a file the
    book does not list are placed after everything and marked, because a claim sourced to
    a file outside the manuscript is worth noticing on its own account.
    """
    lines = resolve_lines(doc, source_root, quote_results, locate=locate)
    # Feed the cited chapters in, so a reconstruction of ONE paper needs no project file at all.
    # Order of first citation, which is exactly right for a single source.
    cited = [i["chapter"] for i in lines.values() if i.get("chapter")]
    order = reading_order(source_root, cited)
    index = {c: i for i, c in enumerate(order)}
    out = {}
    for title, info in lines.items():
        chapter = info.get("chapter")
        if chapter in index:
            out[title] = dict(chapter=chapter, chapter_index=index[chapter],
                              line=info.get("line"), precision=info["source"],
                              in_book=True)
        elif chapter:
            out[title] = dict(chapter=chapter, chapter_index=len(order),
                              line=info.get("line"), precision=info["source"],
                              in_book=False)
    return out


def pcs_edges(arg):
    """The edges a premise-conclusion structure implies, step by step.

    Argdown's roles are `premise`, `intermediary-conclusion` and `main-conclusion` -- NOT
    "conclusion", which is what this function used to look for, so it matched nothing and the
    whole branch was dead: on the book map it contributed 0 edges where it should contribute 82,
    and the justification-debt report was measuring a graph missing most of its spine.

    A chained PCS is a sequence of inferences, not one big one. Everything since the last
    conclusion supports the next conclusion, and that conclusion is then carried forward as an
    input to the step after it. Flattening every premise onto the main conclusion instead would
    assert inferences the author never drew -- in `The Argument from Cultural Technology` it
    would run `technologies-evolve` straight to `onus-shifts`, skipping the intermediary
    `histories-are-explanatory` that actually carries it.
    """
    out, pending, carried = [], [], None
    for s in arg.get("pcs") or []:
        title, role = s.get("title"), s.get("role") or ""
        if not title:
            continue
        if "conclusion" in role:
            for p in ([carried] if carried else []) + pending:
                if p != title:
                    out.append((p, title, "support"))
            carried, pending = title, []
        else:
            pending.append(title)
    return out


def title_edges(doc):
    """Support/attack edges between CLAIMS, including those implied by a PCS.

    The `relations` array alone is not enough: it omits everything a premise-conclusion
    structure implies, which on a real file is most of the argument's spine.

    An endpoint that is an ARGUMENT (or an argument's inference, which is what an undercut
    targets) is resolved to that argument's main conclusion, since the report is about claims
    and where they sit in the text. The relation type is preserved, so an undercut stays an
    undercut and is still excluded from the support-only analyses -- collapsing it onto the
    conclusion would otherwise quietly turn "this inference does not go through" into "this
    conclusion is false".
    """
    main_conclusion = {}
    for name, arg in (doc.get("arguments") or {}).items():
        for s in arg.get("pcs") or []:
            if s.get("role") == "main-conclusion" and s.get("title"):
                main_conclusion[name] = s["title"]

    def resolve(title, kind):
        return title if kind == "equivalence-class" else main_conclusion.get(title)

    edges, seen = [], set()

    def add(a, b, kind):
        if not a or not b or a == b or (a, b, kind) in seen:
            return
        seen.add((a, b, kind))
        edges.append((a, b, kind))

    for r in doc.get("relations") or []:
        add(resolve(r["from"], r.get("fromType")), resolve(r["to"], r.get("toType")),
            r.get("relationType", "support"))
    for name, arg in (doc.get("arguments") or {}).items():
        for a, b, kind in pcs_edges(arg):
            add(a, b, kind)
    return edges


def justification_debt(doc, source_root, quote_results=None):
    """How far each claim's support sits from the claim, measured in the manuscript.

    NEITHER DIRECTION IS A FAULT, and the name of this function is a historical accident worth
    not reading anything into. Analytic philosophy's standard advice is to announce the thesis
    and argue for it afterwards: Pryor's writing guide tells students to make the paper's
    structure obvious and that the reader "shouldn't have to exert any effort to figure it out".
    On that convention a claim SHOULD arrive before its support, and a positive figure is the
    paper doing what it was told. Williams's "Internal and external reasons" is the other case:
    it signposts the itinerary but withholds the destination, and asks more of the reader by
    design.

    READ THE REACH, NOT THE COUNT. On the Williams the two directions are near-even by count --
    23 anticipated against 22 prepared -- and stopping there would say the paper has no policy.
    But the anticipated ones stretch at most 8 claims, which is prose stating a thing and
    supporting it just after, while the prepared ones reach 50. The local texture is mixed; the
    long-range architecture is entirely build-then-conclude.

    So the reader-facing vocabulary is `anticipated` (claim first) and `prepared` (support
    first), and what the numbers are for is finding which convention a text follows, how far it
    reaches either way, and which relations depart from its own practice.

    Returns (debts, unplaced) where each debt is a dict with the two claims, the distance,
    and which chapters they sit in.
    """
    pos = text_positions(doc, source_root, quote_results)
    debts, unplaced = [], set()
    for src, dst, kind in title_edges(doc):
        if kind != "support":
            continue
        a, b = pos.get(src), pos.get(dst)
        if not a or not b or a["line"] is None or b["line"] is None:
            unplaced.add(src if not a or a.get("line") is None else dst)
            continue
        span = (a["chapter_index"] - b["chapter_index"], a["line"] - b["line"])
        debts.append(dict(support=src, supported=dst,
                          chapters=span[0], lines=span[1],
                          from_chapter=a["chapter"], to_chapter=b["chapter"],
                          from_line=a["line"], to_line=b["line"],
                          precision=(a["precision"], b["precision"])))
    return debts, sorted(unplaced)


def _dump_positions():
    """Print text_positions as JSON:  python3 argdown_provenance.py EXPORT.json SOURCE_ROOT

    This exists for the cross-check. `argdown-positions.js` computes the same positions for the
    exposition-ordered view, and two implementations of one rule drift unless something compares
    them: `test_argdown_positions.mjs` runs both against the real book and fails on any
    disagreement. Without that, the report and the picture could quietly disagree about where a
    claim sits, which is the class of error this whole strand exists to catch.
    """
    import json
    import sys
    with open(sys.argv[1], encoding="utf-8") as fh:
        doc = json.load(fh)
    root = sys.argv[2]
    print(json.dumps(text_positions(doc, root, check_quotations(doc, root))))


def contribution(doc):
    """Which claims do work for a main contention, and how much rests on each.

    "Orphaned setup -- material introduced early that nothing later uses" was the original
    framing, and as a DEGREE test it finds nothing: on the book map every claim but the three
    contentions has an outgoing edge, so nothing is orphaned in that sense. The question that
    does bite is REACHABILITY. A claim can be wired to a neighbour, and that neighbour to
    another, and the whole chain still arrive nowhere near anything the book is arguing for.

    THE ROLES ARE NOT TWO BUT FOUR, and collapsing them misleads. Reachability by SUPPORT alone
    reports the entire objection apparatus as dead weight: on the book map the largest such
    subtree is `public-ritual-suspect` with 20 claims beneath it, and every one of them is doing
    exactly what an objection should. An objection reaches the thesis by ATTACKING it, which a
    support-only walk cannot see. So:

      apex      -- a contention: bears on nothing, and something bears on it
      supports  -- its support chain arrives at a contention
      engages   -- it arrives at a contention, but only through an attack somewhere on the way:
                   the objections, and the replies that hang off them
      inert     -- it arrives at no contention by any route. THIS is the cut list.

    Returns a dict per claim with `role`, plus `load` (how many claims sit in the support tree
    beneath it) and the two raw reachability flags.
    """
    edges = title_edges(doc)
    titles = set(merged_statements(doc))
    for a, b, _ in edges:
        titles.update((a, b))

    up, down, any_up, bears_on, borne = {}, {}, {}, set(), set()
    for a, b, kind in edges:
        bears_on.add(a)
        borne.add(b)
        any_up.setdefault(a, []).append(b)
        if kind != "support":
            continue
        up.setdefault(a, []).append(b)
        down.setdefault(b, []).append(a)

    # A contention bears on nothing and has something bearing on it. The second half matters:
    # without it every stray unattached claim counts as a contention of its own.
    apex = {t for t in titles if t not in bears_on and t in borne}

    def walk(start, adj):
        seen, queue = set(), [start]
        while queue:
            for nxt in adj.get(queue.pop(), []):
                if nxt not in seen:
                    seen.add(nxt)
                    queue.append(nxt)
        return seen

    # Distance to the nearest contention, and this is the number that carries the weight.
    # The binary is nearly toothless on a well-connected map: nothing is disconnected, so
    # almost everything reaches SOMETHING, and `inert` came out at 0 on the book. How FAR a
    # claim sits from anything the book is arguing for is the graded version of the same
    # question, and it does discriminate -- a claim six steps out is doing remote work whatever
    # its reachability flag says.
    def distances(adj):
        rev = {}
        for src, dsts in adj.items():
            for d in dsts:
                rev.setdefault(d, []).append(src)
        dist, frontier, step = {t: 0 for t in apex}, list(apex), 0
        while frontier:
            step += 1
            nxt = []
            for t in frontier:
                for below in rev.get(t, []):
                    if below not in dist:
                        dist[below] = step
                        nxt.append(below)
            frontier = nxt
        return dist

    d_any, d_sup = distances(any_up), distances(up)

    out = {}
    for t in titles:
        by_support = t in d_sup
        by_any = t in d_any
        role = ("apex" if t in apex else
                "supports" if by_support else
                "engages" if by_any else
                "inert")
        out[t] = dict(role=role, reaches=by_support or t in apex, engages=by_any,
                      dist=d_any.get(t), dist_support=d_sup.get(t),
                      load=len(walk(t, down)), apex=t in apex)
    return out


def first_use(doc, source_root, quote_results=None):
    """How long after a claim is stated does anything first draw on it, measured in claims.

    The reader's question is not "is this used" but "is it used anywhere near here". Material
    stated a hundred claims before anything needs it is material the reader carries for a
    hundred claims. Distance is in CLAIMS rather than lines because that is what the exposition
    view's axis is, and the two should agree.
    """
    pos = text_positions(doc, source_root, quote_results)
    placed = {t: (p["chapter_index"], p["line"]) for t, p in pos.items() if p["line"] is not None}
    rank = {t: i for i, t in enumerate(sorted(placed, key=lambda t: placed[t]))}
    users = {}
    for a, b, kind in title_edges(doc):
        if kind == "support":
            users.setdefault(a, []).append(b)
    out = []
    for t, r in rank.items():
        seen = [rank[u] for u in users.get(t, []) if u in rank]
        if not seen:
            continue
        out.append(dict(claim=t, stated=r, first_used=min(seen), gap=min(seen) - r,
                        total=len(rank)))
    return sorted(out, key=lambda d: -d["gap"])


def dag_depth(doc):
    """Distance of each claim from the apex, following support edges upward."""
    edges = title_edges(doc)
    out_of = {}
    titles = set()
    for a, b, _ in edges:
        out_of.setdefault(a, []).append(b)
        titles.update((a, b))
    apex = [t for t in titles if not out_of.get(t)]
    depth = {t: 0 for t in apex}
    frontier = list(apex)
    guard = 0
    while frontier and guard < 100000:
        guard += 1
        nxt = []
        for t in frontier:
            for a, b, _ in edges:
                if b == t and a not in depth:
                    depth[a] = depth[t] + 1
                    nxt.append(a)
        frontier = nxt
    return depth


if __name__ == "__main__":
    _dump_positions()
