# The annotations programme: the reader's marks, and one source of truth

Opened 14 September 2026, from the author's analysis of the text-first question (the
Formation queue's item 6): the question of which pane opens first turned out to sit inside a
larger one — *where does the reader do their serious reading, and where do their marks
live?* The author's own workflow: the library lives in Zotero; the reading happens in the
Zotero app on an Android tablet; passages are highlighted and annotated there, for use
later. Two implications, in his words' order:

1. **Marks on the manuscript.** Someone seriously reading an article *in Ipsissima* may want
   to highlight and annotate the source text itself — not only the map's claims, which is
   what the margin machinery serves today.
2. **Round-tripping with Zotero.** It would be very helpful to move highlights and
   annotations between the item in Zotero and the text (or map) as Ipsissima presents it.

And a candidate principle, proposed by the author with the second implication: *"having a
single source of truth if at all possible, and using design decisions to prevent things that
ought to be in sync from getting out of sync."* Drafted as E10 ⟨proposed⟩ in
`docs/values/INVENTORY.md`, awaiting admission — see §4.

## 1. Feasibility, measured against the machinery that exists

**Zotero → Ipsissima is genuinely feasible, by the project's own methods.** A Zotero
highlight carries the highlighted *text* and the printed *page*. Ipsissima's converted
sources keep both hooks: the quotation-verification machinery already locates a quoted span
in a converted Markdown source through every normalisation the converters introduce
(`find_quote` and its whole discipline), and `pdf_to_source.py` writes the printed page at
every break (`<!-- p.N begins here -->`), which bounds any search and arbitrates any
ambiguity. So a highlight made in Zotero can be *placed* in the manuscript pane exactly the
way a claim's quotation is placed today — same code path, same honesty about failure (a
highlight whose text cannot be found is reported, not dropped).

**Ipsissima → Zotero is feasible for highlights, with a caveat.** Creating a PDF annotation
needs a page and a position; the page is known (the p.N markers), and Zotero's API accepts
text-anchored highlights. What the converted Markdown cannot supply is sub-page *rectangle*
precision — acceptable for highlights, and a reason to treat comment-anchoring carefully.
The MCP already speaks to Zotero (`from_zotero.py`, `zotero_lookup`), so the transport
exists; what would be new is the annotation traffic.

## 2. The design that follows from the principle

If E10 is admitted, it answers the storage question before it is asked: **Ipsissima should
not keep a second store of the reader's marks on the text.** For a reader whose annotation
home is Zotero, Ipsissima *displays* Zotero's highlights in the manuscript pane and *writes
new ones back to Zotero* — one source of truth, the sync problem prevented by never creating
the second copy. For a reader with no Zotero, the fallback question (a `highlights:` block
in the bundle? nothing?) is real and is put in §3 rather than answered here.

This also re-frames the text-first question the author opened: the manuscript pane becomes
more worth opening first the more it carries the reader's own working marks. The two
questions should be settled together, and neither is settled here.

## 3. The questions put to the author

1. **E10** — admit as worded (`INVENTORY.md` ⟨proposed⟩)?
2. **Scope of v1.** Display-only (Zotero highlights shown in the manuscript pane, read-only)
   is the smallest honest step and proves the placement machinery on real data. Write-back
   second. Agreed?
3. **The no-Zotero reader.** A second store in the bundle contradicts E10's spirit unless it
   is the *only* store for that reader (in which case it is not a second one). Carry a
   bundle-native highlights block for Zotero-less readers, or defer?
4. **Where the traffic runs.** The App is no-network by promise (C1); Zotero's local API is
   a localhost port, and the desktop app is the natural host for it — but any route needs
   the C1 sentence rewritten with the same per-artifact precision the update check got.
   This is the heaviest question and gates everything above.
5. **Text-first** (Formation item 6) — held open deliberately, to be settled with this
   programme rather than before it.

## 4. The candidate principle, and where it came from

E10 ⟨proposed⟩: *one source of truth where possible; where duplication is unavoidable, the
copies are held together by machinery, not by care.* Origin: author (14 Sep, verbatim in the
provenance field). It is E4's spirit widened from the project's own artifacts to the user's
data across systems — E4 governs what the build derives; E10 would govern what the *user's
tools* both hold. Enacted before stated, heavily: the six version files under one test, the
two front-matter readers pinned by a cross-check, the dead-field lint, the export that is
the Reader byte-for-byte, the fold-state identifier's round-trip. The Zotero round-trip
would be its first application *outward*, and the reason it needs stating: between two
programs, "prevent the second copy" is a design decision, not a lint.

## 5. Standing

Nothing is built. The feasibility analysis is this document; the principle awaits admission;
the four scope questions await rulings. The comparison surface (PLURALITY-PLAN) and study
mode shipped first because they needed no new promises; everything here touches either C1
or a second data store, and neither is the assistant's to decide.
