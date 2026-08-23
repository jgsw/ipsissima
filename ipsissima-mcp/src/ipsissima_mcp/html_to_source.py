#!/usr/bin/env python3
"""A saved publisher page as markdown. The route that works where the APIs do not.

WHY THIS EXISTS. Publishers serve the full article as HTML to a logged-in reader, and Zotero's
connector -- which IS a browser, with the reader's own session -- saves that page. A script cannot
fetch it: Wiley and Sage sit behind a Cloudflare challenge, and defeating a bot check is not
something this toolchain does. But it does not have to. The snapshot is already on disk.

Measured on this library: 1,206 items have an HTML snapshot, and the ones sampled carry 7,800 to
11,000 words -- whole articles, not abstracts -- in exactly the fields where Europe PMC and
Unpaywall returned nothing (aesthetics, bioethics, applied philosophy).

HOW THE ARTICLE IS FOUND. By TEXT DENSITY, not by publisher patterns. A saved page is mostly
chrome: navigation, cookie banners, "related articles", a footer of society links. But the article
is the one element holding nearly all of the paragraph text, and that is true of every publisher
without anyone maintaining a list of their CSS class names -- which change without notice and
differ per journal even within a publisher.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from epub_to_source import _pandoc_markdown, _tidy                    # noqa: E402

#: Page furniture that is never the article, whatever its text length.
STRIP = ("script", "style", "nav", "header", "footer", "aside", "form", "noscript",
         "iframe", "svg", "button", "select", "label")
#: Class or id fragments that mark chrome. Only used to DISQUALIFY a candidate, never to find one.
CHROME = re.compile(
    r"cookie|banner|nav|menu|masthead|footer|sidebar|related|recommend|advert|promo|"
    r"social|share|metric|altmetric|citation-tools|toolbar|breadcrumb|skip|search|"
    r"newsletter|subscribe|institution|login|access-options", re.I)
#: Where the article stops. Same vocabulary as the PDF route, for the same reason.
BACK_MATTER = re.compile(
    r"^\W*(references?|bibliography|works\s+cited|notes?|endnotes?|acknowledge?ments?|"
    r"further\s+reading|supporting\s+information|supplementary\s+material|"
    r"author\s+information|about\s+the\s+authors?|funding|conflicts?\s+of\s+interest|"
    r"declarations?|data\s+availability|citing\s+articles|related\s+articles)\W*$", re.I)


def _density(el):
    """How much paragraph text this element holds."""
    return sum(len(p.get_text(" ", strip=True)) for p in el.find_all("p", recursive=True))


def _link_ratio(el):
    """How much of the text is inside links. Navigation is nearly all link; prose is nearly none."""
    total = len(el.get_text(" ", strip=True)) or 1
    linked = sum(len(a.get_text(" ", strip=True)) for a in el.find_all("a"))
    return linked / total


def find_article(soup):
    """The element holding the article.

    THE DEEPEST ELEMENT THAT STILL HOLDS MOST OF THE TEXT, not the one holding the most.
    Those sound alike and the difference is the whole problem: `<body>` contains every paragraph
    on the page and therefore always wins on raw density, so scoring by density alone returned
    the entire saved page -- nav, cookie banner, a base64 logo, the footer's legal links, and the
    article somewhere inside it. The article is instead the innermost container that still has
    the bulk of the prose, which is a property no publisher's markup has to opt into.

    A LINK-HEAVY ELEMENT IS NOT PROSE. "Article Contents", "Related articles" and the reference
    list are all mostly anchor text; an argument is almost none.
    """
    for tag in soup.find_all(STRIP):
        tag.decompose()
    cands = []
    for el in soup.find_all(["article", "main", "section", "div"]):
        ident = " ".join(filter(None, [el.get("id") or "", " ".join(el.get("class") or [])]))
        if CHROME.search(ident):
            continue
        d = _density(el)
        if d < 1000:
            continue
        cands.append((d, len(list(el.parents)), el))
    if not cands:
        return None, 0
    top = max(d for d, _depth, _el in cands)
    # Everything holding at least 60% of the best; of those, the deepest wins.
    keep = [c for c in cands if c[0] >= top * 0.6 and _link_ratio(c[2]) < 0.4]
    if not keep:
        keep = [c for c in cands if c[0] >= top * 0.6] or cands
    keep.sort(key=lambda c: (c[1], c[0]))          # deepest, then densest
    best = keep[-1]
    return best[2], best[0]


def cut_back_matter(soup):
    """Drop everything from the references heading on. Returns how many elements went."""
    heads = soup.find_all(["h1", "h2", "h3", "h4"])
    for h in heads:
        if BACK_MATTER.match(h.get_text(" ", strip=True)):
            gone = 0
            for sib in list(h.next_siblings) + [h]:
                if getattr(sib, "decompose", None):
                    sib.decompose()
                    gone += 1
            # The heading may be wrapped in its own section; take the rest of the parent too.
            parent = h.parent if h.parent and h.parent.name in ("section", "div") else None
            if parent:
                for sib in list(parent.next_siblings):
                    if getattr(sib, "decompose", None):
                        sib.decompose()
                        gone += 1
            return gone
    return 0


def convert(path, keep_back_matter=False):
    """A saved article page as markdown. Returns (markdown, report)."""
    raw = Path(path).read_bytes()
    soup = BeautifulSoup(raw, "lxml")
    title = None
    m = soup.find("meta", attrs={"name": "citation_title"})
    if m and m.get("content"):
        title = m["content"].strip()
    elif soup.title:
        title = soup.title.get_text(" ", strip=True)

    body, score = find_article(soup)
    if body is None or score < 1500:
        return None, {"why": f"no element on this page holds enough article text "
                             f"(best was {score} characters) -- the snapshot is probably a "
                             f"landing page or a paywall notice, not the article"}
    cut = 0 if keep_back_matter else cut_back_matter(body)
    md = _tidy(_pandoc_markdown(str(body).encode("utf-8"), None))
    if title and not md.lstrip().startswith("#"):
        md = f"# {title}\n\n{md}"
    return md, {"title": title, "chars": score, "back_matter_elements_cut": cut,
                "words": len(md.split())}


def main():
    ap = argparse.ArgumentParser(description="Convert a saved article page to markdown.")
    ap.add_argument("html")
    ap.add_argument("--out")
    ap.add_argument("--keep-back-matter", action="store_true")
    a = ap.parse_args()
    md, rep = convert(a.html, a.keep_back_matter)
    if md is None:
        print("  " + rep["why"])
        return 1
    print(f"  {rep['title'] or '(untitled)'}")
    print(f"  {rep['words']:,} words; {rep['back_matter_elements_cut']} back-matter element(s) cut")
    if a.out:
        Path(a.out).write_text(md, encoding="utf-8")
        print(f"  wrote {a.out}")
    else:
        print()
        print(md[:900])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
