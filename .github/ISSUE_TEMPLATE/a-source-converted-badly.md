---
name: A source converted badly
about: The Markdown that came out is not the document that went in
labels: ingest
---

**What went in.** A PDF, a `.docx`, an EPUB, a publisher's HTML snapshot? Roughly how old, and
is it a scan or born-digital? Age is the strongest predictor of trouble in the PDF route.

**What the converter said.** Paste its report. It is designed to be the first thing you read: it
names every route it tried, what it scored, what it cut and what it could not do. A conversion
that went wrong quietly is a worse bug than the conversion, and the report is where that shows.

**What is wrong with the output.** The useful distinctions:

- *words missing* — the most serious, and the one to report first
- *paragraphs joined or split* wrongly
- *headings invented, or real headings not detected*
- *page numbers wrong or absent*
- *furniture left in* — running heads, page numbers, a publisher's access stamp

**Was there a better source available?** Markdown is gold, anything pandoc reads is silver, PDF
is bronze. If you converted a PDF of a document you also have as `.docx`, try the `.docx` first —
`plan_job` will say so too.

**Can you share it?** If not, a page or two showing the problem is usually enough. Please do not
attach anything you do not have the right to redistribute.
