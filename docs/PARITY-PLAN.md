# What only the menus can reach: a parity sweep, and the plan

Written 3 September 2026, after the author met the gap in the HTML version: some functions now
exist only behind the desktop application's native menus. The question: what functionality is
desktop-only, which of it *should* the HTML version have, and how does it get there.

The sweep's measuring stick is the project's own doctrine, stated where the menu is wired
(`argdown-viewer.template.html`, the `HOST.onMenu` block): **"the menu rings the same doorbells
as the buttons — no menu item has behaviour of its own."** A menu id with no page doorbell is
the drift this sweep looks for. Facts marked **[measured]** were read from the tree today.

---

## 1. The sweep

All 22 menu ids in `lib.rs`, against their page doorbells in the HTML builds **[measured]**:

| menu id | page doorbell in the HTML build | verdict |
|---|---|---|
| `about` | How to use ▸ About Ipsissima (help contents entry) | ✓ |
| `new` | "start a new one" on the empty state — editor builds only, which is right: the Reader is read-only | ✓ |
| `open` | Open… button (shown in standalone builds) and the empty state's picker | ✓ |
| `open-folder` | the empty state's folder picker; after a map is open, dropping a folder is the documented route | ✓ (see §3) |
| `save`, `save-as` | the editor bar's Save / Save as…, shown once the editor is live | ✓ |
| `export` | the Export button | ✓ |
| `find` | the editor bar's Find | ✓ |
| `undo`, `redo` | the Undo/Redo buttons, appearing once there is something to take back | ✓ |
| `fit`, `layout` | the Fit and Layout buttons | ✓ |
| `view-reasons`, `view-exposition` | the arrangement toggle | ✓ |
| `pane-map/argdown/notes/text` | the pane buttons | ✓ |
| `walkthrough` | How to use ▸ Take the walkthrough | ✓ |
| `help` | the How to use button | ✓ |
| `check-updates` | **none, deliberately** — the request lives in Rust so the page's no-network claim stays absolute (C1); the handler block names it as "the only menu item that is not a second doorbell" | documented exception |
| **`key`** | **none** — the card self-offers once and is gone; after a dismissal the HTML reader has no way back to it | **the gap** |

The help topic *The key* shows the assembled key content in every build, so the information is
reachable — but the **card** is not: the floating, foldable, keepable form, which is the form
that serves the reader mid-map. The doctrine's own history explains how this happened: `Show
the Key` was the first menu item since `check-updates` added without a page doorbell to ring,
and unlike `check-updates` it has no principled reason to lack one.

## 2. Which side of the line each desktop-only thing falls

**Genuinely desktop-only, and rightly so** — platform facts, not gaps, all documented in
`README.md` and `NOTES.md`:

- opening a `.argdown` by double-click (file association);
- reloading the manuscript when it changes on disk (the web has no file watching);
- save-in-place everywhere (the web gets it on Chromium via `showDirectoryPicker`, and a
  download elsewhere — already handled per-capability);
- Check for Updates (kept out of the page on purpose; a gap only if forgotten that it is a
  promise).

**The one function that should be in the HTML and is not: opening the key on demand.** The
values framework decides this cleanly, and the author's observation is the argument: B1 says
the design target is the inexperienced reader, and the HTML file is where every inexperienced
reader starts — it is the build with no install, the one linked from the site, and the one
people are sent. The card's useful forms — reopen it after a hasty dismissal, fold it and keep
it while learning the encodings — are exactly novice needs, and they are currently a
desktop-app privilege, which inverts B1.

## 3. The plan

**1. A doorbell for the key, inside its own help topic.** The design note's rule stands — no
standing chrome, no toolbar button (F4) — and the walkthrough shows the pattern: it is
relaunched from its help entry. The *The key* topic gains one button — *Float this key over
the map* — that rings `openKeyCard`, exactly as the menu does. That serves every build: the
workbench, the Reader, and sent pages too, where a deliberate ask is not the self-offer the
payload guard exists to suppress. One button, one existing function, and the doctrine is
restored: every menu id but `check-updates` rings a doorbell the page has.

**2. Optionally, the map's own right-click menu gains *Show the key*.** The context menu is
in-context and not standing chrome, so F4 permits it; it makes the key findable at the moment
of puzzlement rather than after a trip to help. Held as optional: item 1 alone restores
parity, and the context menu should not grow by default.

**3. A promises-lint row, so this class of drift is caught mechanically.** Today's gap was
found by the author using the product; the next one need not be. `test_promises.mjs` gains a
row that parses the menu ids out of `lib.rs` and the handler ids out of the template's
`onMenu` map and requires them equal — which holds the *wiring* — plus a maintained exception
list ({`check-updates`}) for ids that are allowed no page doorbell, so adding a menu-only
function forces the pairing to be argued in this file rather than assumed. (The stronger
claim — every handler rings a control that is *visible* on the page — is a judgement about
gating and stays with people, per `docs/values/AUTOMATION.md` §2.)

**4. Nothing else moves.** `open-folder`'s post-open asymmetry (drop is the route) is recorded
here as an observation, not a defect: the drop is taught by the empty state and works in every
build, and a second folder-picker button after a map is open would be chrome without a
constituency. Revisit if a reader ever reports hunting for it.

Costs: item 1 is minutes; item 3 is under an hour with its mutation; item 2 is minutes if
wanted. None requires a desktop rebuild to benefit HTML users, though the next desktop build
inherits the help-topic button harmlessly.

> **All three built the same day, on the author's instruction.** The key's help topic carries
> *Float this key over the map*, wired to the same `openKeyCard` the menu rings; the map's
> right-click menu gained *Show the key*; and `test_promises.mjs` holds the menu ids and
> handler ids equal both ways, with `check-updates` the one documented exception and every
> exception required to be a real menu id. Two rendered-DOM checks drive both doorbells as a
> reader would, and the openKeyCard-stub mutation failed them — after first crashing the
> harness's follow-up click, a lesson now guarded against and recorded where it lives.
