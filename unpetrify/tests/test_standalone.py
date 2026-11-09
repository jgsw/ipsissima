#!/usr/bin/env python3
"""Unpetrify must stand on its own: nothing in it may reach into Ipsissima.

    python3 unpetrify/tests/test_standalone.py

WHAT THIS HOLDS IN PLACE. The converters were split out of Ipsissima-MCP (Nov 2026) so that
people who never make an argument map can have them. That only stays true while the dependency
runs one way: Ipsissima imports Unpetrify, and Unpetrify imports nothing of Ipsissima's. Before
the split this test checked the same line inside one package and found it already clean; now it
checks the two packages.

EVERY IMPORT FORM IS CHECKED, lazy ones inside functions included, because that is where a
shortcut hides. The bare `import pdf_to_source` fallbacks the modules carry for running as a
script count too: a bare import of a module that only exists on Ipsissima's side would work in a
checkout and fail for anyone who installed Unpetrify alone.

And the move must be a move: a converter left behind in Ipsissima as well would be a second copy
for a fix to miss.
"""
import ast
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
UNPETRIFY = REPO / "unpetrify" / "src" / "unpetrify"
IPSISSIMA = REPO / "ipsissima-mcp" / "src" / "ipsissima_mcp"

fails = 0


def check(name, ok, detail=None):
    global fails
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok or not detail else f"\n          {detail}"))


def imported_names(path):
    """Every top-level module name `path` imports, by any spelling, at any depth.

    A relative import counts as its package's own (`unpetrify`), so only absolute names are
    returned for the caller to judge."""
    found = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom):
            if not node.level and node.module:
                found.add(node.module.split(".")[0])
        elif isinstance(node, ast.Import):
            found.update(alias.name.split(".")[0] for alias in node.names)
    return found


ours = {p.stem for p in UNPETRIFY.glob("*.py")} - {"__init__"}
theirs = {p.stem for p in IPSISSIMA.glob("*.py")} - {"__init__"}
check("both packages are where this test expects", ours and theirs,
      f"{UNPETRIFY} or {IPSISSIMA} is empty")

for path in sorted(UNPETRIFY.glob("*.py")):
    leaks = imported_names(path) & ({"ipsissima_mcp"} | (theirs - ours))
    check(f"{path.stem} imports nothing of Ipsissima's", not leaks,
          f"imports {sorted(leaks)}")

# Each package has a `server.py` of its own, which is two servers, not a copy.
converters = ours - {"server", "cli", "tools"}
check("no converter is left behind in Ipsissima as well", not (converters & theirs),
      f"in both: {sorted(converters & theirs)}")

# The reverse direction is allowed, and is the point: Ipsissima's server registers these tools.
server = imported_names(IPSISSIMA / "server.py")
check("Ipsissima's server reads its sources through Unpetrify", "unpetrify" in server,
      f"server imports {sorted(server)}")

print(f"\n{'FAILED: ' + str(fails) if fails else 'ok'}")
sys.exit(1 if fails else 0)
