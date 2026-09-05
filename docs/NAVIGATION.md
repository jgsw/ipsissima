# Cross-pane navigation: the gestures, audited

5 September 2026, at the author's direction (the Second Thoughts episode's editor programme
opens with this audit): when does a gesture on a claim in one pane centre that claim in the
other open panes, and when may it open a pane that is closed? First the behaviour as found,
then the audit against the values framework, then what moved. The reader-facing half of this
document is in `app/help.md` under "The claim and its source"; this file is the record and
the full table.

## The doctrine

The code had already stated it, in `followClaim`'s docstring: *"the answer should reach every
pane that can say something about it… Which of the three the reader is looking at is their
business, not the code's."* Made explicit, the design is **two kinds of gesture keeping two
different promises**:

- **Selection** — "this one." Shows the claim in every pane that is *already open*, and opens
  none (B2, the reader's own pace; P6, attention). Selecting is not a summons.
- **Go to the passage** — the one request that *opens* a pane (the Manuscript), because the
  pane is the very thing asked for. Opening it is not attention claimed but attention served.

Two deliberate exceptions, each summoning exactly the pane it needs: the folded corner of a
commented claim opens the **Notes** pane — that glyph's whole meaning is "there is a margin
entry here" — and (since selection-to-claim landed the same day, `EDITOR-PLAN.md` §2) the
selection-to-claim buttons — **Quote this passage** and **Paraphrase it** — open the
**Argdown** pane, because writing into the file is the very thing they ask for.

## The table, as found (and where changed, as it now is)

| from | gesture | effect | opens a pane? |
|---|---|---|---|
| map claim | click, or <kbd>Enter</kbd> | marked current, lit on the map; nothing else | no |
| map claim | double-click / shift-click / alt-click / <kbd>Shift</kbd>+<kbd>Enter</kbd> | Argdown pane taken to the claim's line (when the editor exists); Manuscript opened and scrolled to the passage, precision noted | **Manuscript** |
| map claim | right-click, or the context-menu key | menu: Go to source, Fold section (groups), comments, Export…, the Key | no (a menu offers; it does not act) |
| map claim, folded corner glyph | click | Notes pane opened at that entry, then the ordinary selection | **Notes** (the thing asked for) |
| Argdown pane, a `[claim]` name | click (editor decoration; `.ref` + <kbd>Enter</kbd> in the Reader's read-only pane) | selection: lit on map, own line revealed; passage only if the Manuscript pane is open *(changed — see finding 2)* | no |
| Notes pane, an entry | click | the same selection | no |
| Manuscript, a passage | click | every claim drawn from that passage lights on the map (deliberately plural — 57% of placed claims share a line); camera moves only when they can all be framed. A drag that merely selects does neither: while words are selected the lighting gesture stands down | no |
| Manuscript, a selection | **Quote this passage** / **Paraphrase it** | a new claim written into the Argdown with its provenance filled in; what arrives selected is the human's half — the title for a quotation, the placeholder text for a paraphrase (`EDITOR-PLAN.md` §2) | **Argdown** (the pane written into) |
| Manuscript, chapter select | change | switches the chapter, clears the note | no |

Notes on two asymmetries that survive the audit unchanged:

- **Manuscript→map lights many, map→manuscript goes to one.** A passage can father several
  claims and the tool refuses to guess which was wanted; a claim cites exactly one passage.
  Aligned with F1 (the picture says only what the file says) — kept.
- **The editor reveal happens even when the Argdown pane is closed.** `ED` outlives the pane,
  so a hidden editor still scrolls; the pane then *reopens at the last followed claim*, which
  serves the reader rather than surprising them (F3 — the mental map survives). Kept, noted.

## What the audit found, against the framework

1. **A sourceless map got a reading-genre error (B7, F2).** On a map that cites no text — the
   survey genre — the go-to-passage gesture raised *"Drop the reconstruction's FOLDER rather
   than the .argdown"*: advice to produce a manuscript that has never existed, the viewer-side
   twin of the checker fault fixed the same day. **Changed**: the gesture now tells the genre
   apart the way the Manuscript tab does (does any claim cite a chapter?) and answers *"This
   map reads no text, so its claims have no passages to go to"* — and only when the gesture
   did nothing visible (an open Argdown pane, already taken to the claim's line, has answered).
2. **Selection summoned the Manuscript (P6, B2, and the doctrine's own words).** `followClaim`
   — the selection used by the Argdown claim-click, the Notes list, and the Reader's `.ref`
   links — called `msLocate`, which opens the Manuscript pane. A selection was acting as a
   summons, against the docstring sitting directly above the call. **Changed**: `followClaim`
   locates in the Manuscript only when that pane is already open. The two comments and the
   help topic that promised the old behaviour were updated with it — a promise and its code
   must move together (C5/F2).
3. **A disabled "Go to source" said nothing (the tab policy, 3 Sep).** The menu item was
   rightly disabled when there is nothing to go to, but carried no reason, where the disabled
   Manuscript tab carries its remedy. **Changed**: the item now says which of the three cases
   holds — a map that reads no text (nothing to obtain), a cited manuscript the viewer has no
   copy of (drop the folder), a claim that cites no file.

## Why this came first in the editor programme

The coming editor work — completion, indentation, selection-to-claim — hangs off exactly this
wiring: every new affordance will either select or summon, and the doctrine above is the rule
they inherit. Auditing before building is the cheap order (E-cluster: definitions before
repairs).
