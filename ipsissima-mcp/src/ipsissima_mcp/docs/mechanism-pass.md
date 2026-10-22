# The mechanism pass — marking the chain a text asserts

> **THE SERIES METHOD, served as `mechanism-series`.** It is used only when
> `IPSISSIMA_MECHANISM_METHOD=series` is set. The method in force is the parallel one (`mechanism`),
> which reads the mechanism with the argument; under it, do not read this document. Both methods
> mark the chain in the same notation, `mechanism-notation`.

A SEPARATE PASS, AND ONLY ON REQUEST. It runs when a reader has asked for the mechanism of a text —
"map its mechanism too", or yes to `argdown_plan`'s offer — and never as part of an ordinary
reconstruction. It takes a map that is already finished (`argdown_check` reports `ok` and
`verified`) and adds to it. Ruled 26 Sep 2026.

This document says when the pass runs and what it may change. The notation it marks the chain in
is `argdown_method("mechanism-notation")`. How to READ a text's causal claims — their strength,
necessity and sufficiency, moderators, time and size, rival accounts — is the mechanism
cheatsheet, `argdown_method("mechanism-method")`: read it first.

## Why a separate pass goes back to the source

The pass exists because the argument map alone cannot supply the chain. Reconstruction keeps what
serves as a reason for the contention and leaves the rest, and much of a mechanism is the rest:

- an **explanation** that argues nothing — why people are so sensitive to small fees — is left out;
- a step can live only in an **inference**: an arrow from "fewer return to prison" to "less
  pressure on prisons" with no claim stating it;
- a **compression** can fold three steps into one sentence and lose the states between them.

So the pass goes back to the SOURCE. An annotation made from the map alone would report as the
author's gaps what extraction had discarded — the one error Ipsissima exists to prevent.

## What it may and may not change

It may **add**:

1. the `mechanism:` block in the front matter;
2. `causes:` in the metadata of claims that already state a step;
3. **mechanism-only claims**: steps the text states and the argument never needed, each in the
   text's own words, under a section of their own;
4. a claim stating a step the text's own **inference** relies on, marked as an imputation.

It may **not**: change any claim's words, fidelity or tags; add, remove or rewire any support,
attack or undercut among the existing claims; wire a mechanism-only claim into the argument; or
write any `#appraisal`. The argument map must come out of the pass exactly as it went in, apart
from the metadata and the new section — check it with `argdown_check`: the apex, contribution and
interpretive load must be unchanged.

## 1. Read the source again, all of it

Not the map. List every passage that says something brings something about: what the recommended
action will do, why it will, what happens to whom and in what order, what it depends on, and what
goes wrong. Explanatory sections and asides count; footnotes count when they carry the reasoning.

## 2. Mark the chain

Declare the cast and mark the steps in the notation, `argdown_method("mechanism-notation")`, its
§§1–4. What follows is what the series pass adds to it.

## 3. Add what the argument never needed

A step the text states and no claim carries gets a claim of its own, under

```argdown
===
mechanism:
    actors:
        household: {label: "Poor household", level: micro}
    states:
        cash:   {label: "Household has cash on hand", actor: household}
        takeup: {label: "Household takes the product up", actor: household}
===

# The mechanism, as the text states it {isGroup: true}

[Cash constrains purchase]: "a lack of cash on hand explains at least part of the drop in demand
seen with user fees"
    {fidelity: "quotation", pinpoint: "p. 8",
     causes: {from: cash, to: takeup, sign: "+", basis: study}}
```

Quote the text: these claims are verified like every other. They support nothing and attack
nothing, which is right — they are the chain's material, not the argument's, and the checker counts
them apart. Argdown leaves them off the Reasons map; the Mechanism arrangement draws them.

## 4. Steps carried by an inference

Where the text's own inference relies on a causal step no claim states — the argument runs from "fewer
reoffend" to "less pressure on prisons" and nothing says reoffenders fill the prisons — add a claim
stating it, `fidelity: "imputation"`, `warrant: "enthymeme"`, in the mechanism section. **Only**
where the text's inference relies on it.

## 5. Report back

Once the map checks `ok` and `verified` with the chain marked, report: the profile, the gaps, how
much of the text's causal language the chain covers, and the decisions about which states are one.
