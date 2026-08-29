#!/usr/bin/env node
/* release_notes.mjs — compose a release's notes: its Changes, then the standing guidance.
 *
 *   node release_notes.mjs v0.2.0 > /tmp/notes.md
 *
 * WHY THE TAG IS THE SOURCE. A release should say what changed, and that text belongs where it
 * cannot drift from the release it describes: the tag's own annotation, written once at cut
 * time and readable forever with `git tag -l`. This script reads it back and puts the standing
 * "What should I install?" section under it — extracted from release.yml's releaseBody rather
 * than duplicated here, so the fallback the workflow writes and the draft the cut pre-creates
 * are the same shape from the same words. RELEASING.md is the flow this belongs to; the draft
 * is created from this output BEFORE the tag is pushed, and on the found-draft path the build
 * action uploads assets without touching the body.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tag = process.argv[2];
if (!tag || !/^v\d/.test(tag)) {
  console.error("usage: node release_notes.mjs vX.Y.Z   (the tag must exist locally)");
  process.exit(1);
}

const annotation = execFileSync("git", ["tag", "-l", "--format=%(contents:body)", tag],
                                { encoding: "utf8" }).trim();
if (!annotation) {
  console.error(`the tag ${tag} has no annotation body — write the Changes into the tag first:\n` +
                `  git tag -a ${tag} -m "Ipsissima ${tag.slice(1)} — <one line>" -m "<what changed>"`);
  process.exit(1);
}

const yml = fs.readFileSync(path.join(HERE, "..", "..", ".github", "workflows", "release.yml"),
                            "utf8");
const start = yml.indexOf("            ## What should I install?");
if (start < 0) throw new Error("release.yml no longer carries the standing section");
const lines = [];
for (const ln of yml.slice(start).split("\n")) {
  if (ln.trim() === "") { lines.push(""); continue; }
  if (!ln.startsWith("            ")) break;
  lines.push(ln.slice(12));
}
const standing = lines.join("\n").trimEnd();

/** GitHub renders a release body's single newlines as hard line breaks, so a paragraph wrapped
 *  at source-code width comes out ragged on the page (reported from use). Continuation lines
 *  join their paragraph or bullet; blank lines, headings and new bullets keep their own. */
function unwrap(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const s2 = raw.trim();
    const startsBlock = s2 === "" || /^(#|>|\||[-*] )/.test(s2);
    const prev = out.length ? out[out.length - 1] : "";
    if (prev.trim() !== "" && !startsBlock && !prev.trim().startsWith("#"))
      out[out.length - 1] = prev.replace(/\s+$/, "") + " " + s2;
    else out.push(raw.replace(/\s+$/, ""));
  }
  return out.join("\n");
}

process.stdout.write(
  "Ipsissima reads an Argdown reconstruction beside the manuscript itself.\n\n" +
  "## Changes\n\n" + unwrap(annotation) + "\n\n" + unwrap(standing) + "\n");
