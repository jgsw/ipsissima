#!/usr/bin/env node
/* build_site.mjs — assemble everything the public site serves, beside the markdown that is
 * committed here.
 *
 *   node site/build_site.mjs
 *
 * WHY A SCRIPT AND NOT A COMMITTED FOLDER. `Ipsissima.html` is a build artifact and the
 * repository says so: "The two HTML files ARE the product, but they are generated … attach them
 * to a release rather than committing them." Serving GitHub Pages from a committed directory
 * would mean 2.5 MB of generated HTML entering git on every release, for ever. So the site is
 * assembled at deploy time from sources that are committed — `index.md`, `_config.yml` — plus
 * artifacts built here and thrown away.
 *
 * WEB NAMES, NOT FILE NAMES. `Ipsissima Reader.html` is a good name on a desktop and a bad one in
 * a URL, where the space becomes `%20` in every link anyone copies. The same goes for the sample
 * folders: `Miller 2019 - Prorogation of Parliament` and `… (map).html` are legible in a Finder
 * window and miserable in an address bar. Everything published here is renamed to a slug, and the
 * mapping is in SAMPLES below rather than spread through the markdown.
 *
 * THE SAMPLES ARE BUILT WITH THEIR MANUSCRIPTS. `--source-root` bakes the source text into the
 * page, so a visitor gets the Manuscript view and the claim-to-passage links rather than a map
 * with the tab greyed out. It roughly doubles each file and is the whole point of the demonstration.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const BUILDER = path.join(REPO, "app", "build_argdown_viewer.mjs");
const OUT = HERE;

/** The three published samples, and the slug each is served under.
 *
 *  PUBLIC-DOMAIN AND OPEN-LICENCE ONLY, which is not a coincidence. Darwin and Carroll are out of
 *  copyright; Miller is Crown copyright reusable under the Open Government Licence. A CC-BY
 *  sample would drag its attribution onto a web page that has nowhere sensible to put it, and the
 *  private corpus must never come near this script at all.
 */
const SAMPLES = [
  { slug: "darwin",
    dir: "Darwin 1859 - Natural selection",
    file: "darwin-natural-selection.argdown",
    title: "Darwin, on natural selection",
    blurb: "A single paragraph of the Origin, argued from variation and struggle to the " +
           "conclusion those two earn. The smallest complete reconstruction here." },
  { slug: "carroll",
    dir: "Carroll 1895 - What the Tortoise said to Achilles",
    file: "carroll-tortoise-achilles.argdown",
    title: "Carroll, What the Tortoise said to Achilles",
    blurb: "The regress about rules of inference, reconstructed as a reductio the dialogue " +
           "never states — with the imputation marked as the reconstructor's own." },
  { slug: "miller",
    dir: "Miller 2019 - Prorogation of Parliament",
    file: "miller-2019-uksc-41.argdown",
    title: "Miller v The Prime Minister [2019] UKSC 41",
    blurb: "The prorogation judgment, mapped backwards from the order the court made. The steps " +
           "the court needed to get there are its ratio; what it said by the way is marked " +
           "obiter, and the authorities it rests on are marked as authorities." },
  // FOURTH, AND THE ONLY ONE HERE BY SOMEBODY STILL ALIVE TO MIND. Published open access, and by
  // the author of Ipsissima, which is what makes putting a whole journal article on this site his
  // decision to make rather than a licence question. The other CC-BY samples in `samples/` stay
  // off the web on etiquette rather than law.
  { slug: "wilson",
    dir: "Wilson 2026 - Williams Dewey and the Nature of Value Inquiry",
    file: "wilson-williams-dewey.argdown",
    title: "Wilson, Williams, Dewey, and the Nature of Value Inquiry",
    blurb: "A whole journal article, and the one that strains the method hardest: its argument " +
           "moves like music rather than assertion, and the map ends in three contentions " +
           "instead of one because forcing a single apex would mean inventing a claim the " +
           "paper does not make.",
    credit: "Wilson, J. (2026) 'Williams, Dewey, and the Nature of Value Inquiry', " +
            "<em>Philosophy</em> 101, pp. 511–538. Open access, reproduced by the author." }
];

const run = (args, cwd) =>
  execFileSync("node", args, { cwd: cwd || REPO, stdio: ["ignore", "inherit", "inherit"] });

const kb = f => Math.round(fs.statSync(f).size / 1024);

console.log("assembling the site in " + path.relative(REPO, OUT));

// ---- the two standalone pages ------------------------------------------------------------- //
// The same two commands the release workflow runs, so what the site serves and what a release
// attaches are the same build and cannot drift.
const app = path.join(REPO, "app");
run([BUILDER, "--standalone", "--editor", "-o", path.join(OUT, "ipsissima.html")], app);
run([BUILDER, "--standalone", "-o", path.join(OUT, "ipsissima-reader.html")], app);
console.log(`  ipsissima.html          ${kb(path.join(OUT, "ipsissima.html"))} KB`);
console.log(`  ipsissima-reader.html   ${kb(path.join(OUT, "ipsissima-reader.html"))} KB`);

// ---- one page per sample, manuscript included ---------------------------------------------- //
const tryDir = path.join(OUT, "try");
fs.mkdirSync(tryDir, { recursive: true });
for (const s of SAMPLES) {
  const root = path.join(REPO, "samples", s.dir);
  const map = path.join(root, s.file);
  if (!fs.existsSync(map)) throw new Error("no such sample: " + map);
  const out = path.join(tryDir, s.slug + ".html");
  run([BUILDER, map, "--source-root", root, "-o", out]);
  console.log(`  try/${(s.slug + ".html").padEnd(20)}${kb(out)} KB`);
}

// ---- the list the landing page reads -------------------------------------------------------- //
// WRITTEN, NOT HAND-MAINTAINED. Jekyll reads `_data/samples.json` and `index.md` renders the list
// from it, so SAMPLES above is the only place a sample is named. A page that listed them itself
// would eventually advertise one that failed to build, which is the worst kind of broken link:
// the page is fine and the thing behind it is missing.
const dataDir = path.join(OUT, "_data");
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "samples.json"),
  JSON.stringify(SAMPLES.map(s => ({ slug: s.slug, title: s.title, blurb: s.blurb,
                                     credit: s.credit || null })), null, 2) + "\n");

console.log(`  _data/samples.json      ${SAMPLES.length} sample(s)`);
console.log("done. `jekyll build` over this folder produces the site.");
