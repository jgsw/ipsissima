#!/usr/bin/env python3
"""Rebuild the source text of the J-PAL sample from the FACTS Reports reprint.

WHICH TEXT, AND WHY THIS ONE. "The Price is Wrong" first appeared as a J-PAL Policy Bulletin
(April 2011). That bulletin states no licence. The same text was reprinted in Field Actions
Science Reports, Special Issue 4 (2012), pp. 30-37, whose PDF says "This work is distributed under
the Creative Commons Attribution 3.0 License" (the journal's page now gives CC BY 4.0 for the text,
and says illustrations may carry terms of their own). So the reprint is the text this sample
carries, and only its TEXT: the figures are not reproduced, only their captions.

THE ROUTE IS IPSISSIMA'S OWN. `ingest.py` converts the PDF exactly as `extract_text` does. The
reprint is set in two columns with boxes, a table and three charts, and the conversion runs them
into the prose: table cells in mid-sentence, chart axes as paragraphs, boxes splitting a sentence
in two. Each repair below is one of four kinds, and says why:

  * STRUCTURE -- a heading made a heading, a table made a table, a list made a list;
  * MOVE      -- a box or a table taken out of the sentence it interrupted and set after it;
  * DROP      -- page furniture removed: chart axes and legends, page numbers, running heads,
                 the journal's cover sheet (its details are in the front matter instead);
  * REJOIN    -- a word the PDF hyphenated at a line end, `eva- luation`, made one word again.

NO WORDING IS ALTERED, AND THIS SCRIPT CHECKS IT. The last step counts every word of the converted
text and every word of the result, and refuses to write unless they differ by exactly the words
the DROP repairs name. A repair that changed, lost or invented a word fails the build.

A PARAGRAPH THAT RUNS ACROSS A PAGE IS KEPT WHOLE, on the page where it starts, and the page
marker follows it. The quotation checker does not read through a page marker, and a sentence
broken by one could not be quoted.

    python3 make_source.py path/to/factsreports-1554.pdf

The PDF is not in this repository: the typesetting is the publisher's. The journal's page is
https://journals.openedition.org/factsreports/1554.
"""
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUILD = HERE.parents[1] / "ipsissima-mcp" / "src" / "ipsissima_mcp"
WANTED = HERE / "source" / "bates-2012-price-is-wrong.md"

FRONT = """---
title: "The Price is Wrong"
author: "Mary Ann Bates, Rachel Glennerster, Kamilla Gumede and Esther Duflo"
source: "Field Actions Science Reports, Special Issue 4 (2012), pp. 30-37; first published as a J-PAL Policy Bulletin, April 2011"
url: "https://journals.openedition.org/factsreports/1554"
licence: "CC-BY-3.0"
licence_url: "https://creativecommons.org/licenses/by/3.0/"
rights: "© Author(s) 2012. The text is distributed under the Creative Commons Attribution 3.0 License (as the reprint's PDF states; the journal's page now gives CC BY 4.0 for the text). The figures are not reproduced."
abstract: >-
  Charging small fees dramatically reduces access to important products for the poor. Relative
  to free distribution, charging even very small user fees substantially reduces adoption.
  There is no evidence that the act of paying for a product makes a recipient more likely to
  use it. In general, cost-sharing does not appear to concentrate adoption on those who need
  products most. Receiving a product for free can even increase willingness to pay for it
  later. There may be other reasons to charge.
---

<!-- CONVERTED TEXT - NOT THE PUBLISHED DOCUMENT.
     Made by make_source.py from the FACTS Reports reprint (factsreports-1554.pdf), by
     Ipsissima's own PDF route and then the repairs that script lists and explains: headings,
     Table 1 and the lists made structural; the boxes and the table moved out of the sentences
     they interrupted; chart axes, legends, page numbers, running heads and the journal's cover
     sheet dropped; four line-end hyphenations rejoined. No wording is altered, and the script
     checks that word for word. The figures are not reproduced; their captions are kept.
     A paragraph that runs across a page is kept whole on the page where it starts.
     The <!-- p.N --> markers are the journal's printed page numbers. -->

"""

TABLE_1 = """Table 1. Featured evaluations.

| | Product | Researchers | Location | Prices tested | Approximate market price |
|---|---|---|---|---|---|
| 1 | Deworming medicine | Kremer, Miguel | Kenya | free, $0.30 | $0.50-1.50 |
| 2. | Long-lasting insecticidal bednets (at prenatal clinics) | Cohen, Dupas | Kenya | free, $0.15 to $0.60 | $6.00 |
| 3 | Long-lasting insecticidal bednets (vouchers given to households) | Dupas | Kenya | free up to $4.60 | $7.63 |
| 4 | Long-lasting insecticidal bednets (follow-up to study #3) | Dupas | Kenya | $2.30 | $7.63 |
| 5 | Long-lasting insecticidal bednets (received cash or nets) | Hoffman, Barret, Just | Uganda | free up to $7.63 | $7.63 |
| 6 | Water desinfectants | Ashraf, Berry, Shapiro | Zambia | free, $0.25 | $0.09 to $0.25* |
| 7 | Water desinfectants | Kremer, Miguel, Null, Zwane | Kenya | free, $0.30 | $0.15 and $0.30 |
| 8 | Handwashing soap | Spcars | India | $0.06 and $0.30 | $0.52 |
| 9. | School uniforms, primary school children | Evans, Kremer, Ngatia | Kenya | free, $5.82 | $5.82 |
| 10. | School uniforms, 14 years old students | Duflo, Dupas, Kremer, Sinei | Kenya | free, $6.00 | $6.00 |"""

# (kind, pattern, replacement, dropped furniture, why). A pattern is a regular expression and must
# match exactly once. `dropped` is the text a DROP removes, and is all the word check forgives.
S = re.S
REPAIRS = [
    ("drop", r"<!-- p\.29 begins here -->\n\n.*?(?=<!-- p\.30 begins here -->)", "",
     "Field Actions Science Reports The journal of field actions Special Issue 4 | 2012 Fighting "
     "Poverty, between market and gift The Price is Wrong Mary Ann Bates, Rachel Glennerster, "
     "Kamilla Gumede and Esther Duflo Electronic version URL: http://journals.openedition.org/"
     "factsreports/1554 ISSN: 1867-8521 Publisher Institut Veolia Electronic reference Mary Ann "
     "Bates, Rachel Glennerster, Kamilla Gumede and Esther Duflo, « The Price is Wrong », Field "
     "Actions Science Reports [Online], Special Issue 4 | 2012, Online since 12 June 2012, "
     "connection on 03 June 2020. URL : http://journals.openedition.org/factsreports/1554 © "
     "Author(s) 2012. This work is distributed under http://factsreports.revues.org/1554 "
     "Published 31 May 2012 AThe Price is Wrong Mary Ann Bates, Rachel Glennerster, Kamilla "
     "Gumede, Esther Duflo (J-PAL) p 29 begins here",
     "the journal's cover sheet and the reprint's masthead; their details are in the front matter"),
    ("structure", r"\n\n1\n\n> (Charging small fees dramatically reduces access to important products for the poor\.)\n\n",
     r"\n\n# 1 \1\n\n", "", "the first section's number and title, set as a heading"),
    ("structure", r"\n\n2 Evaluations (This bulletin reviews)", r"\n\n# 2 Evaluations\n\n\1", "",
     "the second section's heading, run into its first paragraph"),
    ("move", r" (Table 1\. Featured evaluations\.)\n\n(<!-- p\.31 begins here -->)\n\nProduct Researchers\n\n"
             r"# 1 Deworming medicine Kremer, Miguel\n\n2\. Long-lasting insecticidal bednets \(at prenatal clinics\) Cohen, Dupas\n\n"
             r"# 3 Long-lasting insecticidal bednets Dupas\n\n\(vouchers given to households\)\n\n"
             r"# 4 Long-lasting insecticidal bednets Dupas\n\n\(follow-up to study #3\)\n\n"
             r"# 5 Long-lasting insecticidal bednets Hoffman, Barret,\n\n\(received cash or nets\) Just\n\n"
             r"# 6 Water desinfectants Ashraf, Berry, Shapiro\n\n# 7 Water desinfectants Kremer, Miguel, Null, Zwane\n\n"
             r"# 8 Handwashing soap Spcars\n\n9\. School uniforms, primary school children Evans, Kremer, Ngatia\n\n"
             r"10\. School uniforms, 14 years old students Duflo, Dupas, Kremer, Sinei\n\n"
             r"(\* These prices include prices initially offered to customers and prices offered after a second round of discounts\.) "
             r"(prevent diarrhea\).*?to 14-year-old children\.)\n\n",
     r" \4\n\n\2\n\n@TABLE@\n\n\\\3\n\n", "",
     "Table 1's left half sat inside the sentence it interrupted, its rows read as headings; the "
     "sentence is rejoined and the table set after its paragraph (its cells are laid out below)"),
    ("move", r" www\.factsreports\.org Approximate\n\nLocation Prices tested market price\n\n"
             r"Kenya free, \$0\.30 \$0\.50-1\.50\n\nKenya free, \$0\.15 to \$0\.60 \$6\.00\n\n"
             r"Kenya free up to \$4\.60 \$7\.63\n\nKenya \$2\.30 \$7\.63\n\nUganda free up to \$7\.63 \$7\.63\n\n"
             r"Zambia free, \$0\.25 \$0\.09 to \$0\.25\*\n\nKenya free, \$0\.30 \$0\.15 and \$0\.30\n\n"
             r"India \$0\.06 and \$0\.30 \$0\.52\n\nKenya free, \$5\.82 \$5\.82\n\nKenya free, \$6\.00 \$6\.00 (price that averaged)",
     r" \1", "www.factsreports.org",
     "Table 1's right half, run into the sentence about the deworming fee; joined to the left half "
     "above, row by row. The running footer goes"),
    ("structure", r"@TABLE@", TABLE_1.replace("\\", "\\\\"), "", "Table 1, whole"),
    ("structure", r"\n\n3 Results 3\.1\n\nResult 1:\n\nSmall fees cause big reductions in take-up (A common policy)",
     r"\n\n# 3 Results\n\n## 3.1 Result 1: Small fees cause big reductions in take-up\n\n\1", "",
     "the results section and its first result, set as headings"),
    ("move", r"(about as steep as)\n\n(<!-- p\.32 begins here -->)\n\n80%\n\n70%\n\n60%\n\n50%\n\n40%\n\n30%\n\n20%\n\n"
             r"10% \$0\.10 \$0\.20 \$0\.30 \$0\.40 \$0\.50 \$0\.60 \$0\.70 PRICE OF PRODUCTS \(2009 USD\) "
             r"(Figure 1\. Demand for Preventive Healthcare Products Based on Price) (the drop in demand.*?subsidy level\.)\n\n",
     r"\1 \4\n\n\2\n\n\3\n\n",
     "80% 70% 60% 50% 40% 30% 20% 10% $0.10 $0.20 $0.30 $0.40 $0.50 $0.60 $0.70 PRICE OF PRODUCTS (2009 USD)",
     "Figure 1's axes dropped and its caption kept; the sentence the chart split is rejoined"),
    ("structure", r"(school\.) 3\.2\n\nResult 2:\n\nFees do not substantially promote use (For some products)",
     r"\1\n\n## 3.2 Result 2: Fees do not substantially promote use\n\n\2", "", "the second result's heading"),
    ("move", r"(Chlorine does not)\n\n32 DEWORMING, KENYA\n\nBEDNETS IN CLINICS, KENYA\n\nBEDNET VOUCHERS, KENYA\n\n"
             r"WATER DISINFECTANT, ZAMBIA\n\nWATER DISINFECTANT, KENYA\n\nSOAP, INDIA \$0\.80\n\n> \$0\.90 \$1\.00 "
             r"(Spillover effects may justify free distribution.*?priority for free distribution\.)\n\n"
             r"(prevent diarrhea if it is not regularly added.*?used correctly\.)\n\n",
     r"\1 \3\n\n> \2\n\n",
     "32 DEWORMING, KENYA BEDNETS IN CLINICS, KENYA BEDNET VOUCHERS, KENYA WATER DISINFECTANT, ZAMBIA "
     "WATER DISINFECTANT, KENYA SOAP, INDIA $0.80 $0.90 $1.00",
     "Figure 1's legend and a page number dropped; the spillovers box moved out of the sentence it split"),
    ("move", r"(resources from being) Field Actions Science Reports 69 % 70 %\n\n(<!-- p\.33 begins here -->)\n\n"
             r"63 %\n\n61 %\n\nFree\n\nPositive Free Positive\n\nPrice Price\n\n"
             r"BEDNETS, VOUCHERS, KENYA BEDNETS, VOUCHERS, KENYA\n\nAFTER 2 MONTHS AFTER 1 YEAR\n\n4 (Figure 2\.)\n\n"
             r"(Does free distribution)\n\n> (to the poor lead to reselling\?.*?address it\.)\n\n"
             r"(wasted, believing.*?it does not\.)\n\n(Figure 2 summarizes.*?recipients’ houses to) www\.factsreports\.org\n\n"
             r"87 % 55 % 46 %\n\nFree\n\nPositive Free Positive\n\nPrice Price\n\n"
             r"BEDNETS, UGANDA WATER DISINFECTANT, ZAMBIA\n\nAFTER 3 WEEKS AFTER 2 WEEKS\n\n5 6 (see if products.*?usage is higher\.)\n\n",
     r"\1 \6\n\n\2\n\n\3\n\n\7 \8\n\n> \4 \5\n\n",
     "Field Actions Science Reports 69 % 70 % 63 % 61 % Free Positive Free Positive Price Price "
     "BEDNETS, VOUCHERS, KENYA BEDNETS, VOUCHERS, KENYA AFTER 2 MONTHS AFTER 1 YEAR 4 "
     "www.factsreports.org 87 % 55 % 46 % Free Positive Free Positive Price Price "
     "BEDNETS, UGANDA WATER DISINFECTANT, ZAMBIA AFTER 3 WEEKS AFTER 2 WEEKS 5 6",
     "Figure 2's bars and labels dropped and its caption kept; two sentences it split are rejoined, "
     "and the reselling box, whose title the layout broke in two, set after them"),
    ("structure", r"(free distribution\.) 3\.3\n\n> (Result 3: Cost-sharing fails to target those who most need a product)\n\n",
     r"\1\n\n## 3.3 \2\n\n", "", "the third result's heading"),
    ("move", r"(children with high parasitic worm loads would)\n\n34\n\n(> Charging small fees in an attempt.*?restrict access for the poor\.)\n\n"
             r"(have benefited most.*?lower willingness to pay for bednets\.) Field Actions Science Reports\n\n(<!-- p\.35 begins here -->)\n\n",
     r"\1 \3\n\n\2\n\n\4\n\n", "34 Field Actions Science Reports",
     "the summary box moved out of the sentence it split; a page number and a running head dropped"),
    ("structure", r"(> Charging small fees in an attempt.*?restrict access for the poor\.)",
     lambda m: m.group(1).replace(" • ", "\n>\n> - "), "", "the summary box's bullets, set as a list"),
    ("structure", r"(most\.) 3\.4\n\nResult 4:\n\nLong-term effects of free distribution (Many NGOs)",
     r"\1\n\n## 3.4 Result 4: Long-term effects of free distribution\n\n\2", "", "the fourth result's heading"),
    ("structure", r"(in the past\.) 3\.5\n\nResult 5:\n\nWhy are people so sensitive to small user fees\? (Individuals in)",
     r"\1\n\n## 3.5 Result 5: Why are people so sensitive to small user fees?\n\n\2", "", "the fifth result's heading"),
    ("move", r"(willing to pay on average \$2\.34 for) www\.factsreports\.org\n\n(> User fee revenue comes at a cost.*?save many more lives\.)\n\n"
             r"(a bednet\. When the researchers.*?\(\$5\.94\)\.)\n\n",
     r"\1 \3\n\n\2\n\n", "www.factsreports.org",
     "the revenue box moved out of the sentence it split; the running footer dropped"),
    ("move", r"(credit was available for the bednet\.) BEDNETS IN CLINICS, KENYA BEDNET VOUCHERS, KENYA\n\n(<!-- p\.36 begins here -->)\n\n"
             r"80%\n\n60%\n\n40%\n\n20%\n\n\$0\.20 \$0\.40 \$0\.60 \$0\.80 \$1\.00 PRICE OF PRODUCTS \(2009 USD\) "
             r"(Figure 3\. Price Sensitivity Falls when People Have More Time to Buy\.) (This suggests that.*?loan repayments\)\.)\n\n",
     r"\1\n\n\2\n\n\3\n\n\4\n\n",
     "BEDNETS IN CLINICS, KENYA BEDNET VOUCHERS, KENYA 80% 60% 40% 20% $0.20 $0.40 $0.60 $0.80 $1.00 "
     "PRICE OF PRODUCTS (2009 USD)",
     "Figure 3's legend and axes dropped and its caption kept, as its own paragraph"),
    ("structure", r"\n\n4 Convenience also matters (Just as people)", r"\n\n# 4 Convenience also matters\n\n\1", "",
     "the fourth section's heading"),
    ("structure", r"\n\n5 Does deliberation deter purchases\? (One study)", r"\n\n# 5 Does deliberation deter purchases?\n\n\1", "",
     "the fifth section's heading"),
    ("drop", r"(the magnitude of the effect was)\n\n36 (small, and at best)", r"\1 \2", "36",
     "a page number dropped from the sentence it split"),
    ("structure", r"\n\n6 Policy Lessons (Charging small fees)", r"\n\n# 6 Policy Lessons\n\n\1", "",
     "the sixth section's heading"),
    ("move", r"(offered for free\?) 6\.1\n\n> When to distribute for free • (When benefits extend.*?Many cost-effective preventive)\n\n"
             r"Field Actions Science Reports\n\n(<!-- p\.37 begins here -->)\n\n(> What we don’t know about charging.*?user fees or cost-sharing\.) "
             r"(health products are available.*?where children benefit but parents have to pay)\n\n(user fees, there may similarly.*?the poor and women\.)\n\n",
     r"\1\n\n## 6.1 When to distribute for free\n\n- \2 \5 \6\n\n\3\n\n\4\n\n", "Field Actions Science Reports",
     "section 6.1 set as a heading and its list rejoined across the box and the page; the "
     "what-we-don't-know box set after it; a running head dropped"),
    ("structure", r" • (When products and services are aimed)", r"\n- \1", "", "6.1's second item"),
    ("structure", r" • (When the product is very cost-effective\.)", r"\n- \1", "", "6.1's third item"),
    ("drop", r"(even small ones,) www\.factsreports\.org (are imposing)", r"\1 \2", "www.factsreports.org",
     "the running footer, dropped from the closing sentence"),
] + [
    # The four boxes run their titles into their first sentences.
    ("structure", rf"\n> ({title}) ", r"\n> **\1**\n>\n> ", "", "a box's title, set on its own line")
    for title in (r"Spillover effects may justify free distribution",
                  r"Does free distribution to the poor lead to reselling\?",
                  r"User fee revenue comes at a cost",
                  r"What we don’t know about charging")
]

REJOIN = "­ "   # a soft hyphen the PDF set at a line end, followed by the line break's space


def words(text):
    return Counter(re.findall(r"[^\W_]+", text))


def build(converted):
    body = converted[converted.index("<!-- p.29 begins here -->"):]
    rejoined = body.count(REJOIN)
    body = body.replace(REJOIN, "")
    before, dropped = words(body), Counter()
    for kind, pattern, repl, gone, why in REPAIRS:
        n = len(re.findall(pattern, body, flags=S))
        if n != 1:
            sys.exit(f"repair matched {n} times, not once ({kind}: {why})\n  {pattern[:120]}")
        body = re.sub(pattern, repl, body, count=1, flags=S)
        dropped += words(gone)
    after = words(body)
    # THE CHECK. What went in, less the furniture named above, is exactly what comes out.
    lost, gained = (before - dropped) - after, after - (before - dropped)
    if lost or gained or dropped - before:
        sys.exit(f"the repairs altered the wording:\n  lost {dict(lost)}\n  gained {dict(gained)}\n"
                 f"  named but absent {dict(dropped - before)}")
    return FRONT + body.lstrip(), rejoined


if __name__ == "__main__":
    pdf = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else None
    if pdf is None or not pdf.exists():
        sys.exit(__doc__.strip() + "\n\nGive it the reprint's PDF.")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, str(BUILD / "ingest.py"), str(pdf), "--out", tmp, "--no-ocr"],
                       check=True, stdout=subprocess.DEVNULL)
        made = list(Path(tmp, "source").glob("*.md"))
        if len(made) != 1:
            sys.exit(f"expected one converted file, found {len(made)}")
        text, rejoined = build(made[0].read_text(encoding="utf-8"))
    WANTED.parent.mkdir(exist_ok=True)
    WANTED.write_text(text, encoding="utf-8")
    print(f"wrote {WANTED.relative_to(HERE)}: {len(REPAIRS)} repairs, {rejoined} hyphenations "
          f"rejoined, every word accounted for")
