# Named rules, formalization and strict mode

Read this before naming a rule of inference, writing a `formalization:`, or turning on strict
mode.

## From the reconstruction method

- **where a step really is deductive, name the rule and formalize it** — `-- Modus ponens
  {uses: [1, 2]} --`, with `{formalization: "p -> q"}` on every line of that step. Naming a rule
  claims the conclusion *follows*, and that claim is now checked: an invalid step is reported as
  a fault with a countermodel, and the map draws the rule name struck through. **Do not reach for
  this by default.** Most philosophical argument is conductive — independent considerations
  weighed, premises that do not entail the conclusion — and a rule name on such a step claims
  something the author never did. Name a rule when the step would be *invalid if a premise were
  removed*, not when it merely reads as tight
- **never write `formalized:` yourself.** It is a hash of the claim's own text, written by
  `check_argdown.py --stamp` once a human has satisfied themselves that the formulas say what the
  claims say. A value invented here would either mark every step of the file as stale or, worse,
  vouch for an agreement nobody made
- **any rule name is accepted, and these eighteen are abbreviated on the map** — modus ponens,
  modus tollens, hypothetical syllogism, disjunctive syllogism, constructive dilemma, destructive
  dilemma, simplification, conjunction, addition, double negation, de Morgan, contraposition,
  universal instantiation, universal generalisation, existential instantiation, existential
  generalisation, biconditional elimination, reductio ad absurdum. Prefer one of these where it
  is the right name; write whatever is right where it is not, and the map reduces it to initials.
  **The validity verdict never reads the name** — it comes from the `formalization` lines alone —
  but a single canonical name is checked against its own schema: a valid step wearing the wrong
  textbook name comes back from the checker as a `?`. A name of your own, and a line naming two
  rules at once (a compound step), are labels rather than claims to a known form, and are not
  examined — so get those right for the reader, because nothing else will

## Naming a rule, and `formalization:`

`-- Modus ponens {uses: [1, 2]} --` says the conclusion *follows*. Give every line of that step a
`formalization:` and the checker will decide whether it does:

```argdown
(1) [If crisis then maggots]: If the NHS were in crisis it would use maggots. {formalization: "q -> p"}
(2) [Maggots are used]: The NHS uses maggots. {formalization: "p"}
-- Modus ponens {uses: [1, 2]} --
(3) [The NHS is in crisis]: The NHS is in crisis. {formalization: "q"}
```

That step is reported as a fault, with a countermodel: it is affirming the consequent, not modus
ponens. **Only a step that names a rule is checked** -- a plain `-----` claims nothing, and most
philosophical argument is conductive rather than deductive, so checking every step would report
good reconstructions as invalid for failing to be something they never claimed to be.

The syntax is **NLTK's**, which is what `debatelab/argdown-feedback` parses, so a formalization
means the same thing in both tools:

| | |
|---|---|
| negation | `-p` or `!p` |
| and, or | `p & q`, `p \| q` |
| implies, iff | `p -> q`, `p <-> q` |
| quantifiers | `all x.(F(x) -> G(x))`, `exists x.(F(x) & G(x))` |
| predicates | one place only: `F(x)`, `F(a)` |

**`~` is not negation and is rejected.** NLTK reads `~p` as an atom *called* `~p`, so a step
written with it is satisfiable for the wrong reason and an invalid argument passes silently.
Accepting it here would be worse, because the same file would then mean two different things in
the two tools.

What is decided: propositional logic completely, and one-place predicate logic completely, so
long as there is no equality and no function symbols. Anything else -- a two-place relation, more
than four predicates -- is reported as *not decidable here*, which is a different answer from
invalid and is never drawn as one. `docs/VALIDITY-PLAN.md` explains why this is decided in the
project rather than by a solver.

## Interpretation mode — leave it alone

Argdown reads relations in one of two modes. **The default is `loose`, and it is almost always
what you want.** You do not need to declare it.

In **loose** mode a relation between two statements is *argumentative*: `<+` means this reason
speaks for that claim. In **strict** mode it is *logical*: `<+` asserts that one statement
**entails** the other, and `<-` that they are **contrary** — claims about logical form, not about
what a text argues.

Strict mode touches **only relations between two statements**. Anything involving an argument is
unchanged, and `><` means contradiction in both modes:

| relation | loose (default) | strict |
|---|---|---|
| statement `<+` statement | support | **entails** |
| statement `<-` statement | attack | **contrary** |
| statement `><` statement | contradictory | contradictory |
| statement `<+` `<-` argument | support / attack | unchanged |
| argument `<_` argument | undercut | unchanged |

Turn it on only if you are reconstructing formal logical relations and mean the stronger claim:

```argdown
===
model:
    mode: strict
===

[All ravens are black]: Every raven is black.
    -> [A white raven]: There is a white raven.
```

**Reconstructing a text? Stay in loose.** Saying that a paper's premises *entail* its conclusion
is a claim about validity that the paper itself usually does not make, and the reconstruction
should not make it on the author's behalf.
