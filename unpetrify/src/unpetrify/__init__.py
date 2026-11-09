"""Unpetrify: get the text out of a document -- a PDF above all, scans included -- as Markdown
that keeps its paragraphs, headings, footnotes and page numbers, and says what it could not do.

    unpetrify paper.pdf              # writes paper.md beside it, and reports
    unpetrify-mcp                    # the same, as an MCP server

Split out of Ipsissima-MCP, which reads its sources through this package.
"""
