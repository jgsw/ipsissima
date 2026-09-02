# ArgVu

The Argdown project's own typeface: DejaVu Sans Mono extended with ligatures for Argdown's
relation symbols, so `<+`, `<-`, `<_`, `+>`, `->`, `_>` and `><` are drawn as single marks.

- **Designed by** Peter Stahmer, funded by the KIT Debatelab.
- **Upstream** <https://github.com/argdown/argdown/tree/main/packages/ArgVu>
- **Files here** `ArgVuSansMono-Regular-8.2.otf` (exactly as published upstream),
  `LICENSE.md` (upstream, unmodified), `README.md` (upstream), and
  `ArgVuSansMono-Regular.woff2`, generated from the .otf by `make.mjs`.
- **Licence** Bitstream Vera Fonts Copyright, plus public-domain DejaVu and ArgVu changes. It
  permits redistribution and inclusion in a larger package, and is compatible with GPL-3.0 and
  with MIT alike — but the font stays under its own licence whatever the surrounding code's is:
  "Ipsissima is MIT" is a claim about the code, never about this typeface. The
  licence text must travel with the font, which is why `LICENSE.md` is kept here unmodified —
  and why the builder writes it into every built page's notices, so it travels with the
  embedded WOFF2 too.

The build embeds the .woff2 as a data URI, so no network request is ever made for it and the
single-file page keeps working offline and from `file://`.

Standard ligatures (`liga`, `calt`) are enabled wherever Argdown source is shown. Discretionary
ligatures (`dlig`), which turn shortcodes like `:^:` into logical symbols, are deliberately left
off — see the note beside the `@font-face` rule in the template.
