# The identity

One principle, stated once: **fidelity is pattern; relation is colour.** In the map, how far a
claim stands from its source is drawn as the solidity of its border — solid for quotation,
dissolving through three grades of dash to the dash-dot of imputation — and support and attack
are coloured edges. The identity is built out of the first half of that: the mark is a claim box
whose border enters solid and leaves as dash-dot, with the quotation marks seated inside. A
claim, and the open question of how solid it is. Nothing in the identity may colour-code
fidelity; solidity means closeness to the words, everywhere, always.

The strapline is **"The very words, and how far a reading stands from them."** The descriptive
line — "Read an argument reconstruction beside the text itself" — is not a rival and
stays as the subtitle everywhere. The history behind the name is in the About window, under
*The name*.

## Files

| file | what it is |
|---|---|
| `mark.svg` | The master mark: navy field, paper strokes. The app icon is rendered from this. |
| `mark-bare.svg` | The same mark in `currentColor`, no field — for documents and the site, on either ground. |
| `favicon.svg` | The mark simplified for 16–32 px: solid left+top, dashed right+bottom, heavier commas. |

The quotation marks are not drawn freehand: they are **EB Garamond's own U+201C outline**
(medium weight, SIL OFL), extracted from the same font files the site serves and thickened with
a light stroke for icon duty — so the mark quotes the typeface the identity is set in, which is
the right joke for this program. The dash patterns in `mark.svg` are the map's own fidelity
ladder scaled up, and the palette is the program's, not an invention: field navy `#203A6A` (the icon has been this navy from the
first build), paper `#FBFAF7`/`#FDFDFC`, ink `#1A1A1A`, working blue `#3A7BD5` (dark
`#6EA8FE`). On dark grounds the navy yields: the mark inverts to paper-white lines on the navy
field, never navy lines on night.

The wordmark is *Ipsissima* in **EB Garamond italic** (SIL OFL, so it can be bundled — the site
self-hosts it; see `site/assets/`). ArgVu remains the notation face and the app's chrome stays
on the system stack; neither is this identity's to touch.

## Regenerating what is generated

The platform icon set (`app/desktop/src-tauri/icons/`, everything but `source.png`) is not
committed. To rebuild it after editing `mark.svg`:

1. Render `mark.svg` to `app/desktop/src-tauri/icons/source.png` at 1024 px with any SVG
   renderer that honours `stroke-dasharray` — `resvg`, `rsvg-convert`, or Inkscape.
2. `cd app/desktop && node tauri.mjs icon src-tauri/icons/source.png -o src-tauri/icons`
3. Delete the `android/` and `ios/` folders the CLI insists on writing; there are no mobile
   targets.

The site's `favicon.ico` (16+32+48) and `apple-touch-icon.png` (180) are rendered the same way
from `favicon.svg` and `mark.svg` respectively, and *are* committed, because the Pages build
has no SVG renderer and they change about never.
