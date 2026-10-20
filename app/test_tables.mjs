// The text's comparisons as tables (a trial, 20 Oct 2026; ipsissima-mcp docs/tabulation-pass.md).
//
//     node app/test_tables.mjs
//
// The planted fixtures in fixtures/frames/ carry their answers in their headers, written before the
// code: the definition's coin guess meets the rule and is not a good guess; the card guess leaves a
// cell empty; the weather and coin guesses differ in the verdict and in nothing else stated...
// and the grant is better than the fee on every count the text ranks. Declared accounts replace the
// guessed ones.
import { argdown } from "@argdown/core";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const require = createRequire(import.meta.url);
require("./src/argdown-validity.js");
const { toGraph, RUN } = await import("./argdown-graph.mjs");
const T = require("./src/argdown-tables.js");
const A = require("./src/argdown-accounts.js");
const graphOf = f => toGraph(argdown.run({ input: fs.readFileSync(path.join(REPO, "fixtures", f), "utf8"), ...RUN }));

let fails = 0;
const check = (ok, name, got) => { if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok || got === undefined ? "" : "\n          got " + got}`); };

console.log("the definition and its counterexample");
{
  const g = graphOf("frames/definition.argdown");
  check(g.frames && g.frames.frames.length === 4 && g.frames.cells.length === 8,
        "the graph carries the frames and the eight cells the claims state", JSON.stringify(g.frames && g.frames.cells.length));
  const [t] = T.caseTables(g);
  check(t && t.rows.length === 3 && t.columns.map(c => c.id).join() === "informed,right,good",
        "one case table: the cases as rows, the dimensions as columns and the verdict last", t && t.columns.map(c => c.id).join());
  // Mutation: count a cell as filled when it has no claim -> 0 empty.
  check(t.empty.length === 1 && t.empty[0].row === "C" && t.empty[0].column === "informed",
        "the cell the text leaves empty is named, and never filled", JSON.stringify(t.empty));
  check(t.cells.C.good.values[0] === "no" && t.cells.C.right.claims[0].title === "The card guess was right",
        "one claim may state two cells", JSON.stringify(t.cells.C));
  // Mutation: let a row with an empty dimension be compared -> B/C appear.
  check(t.apart.length === 0, "no pair is set apart where a dimension is unstated or two differ", JSON.stringify(t.apart));
  // Mutation: test `!meets` only -> the coin guess is not found.
  check(t.againstRule.length === 1 && t.againstRule[0].row === "B" && t.againstRule[0].meets && t.againstRule[0].got === "no",
        "the row that meets the stated rule and gets another verdict is the counterexample", JSON.stringify(t.againstRule));
  // A row that differs from another in one stated dimension only.
  const g2 = graphOf("frames/definition.argdown");
  g2.frames.cells.push({ title: "x", id: null, text: "", kind: "claim", coords: { case: "C", informed: "no" } });
  const [t2] = T.caseTables(g2);
  // Mutation: require diff.length === 2 -> none.
  const ac = t2.apart.find(p => p.a === "A" && p.b === "C"), bc = t2.apart.find(p => p.a === "B" && p.b === "C");
  check(t2.apart.length === 2 && ac && ac.dimension === "informed" && ac.verdicts[0].differ && bc && !bc.verdicts[0].differ,
        "two rows alike in every stated dimension but one are set apart, with whether the verdict differs too", JSON.stringify(t2.apart));
  // Mutation: drop the alike branch -> none.
  check(t.alike.length === 1 && t.alike[0].a === "A" && t.alike[0].b === "B" && t.alike[0].values.join() === "yes,no",
        "two rows alike in every stated dimension and given different verdicts are named", JSON.stringify(t.alike));
}

console.log("options, criteria and two accounts");
{
  const g = graphOf("frames/options.argdown");
  const [t] = T.caseTables(g);
  // Mutation: compare ranks the wrong way -> the grant is worse.
  check(t.dominated.length === 1 && t.dominated[0].worse === "fee" && t.dominated[0].better === "grant",
        "a case worse on every count the text ranks is named, and nothing is totalled", JSON.stringify(t.dominated));
  check(t.dominated[0].on.join() === "reach,cost", "  and the counts it is worse on are named", JSON.stringify(t.dominated[0]));
  check(t.empty.filter(e => e.row === "lottery").length === 2, "the option the text never weighs is two empty cells");
  const sets = A.accountSets(g);
  // Mutation: drop the declaredSets branch -> the derived pairing finds "Reading moved online" attacking the claim.
  check(sets.length === 1 && sets[0].declared && sets[0].accounts.map(a => a.label).join() === "Shorter hours cut visits,Reading moved online",
        "declared accounts are the sets, the text's own first", JSON.stringify(sets.map(s => s.accounts.map(a => a.label))));
  const row = sets[0].rows.find(r => r.label === "Visits fell on the closed evenings");
  check(row && row.kind === "apart", "and a finding drawn for one and against the other tells them apart", JSON.stringify(row));
}

console.log("an account set's rows grouped by case");
{
  // Two findings of one study, each bearing on one account, are one row that tells them apart.
  const g = graphOf("frames/options.argdown");
  const byTitle = t => g.nodes.find(n => n.label === t).id;
  g.frames.frames.push({ id: "site", kind: "case", label: "Site", values: [{ id: "north", label: "North branch" }] });
  const set = A.accountSets(g)[0];
  const ev = byTitle("Visits fell on the closed evenings");
  // Plant a second finding of the same site, for one account only, by hand.
  set.rows = [{ id: ev, label: "x", cells: { [set.accounts[0].id]: "for" }, kind: "one" },
              { id: "n-other", label: "y", cells: { [set.accounts[1].id]: "against" }, kind: "one" }];
  g.frames.cells.push({ title: "x", id: ev, text: "", kind: "claim", coords: { site: "north" } },
                      { title: "y", id: "n-other", text: "", kind: "claim", coords: { site: "north" } });
  const groups = T.accountRowsByCase(g, set);
  // Mutation: key groups by row id -> two groups of kind "one".
  check(groups.length === 1 && groups[0].label === "North branch" && groups[0].kind === "apart" && groups[0].rows.length === 2,
        "two one-account rows from one case are one row that tells the accounts apart", JSON.stringify(groups));
}

console.log("a map with no frames");
{
  const g = graphOf("suppose/accounts.argdown");
  check(g.frames === null && T.caseTables(g).length === 0 && T.crossTables(g).length === 0,
        "has no tables, and its accounts are still derived as before", String(g.frames));
  check(A.accountSets(g).length === 1 && !A.accountSets(g)[0].declared, "  (the derived set, unchanged)");
}

console.log("cases crossed with cases");
{
  const g = graphOf("frames/options.argdown");
  g.frames.frames.push({ id: "year", kind: "case", label: "Year", values: [{ id: "y1", label: "2024" }, { id: "y2", label: "2025" }] });
  g.frames.cells.push({ title: "A grant reaches everyone", id: null, text: "", kind: "claim", coords: { option: "grant", year: "y1", reach: "everyone" } });
  const [x] = T.crossTables(g);
  check(x && x.rowsFrame === "option" && x.columnsFrame === "year" && x.filled === 1 && x.size === 6 &&
        x.cells.grant.y1[0].values.reach === "everyone",
        "a claim naming two case frames sits where they cross, with its other values beside it", JSON.stringify(x && x.cells));
}

console.log();
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
console.log("all table checks passed");
