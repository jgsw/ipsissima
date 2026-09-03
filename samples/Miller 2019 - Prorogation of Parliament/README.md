# R (on the application of Miller) v The Prime Minister [2019] UKSC 41

*The Supreme Court on the prorogation of Parliament, September 2019. Twenty-five pages, 10,751
words, seventy-one numbered paragraphs, decided unanimously by eleven justices.*

**Crown copyright, re-usable under the Open Government Licence** — the Court's own terms page says
you may re-use Crown copyright material from that website under the terms of the OGL. **The PDF
here came from `supremecourt.uk`**, and that is the licence it arrived under.

**The National Archives route is a different licence, and not a substitute.** Find Case Law
publishes the same judgment under the **Open Justice Licence v2.0**, which excludes "computational
analysis of the Information" and tells you to apply for a separate licence to do it. Converting a
judgment to Markdown and reconstructing it programmatically is on the wrong side of that line, so
the OGL route is not merely the one this file took — it is the one that covers what is done with
it here.

## Why a judgment is in a corpus of philosophy

Every other reconstruction here is an article or a book, and each was chosen for something the
converter or the map had not seen. This one is chosen for something the **reconstruction** has not
seen: a text that argues to a conclusion and is not philosophy.

Three things make it different from anything else in `samples/`, and all three are the point:

- **It is cited by paragraph, not by page.** *Miller (No 2)* at [50] is the address of a claim, and
  it is the only address there is. Recovering those seventy-one numbers from the page cost four
  separate fixes in `pdf_to_source.py` — the numbers sit in the margin beside their first line, and
  every mechanism that looks for furniture found them first. `ipsissima-mcp/eval/INGEST-2026-08.md`
  has the account.
- **The court reasons to a holding**, not to a thesis, and the difference is real: a judgment
  states the law it applies, applies it, and says what follows, in an order the writing itself
  announces. Whether that maps onto premises and conclusions the way an argument does is the open
  question this folder exists to answer.
- **It is unanimous.** There is no dissent to reconstruct as an objection, which removes the
  easiest source of `<-` in the corpus and asks whether the map can show a court disposing of the
  arguments put to it.

## What to look at

The **Exposition** arrangement, and whether the bands land on the judgment's own numbered
paragraphs rather than cutting across them. If a legal reconstruction is going to work in
Ipsissima at all, that is where it will show.

One quiet duty this folder performed for a while: its formalized steps were **deliberately left
without `formalized:` stamps**, so that a future re-run of the samples would exercise the whole
stamp-and-drift loop end to end rather than find it already satisfied. That re-run happened on
3 September 2026 — the loop ran clean and the stamps were written — so the steps here now carry
`formalized:` like the rest of the corpus, and this note records the test rather than the gap.
