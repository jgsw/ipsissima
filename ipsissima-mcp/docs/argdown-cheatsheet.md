# Argdown: the complete syntax

**Assume you do not know this language.** There is very little Argdown on the open web, so a
model's prior on it is weak and often wrong — confident-looking guesses that do not parse, or that
parse into something other than what was meant. Everything below was checked against the parser
(`@argdown/core` 2.0) rather than inferred; where the behaviour is surprising, it says so.

Read this once before writing any `.argdown` file. It is short enough to read twice.

---

## 1. The whole language in one example

```argdown
===
title: A worked example
===

# The question                                    // a section heading

[Legalise soft drugs]: Soft drugs should be legal.    // a statement, with a title
    <+ <No harm, no ban>                              // an argument supports it
    <- <Law must protect>: The state may override personal freedom to protect people
      from themselves.                                // an argument attacks it, defined inline

<No harm, no ban>                                     // the argument, reconstructed

(1) [Harm principle]: The law's role is to protect society from harm, not people from
    themselves.
(2) Taking soft drugs harms nobody else.
-- Modus ponens {uses: [1,2]} --                      // the inference (optional detail)
(3) Soft drugs should not be criminal.
    +> [Legalise soft drugs]                          // this conclusion supports the contention

<Law must protect>
    <_ <Poor reason>: That harmful substances are already entrenched is no reason to
      allow two more.                                 // an UNDERCUT: the inference fails
```

Five kinds of thing: **statements**, **arguments**, **relations** between them, **premise-conclusion
structures** that open an argument up, and **structure** (sections, tags, metadata).

---

## 2. Statements

A statement is a claim. A paragraph of plain text is a statement.

```argdown
Soft drugs should be legal.
```

Give it a **title** in square brackets so you can refer to it:

```argdown
[Legalise soft drugs]: Soft drugs should be legal.
```

Refer to it later by writing the title alone:

```argdown
[Some other claim]: Something else.
    <+ [Legalise soft drugs]
```

**Titles are an equivalence class.** Two definitions with the same title are two formulations of
*the same claim*, not two claims. That is the intended way to record an alternative wording.

**A statement may run over several lines.** A blank line ends it — and a blank line *inside* one
splits it into two separate statements.

```argdown
[A]: This is one statement
that runs over two lines.

[B]: This is a different statement.
```

---

## 3. Arguments

An argument is a piece of reasoning. Title in **angle** brackets:

```argdown
<No harm, no ban>: The law's role is to protect society from harm, not people from themselves.
```

That is a **sketched** argument — a title and a description. Refer to it by title alone:

```argdown
[Some claim]: Text.
    <+ <No harm, no ban>
```

An argument becomes **reconstructed** when you give it a premise-conclusion structure (§5).
The same argument can have both a description and a PCS, written in separate blocks.

### The blank line after a title goes exactly one way

This is the rule most likely to catch you, because it points in opposite directions depending on
what comes next. It holds for `[Statement]` titles as well as `<Argument>` titles.

| what follows the title | blank line | why |
|---|---|---|
| a **relation** (`<+`, `<-`, `<_`, …) | **never** — it is a parse error | the relation is a child of the title, and a tree may not be broken by a blank line |
| a **premise-conclusion structure** (`(1) …`) | **always** — omitting it is a parse error | the title works as a heading for the PCS, and blank lines separate blocks |

```argdown
<Law must protect>
    <_ <Poor reason>: No blank line. The relation hangs off the title.

<No harm, no ban>

(1) A blank line above this one, because a PCS is a new block.
(2) Another premise.
-----
(3) The conclusion.
```

**Statement or argument — which?** A statement is *what is claimed*. An argument is *the move
from some claims to another*. If you can say "because", you have an argument.

---

## 4. Relations

### Parent and child

A relation is written on its own line, **indented under** the thing it relates to. That gives
every relation two ends, and the rest of this section needs names for them:

```argdown
[The contention]: The claim being argued for.
    <+ [A reason]: A reason for it.
```

- The **parent** is what the relation line is indented *under* — `[The contention]`. It is the
  nearest line above that is indented *less*.
- The **child** is what the relation line itself names — `[A reason]`.

Indentation is the only thing that decides this. In a nested list each line's parent is the
nearest line above it at a shallower indent, so the same claim is a child of the line above and a
parent to the lines below:

```argdown
[The contention]: The claim being argued for.
    <+ [A reason]: A reason for it.              // child of the contention …
        <- [An objection]: Why that reason fails. // … and parent of this
```

### The symbols, and which way they point

| write | meaning | direction |
|---|---|---|
| `<+` | support | the **child** supports the parent |
| `+>` | support | the **parent** supports the child |
| `<-` | attack | the **child** attacks the parent |
| `->` | attack | the **parent** attacks the child |
| `<_` | undercut | the **child** undercuts the parent |
| `_>` | undercut | the **parent** undercuts the child |
| `><` | contradiction | symmetric — they cannot both be true |

**The arrow points the way the relation runs.** `<+` points back up at the parent: the child
supports it. `+>` points down at the child: the parent supports it. That is the whole rule.

```argdown
[Contention]: The contention.
    <+ [Reason]: A reason for the contention.      // Reason  --supports--> Contention
    +> [Consequence]: What follows from it.        // Contention --supports--> Consequence
```

**Bare `+`, `-` and `_` mean the same as `<+`, `<-` and `<_`.** Do not use the bare forms — see
house style (§10). Bare `_` additionally *requires* a following space (`_ <X>`), because `_This`
would start italic text; `<_` needs no space. This asymmetry is a known wart in the language.

### When to use which — and the one everybody forgets

- **support / attack** — the child bears on the *truth* of the parent.
- **contradiction (`><`)** — the two cannot both be true. Symmetric, and stronger than attack.
  Use it for genuinely exclusive alternatives, e.g. rival hypotheses.
- **undercut (`<_`) — the one that is almost always missed.** An undercut does not say a premise
  is false or a conclusion untrue. It says **the inference does not go through**: even granting
  the premises, they do not support that conclusion.

Ask: *is this objection saying "that's false", or "that doesn't follow"?* If the second, it is an
undercut, and drawing it as an attack misreports the argument.

```argdown
<Comparable to alcohol>: Soft drugs are no worse than alcohol and tobacco.
    <- <Major differences>: Cannabis is mind-altering in a way alcohol is not.
      // attack: denies the premise
    <_ <Poor reason>: That alcohol and tobacco are already entrenched is not a reason
      to allow two more.
      // undercut: grants the comparison, denies that it licenses the conclusion
```

Typical undercut phrasings in a source: *"even if that were so, it would not show…"*, *"that may
be true, but it does not follow that…"*, *"this holds only under conditions that do not obtain
here"*, *"the analogy breaks down at exactly the point that matters"*.

An undercut properly targets an **argument** (an inference has to exist to be undercut). The
parser will let you undercut a statement; do not.

### Nesting

Children of the same parent sit at the **same indentation**. Deeper indentation makes a child of
the *previous line*, silently:

```argdown
[A]: A.
    <+ [B]: B.
    <+ [C]: C.       // sibling of B — both support A
```

```argdown
[A]: A.
    <+ [B]: B.
      <+ [C]: C.     // WRONG: C now supports B, not A. No error is reported.
```

### Declaring relations away from the definition

You can write a title alone and hang relations off it. Useful for declaring a set of relations in
one place:

```argdown
[Epidemic Influence Hypothesis]
    -> [Rough Examination Hypothesis]
    -> [Cadaveric Substance Hypothesis]
```

---

## 5. Premise-conclusion structures

Numbered statements in **round** brackets, with an inference line before the conclusion.

```argdown
<The argument's title>

(1) The first premise.
(2) The second premise.
-----
(3) The conclusion.
```

**Rules that are enforced:**

- A blank line **between the argument title and `(1)`** is required. Without it the file does not
  parse.
- **No blank lines inside** the structure.
- At least **two** statements, and an inference line between the last two.
- The inference line is **four or more hyphens** (`----`). Three hyphens is an error.

**Rules that are not enforced but are house style:** number consecutively from `(1)`. The parser
accepts `(1) (3) (4)`; a reader will not.

### Several steps

Repeat the inference line to chain steps. Everything above a line is available to what is below.

```argdown
(1) P.
(2) Q.
-----
(3) An intermediate conclusion.
(4) A further premise.
-----
(5) The final conclusion.
```

### Naming the inference

The expanded form uses **two** hyphens, a rule name and/or YAML, then two hyphens:

```argdown
<An argument>

(1) All humans are mortal.
(2) Socrates is human.
-- Modus ponens, Universal instantiation {uses: [1,2]} --
(3) Socrates is mortal.
```

The four permitted shapes of that line: `-- Rule --`, `-- Rule, Another rule --`,
`-- Rule {uses: [1,2]} --`, `-- {uses: [1,2]} --`.

The rule is a **comma-separated list of names**, optionally followed by one bracketed metadata
block. A **trailing comma is a parse error**. Prefer the plain `-----` unless the rule genuinely
informs the reader.

### Premises and conclusions can carry titles and relations

```argdown
<An argument>

(1) [Harm principle]: The law protects society from harm, not people from themselves.
    <+ [Mill says so]: Mill argues for exactly this.
(2) Taking soft drugs harms nobody else.
-----
(3) [No ban]: Soft drugs should not be criminal.
    +> [Legalise soft drugs]
```

A premise may be a **reference** to a statement defined elsewhere — `(1) [Harm principle]` —
which is how one claim does work in two arguments.

---

## 6. Metadata

YAML in braces, attached to the statement, argument or heading above it.

```argdown
[A claim]: The text. {source: "p. 14", checked: true}
```

Or on the next line, which is better for anything long:

```argdown
[A claim]: The text.
    {source: "p. 14", note: "Why this reading was chosen."}
```

**Block form** requires a line break *immediately* after `{`, and then you must use YAML block
style — you cannot mix in JSON style:

```argdown
[A claim]: The text.
    {
    source: "p. 14"
    note: "A longer note."
    }
```

> **This is the most dangerous construct in the language.** A metadata block is parsed as YAML,
> and a YAML error inside one does **not** raise a parse error — it silently empties the whole
> document. A trailing comma, a stray character after the closing brace, or JSON style after a
> line break will each turn a 40-claim file into nothing, with no message. See §11.

### Front matter

YAML between two lines of `===`, at the top of the file:

```argdown
===
title: The document's title
author: Who wrote it
===

[A claim]: Statements come after the front matter.
    <+ [A reason]: With a blank line between the two.
```

### Interpretation mode — leave it alone

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

---

## 7. Sections

Headings with `#`. They group the map.

```argdown
# A top-level section

[A claim]: Text.
    <+ [A reason]: Text.

## A subsection

[Another claim]: Text.
    <+ [Another reason]: Text.
```

Add `{isGroup: true}` to force a heading to become a group in the map. Note that by default only
headings down to a certain depth become groups (`group.groupDepth`, default 2), so a level-1
heading can quietly fail to appear.

**Top-level blocks must be separated by blank lines** — including a heading and what follows it.

---

## 8. Tags

```argdown
[A claim]: The text. #core

[Another claim]: The text. #(a tag with spaces)
```

Tags may appear anywhere in the text and are collected. `#` followed by a number (`#42`) is not a
tag.

---

## 9. Comments

```argdown
[A claim]: The text.        // to the end of the line

/* over
   several lines */

<!-- HTML style also works -->

[Another claim]: More text.
```

Comments are ignored entirely. **Do not put a comment on the second line of a file whose first
line is blank** — a known lexer fault.

---

## 10. House style

Where the language allows several ways, use these. They are chosen for a reader.

| do this | not this | why |
|---|---|---|
| `<+` `<-` `<_` — explicit direction | bare `+` `-` `_` | the direction is the argument; make it visible. And bare `_` needs a trailing space the others do not |
| `[Life moves fast]` | `[life-moves-fast]` | titles are prose and are read as prose. Spaces, commas and capitals are all legal. This is what the language's own examples do |
| `// a comment` | `<!-- a comment -->` | shorter, and the convention in every published Argdown document |
| `-----` | `-- rule --` | name a rule only when the reader learns something from it |
| numbered `(1) (2) (3)` from 1 | gaps | the parser tolerates gaps; readers do not |
| four spaces per level | mixed | consistency is load-bearing — see §4 |
| one claim per statement | several joined by "and" | a claim you cannot attack separately is two claims |

**Titles are case- and space-sensitive.** `[Life moves fast]` and `[Life Moves Fast]` are two
different claims. Pick a title once and copy it exactly thereafter.

---

## 11. The traps that do not announce themselves

Each of these produces a file that parses — or fails in a way that says nothing useful. They are
the reason to check a finished file rather than trust it.

**1. A mistyped title silently creates a new claim.**
`[Life moves fast]` defined, `[Life Moves Fast]` referenced → two claims, one of them orphaned. No
error. This is the most common way an LLM-written map goes wrong.

**2. A YAML error in metadata empties the entire document.**
No exception, no `parserErrors`, no message. Measured: 23 claims to 0.

```
{note: "x"}Z          // one stray character. Document gone.
{k: "v",}             // trailing comma. Document gone.
```

**3. A blank line inside a relation tree is a parse error.**
Including before the first child. Trees must be unbroken.

**4. Deeper indentation silently re-parents.** §4. No error, wrong argument.

**5. A lone `--` eats the next statement.**
`--` opens an *expanded* inference and consumes what follows as the rule name. With a closing
`--`, the claim between them vanishes from the document and the file parses clean.

```argdown
(1) P.
--
(2) Q.        // ← this claim is now an inference rule name, and is gone
--
(3) R.
```
Write `-----` for a plain inference line.

**6. Square and angle brackets in statement text are parse errors.**
`[...]` is always a statement reference and `<...>` always an argument reference — they cannot
appear inside a statement's content. Quoting a source containing `[sic]` breaks the file.
Write `\[sic\]`, or `&#91;sic&#93;`, or use a mention: `@[Some claim]`, `@<Some argument>`.
A lone `<` or `[` is fine; it is the matched pair that is read as a reference.

**7. An underscore inside a word is a parse error.**
`file_name` fails; `file\_name` and `__bold__` are fine.

**8. A missing blank line between an argument title and its `(1)` fails to parse.**

**9. A statement with no relations may not appear in the map.**
The map draws what is connected. A file with no relations at all produces an empty map.

**10. Section headings need a blank line after them**, like every other top-level block.

---

## 12. Before you call a file finished, ensure that:

1. It parses.
2. Every title you referenced is spelled exactly as it was defined — check the list of statements
   for near-duplicates.
3. Nothing is orphaned: every claim reaches the contention by some route.
4. Each objection is the *right kind*: attack if it denies a claim, undercut if it denies the
   inference, `><` if the two cannot both hold.
5. Indentation is even at each level.
6. The map has no claim you cannot point to in the source.

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/check_argdown.py FILE.argdown --format json
```
