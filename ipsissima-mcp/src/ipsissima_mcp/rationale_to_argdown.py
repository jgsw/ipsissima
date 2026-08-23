#!/usr/bin/env python3
"""Convert a Rationale (.rtnl) argument map into Argdown.

Rationale (Austhink, ~2005-2010) stores a map as a small imperative script:

    map0_0  = Create("Claim")
    SetText("...")                        # applies to the LAST created node
    map0_1  = CreateChild(map0_0, "CompoundReason")
    map0_2  = CreateChild(map0_1, "Claim")
    map0_3  = CreateAnnotation(map0_2, "Note")
    ...
    CreateFernView() / SetLocation / SetSize / SetOffset   # layout only, ignored

Node types and how they map onto Argdown
---------------------------------------
Claim              -> a statement
CompoundReason     -> a LINKED argument: its Claim children are co-premises that
                      jointly support the parent claim.
CompoundObjection  -> a LINKED argument whose conclusion attacks the parent.
Inference          -> the inference line inside a compound; carries no text.
                      An objection attached to an *Inference* is an UNDERCUT.
Note (annotation)  -> an authorial gloss on a claim.

The linked/convergent distinction is the thing that must not be lost. A Rationale
compound with n premises is ONE argument in which the premises work together; the
naive rendering as n sibling `+` relations in Argdown asserts something different
(n independent, convergent supports). So:

    compound with >= 2 claim children  -> an Argdown argument with a PCS
    compound with exactly 1 claim child -> a plain `+` / `-` relation

Usage:
    python3 rationale_to_argdown.py INPUT.rtnl [-o OUTPUT.argdown] [--title T]
"""

import argparse
import pathlib
import re
import sys
from collections import OrderedDict

# Argdown silently rewrites these character sequences in ANY text, including
# section headings. `.A.` -> the "for all" sign is the one that bites, because
# section numbering like "III.A." is so natural to write.
SHORTCODES = [".A.", ".E.", ".~.", ".v.", ".->.", ".<->.", ".P.", ".O."]

# Deliberately does NOT include "not", "no", "cannot", "never", "only". In a
# philosophical map the negation is the claim; an id like `sufficient-reason-
# grant-authors` for "There is NOT a sufficient reason to grant authors..."
# inverts the meaning of the node in every place the id is read.
STOPWORDS = {
    "a", "an", "the", "of", "to", "in", "is", "are", "be", "that", "this", "it",
    "we", "i", "there", "and", "or", "for", "if", "as", "by", "on", "but",
    "so", "would", "could", "must", "should", "have", "has",
    "any", "some", "their", "them", "they", "which", "what", "our", "my",
}


# --------------------------------------------------------------------------- #
# parsing
# --------------------------------------------------------------------------- #

RE_CREATE = re.compile(r'^\s*(\w+)\s*=\s*Create\("([^"]+)"\)')
RE_CHILD = re.compile(r'^\s*(\w+)\s*=\s*CreateChild\(\s*(\w+)\s*,\s*"([^"]+)"\)')
RE_ANNOT = re.compile(r'^\s*(\w+)\s*=\s*CreateAnnotation\(\s*(\w+)\s*,\s*"([^"]+)"\)')
RE_SETTEXT = re.compile(r'^\s*SetText\("(.*)"\)\s*$', re.S)


def unescape(s):
    return s.replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")


def parse_rtnl(text):
    """Return (nodes, root_ids). nodes: id -> dict(type,parent,children,text,notes)."""
    nodes = OrderedDict()
    roots = []
    last = None

    # SetText(...) may run across lines; join logical statements first.
    lines, buf = [], ""
    for raw in text.splitlines():
        buf = raw if not buf else buf + "\n" + raw
        if buf.count('"') % 2 == 0:
            lines.append(buf)
            buf = ""
    if buf:
        lines.append(buf)

    for line in lines:
        m = RE_CREATE.match(line)
        if m:
            nid, ntype = m.group(1), m.group(2)
            nodes[nid] = dict(id=nid, type=ntype, parent=None, children=[],
                              text="", notes=[])
            roots.append(nid)
            last = nid
            continue

        m = RE_CHILD.match(line)
        if m:
            nid, parent, ntype = m.group(1), m.group(2), m.group(3)
            nodes[nid] = dict(id=nid, type=ntype, parent=parent, children=[],
                              text="", notes=[])
            if parent in nodes:
                nodes[parent]["children"].append(nid)
            last = nid
            continue

        m = RE_ANNOT.match(line)
        if m:
            nid, target, ntype = m.group(1), m.group(2), m.group(3)
            nodes[nid] = dict(id=nid, type="Annotation:" + ntype, parent=target,
                              children=[], text="", notes=[])
            if target in nodes:
                nodes[target]["notes"].append(nid)
            last = nid
            continue

        m = RE_SETTEXT.match(line)
        if m and last:
            nodes[last]["text"] = unescape(m.group(1)).strip()
            continue

    return nodes, roots


# --------------------------------------------------------------------------- #
# emission
# --------------------------------------------------------------------------- #

def slug(text, used):
    plain = re.sub(r"[*_`]", "", text)
    plain = re.sub(r"\(.*?\)", " ", plain)
    words = [w for w in re.findall(r"[A-Za-z]+", plain.lower())
             if w not in STOPWORDS]
    base = "-".join(words[:5]) or "claim"
    base = base[:52].strip("-")
    cand, n = base, 2
    while cand in used:
        cand = f"{base}-{n}"
        n += 1
    used.add(cand)
    return cand


def one_line(text):
    """Argdown statement text must not contain a bare newline."""
    t = re.sub(r"\s*\n\s*", " ", text).strip()
    return re.sub(r"\s{2,}", " ", t)


def guard_shortcodes(text):
    """Break up sequences Argdown would silently turn into logic symbols."""
    for code in SHORTCODES:
        if code in text:
            # insert a zero-width-free separator: a space before the closing dot
            text = text.replace(code, code[:-1] + " .")
    return text


def escape_text(text):
    """Make arbitrary prose safe as Argdown statement text.

    `_` opens an italic range, so an unpaired one aborts the parse -- and
    Rationale node ids (map0_30) are full of them. `[` at the start of a run of
    text is read as a statement definition. Both need escaping with a backslash.
    """
    text = text.replace("\\", "\\\\")
    text = re.sub(r"_", r"\\_", text)
    text = re.sub(r"([\[\]<>])", r"\\\1", text)
    return text


def claim_children(node, nodes):
    return [c for c in node["children"] if nodes[c]["type"] == "Claim"]


def inference_children(node, nodes):
    return [c for c in node["children"] if nodes[c]["type"] == "Inference"]


def convert(nodes, roots, title=None, subtitle=None, core_depth=2):
    ids = {}
    used = set()

    # stable ids for every claim, in document order
    for nid, n in nodes.items():
        if n["type"] == "Claim":
            ids[nid] = slug(n["text"], used)

    # ---- assign sections: one per top-level branch under the root ---------- #
    section_of = {}
    root = roots[0]
    top_compounds = [c for c in nodes[root]["children"]
                     if nodes[c]["type"].startswith("Compound")]
    branch_heads = []
    for tc in top_compounds:
        branch_heads.extend(claim_children(nodes[tc], nodes))

    def mark(nid, sec):
        section_of[nid] = sec
        for c in nodes[nid]["children"]:
            mark(c, sec)

    def branch_claims(nid):
        n = 1 if nodes[nid]["type"] == "Claim" else 0
        return n + sum(branch_claims(c) for c in nodes[nid]["children"])

    def label(text, limit=52):
        t = re.sub(r"[*_]", "", one_line(text)).strip()
        t = re.sub(r"\s+", " ", t)
        if len(t) <= limit:
            return t.rstrip(" .")
        cut = t[:limit].rsplit(" ", 1)[0].rstrip(" ,;:.")
        return cut + "..."

    # Short framing claims do not deserve a section of their own; they would
    # produce a cluster containing exactly one node.
    for h in branch_heads:
        sec = (label(nodes[h]["text"]) if branch_claims(h) >= 3
               else "Framing and scope")
        mark(h, sec)

    # ---- build per-claim relation lists ------------------------------------ #
    rel = {nid: [] for nid in ids}          # claim id -> list of relation lines
    args = []                                # (argname, gloss, premises, concl, kind, target)
    argnames = set()

    def argname(kind, target_nid):
        base = ("Reason for " if kind == "support" else "Objection to ")
        base += ids[target_nid].replace("-", " ")
        cand, n = base[:60], 2
        while cand in argnames:
            cand = f"{base[:56]} {n}"
            n += 1
        argnames.add(cand)
        return cand

    for nid, n in nodes.items():
        if not n["type"].startswith("Compound"):
            continue
        kind = "support" if n["type"] == "CompoundReason" else "attack"
        prem = claim_children(n, nodes)
        if not prem:
            continue

        parent = n["parent"]
        pnode = nodes[parent]

        # An objection whose parent is an Inference undercuts that inference.
        undercut_of = None
        if pnode["type"] == "Inference":
            grand = nodes[pnode["parent"]]           # the compound the inference sits in
            undercut_of = grand["parent"]            # the claim that compound targets
            parent = undercut_of

        if parent not in ids:
            continue

        if len(prem) == 1:
            sym = {"support": "+", "attack": "-"}[kind]
            if undercut_of is not None:
                sym = "_"
            rel[parent].append(f"{sym} [{ids[prem[0]]}]")
        else:
            name = argname(kind, parent)
            sym = {"support": "+", "attack": "-"}[kind]
            if undercut_of is not None:
                sym = "_"
            rel[parent].append(f"{sym} <{name}>")
            args.append(dict(name=name, kind=kind, premises=prem, target=parent,
                             undercut=undercut_of is not None,
                             rid=n["id"], inferences=inference_children(n, nodes)))

    # ---- emit --------------------------------------------------------------- #
    out = []
    out.append("===")
    out.append(f'title: "{title or "Converted Rationale map"}"')
    if subtitle:
        out.append(f'subTitle: "{subtitle}"')
    out.append("model:")
    out.append("    removeTagsFromText: true")
    out.append("map:")
    out.append("    statementLabelMode: text")
    out.append("    argumentLabelMode: title")
    out.append("===")
    out.append("")
    out.append("// Generated by rationale_to_argdown.py -- do not hand-edit without")
    out.append("// re-checking against the .rtnl source.")
    out.append("//")
    out.append("// Every node carries its Rationale id in metadata, so any claim can be")
    out.append("// traced back to the .rtnl source. A Rationale Note is an authorial")
    out.append("// annotation rather than a reason, so it is carried as `note:` metadata")
    out.append("// and does not add an edge to the graph.")
    out.append("//")
    out.append("// An objection Rationale attached to an INFERENCE (rather than to a claim)")
    out.append("// becomes an Argdown undercut, written `_`.")
    out.append("//")
    out.append(f"// Claims at Rationale depth <= {core_depth} are tagged #core, which gives the")
    out.append("// fold-up view:  selection: {selectedTags: [\"core\"]}")
    out.append("//")
    out.append("// A Rationale compound reason is a LINKED argument: its premises work")
    out.append("// jointly. Compounds with two or more premises are therefore rendered as")
    out.append("// Argdown arguments with a premise-conclusion structure, not as sibling")
    out.append("// support relations (which would assert independent, convergent support).")
    out.append("")

    emitted = set()
    current_section = None

    # Claim depth in the Rationale tree (compounds and inferences do not count).
    # Depth is a property of the source map, not an editorial judgement, so
    # tagging by it gives a fold-up view without inventing structure.
    depth = {}

    def set_depth(nid, d):
        n = nodes[nid]
        nd = d + 1 if n["type"] == "Claim" else d
        if n["type"] == "Claim":
            depth[nid] = nd
        for c in n["children"]:
            set_depth(c, nd)

    set_depth(root, 0)

    def body_of(text):
        return escape_text(guard_shortcodes(one_line(text)))

    def yaml_str(s):
        return '"' + one_line(s).replace("\\", "\\\\").replace('"', '\\"') + '"'

    def emit_claim(nid):
        n = nodes[nid]
        lines = []
        d = depth.get(nid, 99)
        tag = " #core" if d <= core_depth else ""
        lines.append(f"[{ids[nid]}]: {body_of(n['text'])}{tag}")
        meta = [f'rationale_id: "{nid}"', f"depth: {d}"]
        # A Rationale Note is an authorial annotation, NOT a reason. Attaching it
        # with `+` would assert support the map does not contain, so it goes in
        # metadata, which is passed through verbatim and needs no escaping.
        for i, note_id in enumerate(n["notes"]):
            key = "note" if i == 0 else f"note{i + 1}"
            meta.append(f"{key}: {yaml_str(nodes[note_id]['text'])}")
        lines.append("    {" + ", ".join(meta) + "}")
        for r in rel[nid]:
            lines.append(f"    {r}")
        return lines

    order = [nid for nid in nodes if nodes[nid]["type"] == "Claim"]
    for nid in order:
        sec = section_of.get(nid)
        if sec != current_section and sec is not None:
            out.append(f"# {guard_shortcodes(sec)} {{isGroup: true}}")
            out.append("")
            current_section = sec
        out.extend(emit_claim(nid))
        out.append("")
        emitted.add(nid)

    if args:
        out.append("# Reasoning steps {isGroup: true}")
        out.append("")
    for a in args:
        verb = "jointly support"
        if a["undercut"]:
            verb = "jointly undercut the inference to"
        elif a["kind"] == "attack":
            verb = "jointly tell against"
        # `@[title]` is the MENTION form; a bare [title] in running text is read
        # as a statement definition and aborts the parse.
        out.append(f"// Rationale compound {a['rid']}")
        out.append(f"<{a['name']}>: Premises that {verb} @[{ids[a['target']]}].")
        out.append("")
        for i, p in enumerate(a["premises"], start=1):
            out.append(f"({i}) [{ids[p]}]")
        out.append("-----")
        concl = f"({len(a['premises'])+1}) "
        if a["kind"] == "support" and not a["undercut"]:
            concl += f"[{ids[a['target']]}]"
        else:
            concl += f"Taken together, the premises above tell against @[{ids[a['target']]}]."
        out.append(concl)
        out.append("")

    return "\n".join(out).rstrip() + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("-o", "--output")
    ap.add_argument("--title")
    ap.add_argument("--subtitle")
    ap.add_argument("--core-depth", type=int, default=2,
                    help="tag claims at this Rationale depth or shallower #core "
                         "(default 2); drives the fold-up overview view")
    a = ap.parse_args()

    src = pathlib.Path(a.input)
    nodes, roots = parse_rtnl(src.read_text(encoding="utf-8", errors="replace"))
    if not roots:
        sys.exit("no root node found -- is this a Rationale .rtnl file?")

    counts = {}
    for n in nodes.values():
        counts[n["type"]] = counts.get(n["type"], 0) + 1
    print("parsed:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())),
          file=sys.stderr)

    text = convert(nodes, roots, a.title or src.stem, a.subtitle, a.core_depth)
    out = pathlib.Path(a.output) if a.output else src.with_suffix(".argdown")
    out.write_text(text, encoding="utf-8")
    print(f"wrote {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
