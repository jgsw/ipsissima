<!--
  about.md — the About window.

  Same arrangement as help.md, one rule: `##` starts a TAB, in this order. Raw HTML is allowed,
  and the ids below are filled in at runtime — `aboutver`, `aboutbuilt`, `abouthost`,
  `aboutauthor`, `aboutlicence`, `aboutdeps`, `aboutdebug`, and the fold state trio
  `foldstateid` / `foldstatein` / `foldstatego` / `foldstateerr`. Deleting one does not break
  anything; the thing it was showing simply stops appearing.

  Keep it about this level of detail. Zettlr's About is the model and is more verbose than
  Ipsissima has debts to repay — but Argdown's credit is not the place to economise.
-->

## Ipsissima

*The very words, and how far a reading stands from them.*

**Ipsissima** reads an argument reconstruction beside the text itself: the argument as
a map, the passage each claim was drawn from, and the marks a reader writes in the margin.

*ipsissima verba* — the very words themselves, as against *ipsissima vox*, the authentic voice:
did the author write *these words*, or is this a faithful report of what they meant? Every
discipline that quotes anybody has had to draw that line. Ipsissima keeps the distinction, on
every claim.

<dl id="aboutmeta">
  <dt>Version</dt><dd id="aboutver">—</dd>
  <dt>Author</dt><dd id="aboutauthor">—</dd>
  <dt>Licence</dt><dd id="aboutlicence">—</dd>
</dl>

It runs entirely on your own machine. Nothing is uploaded, and it makes no network requests of any
kind — not for updates, not for fonts, not for analytics. You can disconnect from the internet and
it behaves identically.

## Argdown

Ipsissima is a reader and editor for **Argdown**, and would not exist without it.

Argdown is the argumentation markup language created by **Christian Voigt**. The notation, the
parser, and the model of what an argument reconstruction *is* are all his. Since the beginning of
2025 the language has been renovated and maintained by **Kushal, Hatim, Lucas and Gregor**, who
released Argdown 2.0 in April 2026. Ipsissima bundles the official parser and uses it unmodified,
so a file that parses here parses everywhere Argdown does, and a reconstruction written here is
not locked to this program.

The notation is set in **ArgVu**, the Argdown project's own typeface, designed by **Peter Stahmer**
and funded by the **KIT Debatelab**. It is what draws `<+` and `<-` as single arrows rather than as
two characters that happen to sit together.

Argdown is at **argdown.org** and is MIT licensed; ArgVu is under the Bitstream Vera Fonts
licence. **Ipsissima is an independent program, not endorsed by or affiliated with the Argdown
project.**

## Whose words

Ipsissima marks every claim for how far it stands from its source, and *checks* the ones that can
be checked: a claim marked **quotation** is verified character by character against the text it
cites.

That is worth having and establishes less than it looks like — which the program knows because of
one article. **Tom Stern**, '"Some Third Thing": Nietzsche's Words and the Principle of Charity'
(*The Journal of Nietzsche Studies* 47.2, 2016, pp. 287–302), sets out four illustrations of
**misreporting**: using an author's own words to make it seem he is saying something he certainly
is not. **Three of the four quote accurately.** A hedged claim quoted with the author's own
correction left just outside the quotation marks; a partial claim quoted in support of a universal
one; a passage quoted as evidence for a term it never uses. Every one would pass a verbatim check.

So the checker also reports what each verbatim quotation was cut away *from* — a dropped
qualifier, a continuation that corrects it, an oversized elision — and the fidelity vocabulary
here follows Stern's dimensions of charity rather than an invention of this program's.

The method by which a reconstruction is made is not this program's either. It follows **Alec
Fisher**'s *The Logic of Real Arguments* — working back from the conclusion, and the Assertibility
Question that stops a reconstruction attributing reasoning the author never gave — and **Trudy
Govier**'s *A Practical Study of Argument*, from which come standardising, the distinction between
linked and convergent support that these maps draw, unstated premises and counterconsiderations;
with argument schemes from **Walton, Reed and Macagno**. `CREDITS.md` gives the full list.

## The name

*Ipsissima* is the feminine of *ipsissimus*, an impossible superlative of *ipse* — "the very
one" — and it begins as a joke. Aristophanes coined it in Greek: asked whether he is really the
god himself, a character in *Plutus* (388 BC) answers *autotatos*, "his very selfest self".
Plautus translated the gag into Latin (*Trinummus*, c. 190 BC): "Are you then the man himself?" —
"*Ipsissimus.*" English scholarship took up *ipsissima verba*, "the very words themselves", in the
early nineteenth century, for the places where the wording is the whole case — a libel had to be
pleaded in the very words complained of, not a paraphrase of them.

The distinction the phrase names is older than the phrase, and belongs to everybody who has ever
quoted anybody. Thucydides opens the tradition of history-writing by conceding that his speeches
keep "the general sense of what was really said" rather than the words. The science of hadith
distinguishes transmission by exact wording (*bi-l-lafẓ*) from transmission by meaning
(*bi-l-maʿnā*) — and concedes that most transmission is the latter. The rabbis made faithful
attribution a virtue: whoever repeats a thing in the name of the one who said it brings
deliverance to the world (Avot 6:6). Scholars of the sayings of Jesus gave the contrast its
permanent Latin in the 1950s — *ipsissima verba*, the very words, against *ipsissima vox*, the
authentic voice — in a tradition that had translated Aramaic speech into Greek text. And the
United States Supreme Court put a price on it (*Masson v. New Yorker*, 1991): quotation marks
promise the very words, and altering them is culpable when the alteration changes the meaning.

Every claim in a map here answers the question those traditions kept asking: are these the words,
or a report of them?

## Built on

Every one of these is bundled into the program and runs locally. The versions are read from the
build itself rather than written by hand, so this list cannot claim what it does not carry.

<dl id="aboutdeps"></dl>

These credits are MIT licensed, but the build carries more than it names: some forty packages
reach this page — MIT for the most part, with the chevrotain parser engine and the Graphviz
attribute tables under Apache-2.0, highlight.js and entities under BSD, JSZip dual-licensed and
taken under its MIT arm, and the ArgVu typeface under the Bitstream Vera Fonts licence. The full
text of every one of those licences travels inside this file: they are under **Licence**.

The desktop application additionally uses **Tauri** (MIT / Apache-2.0), which supplies the window
and the file access. On macOS and Linux the page is drawn by the system WebView rather than by a
bundled browser, which is why the application is a few megabytes rather than a few hundred.

Ipsissima began inside a copy of **Simon Goldstein's Deep Drafter** (MIT) before it became clear
it was a different project. It shares no code with it. `CREDITS.md` in the source has the full
account of every debt above.

## Licence

Ipsissima is free software, licensed under the **MIT License**.

You may use it for anything, study how it works, change it, and share it — including changed
versions, under terms of your own choosing. The one condition is that the copyright and
permission notice travels with every copy of the software.

The full text ships with the source as `LICENSE`. Two things this file carries are not covered
by it and keep their own licences: the **ArgVu** typeface, under the Bitstream Vera Fonts
licence, and the bundled packages, each under its own — all reproduced in the notices below.
The companion MCP server that prepares sources, `ipsissima-mcp`, is distributed separately
under the GNU General Public License v3 or later.

This program is distributed in the hope that it will be useful, but **without any warranty**;
without even the implied warranty of merchantability or fitness for a particular purpose.

### Third-party notices

The work this program bundles stays under its own licences. The notices below are written by the
build from what it actually bundled — the same rule as the dependency list — and they travel in
every copy this page exports, because an exported copy is a distribution too.

<pre id="aboutnotices"></pre>

## Debug

Worth quoting if something goes wrong.

<dl id="aboutdebug"></dl>

### The fold state

One line that names exactly what is folded and shown right now — which sections are shut, which
claims the reader folded or opened by hand, the depth, the view. **Report a folding bug with the
`.argdown` file and this line**, and the state can be rebuilt instead of guessed at. A click
selects the whole line.

<p><code id="foldstateid">no map on screen</code></p>

It is tied to this exact map — the `map=` fingerprint refuses a file it does not belong to — and
two identical lines are the same state, so comparing them answers "are we looking at the same
thing?" To rebuild a reported state, paste its line here:

<p><input id="foldstatein" type="text" spellcheck="false" autocomplete="off" placeholder="ipsfold1 map=… view=…"><button id="foldstatego" type="button" class="plain">Restore</button></p>
<p id="foldstateerr" hidden></p>
