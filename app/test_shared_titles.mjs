#!/usr/bin/env node
/* test_shared_titles.mjs — a statement may share its name with an argument, and keeps its own box.
 *
 *   node app/test_shared_titles.mjs
 *
 * WHY THIS EXISTS. Argdown keeps `[statement]` and `<argument>` titles in separate namespaces, so
 * a premise or a conclusion may carry its argument's name, and a reconstruction often wants it
 * to: the argument is named for the claim it turns on. The graph builder keys an argument's
 * records -- its premise-conclusion lines, its step count, which premise feeds which step -- by
 * title, and read them back by title without asking whether the node was an argument. So the
 * statement was handed the argument's whole structure and drawn as a second copy of it,
 * supporting the first (the Dewey map, 27 Nov 2026: `[Experience is saturated with past
 * reflection]`, premise (1) of the argument of that name, and `[Non-empirical philosophy fails
 * the test]`, the conclusion of its namesake).
 */
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

let failed = 0;
function check(ok, label) { console.log((ok ? "   ok   " : "   FAIL ") + label); if (!ok) failed++; }

const MAP = `
[Top]: What the argument is for.
    <+ <Saturated>

<Saturated>: The argument, named for its first premise.

(1) [Saturated]: The first premise, named like the argument.
(2) [Distort]: The second premise.
-----
(3) [Top]

<Fails>: An argument named for its conclusion.

(1) [Test]: A premise.
(2) [Outcome]: Another premise.
-----
(3) [Fails]: The conclusion, named like the argument.

[Elsewhere]: A claim the argument's own premise also supports, outside any structure.
    <+ [Test]
    <- [Fails]

[Saturated]
    <+ [Distort]
`;

const g = toGraph(argdown.run({ input: MAP, ...RUN }));
const node = (label, kind) => g.nodes.find(n => n.label === label && n.kind === kind);

console.log("a premise named like its argument");
const arg1 = node("Saturated", "argument"), st1 = node("Saturated", "statement");
check(arg1 && arg1.pcs && arg1.pcs.length === 3 && arg1.steps === 1,
      "the argument keeps its three lines and its one step");
check(st1 && !st1.pcs && st1.steps == null,
      "the premise carries no structure of its own, so it is drawn as a claim");
const e1 = g.edges.find(e => e.from === st1.id && e.to === arg1.id);
check(e1 && e1.step === 0, "and it still feeds the argument's step as premise (1)");

console.log("a conclusion named like its argument");
const arg2 = node("Fails", "argument"), st2 = node("Fails", "statement");
check(arg2 && arg2.pcs && arg2.pcs.length === 3, "the argument keeps its lines");
check(st2 && !st2.pcs && st2.steps == null, "the conclusion carries none");

console.log("a support between statements, where one shares an argument's name");
const elsewhere = node("Elsewhere", "statement"), test = node("Test", "statement");
const e2 = g.edges.find(e => e.from === test.id && e.to === elsewhere.id);
check(e2 && e2.step == null, "a premise supporting some other claim is not read as a step");
const e3 = g.edges.find(e => e.from === st2.id && e.to === elsewhere.id);
check(e3 && e3.step == null && e3.type === "attack",
      "and the namesake conclusion's own relation is its own");

const e4 = g.edges.find(e => e.from === node("Distort", "statement").id && e.to === st1.id);
check(e4 && e4.step == null,
      "a claim supporting the namesake statement directly is not a step of the argument");

console.log(failed ? `\n${failed} FAILED` : "\nall shared-title checks pass");
process.exit(failed ? 1 : 0);
