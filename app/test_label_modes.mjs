#!/usr/bin/env node
/* test_label_modes.mjs — the claim's words survive whatever label mode the file sets.
 *
 * WHY THIS EXISTS. `statementLabelMode: "title"` and `argumentLabelMode: "title"` tell Argdown
 * to put nothing but the title on a map node, and the adapter read the words off `labelText`
 * alone -- so on the one map in the corpus that set the modes, every box, every tooltip and
 * the claims toggle had nothing behind the title, and a reader met "Unsafe Without Philosophy"
 * with no way to unpack what it amounts to. Reported from use, 31 Aug 2026.
 *
 * The contract under test: a label mode is an export style for Argdown's own outputs, and
 * toGraph carries the definition's words regardless, because the viewer's claims toggle is
 * what decides how much of them shows. A claim referred to but never defined stays empty --
 * its title is already everything the file says.
 */
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

let fails = 0, cases = 0;
const check = (name, ok, detail) => {
  cases++;
  if (!ok) { fails++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
  else console.log(`ok    ${name}`);
};

const FILE = `===
map:
    statementLabelMode: "title"
    argumentLabelMode: "title"
===

[Main Claim]: the words of the main claim, which the title-only mode hid.
    <+ <The Argument>

<The Argument>: the argument's own description, hidden the same way.

(1) [Side Premise]: the premise's words.
(2) an untitled premise.
-----
(3) [Main Claim]

[Side Premise]
    <- [Undefined Elsewhere]
`;

const g = toGraph(argdown.run({ input: FILE, ...RUN }));
const by = label => g.nodes.find(n => n.label === label);

check("a titled statement keeps its definition under statementLabelMode: title",
      by("Main Claim") && by("Main Claim").detail ===
        "the words of the main claim, which the title-only mode hid.",
      by("Main Claim") && JSON.stringify(by("Main Claim").detail));
check("a premise selected into the map keeps its words too",
      by("Side Premise") && by("Side Premise").detail === "the premise's words.",
      by("Side Premise") && JSON.stringify(by("Side Premise").detail));
check("an argument keeps its description under argumentLabelMode: title",
      by("The Argument") && by("The Argument").detail ===
        "the argument's own description, hidden the same way.",
      by("The Argument") && JSON.stringify(by("The Argument").detail));

// The modes off: the same file must come out with the same words, through labelText as before.
const plain = FILE.replace(/===[\s\S]*?===\n\n/, "");
const g2 = toGraph(argdown.run({ input: plain, ...RUN }));
const by2 = label => g2.nodes.find(n => n.label === label);
check("without the modes the words arrive as before",
      by2("Main Claim") && by2("Main Claim").detail ===
        "the words of the main claim, which the title-only mode hid.",
      by2("Main Claim") && JSON.stringify(by2("Main Claim").detail));
check("and the two routes agree on every shared node",
      g.nodes.every(n => {
        const twin = by2(n.label);
        return !twin || twin.detail === n.detail;
      }));

// A claim with no definition anywhere has no words to recover, and must not invent any.
check("a claim referred to but never defined stays empty",
      by("Undefined Elsewhere") && by("Undefined Elsewhere").detail === "",
      by("Undefined Elsewhere") && JSON.stringify(by("Undefined Elsewhere").detail));

console.log(`\n${cases - fails} of ${cases} passed`);
process.exit(fails ? 1 : 0);
