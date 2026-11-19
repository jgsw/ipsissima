# Appraising a text, on request

Profile 1.28, 19 November 2026. Read this only when the user has asked for an appraisal. A map
reports what a text says and never evaluates it, so Ipsissima appraises only on request: "critique
this", "what's wrong with it", "its weaknesses", "how could it be strengthened", "assess", "evaluate",
"how good is the argument". An appraisal assesses three things, where the text has them:
- **the argumentation:** whether the premises are acceptable and the inferences go through;
- **the mechanisms:** whether the causal mechanisms it invokes are plausible;
- **the comparisons:** whether its systematic comparisons are cogent.

## What the trial found, and what follows

Twelve blind appraisals of three texts were judged blind (18 November 2026): half were written with
the checked map, half from the text alone.
- **The map made appraisals more exact.** Writers with the map never put their own words in quotation
  marks; writers with the text alone did so ten times. Map appraisals were also a little better
  argued: fidelity, depth and the strength of the top three were all rated higher.
- **It did not make them find more or stronger objections.** Every objection rated 4 or 5 for strength
  was found by both arms.
- **Having the comparisons and the mechanism laid out did not prompt a critique of them.** Comparisons
  were assessed slightly worse with the map.
- **Two runs differed about as much as the two arms did.**

So:
- **A map is not worth making for the appraisal alone.** Where there is no map, offer the user the
  choice with its costs (`argdown_plan` with `intent: "appraise"` states them), and make the map only
  if they want it anyway.
- **Use the map for what it is good at:** exactness, and the computed questions in `argdown_audit`.
  Don't spend the appraisal re-reading the map. Read the text, and use the audit to make sure the
  mechanism and the comparisons are assessed, not passed over.
- **Depth beats breadth.** The judges preferred a few criticisms argued to a verdict over many in a line.

## The routes

| route | when | what you write |
|---|---|---|
| **from the map** | a checked map exists | the report, its claims linked to the map |
| **from the text** | no map, and the user chose it | the report, with no links |
| **pooled** | no map, the user chose it | two independent appraisals, then one report from both |
| **map first** | no map, and the user wants one anyway | the ORDER OF WORK, then the from-map route |

**Pooled:** run the two appraisals in separate fresh sessions, so neither sees the other. Then merge
them: keep every distinct criticism, and rank the merged set.

## The three moves

### 1. Diagnose: where to look

Call `argdown_audit` on the map. It lists, from the map alone, with what most rests on first:
- the premises the reconstruction had to supply;
- the concessions and objections the map records no reply to;
- the sets the text says cannot all hold;
- the causal steps that are only asserted, or put as possibilities;
- an outcome the chain never reaches, or a start that leads nowhere;
- each causal move's critical questions the map records nothing on;
- declared rival accounts no reason bears on differently;
- comparison tables' empty cells, and pairs alike but judged apart.

These are facts about the map, not verdicts. Each is a place to look. A group of more than three is
summarised, with its three heaviest shown and the rest marked `more`: read them all. How much rests on a
claim only orders the list. A load-bearing claim is a linchpin, not a weakness; Study's "which would
cost the most?" names those. Decide, for each worth pursuing, whether it is a weakness of the text, a
limit of the reconstruction, or nothing.

**Also go through the forms** the map names: each argument's scheme, and each bridge's causal
scheme. Ask their critical questions (`argdown_method("method")` lists them). And read the text
again where the audit points.

### 2. Appraise, and 3. Report

The appraisal is one document: a report in Markdown beside the map, named `<map stem>.appraisal.md`.
Ipsissima shows it in the Appraisal pane, with its references as links into the map and the text.
Nothing is written into the map. (Profile 1.27 put appraisal claims in a sibling `.argdown` file. In
use they were hidden until switched on, drawn far from what they appraised, and hard to read; the
argued verdicts, which are the value, are prose.)

**What it says.** Aim for about 1,500 to 2,000 words:
- **The argument in brief:** at most 200 words.
- **The criticisms, ranked, most powerful first.** For the leading three to five:
  - what the author says, quoted, with the page;
  - the objection;
  - the author's best reply;
  - whether it succeeds, and why.

  Cover the mechanism and the comparisons where the text has them: the audit says where to look.
- **Strengthenings:** how the position could be made stronger, and the most powerful criticisms of that
  stronger version, which is what the author "could have said if the argument were better".
- **Where a critique should aim:** a paragraph. Objections to the whole strategy, which attach to no
  single claim, go here.

**Links.** Name what you appraise so the reader can go to it:
- **A claim or argument of the map:** its title, exactly, between ‹ and ›: "‹The explanation bootstraps›".
  Use the map's titles, never your own wording of a claim; the checker refuses a title the map does not
  have. In the Mechanism view the same link selects the step the claim states, so a causal step is
  named by the claim that states it.
- **A state of the mechanism:** `[its label](#state:ID)`, with the state's id from the map's
  `mechanism:` block.
- **A table:** `[its label](#table:FRAME)`, with the frame's id from `frames:`.
- **A page of the text:** write it as "(p. 431)" or "pp. 12–14"; the pane opens the Manuscript there.

Link where it helps the reader find the thing, not every mention. A paragraph with one or two links is
easier to read than one where every phrase is underlined.

**Quote exactly, and only the text.** Put the page in brackets straight after the quotation:
"words" (p. 431). Never put your own wording in quotation marks, however natural it is to voice the
author. A paraphrase gets a page and no quotation marks. Mark recalled literature "(from memory)".

**Check it** with `argdown_check` on the `.md` file, with `source_root`:
- **a quotation not in the text** is queried;
- **a quotation on another page than cited** is a fault;
- **a link to a title, state or table the map does not have** is a fault, with the nearest title.

Repeat until it reports ok.

## Handing it over

The deliverable is the map, its `source/`, and the report beside them. Tell the user:
- what the audit pointed at;
- the three criticisms you rank highest;
- that the report opens in Ipsissima's Appraisal pane, where its links go to the map.

`zotero_store` carries the report inside the map's bundle, and stores it as its own attachment.
