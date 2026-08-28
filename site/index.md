---
layout: home
title: Ipsissima
---

<!-- NO `# Ipsissima` HERE. The `home` layout already prints `title:` as the page's heading and
     the site name sits in the nav above it, so a markdown H1 makes the word appear three times
     before the first sentence. The heading is the front matter's job; this file starts at the
     first thing a reader has not already been told. -->

**Read an argument reconstruction beside the text it is a reading of.**

*ipsissima verba* — the very words themselves. Scholars of the Gospels set it against *ipsissima
vox*, the authentic voice: did he say **these words**, or is this a faithful report of what he
meant? That is the distinction this program keeps, on every claim.

Ipsissima reads [Argdown](https://argdown.org), Christian Voigt's argumentation markup language,
and shows a reconstruction three ways at once: the argument as a map, the passage each claim was
drawn from, and the marks a reader writes in the margin. **It runs entirely in your browser and
makes no network requests of any kind.**

---

## Try it now

<a href="{{ '/ipsissima.html' | relative_url }}"><strong>Open Ipsissima →</strong></a>

One page, nothing to install. Drop an `.argdown` file onto it — or a whole folder, which brings
the manuscript with it so the claims can be laid out by where they appear in the text.

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
{% endfor %}

## What it is for

A reconstruction is **a scholarly claim about someone's work**, and it should be checkable like
one. So every claim in an Ipsissima map records how far it stands from the words it came from —
quotation, paraphrase, compression, interpretation, or the reconstructor's own imputation — and
every quotation is verified against the source, character for character, before the map is built.
The border drawn around a claim tells you which it is.

That makes two things visible that a normal argument map hides: **whose words these are**, and
**where the reconstructor has supplied something the author did not say**.

## The other half

[**Ipsissima-MCP**](https://github.com/jgsw/ipsissima/tree/main/ipsissima-mcp) turns a document
into something a reconstruction can cite — getting a PDF, EPUB, `.docx` or HTML article into
structured Markdown with its paragraphs and page numbers intact — and then checks the finished
reconstruction against its sources word for word. It is an MCP server, so you can ask an assistant
you are already talking to for an argument map and it does the rest.

It does not reconstruct arguments itself. That judgement belongs to the model, and the
instructions given to it are served as a prompt read off disk, where anyone can read and change
them.

## Get the application

The desktop application adds what a web page cannot do: open a `.argdown` by double-clicking it,
save back in place, and reload the manuscript when it changes on disk. macOS, Windows and Linux
builds are on the [releases page](https://github.com/jgsw/ipsissima/releases).

---

<small>Ipsissima is by James Wilson. The source is on
<a href="https://github.com/jgsw/ipsissima">GitHub</a>. The samples above are public domain
(Darwin, Carroll) or Crown copyright reused under the
<a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open
Government Licence</a> (Miller).</small>
