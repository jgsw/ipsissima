#!/bin/sh
# rebuild-shell.sh — a Claude Code session set up for building argument maps.
#
#   ./rebuild-shell.sh
#
# WHY A SEPARATE SHELL RATHER THAN A SETTING. Prompt caching has two TTL buckets, and everything
# Claude Code runs outside the main conversation — every subagent, workflows, forks, compaction,
# session titles — shares one of them. It defaults to FIVE MINUTES on every plan.
#
# A reconstruction at `max` effort reliably contains a turn that thinks for longer than that. Both
# book runs on 28 Aug 2026 did: one deliberative turn ran 8.2 minutes, outlived its own cache, and
# the next turn paid to re-cache the whole context — 250,835 tokens on one run and 280,065 on the
# other. A one-hour TTL prevents that, worth roughly a quarter of a run's rate-weighted cost.
#
# But the setting is per BUCKET, not per agent, and the longer life is not free: a 1h cache bills
# its writes at 2x base against 1.25x for 5m. So every short subagent in the bucket pays about 40%
# more on its writes for a lifetime it never uses — and short subagents are frequent, cheap and
# numerous while reconstructions are rare and expensive. Put it in settings and an ordinary session
# that builds one map and does a lot of searching is plausibly WORSE off. Compaction is in the
# bucket too, and usually writes once and is never read again.
#
# Hence a shell you open on purpose, for the work that recoups it, leaving every other session on
# the five-minute default.
#
# CHECK IT TOOK. `eval/run_cost.py` on the run's transcript prints cache writes by TTL bucket and
# says so when they are all five-minute. A mistyped value and a setting never made look identical
# from the outside; the accepted values are exactly `5m` and `1h` and anything else is ignored.
# Needs Claude Code v2.1.242 or later.
set -eu

export CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL=1h

cat <<'EOF'
  Subagent prompt cache: 1h (this shell only).

  For building argument maps, where a max-effort turn can outlive the 5-minute default
  and make the next turn re-cache the whole context. Ordinary sessions are unaffected.

  Afterwards:  python3 ipsissima-mcp/eval/run_cost.py <transcript> --map <name>.argdown
  and look for "CACHE WRITES BY TTL" — it should say 1 hour, not 5 minutes.

EOF

exec claude "$@"
