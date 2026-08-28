#!/usr/bin/env python3
"""What one reconstruction run actually cost, read out of the agent's own transcript.

    python3 ipsissima-mcp/eval/run_cost.py TRANSCRIPT.jsonl [--calls] [--map NAME.argdown]

WHY THIS EXISTS. `COST-2026-08-27.md` established that a run costs 37 to 45 tool calls whatever
the paper, and that the fixed cost is the agentic loop rather than the documents or the checker.
What it could not do was say how the tokens divide, because tool calls were counted by hand out of
five transcripts and tokens were taken from the agents' own summary. So the central claim --
that a run costs roughly `calls x context` and that halving the calls halves the cost -- stayed a
prediction. `COST-PLAN-2026-08-28.md` writes that prediction down as an arithmetic model and says
which observation would falsify it.

This reads the observation. Every assistant turn in an agent transcript carries a `usage` block
with four separate numbers, and they answer different questions:

  cache_read_input_tokens      CARRYING THE CONVERSATION. The prefix that was already cached,
                               re-sent on this call and charged at a fraction. If the model in the
                               plan is right, this is the bulk of a run and it grows with the
                               number of calls.
  cache_creation_input_tokens  what was new on this call and worth caching -- the documents when
                               they are first read, the map when it is first written.
  input_tokens                 what was new and not cached.
  output_tokens               THINKING AND WRITING. At max effort this includes the reasoning,
                               which no amount of call-cutting removes from a step that still
                               has to happen.

The split between the first and the last is the whole question. If a run is mostly cache reads,
fewer round trips is the lever and the plan's order is right. If it is mostly output, the effort
level is the lever and the plan's section 5 applies instead.

THE CALL CENSUS is the other half, and it is finer than the one done by hand. In particular it
distinguishes READING THE MAP from reading anything else, which the earlier count did not: a map
already in context that gets read back is 40 KB of pure duplication, and nobody has yet measured
whether runs do it.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys

USAGE_KEYS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens",
              "output_tokens")

#: Documents the extraction prompt tells a reconstructor to read before writing.
INSTRUCTIONS = ("extraction-prompt", "argdown-cheatsheet", "reconstruction-cheatsheet",
                "ipsissima-conventions", "SKILL.md")


def classify(name, inp, map_name):
    """What one tool call was for. Categories match COST-2026-08-27.md, plus 'read the map'."""
    text = ""
    if isinstance(inp, dict):
        text = " ".join(str(v) for v in inp.values() if isinstance(v, (str, int)))
    low = text.lower()

    if "check_argdown" in low or "check_reconstruction" in name.lower():
        return "run the checker"
    if name in ("Write",) and map_name and map_name.lower() in low:
        return "write the map"
    if name in ("Edit", "NotebookEdit") and map_name and map_name.lower() in low:
        return "edit the map"
    if map_name and map_name.lower() in low and name in ("Read", "Bash"):
        # A map that is read back after being written is duplication; a map that is read before
        # being written is contamination, and a different problem entirely.
        return "read the map"
    if any(d.lower() in low for d in INSTRUCTIONS):
        return "read the instructions"
    # `and` binds tighter than `or`, so these are spelled out rather than run together.
    if name in ("Read", "Bash") and ("/source/" in low or re.search(r"\bsource/", low)):
        return "read the source"
    if name in ("Grep", "Glob") or re.search(r"\b(grep|rg|find)\b", low):
        return "search / grep"
    if re.search(r"\b(ls|tree|stat)\b", low):
        return "look around the folder"
    if name in ("Read",):
        return "read something else"
    if name in ("Write", "Edit"):
        return "write something else"
    if name in ("Bash",):
        return "run something else"
    return f"other ({name})"


def read(path, map_name):
    """Usage per model TURN, and what each tool call was for.

    A TRANSCRIPT REPEATS ITSELF AND NAIVE SUMMING IS WILDLY WRONG. Each assistant turn is written
    out once per content block as it streams -- thinking, then text, then each tool_use -- and
    every one of those records carries the SAME usage block, with `output_tokens` climbing to its
    final value on the last. Summing the records rather than the turns counted one run's carried
    context as 145,730 tokens when it was 72,865. Both are grouped by the message id, which is
    stable across a turn's records; usage takes the maximum seen, and tool calls are deduplicated
    on their own ids.

    TURNS, NOT CALLS, ARE THE ROUND TRIPS. Two tools invoked in one turn are one trip and one lot
    of carried context, which is why both numbers are reported and why their ratio matters.
    """
    usage, seen_call, calls, order = {}, set(), [], []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            m = d.get("message")
            if not isinstance(m, dict) or m.get("role") != "assistant":
                continue
            mid = m.get("id") or f"anon-{len(usage)}"
            u = m.get("usage") or {}
            if any(k in u for k in USAGE_KEYS):
                if mid not in usage:
                    usage[mid] = {k: 0 for k in USAGE_KEYS}
                    order.append(mid)
                for k in USAGE_KEYS:
                    usage[mid][k] = max(usage[mid][k], int(u.get(k) or 0))
            for block in m.get("content") or []:
                if not isinstance(block, dict) or block.get("type") != "tool_use":
                    continue
                bid = block.get("id") or f"{mid}-{len(calls)}"
                if bid in seen_call:
                    continue
                seen_call.add(bid)
                calls.append((mid, classify(block.get("name", "?"), block.get("input"), map_name)))
    return [usage[m] for m in order], calls


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript")
    ap.add_argument("--map", default=None,
                    help="basename of the .argdown the run writes, so map reads can be told "
                         "apart from other reads")
    ap.add_argument("--calls", action="store_true", help="print every turn's usage")
    a = ap.parse_args()

    turns, calls = read(a.transcript, a.map)
    if not turns:
        sys.exit(f"no assistant turns with usage in {a.transcript}")

    tot = {k: sum(t[k] for t in turns) for k in USAGE_KEYS}
    billed_ish = tot["input_tokens"] + tot["cache_creation_input_tokens"] + tot["output_tokens"]
    grand = billed_ish + tot["cache_read_input_tokens"]

    if a.calls:
        print(f"\n  {'turn':>5}{'new':>10}{'cached-w':>11}{'cached-r':>11}{'output':>10}")
        for i, t in enumerate(turns, 1):
            print(f"  {i:>5}{t['input_tokens']:>10}{t['cache_creation_input_tokens']:>11}"
                  f"{t['cache_read_input_tokens']:>11}{t['output_tokens']:>10}")

    print(f"\n  {os.path.basename(a.transcript)}")
    print(f"  {'model turns':<34}{len(turns):>12,}")
    print(f"  {'tool calls':<34}{len(calls):>12,}")
    print("\n  WHERE THE TOKENS WENT")
    for k, label in (("cache_read_input_tokens", "carrying the conversation"),
                     ("output_tokens", "thinking and writing"),
                     ("cache_creation_input_tokens", "new, and cached for later"),
                     ("input_tokens", "new, uncached")):
        share = tot[k] / grand * 100 if grand else 0
        print(f"  {label:<34}{tot[k]:>12,}{share:>8.1f}%")
    print(f"  {'':<34}{'-' * 12:>12}")
    print(f"  {'all input and output':<34}{grand:>12,}")

    if len(turns):
        print(f"\n  {'per model turn: carried':<34}{tot['cache_read_input_tokens']//len(turns):>12,}")
        print(f"  {'per model turn: thought/wrote':<34}{tot['output_tokens']//len(turns):>12,}")
        # DIVIDE BY THE TURNS THAT CALLED SOMETHING. A run's last turn is the report and calls
        # nothing; counting it makes a batching run look unbatched.
        acting = len({mid for mid, _ in calls})
        if acting:
            per_turn = len(calls) / acting
            print(f"  {'tool calls per acting turn':<34}{per_turn:>12.2f}")
            if per_turn < 1.15 and len(calls) > 8:
                print("      calls are going one to a turn. Independent calls issued together are "
                      "ONE round trip;\n      batching them costs nothing but the instruction.")

    # CACHE EXPIRY, which is invisible unless you look for it and can dominate a run.
    # Everything here is cached with a five-minute TTL. A single max-effort turn that thinks for
    # longer than that outlives its own cache, and the NEXT turn re-writes the whole context from
    # scratch -- charged at the cache-write rate, not the cache-read one. Measured on the Darwin
    # run of 28 Aug 2026: one turn thought for 8.2 minutes and cost a 109,347-token re-cache,
    # 62% of all the caching in a six-turn run.
    misses = [i for i, t in enumerate(turns[1:], 2)
              if t["cache_read_input_tokens"] == 0 and t["cache_creation_input_tokens"] > 0]
    if misses:
        lost = sum(turns[i - 1]["cache_creation_input_tokens"] for i in misses)
        print(f"\n  CACHE EXPIRED before turn(s) {', '.join(map(str, misses))} — "
              f"{lost:,} tokens re-cached")
        print("      A turn that thinks for longer than the cache TTL makes the next turn pay to")
        print("      rebuild the whole context. Fewer and shorter turns avoid it; so would a")
        print("      longer TTL. Note that batching MORE into one turn can cause this rather")
        print("      than prevent it.")

    print("\n  WHAT THE CALLS WERE FOR")
    for what, n in collections.Counter(c for _, c in calls).most_common():
        print(f"  {what:<34}{n:>12}")
    if not a.map:
        print("\n  (pass --map NAME.argdown to tell reads of the map apart from other reads)")


if __name__ == "__main__":
    main()
