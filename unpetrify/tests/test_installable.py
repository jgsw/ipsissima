#!/usr/bin/env python3
"""Unpetrify installs as itself: the wheel, its commands, and the .mcpb manifest beside it.

    python3 unpetrify/tests/test_installable.py

The same questions Ipsissima-MCP's test_installable.py asks of its own package, for the same
reason: a checkout hides every path that only a checkout has. Unpetrify carries no data files,
so what is left to go wrong is the declaration -- the dependencies, the two commands, and a
manifest that still agrees with the pyproject it ships beside.
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "src" / "unpetrify"

fails = 0


def check(name, ok, detail=None):
    global fails
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok or not detail else f"\n          {detail}"))


pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")

# ---- 1. the wheel --------------------------------------------------------------- #

builder = None
if shutil.which("uv"):
    builder = ["uv", "build", "--wheel", "--out-dir"]
elif subprocess.run([sys.executable, "-c", "import build"], capture_output=True).returncode == 0:
    builder = [sys.executable, "-m", "build", "--wheel", "--outdir"]

if not builder:
    print("  SKIP  neither `uv` nor `build` is available; the wheel is not checked")
else:
    with tempfile.TemporaryDirectory() as td:
        r = subprocess.run(builder + [td, str(ROOT)], capture_output=True, text=True)
        wheels = list(Path(td).glob("*.whl"))
        check("the wheel builds", r.returncode == 0 and wheels, (r.stderr or r.stdout)[-400:])
        if wheels:
            zf = zipfile.ZipFile(wheels[0])
            names = zf.namelist()
            for module in sorted(p.name for p in PKG.glob("*.py")):
                check(f"the wheel carries {module}", f"unpetrify/{module}" in names)
            meta = next((n for n in names if n.endswith(".dist-info/METADATA")), None)
            text = zf.read(meta).decode("utf-8") if meta else ""
            declared = re.findall(r'^\s*"([A-Za-z0-9_.-]+)\s*[><=]', pyproject, re.M)
            reqs = {r.split(";")[0].strip().lower()
                    for r in re.findall(r"^Requires-Dist:\s*(.+)$", text, re.M)}
            for d in sorted(set(declared)):
                check(f"the wheel requires {d}", any(r.startswith(d.lower()) for r in reqs),
                      f"Requires-Dist has {sorted(reqs)}")
            eps = next((n for n in names if n.endswith(".dist-info/entry_points.txt")), None)
            eps = zf.read(eps).decode("utf-8") if eps else ""
            for cmd in ("unpetrify", "unpetrify-mcp"):
                check(f"the wheel installs the {cmd} command",
                      re.search(rf"^{cmd}\s*=", eps, re.M))

# ---- 2. the .mcpb manifest still describes this package ---------------------- #

manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
py_version = (re.search(r'^version = "([^"]+)"', pyproject, re.M) or [None, None])[1]
check("the manifest and pyproject agree on the version", manifest.get("version") == py_version,
      f"manifest {manifest.get('version')} vs pyproject {py_version}")
entry = manifest.get("server", {}).get("entry_point", "")
check("the manifest's entry_point exists", entry and (ROOT / entry).is_file(),
      f"entry_point is {entry!r}")
py_floor = (re.search(r'requires-python = ">=([\d.]+)"', pyproject) or [None, None])[1]
declared = manifest.get("compatibility", {}).get("runtimes", {}).get("python", "")
check("the manifest and pyproject agree on the Python floor", py_floor and py_floor in declared,
      f"manifest says {declared!r}, pyproject says >={py_floor}")
for key in ("name", "version", "description", "author", "server"):
    check(f"the manifest has a {key}", key in manifest)

print(f"\n{fails} FAILED" if fails else "\nthe package installs as itself")
sys.exit(1 if fails else 0)
