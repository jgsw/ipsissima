#!/usr/bin/env python3
"""Everything the server serves has to travel with it.

    python3 ipsissima-mcp/tests/test_installable.py

THE FAILURE THIS EXISTS FOR IS SILENT AND WAS REAL. `server.py` found its prompts by walking up
from its own file to `ipsissima-mcp/docs`, which is where they live in a source checkout and
nowhere else. Installed properly, that walk arrived above site-packages, `_doc` fell through to
its `f"(missing: {p})"` branch, and the server started, registered nine tools, answered its
handshake and handed the model an apology in place of the instructions. Nothing raised. The same
was true of the Argdown parser, which lived in `app/node_modules`.

EDITABLE INSTALLS HIDE BOTH, which is why it lasted: `pip install -e` leaves the source in the
repository, so every path that assumes a checkout keeps working for the person most likely to
notice. The wheel test below is the only one that would have caught it, so it is the one that
matters; the cheaper checks above it fail faster and say more precisely what broke.
"""
import json
import re
import shutil
import subprocess
import sys
import sysconfig
import tempfile
import zipfile
from pathlib import Path

MCP = Path(__file__).resolve().parents[1]
PKG = MCP / "src" / "ipsissima_mcp"

fails = 0


def check(name, ok, detail=None):
    global fails
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok or not detail else f"\n          {detail}"))


# ---- 1. the data is inside the package, not beside it ------------------------ #

check("the docs are inside the package", (PKG / "docs").is_dir(),
      f"{PKG / 'docs'} does not exist")
check("the bundled parser is inside the package", (PKG / "vendor" / "argdown-cli.mjs").is_file(),
      "run: node app/build_argdown_shim.mjs")

# Every document the server asks for by name, against what is actually there. A prompt added
# without its file is the same silent failure in a new place.
server_src = (PKG / "server.py").read_text(encoding="utf-8")
named = sorted(set(re.findall(r'_doc\("([^"]+)"\)', server_src)
                   + re.findall(r'"([a-z-]+\.md)"', server_src)))
for name in named:
    check(f"docs/{name} exists", (PKG / "docs" / name).is_file())
check("the server names some documents at all", len(named) >= 5, f"found {named}")

# The walk-up that caused it, so that reintroducing it fails here rather than in a user's client.
check("server.py does not reach outside the package for its docs",
      "parents[1] / \"docs\"" not in server_src and "parents[2]" not in server_src,
      "DOCS/ROOT are resolving above the package again")


# ---- 2. the wheel actually carries them -------------------------------------- #
# THE DECLARATION IS THE PART THAT BREAKS. The files can be in the right place and still be left
# out: setuptools ships .py and nothing else unless package-data says otherwise, and it does not
# warn about what it dropped.

builder = None
if shutil.which("uv"):
    builder = ["uv", "build", "--wheel", "--out-dir"]
elif subprocess.run([sys.executable, "-c", "import build"], capture_output=True).returncode == 0:
    builder = [sys.executable, "-m", "build", "--wheel", "--outdir"]

if not builder:
    print("  SKIP  neither `uv` nor `build` is available; the wheel is not checked")
else:
    with tempfile.TemporaryDirectory() as td:
        r = subprocess.run(builder + [td, str(MCP)], capture_output=True, text=True)
        wheels = list(Path(td).glob("*.whl"))
        check("the wheel builds", r.returncode == 0 and wheels,
              (r.stderr or r.stdout)[-400:])
        if wheels:
            names = zipfile.ZipFile(wheels[0]).namelist()
            has = lambda pat: any(n.startswith(f"ipsissima_mcp/{pat}") for n in names)
            check("the wheel carries the parser", has("vendor/argdown-cli.mjs"))
            for name in named:
                check(f"the wheel carries docs/{name}", has(f"docs/{name}"))


print(f"\n{fails} FAILED" if fails else "\nthe package carries everything it serves")
sys.exit(1 if fails else 0)
