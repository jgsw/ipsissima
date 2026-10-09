"""What a converted paper MUST contain, and the flaws in it we have accepted.

A difference between two conversions says that something changed, not whether it was mended or
broken, so every difference had to be read again by a person -- and a paper's known flaws were
re-read on every run that touched them. An EXPECTATION is the paper as it is printed, written down
once by someone who looked: its headings, the length of its abstract, how many notes it has, and a
few sentences that must come through whole. Measured against those, a change is FIXED (an
expectation now met that was not) or BROKE (one met before and not now), and only a breakage
needs a person.

THE LEDGER is the other half. Some flaws are understood and left: Reichling's columns interleave
on two pages, Waldron's running head is damaged by the scan. Each is a `[[defect]]` beside the
expectations it excuses, so a run reports it as KNOWN instead of failing, and says so when the flaw
goes away -- at which point the entry should be struck out.

ONE FILE PER PAPER, in TOML, named for the PDF and naming it:

    pdf = "miller-2019-uksc-41.pdf"         # the file's name; every copy of it is held to this
    title = "R (Miller) v The Prime Minister"   # never counted as a heading; depth is relative
    reviewed = "2026-10-07"                 # or status = "draft": written from an output, unread
    headings = ["# What is prorogation?", "## Remedy"]   # every heading, in order, as Markdown
    abstract = [180, 220]                   # its length in words; [0, 0] for none
    notes = 71
    survive = ["A sentence that must come through whole."]

    [[defect]]
    what = "the Introduction, set in italic, is not found"
    missing_heading = "# I. Introduction"   # or: extra_heading, notes, abstract, damaged, shows
                                            # (the heading keys may name a list)

`shows` names text a flaw leaves in the output (a garbled line, a stray running head): KNOWN while
it is there, GONE when it is not. `damaged` names a `survive` sentence the converter cannot yet
deliver whole. Expectations live where the papers do: the public fixtures' in
`fixtures/ingest/expected/`, the rest in the folder IPSISSIMA_EXPECTATIONS names.
"""
import difflib
import json
from collections import Counter
import re
import tomllib
from pathlib import Path

MARKER = re.compile(r"<!--\s*(?:[^\n]*?\s)?p\.\s*-?\d+\s+begins here\s*-->")
NOTE_REF = re.compile(r"\[\^\d+\]")


def norm(s):
    """Text as compared: page markers and note references out, whitespace collapsed."""
    return " ".join(NOTE_REF.sub("", MARKER.sub(" ", s or "")).split())


def letters(s):
    return re.sub(r"[\W_\d]+", "", (s or "").lower())


def load(dirs):
    """{pdf file name: spec} from every *.toml in `dirs`; a later folder does not override."""
    specs = {}
    for d in dirs:
        if not d or not Path(d).is_dir():
            continue
        for f in sorted(Path(d).glob("*.toml")):
            spec = tomllib.loads(f.read_text(encoding="utf-8"))
            spec["_file"] = str(f)
            specs.setdefault(spec.get("pdf") or f.stem + ".pdf", spec)
    return specs


#: The comment the converter writes under its "# Figures" (pdf_to_source.py).
FIGURES_NOTE = "<!-- The figures' captions, lifted out of the text they were printed in"


def facts(md):
    """What the expectations are checked against: the headings, notes, abstract and body text."""
    front = re.match(r"(?s)\A---\n(.*?)\n---\n", md)
    abstract = 0
    if front:
        mo = re.search(r"(?s)^abstract: >-\n(.*?)(?=^\S|\Z)", front.group(1) + "\n", re.M)
        abstract = len(mo.group(1).split()) if mo else 0
    body = md[front.end():] if front else md
    heads = [" ".join(l.split()) for l in body.splitlines() if re.match(r"#{1,6} ", l)]
    # THE CONVERTER'S OWN "# Figures" (8 Oct 2026), where it gathers the captions it lifted out of
    # the text: apparatus, like its "# Notes", not a heading the paper prints.
    if FIGURES_NOTE in body:
        heads = [h for h in heads if h != "# Figures"]
    notes = len(re.findall(r"(?m)^\[\^\d+\]:", body))
    return dict(heads=heads, abstract=abstract, notes=notes, text=norm(body))


def depth(h):
    return len(h) - len(h.lstrip("#"))


def heading_keys(spec, heads):
    """The expected and the given headings as comparable keys: depth and letters.

    THE TITLE IS NOT A HEADING TO COUNT. The converter prints a paper's title as a heading only
    where it finds it in the PDF's outline, and then every section sits a level lower: Charlton's
    sections came out at "#", Williams's at "##", for the same layout. So a heading that is the
    `title` is set aside, and DEPTH IS RELATIVE -- the given headings are shifted by the depth
    difference the agreed top-level headings show -- so what is compared is how the headings nest,
    not where the nesting starts."""
    t = letters(spec.get("title", ""))
    if t:
        heads = [h for h in heads if not (letters(h) and (letters(h) == t or t.startswith(letters(h))
                                                          and len(letters(h)) > 20))]
    want = [" ".join(h.split()) for h in spec.get("headings", [])]
    # The shift is read off the headings both sides agree on, not off the shallowest one: the
    # converter adds a "# Notes" of its own at the top level, and with the title found every
    # section of Arya's came out at "##" over it.
    sm = difflib.SequenceMatcher(None, [letters(h) for h in want], [letters(h) for h in heads], autojunk=False)
    pairs = [(a + k, b + k) for a, b, n in sm.get_matching_blocks() for k in range(n)]
    # The SECTIONS decide it: where the output is flat, sub-sections can outnumber sections
    # (Wolff's sixteen and five), and a vote of all of them would call the sections misplaced.
    top = min((depth(h) for h in want), default=1)
    offsets = Counter(depth(heads[b]) - depth(want[a]) for a, b in pairs if depth(want[a]) == top) \
        or Counter(depth(heads[b]) - depth(want[a]) for a, b in pairs)
    if offsets:
        shift = max(offsets.items(), key=lambda kv: (kv[1], -abs(kv[0])))[0]
    else:
        shift = min((depth(h) for h in heads), default=1) - min((depth(h) for h in want), default=1)
    return (want, [(depth(h), letters(h)) for h in want],
            heads, [(max(1, depth(h) - shift), letters(h)) for h in heads])


def check(spec, md):
    """{item: (state, detail)}, state one of ok, known, fails, gone. An item is one heading, one
    sentence, the note count, the abstract, or one ledger entry -- keyed so two runs line up."""
    if md is None:
        return {"output": ("fails", "no output at all")}
    f = facts(md)
    defects = spec.get("defect", [])

    def excused(kind, value):
        # One entry may name a list: "the appendix's sub-headings sit one level too high" is one
        # flaw, not twenty.
        return any(d.get(kind) == value or (isinstance(d.get(kind), list) and value in d[kind])
                   for d in defects)

    out = {}
    if "headings" in spec:
        # A HEADING IS ITS DEPTH AND ITS LETTERS. "# 1 Introduction" for a printed "1. Introduction"
        # is the converter's convention for numbered headings, not a fault, and an expectation
        # that failed on it would be about the convention instead of the paper.
        want, wk, got, gk = heading_keys(spec, f["heads"])
        f = dict(f, heads=got)
        sm = difflib.SequenceMatcher(None, wk, gk, autojunk=False)
        matched_w, matched_g = set(), set()
        for a, b, n in sm.get_matching_blocks():
            matched_w.update(range(a, a + n))
            matched_g.update(range(b, b + n))
        for i, h in enumerate(want):
            if i in matched_w:
                out[f"heading {h}"] = ("ok", "")
            else:
                out[f"heading {h}"] = ("known" if excused("missing_heading", h) else "fails", "missing")
        for j, h in enumerate(f["heads"]):
            if j not in matched_g:
                out[f"extra heading {h}"] = ("known" if excused("extra_heading", h) else "fails",
                                             "not a heading the paper prints")
        for d in defects:
            named = d.get("extra_heading")
            for h in ([named] if isinstance(named, str) else named or []):
                if f"extra heading {h}" not in out:
                    out[f"extra heading {h}"] = ("ok", "")
    if "notes" in spec:
        n = spec["notes"]
        out["notes"] = (("ok", "") if f["notes"] == n else
                        ("known" if excused("notes", f["notes"]) else "fails", f"{f['notes']}, not {n}"))
    if "abstract" in spec:
        lo, hi = spec["abstract"]
        a = f["abstract"]
        out["abstract"] = (("ok", "") if lo <= a <= hi else
                           ("known" if excused("abstract", a) else "fails", f"{a} words, not {lo}-{hi}"))
    for s in spec.get("survive", []):
        key = "survive " + " ".join(s.split()[:8]) + " ..."
        ok = norm(s) in f["text"]
        out[key] = (("ok", "") if ok else ("known" if excused("damaged", s) else "fails", "not whole"))
    for d in defects:
        if d.get("shows"):
            out["defect " + d.get("what", d["shows"])] = (
                ("known", "") if norm(d["shows"]) in f["text"] else ("gone", "its text is no longer there"))
    return out


def verdicts(old, new):
    """Each item's transition: BROKE, FIXED, GONE, failing (and still unrecorded), or quiet."""
    rows = []
    for k in list(new) + [k for k in old if k not in new]:
        a = old.get(k, ("ok", "")) if old is not None else None
        b = new.get(k, ("ok", ""))
        if b[0] == "fails" and (a is None or a[0] == "fails"):
            rows.append(("failing", k, b[1]))
        elif b[0] == "fails" or (a is not None and a[0] == "gone" and b[0] == "known"):
            rows.append(("BROKE", k, b[1]))
        elif a is not None and a[0] in ("fails", "known") and b[0] == "ok":
            rows.append(("FIXED", k, "and its ledger entry can go" if a[0] == "known" else ""))
        elif b[0] == "gone" and (a is None or a[0] != "gone"):
            rows.append(("GONE", k, "fixed, or its text moved: strike the entry if fixed"))
        elif b[0] == "known":
            rows.append(("known", k, ""))
    return rows


# --------------------------------------------------------------------------- drafting

SENTENCE_END = re.compile(r"(?<=[.?!])\s+(?=[A-Z“\"‘])")


#: Short words common enough that using one only once proves nothing.
COMMON = set("""a i an as at be by do go he if in is it me my no of on or so to up us we am are but
can did for had has her him his how its may not now one our out own say see she the too two was
way who why yet you all any few new old any also been both does each even ever from have here
into just know less like long made make many more most much must near need next none only over
once part same seem some such take than that them then they this thus time upon very want well
were what when whom will with work yes your""".split())


def fragments(s, vocab):
    """Pieces of words: a letter standing alone (not "a" or "I"), or a short word the paper uses
    only here. A column cut through by a scan reads "urban ar impact" and "will b even if" in the
    PDF's own text layer too, so the letters test cannot see it (Ó Gráda 2001, Simon 1954)."""
    for w in re.findall(r"[A-Za-z]+", s):
        lw = w.lower()
        if (len(w) == 1 and lw not in ("a", "i")) or (len(w) <= 4 and vocab[lw] <= 1
                                                        and lw not in COMMON):
            return True
    return False


def sentences(md):
    """Candidate sentences from the body's paragraphs: ordinary prose, 12 to 45 words."""
    f = re.match(r"(?s)\A---\n.*?\n---\n", md)
    body = md[f.end():] if f else md
    cut = re.search(r"(?m)^# (?:Notes|Figures|References|Bibliography|Works Cited)\s*$", body)
    body = body[:cut.start()] if cut else body
    vocab = Counter(re.findall(r"[a-z]+", MARKER.sub(" ", body).lower()))
    out = []
    for para in re.split(r"\n\s*\n", body):
        p = para.strip()
        if not p or p[0] in "#<>|[" or p.startswith("- "):
            continue
        for s in SENTENCE_END.split(" ".join(MARKER.sub(" ", p).split())):
            w = s.split()
            # NO DIGITS AND NO MATHS: the letters test below cannot see "£(1 + 1)" for
            # "£(1 + r)", or a formula dropped from "the demand price of capital = And" (Ramsey's
            # OCR, 1928), and a sentence that must survive must first be right.
            if (12 <= len(w) <= 45 and "[^" not in s and s[0].isupper() and s[-1] in ".?!"
                    and not re.search(r"[\d=+<>/\\|^*_$£%@#{}\[\]\u00ad\u200b\ufffd]|\w\?\w|\w\.\w\b|\.-\w", s)
                    and sum(c.isalpha() or c.isspace() for c in s) >= 0.9 * len(s)
                    and not fragments(s, vocab)):
                out.append(s)
    return out


def draft(pdf, md, pdf_text, today):
    """A draft expectations file from an output: what it holds now, to be READ against the paper
    before `status = "draft"` becomes `reviewed`. Sentences are taken only where the PDF's own
    text layer has the same letters in the same order, so a damaged one is never written in."""
    f = facts(md)
    have = letters(pdf_text)
    cands = [s for s in sentences(md) if letters(s) in have]
    picks = []
    for at in (0.12, 0.38, 0.64, 0.9):
        i = int(at * len(cands))
        for s in cands[i:] + cands[:i]:
            if s not in picks:
                picks.append(s)
                break
    a = f["abstract"]
    q = lambda s: json.dumps(s, ensure_ascii=False)                       # a TOML basic string
    lines = [f"pdf = {q(Path(pdf).name)}", 'status = "draft"', f'drafted = "{today}"', "",
             "headings = ["] + [f"  {q(h)}," for h in f["heads"]] + ["]",
             f"abstract = [{int(a * 0.9)}, {-(-a * 11 // 10)}]" if a else "abstract = [0, 0]",
             f"notes = {f['notes']}", "survive = ["] + [f"  {q(s)}," for s in picks] + ["]", ""]
    return "\n".join(lines)


def self_test():
    fails = 0

    def ck(name, got, want):
        nonlocal fails
        ok = got == want
        fails += not ok
        print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok else f"\n          got {got!r} want {want!r}"))

    md = ("---\nabstract: >-\n  One two three four five.\n---\n\n<!-- p.1 begins here -->\n\n"
          "# Intro\n\nThe body runs[^1] on <!-- p.2 begins here --> here. A garbled lnie stays.\n\n"
          "# Stray\n\n[^1]: A note.\n")
    spec = dict(headings=["# Intro", "# Second"], notes=1, abstract=[4, 6],
                survive=["The body runs on here.", "Never printed at all."],
                defect=[dict(what="garble", shows="garbled lnie"), dict(missing_heading="# Second")])
    got = check(spec, md)
    # Mutation: compare without norm -> the page marker and the note reference break the sentence.
    ck("a sentence survives across a page marker and a note reference",
       got["survive The body runs on here. ..."][0], "ok")
    ck("  a missing heading the ledger names is known; one it does not, fails",
       (got["heading # Second"][0], got["extra heading # Stray"][0]), ("known", "fails"))
    ck("  a ledger entry's text present is known", got["defect garble"][0], "known")
    # Mutation: excuse only single values -> a list-valued entry excuses nothing.
    # Mutation: compare headings as strings -> "# 1 Intro" is not "# 1. Intro".
    ck("  a heading is its depth and its letters, not its punctuation",
       check(dict(headings=["# 1. Intro"]), md.replace("# Intro", "# 1 Intro"))["heading # 1. Intro"][0], "ok")
    # Mutation: compare absolute depth -> a missing title shifts every section and all fail.
    ck("  the title is set aside and depth is relative",
       check(dict(title="A Paper on Things", headings=["# Intro", "## Part"]),
             md.replace("# Intro", "# A Paper on Things\n\n## Intro\n\n### Part").replace("# Stray", "## Stray"))
       .get("heading ## Part", ("?",))[0], "ok")
    # Mutation: shift by the shallowest heading -> a top-level "# Notes" of the converter's own
    # holds every section a level too deep.
    ck("  and the shift is the one the agreed headings show",
       check(dict(headings=["# Intro", "## Part"]),
             md.replace("# Intro", "## Intro\n\n### Part").replace("# Stray", "# Notes"))
       .get("heading ## Part", ("?",))[0], "ok")
    ck("  and an entry may excuse a list of headings",
       check(dict(headings=["# Intro"], defect=[dict(extra_heading=["# Stray", "# Other"])]), md)["extra heading # Stray"][0],
       "known")
    fixed = check(spec, md.replace("garbled lnie", "garbled line").replace("# Stray", "# Second"))
    v = {k: s for s, k, _ in verdicts(got, fixed)}
    # Mutation: report every failure as failing -> nothing is ever BROKE or FIXED.
    ck("between two runs: fixed, gone, and the unrecorded failure still failing",
       (v.get("heading # Second"), v.get("defect garble"), v.get("survive Never printed at all. ...")),
       ("FIXED", "GONE", "failing"))
    worse = check(spec, md.replace("[^1]: A note.", "").replace("runs[^1] on", "runs off"))
    v = {k: s for s, k, _ in verdicts(got, worse)}
    ck("  and a sentence or a note lost is BROKE",
       (v.get("survive The body runs on here. ..."), v.get("notes")), ("BROKE", "BROKE"))
    d = draft("x.pdf", md + "\nThe second paragraph has more than twelve words in it, plainly enough for it.\n",
              "The second para-\ngraph has more than twelve words in it, plainly enough for it.", "2026-10-07")
    spec2 = tomllib.loads(d)
    ck("a draft is valid TOML holding what the output holds",
       (spec2["headings"], spec2["notes"], spec2["abstract"], spec2["survive"]),
       (["# Intro", "# Stray"], 1, [4, 6],
        ["The second paragraph has more than twelve words in it, plainly enough for it."]))
    # Mutation: drop the fragment test -> "urban ar impact" is offered as a sentence to keep.
    ck("a sentence with a cut word in it is not offered",
       sentences("A paragraph here and there has the urban ar impact that we all knew it would have here.\n\n"
                 "A paragraph here and there has the urban impact that we all knew it would have here.\n"),
       ["A paragraph here and there has the urban impact that we all knew it would have here."])
    ck("  and takes no sentence the PDF's own text does not have",
       tomllib.loads(draft("x.pdf", md + "\nThe second paragraph has more than twelve words in it, plainly enough for it.\n",
                           "nothing like it", "2026-10-07"))["survive"], [])
    return fails
