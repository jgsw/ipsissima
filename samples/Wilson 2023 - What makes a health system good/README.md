# Wilson, "What makes a health system good?" (2023)

> Wilson, J. (2023) 'What makes a health system good? From cost-effectiveness analysis to ethical
> improvement in health systems', *Medicine, Health Care and Philosophy*, 26, pp. 351–365.
> <https://doi.org/10.1007/s11019-023-10149-9>
>
> © The Author(s) 2023. **Open access under a [Creative Commons Attribution 4.0
> International License](https://creativecommons.org/licenses/by/4.0/)**, and by the author, who is
> also the author of Ipsissima. The converted text in `source/` is the article's and stays under
> that licence. The PDF is not in this repository: the typesetting is the publisher's, and
> `make_source.py` takes a path.

The reconstruction is not the article: the `.argdown` is a reading of its argument, made by a
model and checked against the text, and every claim is marked for how far it stands from the
author's words. Open the `.argdown` in Ipsissima, or build **`wilson-2023-health-system-good (map).html`**.

## Why this one is here

**It is the sample whose argument runs on a mechanism.** The paper argues that a health system
should be improved as a system -- for the flows through it, not element by element for the
cost-effectiveness of each -- and much of the case is what happens when it is not: demand beyond
capacity turns into congestion and implicit rationing, a shortage of social care ramifies into
ambulances queuing outside A&E, a cataract waiting list feeds itself as patients get worse while
they wait. Those are causal claims, and the argument uses them as reasons.

So the map was made by the **parallel method**: argument and mechanism read together, the steps
entering the argument as the reasons they are, or through a *bridge* -- an inference that names
the causal scheme it relies on ("From cause to effect", "From a mechanism to what to do", "From
consequences", "From a mechanism against a theory"). It was the second text of the trial that made
the parallel method Ipsissima's default (1 October 2026); its author judged it the better of the
two readings. Open the **Mechanism** arrangement beside the argument to see the nine chains.

## The reconstruction

**One contention, from the abstract:** health systems "should move from simple and atomistic
approaches to measuring effectiveness to approaches that are holistic", both in looking at the
system as a whole and in the range of ethical concerns they weigh. The top-level form is
conductive -- four convergent strands (flows, values beyond cost-effectiveness, cost-effectiveness
analysis as one tool among many, improvement as iterative) weighed against a reported rival, the
move to comprehensive cost-effectiveness analysis, which the paper refutes through its four
assumptions: measurability, a single synoptic decision procedure, external validity and static
ranking.

139 nodes (11 arguments), 154 edges. **98 quotation, 40 compression, 3 interpretation**; 132 of
132 quotations verify exactly, and the interpretive load at the contention is zero: a route to it
runs on the author's words alone. Seven bridges; nine chains, with 66 steps the text asserts --
three backed by a study, statistics or a model, the rest argued or asserted, which the
Mechanism view's light and shadow shows. Means- and values-improvement are drawn as a cycle that
does not come to rest ("continual and iterative"), and what makes the system up -- flows, elements
and their interactions -- is marked as constitution, never as steps.

## The source

`make_source.py` runs Ipsissima's own conversion and adds only the bibliographic front matter.
This paper was the converter's test case: before October 2026 the automatic route gave it a
33-word abstract, two of its seven headings, and Culyer's numbered steps as headings of their own.
The fixes are general ones -- headings set in a larger face, a full-width abstract, tab-set list
items, a page number sharing a line with the running head -- and nothing in this folder repairs
the paper by hand.
