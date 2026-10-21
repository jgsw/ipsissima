# What tabulation would cost as a default

21 October 2026. Wave 5 of the Purpose episode (`docs/values/PURPOSE.md`, §5). Ruling 10 says a layer
becomes a default only once it has been measured. This is that measurement for the tabulation pass
(`argdown_method("tabulation")`). It changes no default. The decision is the author's.

## What was measured

- **What a pass writes.** The four trial maps of 20 October (Gettier 1963, Stone 1989, Valentino et
  al. 2018, Bates et al. 2011) were measured after their passes. For each: the `frames:` block, every
  `about:` placement, and the claims the pass added (from the trial log). These were set against the
  source and the map.
- **What a pass reads.** The method documents, at their sizes on 21 October.
- **How often there is something to tabulate.** Across the corpus (88 maps, 68 texts with their
  sources): how many texts cite tables of their own, and how many of those extraction lost. Both
  were counted with extraction's own `TABLE_LABEL` and `lost_tables`.

Tokens are estimated the way `argdown_plan` estimates them: words × 4/3 for prose, and characters ÷ 4
for Argdown. A reconstruction's own cost is `argdown_plan`'s range, 1.4 to 2.6 times the source.

**What this cannot see: thinking.** The bulk of a reconstruction is the model's thinking, not what
it reads or writes (`extraction-prompt.md`: one deliberative turn emitted 44,411 tokens). File sizes
cannot measure it. Usage figures from real runs can, and they are the next measurement if the
default is to be decided.

## Two ways it could become a default

- **A. A separate pass after every map**, as it runs now on request. It reads the method, the
  source and the map, adds its frames, and checks the result.
- **B. Folded into the reconstruction**, as the mechanism was under the parallel method. It reads
  `tabulation-pass.md` with the other method documents, declares frames as it goes, and records
  `frames: none` where the text compares nothing.

| map | source | a reconstruction | the pass writes | A reads | B adds | B, against a reconstruction |
|---|---|---|---|---|---|---|
| Gettier | 2,025 | 2,835–5,265 | 639 | 29,042 | 3,064 | 58–108% |
| Bates | 8,974 | 12,563–23,332 | 1,524 | 53,901 | 3,949 | 17–31% |
| Stone | 13,568 | 18,995–35,276 | 2,737 | 54,983 | 5,162 | 15–27% |
| Valentino | 14,476 | 20,266–37,637 | 1,182 | 50,201 | 3,607 | 10–18% |

All figures are tokens. "B adds" is the tabulation document read once (about 2,400) plus what the pass
writes.

## What it shows

1. **A separate pass is almost all reading.** It reads 29,000 to 55,000 tokens and writes under
   3,000. Most of the reading is the method documents (about 22,000) and the source, which the
   reconstruction has just read. Made a default, it would cost every map about as much input again
   as the reconstruction itself.
2. **Folded in, the cost is small for a paper and large for a short text.** A fixed 2,400 tokens of
   method is read, and up to 2,700 written. That is a tenth to a third of a full paper's
   reconstruction. For Gettier's three pages it is most of the cost. Thinking comes on top,
   unmeasured.
3. **There is usually something to tabulate.**
   - The census found comparisons in all twelve texts, four kinds on average.
   - 15 of the corpus's 68 texts cite tables of their own, and extraction lost at least one table
     in 10 of them.
   - The weigh panel's derived sets rarely compare: 17 of 145 sets have any reason bearing on two
     accounts. So the declared frames are where a text's comparisons become readable.
4. **One reader has used it.** The author finds the tabulation pass's tables "much more
   perspicuous" than the derived weigh view (21 October). Ruling 10 asks that readers use a layer
   before it becomes a default. This is one reader.

## What was done instead (wave 5)

- **`argdown_plan` offers the tables** where a source cites tables of its own (15 of 68 texts). It
  offers them *before* extraction, because the lost tables are cheapest to rebuild from their pages
  while the source is being made. It runs nothing: the user is asked.
- **`argdown_plan` lists the layers** a map will hold, which way into the map each feeds, and which
  are made always and which on request.
- **The extraction prompt says what the file is for**: which way in each layer feeds, and B11's three
  duties.

## For the author

If tabulation is to become a default, form B is cheaper than form A by an order of magnitude in what
it reads. The parallel method was settled by a trial, and B should be tried the same way first: the
same texts reconstructed with and without it, with usage figures from the runs, and you judging the
tables. Until then the tables stay on request, and are offered where a text cites its own.
