# Appraising a text, on request

Profile 1.27, 19 November 2026. Read this only when the user has asked for an appraisal. A map
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
| **from the map** | a checked map exists | the sibling file, then the report |
| **from the text** | no map, and the user chose it | the report only |
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
cost the most?" names those. Decide for each worth
pursuing whether it is a weakness of the text, a limit of the reconstruction, or nothing.

**Also go through the forms** the map names: each argument's scheme, and each bridge's causal
scheme. Ask their critical questions (`argdown_method("method")` lists them). And read the text
again where the audit points.

### 2. Appraise: the sibling file

Write the appraisal in `<map stem>.appraisal.argdown`, beside the map:

```
===
map: "Enoch 2010 - Epistemological challenge.argdown"
by: "Claude (Opus 5.5), asked by J. Wilson, 19 Nov 2026"
===

# Appraisal {isGroup: true}

## The argument

[The explanation bootstraps]: The belief that survival is good is one selection would have given
us whether or not it is true, so by sect. 3.2 it is defeated until the correlation is explained.
The explanation needs it as a premise. #appraisal
    {fidelity: "imputation", warrant: "appraisal: the standard objection to third-factor replies",
     appraises: {role: criticism, aim: argument, literature: ["Street 2008"], from_memory: true}}
    _> <Survival is good pre-establishes the harmony>

[Every vindication uses its own domain]: A demand that a vindication use no truth of its domain is
one no domain meets, so it is general skepticism. #appraisal
    {fidelity: "imputation", warrant: "appraisal: the author's best reply",
     appraises: {role: reply, aim: argument}}
    -> [The explanation bootstraps]
```

**The rules** (the checker holds you to them):
- **Every claim and argument defined here is `#appraisal`,** with `fidelity: "imputation"`, a
  `warrant:` and `appraises:`.
- **Name the map's claims; never redefine them.** Write `[Their title]` alone, or aim at it with
  `->`, `+>` or `_>`. Never give it words of its own here. A title in neither file is a fault: if
  the map has changed, find the claim's present title.
- **No argument of the author's may use an appraisal claim as a premise.**

**The relation is the content:**
- **Criticisms:**
  - attack a premise you think false or unsupported (`->` to it, or `<-` under it);
  - undercut an inference whose premises do not license its conclusion (`_>` to the argument); this is
    where a scheme's critical question is answered, so give it as `question:`.
- **Strengthenings:** support the author's claim (`+>`). A strengthening that adds a premise is a
  claim supporting the conclusion the premise would serve.
- **Criticisms of a strengthening:** attack the strengthening. What the author "could have said if the
  argument were better" is a strengthening; the most powerful criticisms of that are its attacks.
- **Replies:** the author's best reply to a criticism attacks the criticism (`role: reply`), and a
  rejoinder attacks the reply. Keep this skeleton in the file. The prose goes in the report.

**The mechanism.** Attack or support the step's claim, with `aim: mechanism`. The kinds of
criticism are:
- a confounder;
- the reverse direction;
- a missing link;
- an implausible size;
- the wrong level;
- a scope beyond the evidence.

A cause or route the text omits is a state with `appraisal: true` in the map's `mechanism:` block. That
is the one appraisal entry the map itself carries, and it is drawn only when the appraisal is shown.
The text's own steps never run through it.

**The comparisons** (`aim: comparison`):
- **Rival accounts:** to weigh them yourself, draw relations from your claims, or the text's
  findings, to each account. Weigh the accounts shows them beside the text's own, while the appraisal
  is shown.
- **Recoding:** for a case you would place differently, attack the claim that places it, and say where
  it belongs and why.
- **Do not put `about:` on an appraisal claim.** The Tables panel does not yet keep the appraisal apart.
- **Leave a cell the text leaves empty empty in the map.** You may answer it in your own claim, under
  your own name.

**Literature** you draw on goes in `literature:`, with `from_memory: true` unless every entry is a
Zotero key (`zotero:ABCD1234`).

Check the sibling with `argdown_check` (giving `source_root`) until it reports ok. Your claims may
quote the text, and quotations are verified like any other.

### 3. Report

The report is the reader's: Markdown, beside the map, named `<map stem>.appraisal.md`. Ipsissima
does not read a `.appraisal.md` as part of the manuscript. Aim for about 1,500 to 2,000 words:
- **The argument in brief:** at most 200 words.
- **The criticisms, ranked, most powerful first.** For the leading three to five:
  - what the author says, quoted, with the page;
  - the objection;
  - the author's best reply;
  - whether it succeeds, and why.
- **Strengthenings:** how the position could be made stronger, and the most powerful criticisms of that
  stronger version.
- **Where a critique should aim:** a paragraph. Objections to the whole strategy, which attach to no
  single claim, go here.

**Quote exactly, and only the text.** Put the page in brackets straight after the quotation:
"words" (p. 431). Never put your own wording in quotation marks, however natural it is to voice the
author. A paraphrase gets a page and no quotation marks. Mark recalled literature "(from memory)".

Check the report with `argdown_check` on the `.md` file, with `source_root`:
- **a quotation not in the text** is queried;
- **a quotation on another page than cited** is a fault.

## What goes where

| piece | where |
|---|---|
| each criticism, strengthening and reply, attached to its target | the sibling file |
| role, aim, critical question, literature | the sibling file, `appraises:` |
| the appraisal's weighing of rival accounts | the sibling file, as relations; shown in Weigh the accounts |
| omitted causes and rival routes | `appraisal: true` states in the map's `mechanism:` block |
| where to look (the computed diagnostics) | nowhere: `argdown_audit` computes it fresh each time |
| ranking, strength, the argued verdicts, where to aim | the report |
| whole-strategy objections | the report |

## Handing it over

The deliverable is the map, its `source/`, the sibling file and the report, beside one another. Tell
the user:
- what the audit pointed at;
- the three criticisms you rank highest;
- that the appraisal is shown in Ipsissima only when they switch it on.

`zotero_store` carries the sibling and the report with the map.
