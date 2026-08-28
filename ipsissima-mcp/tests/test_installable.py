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
import re
import shutil
import subprocess
import sys
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

            # THE DEPENDENCIES SURVIVED THE TOML. A sub-table ends the table it sits in, so a
            # `[project.urls]` written above `dependencies` rehomes every requirement as a URL --
            # which happened once here, while adding exactly that table.
            #
            # That particular slip is caught by "the wheel builds" above, and loudly: setuptools
            # refuses it with `project.urls.dependencies must be string`. Checked, rather than
            # assumed, after this comment first claimed it would pass silently. What is left for
            # these assertions is every quieter way the list could empty out -- an edit to the
            # requirements, a backend that reads them differently -- where nothing refuses
            # anything and the install simply has no libraries.
            zf = zipfile.ZipFile(wheels[0])
            meta = next((n for n in names if n.endswith(".dist-info/METADATA")), None)
            text = zf.read(meta).decode("utf-8") if meta else ""
            declared = re.findall(r'^\s*"([A-Za-z0-9_.-]+)\s*[><=]',
                                  (MCP / "pyproject.toml").read_text(encoding="utf-8"), re.M)
            reqs = {r.split(";")[0].strip().lower()
                    for r in re.findall(r"^Requires-Dist:\s*(.+)$", text, re.M)}
            for d in sorted(set(declared)):
                check(f"the wheel requires {d}",
                      any(r.startswith(d.lower()) for r in reqs),
                      f"Requires-Dist has {sorted(reqs)}")

            # The command a client is configured to run. Without it the install is inert.
            eps = next((n for n in names if n.endswith(".dist-info/entry_points.txt")), None)
            check("the wheel installs the ipsissima-mcp command",
                  bool(eps) and "ipsissima-mcp" in zf.read(eps).decode("utf-8"))



# ---- 3. the .mcpb manifest still describes this package ---------------------- #
# The bundle is built by app/build_mcpb.mjs, which runs `mcpb validate` and so catches anything
# the schema can see. What the schema cannot see is whether the manifest still matches the
# project beside it: a version bumped in one file and not the other, or an entry_point pointing
# at a file that has moved. Both would build a bundle that installs and does not start.

manifest_path = MCP / "manifest.json"
if not manifest_path.is_file():
    print("  SKIP  no manifest.json; the .mcpb bundle is not checked")
else:
    import json as _json
    manifest = _json.loads(manifest_path.read_text(encoding="utf-8"))
    pyproject = (MCP / "pyproject.toml").read_text(encoding="utf-8")

    py_version = (re.search(r'^version = "([^"]+)"', pyproject, re.M) or [None, None])[1]
    check("the manifest and pyproject agree on the version",
          manifest.get("version") == py_version,
          f"manifest {manifest.get('version')} vs pyproject {py_version}")

    entry = manifest.get("server", {}).get("entry_point", "")
    check("the manifest's entry_point exists", entry and (MCP / entry).is_file(),
          f"entry_point is {entry!r}")

    # The floor is a dependency's, not this code's -- onnxruntime publishes no wheels below
    # cp311 -- so the two statements of it drift apart easily and only fail at a user's install.
    py_floor = (re.search(r'requires-python = ">=([\d.]+)"', pyproject) or [None, None])[1]
    declared = manifest.get("compatibility", {}).get("runtimes", {}).get("python", "")
    check("the manifest and pyproject agree on the Python floor",
          py_floor and py_floor in declared,
          f"manifest says {declared!r}, pyproject says >={py_floor}")

    for key in ("name", "version", "description", "author", "server"):
        check(f"the manifest has a {key}", key in manifest)


print(f"\n{fails} FAILED" if fails else "\nthe package carries everything it serves")
sys.exit(1 if fails else 0)
