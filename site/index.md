---
layout: default
title: Ipsissima
---

<!-- `default`, NOT `home`. Minima's `home` layout prints `title:` as an H1, and the theme's nav
     already carries the site name immediately above it — so the word "Ipsissima" arrived twice
     before the reader reached a sentence, and three times when this file also opened with its
     own `# Ipsissima`. `default` renders the content and nothing else.
     `title:` stays, because the <title> tag is built from it.

     THE PAGE STILL NEEDS ONE H1, so the mission sentence is it — settled in the author's own
     words at the Second Thoughts checkpoint (docs/values/SECOND-THOUGHTS.md, 5 Sep 2026). The
     verba/vox paragraph stays close beneath: it is the name and the distinctive half, but it
     describes one genre of map, so it no longer stands for the whole. -->

# Making complex reasoning intelligible through maps you can check at every step

Ipsissima reads [Argdown](https://argdown.org) — the argumentation markup language created by
Christian Voigt and maintained by the Argdown team — and opens an argument as an interactive
map: the main claims at a glance, the detail where you choose to look, the marks a reader
writes in the margin, and, when the map was drawn from a text, the passage each claim came
from beside the claim that reports it. **It runs entirely in your browser and makes no network
requests of any kind.** (The downloadable application adds one, and only when you choose
Help ▸ Check for Updates; the page on this site has nothing of the sort.)

The name is the distinctive half. *ipsissima verba* — the very words themselves, as against
*ipsissima vox*, the authentic voice: did the author write **these words**, or is this a
faithful report of what they meant? Every discipline that quotes anybody has had to draw that
line — historians since Thucydides, jurists whenever quotation marks are at stake. Wherever a
claim has a source to stand at a distance from, Ipsissima keeps the distinction, on every
claim.

---

## Try it now

<a href="{{ '/ipsissima.html' | relative_url }}"><strong>Open Ipsissima →</strong></a>

One page, nothing to install. Drop an `.argdown` file onto it — or a whole folder, which brings
the manuscript with it so the claims can be laid out by where they appear in the text. Nothing
to open yet? The same panel can **start a new one**: a worked skeleton you replace claim by
claim, with the map redrawing as you write.

New to argument maps? Take the walkthrough: it is the first entry under **How to use**, runs on
whatever you have open, and takes about two minutes.

There is also a <a href="{{ '/ipsissima-reader.html' | relative_url }}">read-only Reader</a>,
which is smaller and has no editor — the right one to send to somebody you want to *show* a
reconstruction to.

*Both pages carry the whole program, so they are a couple of megabytes and take a moment to
arrive on a slow connection. Nothing is downloaded afterwards.*

## Or start from a worked example

Each opens a finished reconstruction **with the text it was drawn from**, so you can follow a
claim back to the passage it came from and see how far it stands from the author's own words.

{% for s in site.data.samples %}
### [{{ s.title }}]({{ '/try/' | append: s.slug | append: '.html' | relative_url }})

{{ s.blurb }}
{% if s.credit %}<p><small>{{ s.credit }}</small></p>{% endif %}
{% endfor %}

## What it is for

**A map of a text.** A reconstruction of a paper, a judgment or a chapter is **a scholarly
claim about someone's work**, and it should be checkable like one. So every claim in the map
records how far it stands from the words it came from — quotation, paraphrase, compression,
interpretation, or the reconstructor's own imputation — and every quotation is verified against
the source, character for character, before the map is built. The border drawn around a claim
tells you which it is. That makes two things visible that a normal argument map hides: **whose
words these are**, and **where the reconstructor has supplied something the author did not
say**.

**A map of a debate.** Some arguments belong to no single text: the case for and against
censorship, or a drug law, is a pattern of public argument, not a document. Ipsissima opens
these maps too, and leaves out what does not apply — no manuscript pane, no source borders,
just each standpoint's case laid out step by step where anyone can examine it. Here there is
nothing for the tool to check a claim against, and it does not pretend otherwise: a debate map
stands on the fairness of the person who drew it, named in the map's own front matter, and the
tool's job is to make every step visible enough to challenge.

**A map of your own.** Ipsissima is also an editor, and for most people the lightest way to
write Argdown — one page in a browser, rather than a programmer's IDE. Start a new map from
the opening panel (**File ▸ New** in the application), write, and the map redraws as you go;
where a line does not parse, the editor says so on the line, with the real Argdown parser
doing the judging.

## The other half

[**Ipsissima-MCP**](https://github.com/jgsw/ipsissima/tree/main/ipsissima-mcp) turns a document
into something a reconstruction can cite — getting a PDF, EPUB, `.docx` or HTML article into
structured Markdown with its paragraphs and page numbers intact — and then checks the finished
reconstruction against its sources word for word. It is an MCP server, so you can ask an assistant
you are already talking to for an argument map and it does the rest.

It does not reconstruct arguments itself. That judgement belongs to the model, and the
instructions given to it are served as a prompt read off disk, where anyone can read and change
them.

**On Claude Desktop it installs by double-clicking**: take the `.mcpb` bundle from the
[releases page](https://github.com/jgsw/ipsissima/releases) and open it. You will need
[Node](https://nodejs.org) on the machine; Claude Desktop provides the rest.

**In a terminal it is one line**: `uvx ipsissima-mcp` runs the released server straight from
[PyPI](https://pypi.org/project/ipsissima-mcp/) — so
`claude mcp add ipsissima -- uvx ipsissima-mcp` is the whole install for Claude Code, and any
other MCP client points at the same command. Node is still needed.

## Get the application

The desktop application adds what a web page cannot do: open a `.argdown` by double-clicking it,
save back in place, and reload the manuscript when it changes on disk. macOS, Windows and Linux
builds are on the [releases page](https://github.com/jgsw/ipsissima/releases) — the `.dmg`, the
`-setup.exe`, and the `.deb` or `.AppImage` respectively.

The builds are unsigned, so the first launch is blocked once, and the block looks worse than it
is. On macOS: drag Ipsissima into Applications (choose **Replace** if you are updating), launch
it from there, click **Done** on the warning, then allow it under **System Settings → Privacy &
Security → Open Anyway**. On Windows: **More info**, then **Run anyway**.
[Installing Ipsissima](https://github.com/jgsw/ipsissima/blob/main/app/desktop/INSTALL.md) shows
every dialog before you meet it.

---

<small>Ipsissima is by James Wilson, and stands on other people's work: the
<a href="https://argdown.org">Argdown</a> language, created by Christian Voigt and maintained by
the Argdown team; the reconstruction method of Alec Fisher and Trudy Govier; Tom Stern's
article on charity and quotation, which is why the checks do not stop at verbatim; and Gregor
Betz and Georg Brun, who named the distinction this program draws before it drew it.
<a href="https://github.com/jgsw/ipsissima/blob/main/CREDITS.md">CREDITS.md</a> says it properly.
The source is on <a href="https://github.com/jgsw/ipsissima">GitHub</a>. The samples above are
public domain (Darwin, Carroll), Crown copyright reused under the
<a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open
Government Licence</a> (Miller), or open access reproduced by their author (Wilson).</small>
