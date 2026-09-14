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
ought to be in sync from getting out of sync."* Drafted as E10 in `docs/values/INVENTORY.md`
and **admitted as worded the same day** — see §4.

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

## 3. The questions, as ruled (14 Sep)

1. **E10 — admitted as worded.** The ⟨proposed⟩ marker is off; `INVENTORY.md` E10 stands.
2. **Scope of v1 — agreed.** Display-only first: Zotero highlights shown in the manuscript
   pane, read-only, proving the placement machinery on real data; write-back second.
3. **The no-Zotero reader — deferred, and enlarged before being deferred.** The author's
   framing: can highlights and comments embedded in a PDF be taken up at ingest? Which
   other applications besides Zotero deserve support? "Scoping this is a project in its
   own right and could be deferred for the moment." Both questions are recorded here as
   the deferral's contents — the PDF-annotations-at-ingest idea is a real candidate (the
   converters already read the PDF; embedded annotations carry text and page, the same
   two hooks §1 relies on), and it would arrive on the MCP side rather than the App's.
4. **The C1 collision — ruled: a targeted narrowing.** "I would favour a targeted
   narrowing of the no-network principle to accommodate this case." C1 carries the
   addendum (`INVENTORY.md`): the one-file page's absolute promise untouched; the desktop
   application's sentence re-drawn so that traffic to Zotero on the same machine —
   a conversation between two programs the reader runs, opened only when the reader
   connects it — is distinguished from anything leaving the machine, which remains
   exactly one request, on explicit request. The public promise copy changes only when
   the feature ships (D6).
5. **Text-first** (Formation item 6) — still held open, to be settled with this
   programme's build rather than before it.

## 4. The principle, and where it came from

E10, admitted 14 Sep: *one source of truth where possible; where duplication is unavoidable, the
copies are held together by machinery, not by care.* Origin: author (14 Sep, verbatim in the
provenance field). It is E4's spirit widened from the project's own artifacts to the user's
data across systems — E4 governs what the build derives; E10 would govern what the *user's
tools* both hold. Enacted before stated, heavily: the six version files under one test, the
two front-matter readers pinned by a cross-check, the dead-field lint, the export that is
the Reader byte-for-byte, the fold-state identifier's round-trip. The Zotero round-trip
would be its first application *outward*, and the reason it needs stating: between two
programs, "prevent the second copy" is a design decision, not a lint.

## 5. Standing

The rulings are in (§3): E10 admitted, the v1 scope agreed, the C1 narrowing ruled, the
no-Zotero question deferred as its own future project. What remains before the v1 build is
engineering design, not values: how the desktop host reaches Zotero's local API, how a
source names its Zotero item (what `from_zotero.py` already records is the first thing to
measure), and what the manuscript pane draws for a highlight. The build proceeds on that
design; the promise copy moves only when it ships.
