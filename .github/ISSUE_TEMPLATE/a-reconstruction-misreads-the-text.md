---
name: A reconstruction misreads the text
about: The map is a bad reading of the paper, rather than a broken picture
labels: reconstruction-quality
---

This is the hardest kind of report to make and the most valuable, so it has its own template.

**What the map says**, and **what the paper says**. Quote both. The `.argdown` records where each
claim came from, so `[claim-id]` and the passage it cites is the ideal form.

**Which kind of misreading**, as far as you can tell:

- a claim attributed to the author that the paper does not make (should be `interpretation` or
  `imputation`, and carry a `warrant`)
- a quotation that is verbatim but misleading — a dropped qualifier, a correction left just
  outside the quotation marks, a passage quoted for a term it never uses
- support drawn where the paper argues nothing of the kind
- premises drawn as independent that the argument needs together, or the reverse
- a section of the paper missing from the map altogether

**What the checker said.** Run it and paste the output:

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/check_argdown.py <file>.argdown --source-root <folder>
```

If the checker passed a reconstruction you can see is wrong, say so plainly — **that is the most
useful thing in this tracker.** The checks can verify that a quotation is verbatim and that a
departure carries a reason; they cannot yet tell a good reading from a bad one, and every case
where they miss is evidence about what a better check would have to notice.
