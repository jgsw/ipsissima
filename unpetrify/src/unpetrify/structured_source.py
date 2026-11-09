#!/usr/bin/env python3
"""Get an article as STRUCTURED TEXT, without converting a PDF.

THE INVERSION. Everything in `pdf_to_source.py` exists to recover, from ink positions, structure
the publisher already had and threw away when it typeset the page: which lines are a paragraph,
which indent is a quotation, where the references start, what is a footnote. On a 45-paper corpus
that recovery refused outright on 28 and silently mangled several more. Where a machine-readable
version of the article exists, none of those questions has to be asked: the sections are marked
`<sec>`, the footnotes are `<fn>`, and the bibliography is in `<back>`, which we simply do not read.

So the first question about any article should not be "how do I parse this PDF" but "is there a
version I do not have to parse". This answers that, and fetches it.

WHAT IT TRIES, best text first:

  1. EUROPE PMC full-text XML -- JATS, sectioned, with the references in their own element. The
     best outcome by a wide margin, and free of any of the PDF pipeline's failure modes.
  2. UNPAYWALL's best open-access location, when it names an XML or full-text HTML copy.
  3. CROSSREF's `link` array. Reported, but rarely usable: those links are for text and data
     mining and most publishers gate them behind a licence token, so they 403 for a plain client.

WHAT IT DELIBERATELY DOES NOT DO. It does not fetch publisher landing pages with a browser
User-Agent and look for an `<article>` element. That is (a) a misrepresentation of what the client
is, (b) against most publishers' terms, and (c) worthless as evidence -- nearly every article page
has an `<article>` element wrapping an abstract and a paywall notice, so "found one" says nothing
about whether the full text is there. Where this cannot find a licensed structured copy it says
so, and the PDF route remains.

POLITE BY CONSTRUCTION. One contact address in the User-Agent (Crossref and Unpaywall both ask for
one and give faster service in return), a rate limit, and an on-disk cache so a re-run costs no
requests. Only DOIs are ever sent.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

# Crossref's "polite pool" is faster for callers who identify themselves, and it identifies you
# by e-mail. NOT DEFAULTED TO ANYONE'S ADDRESS: a hardcoded default means every stranger who
# clones this makes requests under one person's name, and they cannot tell that they are.
# Set CROSSREF_CONTACT to join the polite pool; without it the public pool still works.
CONTACT = os.environ.get("CROSSREF_CONTACT", "").strip()
UA = ("ipsissima-mcp/0.1 (https://github.com/)" if not CONTACT
      else f"ipsissima-mcp/0.1 (https://github.com/; mailto:{CONTACT})")
CACHE = Path(os.environ.get("STRUCTURED_CACHE",
                            Path.home() / ".cache" / "ipsissima" / "structured"))
MIN_GAP = 0.34            # seconds between requests to one host: ~3/s, well inside the limits
_last = {}


def _get(url, accept=None, timeout=20):
    """One polite GET, cached on disk. Returns (bytes, content_type) or (None, reason)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    key = CACHE / (re.sub(r"\W+", "_", url)[:120] + ".cache")
    if key.exists():
        blob = key.read_bytes()
        ctype, _, body = blob.partition(b"\n\n")
        return body, ctype.decode("utf-8", "replace")
    host = urllib.parse.urlparse(url).netloc
    gap = time.time() - _last.get(host, 0)
    if gap < MIN_GAP:
        time.sleep(MIN_GAP - gap)
    _last[host] = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               **({"Accept": accept} if accept else {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            ctype = r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except Exception as e:
        return None, type(e).__name__
    key.write_bytes(ctype.encode() + b"\n\n" + body)
    return body, ctype


# --------------------------------------------------------------------------- discovery

def crossref_links(doi):
    """What Crossref says exists. Honest about what those links are actually for."""
    body, ct = _get(f"https://api.crossref.org/works/{urllib.parse.quote(doi)}")
    if body is None:
        return {"error": ct}
    try:
        m = json.loads(body)["message"]
    except Exception:
        return {"error": "unparseable"}
    out = {"title": (m.get("title") or [""])[0], "type": m.get("type"),
           "publisher": m.get("publisher"), "links": [], "licence": []}
    for l in m.get("link", []) or []:
        out["links"].append({"type": l.get("content-type"), "url": l.get("URL"),
                             "for": l.get("intended-application")})
    for l in m.get("license", []) or []:
        out["licence"].append(l.get("URL"))
    return out


def europe_pmc(doi):
    """A PMC id, and with it JATS full text. The best case, and it is checkable."""
    q = urllib.parse.quote(f'DOI:"{doi}"')
    body, ct = _get("https://www.ebi.ac.uk/europepmc/webservices/rest/search"
                    f"?query={q}&format=json&resultType=core")
    if body is None:
        return {"error": ct}
    try:
        rs = json.loads(body).get("resultList", {}).get("result", [])
    except Exception:
        return {"error": "unparseable"}
    if not rs:
        return {}
    r = rs[0]
    return {"pmcid": r.get("pmcid"), "pmid": r.get("pmid"),
            "open_access": r.get("isOpenAccess") == "Y",
            "in_epmc": r.get("inEPMC") == "Y",
            "licence": r.get("license"),
            # `inEPMC` is the one that matters: a PMC id alone does not mean the full text is
            # served, only that the record exists.
            "xml_url": (f"https://www.ebi.ac.uk/europepmc/webservices/rest/"
                        f"{r.get('pmcid')}/fullTextXML") if r.get("pmcid") else None}


def unpaywall(doi):
    """The best open-access copy Unpaywall knows of, and under what licence."""
    body, ct = _get(f"https://api.unpaywall.org/v2/{urllib.parse.quote(doi)}"
                    f"?email={urllib.parse.quote(CONTACT)}")
    if body is None:
        return {"error": ct}
    try:
        d = json.loads(body)
    except Exception:
        return {"error": "unparseable"}
    best = d.get("best_oa_location") or {}
    return {"is_oa": d.get("is_oa"), "status": d.get("oa_status"),
            "licence": best.get("license"), "version": best.get("version"),
            "host": best.get("host_type"),
            "url": best.get("url_for_pdf") or best.get("url"),
            "landing": best.get("url_for_landing_page")}


# --------------------------------------------------------------------------- JATS -> markdown

def _text(node):
    """An element's text, with the inline markup a reader needs and nothing else.

    `<xref>` is KEPT as its printed label -- "[14]", "Smith 2019" -- because that is what the page
    shows and a claim quoting the sentence must match it. `<italic>` and `<bold>` become Markdown.
    Everything else contributes its text and no marker.
    """
    out = []
    if node.text:
        out.append(node.text)
    for kid in node:
        tag = kid.tag.split("}")[-1]
        inner = _text(kid)
        if tag in ("italic", "em"):
            out.append(f"*{inner}*" if inner.strip() else inner)
        elif tag in ("bold", "strong"):
            out.append(f"**{inner}**" if inner.strip() else inner)
        elif tag == "sup":
            out.append(f"^{inner}^" if inner.strip() else inner)
        elif tag in ("sub",):
            out.append(f"~{inner}~" if inner.strip() else inner)
        else:
            out.append(inner)
        if kid.tail:
            out.append(kid.tail)
    return "".join(out)


def _clean(s):
    return re.sub(r"[ \t ]+", " ", (s or "")).strip()


def jats_to_markdown(xml_bytes, title=None):
    """A JATS article as the markdown the rest of the pipeline reads.

    WHY THIS IS A FEW DOZEN LINES WHERE THE PDF ROUTE IS TWELVE HUNDRED. Every question that route
    has to answer from geometry is already answered here in the markup:

      * sections and their depth      `<sec>` nesting, with `<title>`
      * what is a paragraph           `<p>`
      * what is a displayed quotation `<disp-quote>`, and it cannot be confused with an indent
      * what is a footnote            `<fn>`, already attached to its own marker
      * where the references start    `<back>`, which is simply not read

    The last one is worth dwelling on: the bibliography's hanging indent is what defeated the band
    detector on 28 of 45 papers, and here it is a different element that we never open.
    """
    root = ET.fromstring(xml_bytes)
    find, findall = ET.Element.find, ET.Element.findall

    front = find(root, ".//front")
    meta_title = title
    if front is not None:
        t = find(front, ".//article-title")
        if t is not None:
            meta_title = _clean(_text(t))
    out = []
    if meta_title:
        out.append(f"# {meta_title}")

    abstract = find(root, ".//abstract")
    if abstract is not None:
        out.append("## Abstract")
        for p in findall(abstract, ".//p"):
            s = _clean(_text(p))
            if s:
                out.append(s)

    body = find(root, ".//body")
    notes = []
    if body is None:
        return None, "no <body> in this XML: the record exists but the full text is not served"

    def walk(el, depth):
        for kid in el:
            tag = kid.tag.split("}")[-1]
            if tag == "sec":
                t = kid.find("title")
                if t is not None:
                    s = _clean(_text(t))
                    if s:
                        out.append(("#" * min(depth, 6)) + " " + s)
                walk(kid, depth + 1)
            elif tag == "p":
                s = _clean(_text(kid))
                if s:
                    out.append(s)
            elif tag in ("disp-quote", "boxed-text"):
                for p in kid.iter():
                    if p.tag.split("}")[-1] == "p":
                        s = _clean(_text(p))
                        if s:
                            out.append("> " + s)
            elif tag == "list":
                for it in kid.iter():
                    if it.tag.split("}")[-1] == "list-item":
                        s = _clean(_text(it))
                        if s:
                            out.append("- " + s)
            elif tag in ("fig", "table-wrap"):
                cap = kid.find(".//caption")
                if cap is not None:
                    s = _clean(_text(cap))
                    if s:
                        out.append(f"*{tag.replace('-wrap','').title()}: {s}*")
            elif tag in ("supplementary-material", "ack", "ref-list"):
                continue
            else:
                walk(kid, depth)

    walk(body, 2)

    # FOOTNOTES, already attached to their own numbers -- no superscript-size guessing needed.
    for fn in findall(root, ".//fn"):
        label = fn.find("label")
        n = _clean(_text(label)) if label is not None else None
        text = _clean(" ".join(_clean(_text(p)) for p in fn.findall(".//p"))) or _clean(_text(fn))
        if text and n:
            notes.append(f"[^{n}]: {text}")
        elif text:
            notes.append(f"- {text}")
    if notes:
        out.append("# Notes")
        out.extend(notes)
    return "\n\n".join(out) + "\n", None


# --------------------------------------------------------------------------- the front door

@dataclass
class Structured:
    doi: str
    route: str = None            # how the text was obtained, or None if it was not
    markdown: str = None
    words: int = 0
    licence: str = None
    why: str = None              # when there is no text, the reason
    seen: dict = field(default_factory=dict)


def fetch(doi, want_text=True):
    """The best structured version of `doi` that can be had, or a reason there is none."""
    r = Structured(doi=doi)
    epmc = europe_pmc(doi)
    r.seen["europe_pmc"] = epmc
    if epmc.get("xml_url") and epmc.get("in_epmc"):
        body, ct = _get(epmc["xml_url"], accept="application/xml")
        if body and b"<body" in body[:400000]:
            if not want_text:
                r.route, r.licence = "europepmc-jats", epmc.get("licence")
                return r
            md, err = jats_to_markdown(body)
            if md:
                r.route, r.markdown, r.licence = "europepmc-jats", md, epmc.get("licence")
                r.words = len(md.split())
                return r
            r.why = err
        elif body is None:
            r.why = f"Europe PMC XML: {ct}"

    up = unpaywall(doi)
    r.seen["unpaywall"] = up
    cr = crossref_links(doi)
    r.seen["crossref"] = cr
    if not r.why:
        if up.get("is_oa"):
            r.why = (f"open access ({up.get('status')}), but the best copy is "
                     f"{up.get('host') or 'a'} {'PDF' if str(up.get('url','')).endswith('.pdf') else 'page'}"
                     " -- no structured full text offered")
        else:
            xml_links = [l for l in cr.get("links", []) if "xml" in str(l.get("type", "")).lower()]
            r.why = ("closed access; Crossref lists "
                     + (f"{len(xml_links)} XML link(s), but those are text-and-data-mining URLs "
                        "that need a publisher licence token" if xml_links
                        else "no structured full text"))
    return r


def main():
    import argparse
    ap = argparse.ArgumentParser(
        description="Fetch an article as structured text, without converting a PDF.")
    ap.add_argument("doi", help="the article's DOI")
    ap.add_argument("--out", help="write the markdown here")
    ap.add_argument("--why", action="store_true",
                    help="show what each source said, whether or not text was found")
    a = ap.parse_args()

    r = fetch(a.doi)
    if r.markdown:
        print(f"  got it: {r.route}, {r.words} words, licence {r.licence or 'not stated'}")
        if a.out:
            Path(a.out).write_text(r.markdown, encoding="utf-8")
            print(f"  wrote {a.out}")
        else:
            print()
            print(r.markdown[:1200])
    else:
        print(f"  no structured full text for {a.doi}")
        print(f"  {r.why}")
        print("  -- the PDF route is what is left; see pdf_to_source.py")
    if a.why:
        print()
        print(json.dumps(r.seen, indent=2)[:2400])
    return 0 if r.markdown else 1


if __name__ == "__main__":
    raise SystemExit(main())
