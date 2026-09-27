# How Ipsissima speaks to its reader

The rules every message, note, card, tooltip and confirmation follows. They are drawn from what
the best existing messages already did, and were adopted with F8 on 27 September 2026 (see
`docs/values/INVENTORY.md`, F8: *designed against the misreading*). The clarity audit that
found the need catalogued 196 messages; its sweep of them is in the private record.

`app/test_teaching_text.mjs` holds the parts of this that a machine can hold: menu paths
spelled as the menus spell them, glyphs named as drawn, and retired words kept retired
(`app/vocabulary.json`). The rest is for whoever writes the next message.

## The models

These already did it right, and the rules below generalise them.

- **Zotero not answering** (`lib.rs`) gives the cause, then the exact setting to check.
- **"That comment would have broken the file, so it was not written."** says what happened, and
  what was protected.
- **"Keep my changes" / "Reload — loses your changes"** each name their consequence on the
  button itself.
- **The abstract's fold**: its button, its × and Esc all do the same thing, and each says so.
- **"It will run again next time"** says where the thing went.

## The rules

1. **What happened, then what to do, in at most two sentences.** The remedy names a control
   that exists in *this* build: "File ▸ Open Folder…" in the app, "Open… ▸ Open a folder…" on
   the web. It never names a command line, a script or a flag.
2. **One word per thing, the reader's word.** Use one word for each of these, and keep to it:
   - the map, a claim, a section;
   - *the text* for the prose, and *Manuscript* for its pane (never "essay", "source" only for
     the author's exact words);
   - the *main claim*;
   - an *arrangement* (Reasons, Exposition, Mechanism);
   - a *hashtag*;
   - a *comment*, and a *reconstructor's note*;
   - *How to use*.

   No file keys (`reviewed:`, `echoes:`, `zotero:`), build names, internal ids or tool names in
   what a reader reads. Those belong in How to use, or in About's Debug tab. A retired word goes
   into `app/vocabulary.json` in the same commit that retires it.
3. **Severity has one channel each.**
   - A fault is the red box, and it stays until dismissed.
   - Information is the neutral note, and it goes away by itself.
   - A warning about partial data (a truncated bundle, files skipped) is neutral and stays.
   - Nothing informational is red, and nothing that lost data times out.
   - No `alert()`; `confirm()` only before losing something.
4. **Say it where the reader acted, and where it can be seen.** A pane's outcome goes in that
   pane's header. Everything else goes in the one message area, which sits outside the map's
   column and above every dialog. A dialog that raises an error may show it inside itself.
5. **Sentence case.** A full sentence starts with a capital and ends with a full stop. A button
   label starts with a capital and takes no stop, as the title bar's do: *Short*, *Open*,
   *Read along*. Any other fragment — a status readout, a chip, a group label on the map's bar,
   a menu hint — takes neither. Bold, not CAPITALS, for emphasis. The macOS menu bar keeps its
   platform's Title Case.
6. **"You" for the reader, "Ipsissima" for the program** — not "this viewer", "this build" or
   "this page".
7. **Every outcome the reader cannot see is confirmed, with where it went**: "Saved to
   essay.argdown."
8. **Never claim irreversibility falsely.** Where Undo can take something back, say "Undo
   (Cmd/Ctrl-Z) brings it back."
9. **Every mode shows its name and its exit in one place.** The exit is × and Esc, and the
   mode's own button reads as on while the mode is on.
10. **Length budgets:**
    - a header or status slot, 8 words;
    - the message box, 35;
    - a tooltip, 30;
    - a card paragraph, 40.

    Anything longer is a sentence plus a link into How to use: `showErr(msg, { help: "Topic" })`
    in a message, `data-help="Topic"` on anything drawn. The topic is named by its title, and
    `app/test_teaching_text.mjs` checks that it exists.
11. **Describe controls exactly as rendered**: the glyph on screen ("+3", not ⊞), the label as
    spelled, a direction only when the layout guarantees it.
12. **Counts are grammatical and zeros are dropped.** Write "1 claim" and "7 claims". A filter
    that hides claims says how many are hidden.
