#!/usr/bin/env python3
"""The extraction half of the package must not depend on the Argdown half.

    python3 ipsissima-mcp/tests/test_extraction_boundary.py

WHAT THIS HOLDS IN PLACE. The converters that turn a PDF, an article, an EPUB or a TEI file into
structured Markdown are useful to people who never make an argument map, and the plan is to ship
them as a package of their own. That is cheap only while the dependency runs one way: the
Argdown side (the server, the planner, the checker, the mechanism pass) may import extraction,
and extraction may import nothing from it. Measured 3 Nov 2026, the set below was already closed
under its own imports; this test keeps it so.

EVERY IMPORT FORM IS CHECKED, lazy ones inside functions included, because that is where a
shortcut hides -- `sources.py` reaches into `mechanism` from inside a function. The bare
`import zotero_local` fallbacks some modules carry for running as a script count too.

Moving a module across the line means editing EXTRACTION below, on purpose.
"""
import ast
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"

#: What could be shipped on its own. `zotero_local` and `from_zotero` read a library for sources;
#: `zotero_store` writes MAPS back, so it stays on the other side.
EXTRACTION = {
    "pdf_to_source", "html_to_source", "epub_to_source", "tei_to_source", "structured_source",
    "collate", "ingest", "paginate", "from_zotero", "zotero_local", "split_manuscript",
}

fails = 0


def check(name, ok, detail=None):
    global fails
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok or not detail else f"\n          {detail}"))


def sibling_imports(path, siblings):
    """Names of sibling modules `path` imports, by any spelling, at any depth."""
    found = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom):
            module = (node.module or "").split(".")
            if node.level or module[0] == "ipsissima_mcp":
                head = module[1] if module[0] == "ipsissima_mcp" and len(module) > 1 else module[0]
                if head in siblings:
                    found.add(head)
                elif not head or head == "ipsissima_mcp":
                    found.update(a.name for a in node.names if a.name in siblings)
            elif module[0] in siblings:
                found.add(module[0])
        elif isinstance(node, ast.Import):
            for alias in node.names:
                parts = alias.name.split(".")
                head = parts[1] if parts[0] == "ipsissima_mcp" and len(parts) > 1 else parts[0]
                if head in siblings:
                    found.add(head)
    return found


siblings = {p.stem for p in PKG.glob("*.py")} - {"__init__"}
check("every extraction module exists", EXTRACTION <= siblings,
      f"missing: {sorted(EXTRACTION - siblings)}")

argdown_side = siblings - EXTRACTION
for name in sorted(EXTRACTION & siblings):
    leaks = sibling_imports(PKG / f"{name}.py", siblings) - {name} - EXTRACTION
    check(f"{name} imports nothing from the Argdown side", not leaks,
          f"imports {sorted(leaks)}; move the dependency out or move the module across the line")

# The reverse direction is allowed, but a module nobody on the Argdown side uses is probably
# misfiled, and the first sign of that is the server not importing it.
server_uses = sibling_imports(PKG / "server.py", siblings) & EXTRACTION
check("the server uses extraction through its modules", {"ingest", "collate"} <= server_uses,
      f"server imports {sorted(server_uses)}")

print(f"\n{'FAILED: ' + str(fails) if fails else 'ok'}")
sys.exit(1 if fails else 0)
