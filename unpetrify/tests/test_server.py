#!/usr/bin/env python3
"""What Unpetrify promises on its own: the command, the server, and where they write.

    python3 unpetrify/tests/test_server.py

THE CONVERSION ITSELF IS TESTED ELSEWHERE (test_pdf_to_source, test_ingest, test_collate, the
extraction regression). What is new with the split is the plain route around it -- a command
that writes `paper.md` beside the PDF, a server whose text can be read back by an assistant with
no file tool -- and the rule that neither writes into Zotero's storage. Those are held here.

The server half is driven over a REAL stdio MCP session, as Ipsissima's is, because the contract
with a client is what breaks; it skips itself where the MCP SDK is missing.
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "src"
REPO = HERE.parents[1]
MILLER = REPO / "fixtures" / "ingest" / "miller-2019-uksc-41.pdf"
sys.path.insert(0, str(SRC))

from unpetrify import tools                                              # noqa: E402

FAILED = []


def check(label, got, want):
    ok = got == want
    print(f"   {'ok  ' if ok else 'FAIL'} {label}")
    if not ok:
        print(f"        wanted {want!r}\n        got    {got!r}")
        FAILED.append(label)


def check_true(label, got, why=""):
    ok = bool(got)
    print(f"   {'ok  ' if ok else 'FAIL'} {label}")
    if not ok:
        print(f"        {why or 'expected something truthy'}; got {got!r}")
        FAILED.append(label)


# ----------------------------------------------------- where things are written ---- #

def test_where_it_writes(tmp):
    """Never into Zotero's storage (Dewey *Logic* run, 17 Oct 2026); beside the source otherwise."""
    print("\nwhere renders and text go")
    data = Path(tmp) / "Zotero"
    att = data / "storage" / "DRERN8S4"
    att.mkdir(parents=True)
    (data / "zotero.sqlite").write_bytes(b"")
    pdf = att / "Dewey - 1938 - Logic.pdf"
    got = tools._page_images_dir(pdf)
    check("a Zotero attachment's renders go outside its storage folder",
          str(got).startswith(str(data)), False)
    check("  to a folder named for the attachment", got.name, "DRERN8S4")
    check("  and so does its extracted text",
          (str(tools.default_out_dir(pdf)).startswith(str(data)),
           tools.default_out_dir(pdf).name), (False, "DRERN8S4"))
    work = Path(tmp) / "my-map" / "source"
    check("a PDF in a working folder still gets page-images/ beside it",
          tools._page_images_dir(work / "paper.pdf"), work / "page-images")
    check("  and its text beside it", tools.default_out_dir(work / "paper.pdf"), work)
    no_db = Path(tmp) / "Looks" / "storage" / "ABCD1234" / "x.pdf"
    check("  as does a folder only shaped like storage, with no zotero.sqlite beside it",
          tools._page_images_dir(no_db), no_db.parent / "page-images")


# ------------------------------------------------------------------ the command ---- #

def run_cli(*args, cwd=None):
    env = {**os.environ, "PYTHONPATH": str(SRC), "IPSISSIMA_NO_TESSERACT": "1"}
    return subprocess.run([sys.executable, "-m", "unpetrify.cli", *map(str, args)],
                          capture_output=True, text=True, env=env, cwd=cwd)


def test_command(tmp):
    print("\nthe command")
    if not MILLER.exists():
        print("   skip  the Miller fixture is not in this checkout")
        return
    work = Path(tmp) / "cli"
    work.mkdir()
    pdf = work / "Miller 2019.pdf"
    shutil.copy(MILLER, pdf)

    r = run_cli(pdf, "--no-ocr")
    written = sorted(p.name for p in work.glob("*.md"))
    check("writes one Markdown file beside the PDF", written, ["miller-2019.md"])
    check("  and exits 0", r.returncode, 0)
    text = (work / "miller-2019.md").read_text(encoding="utf-8") if written else ""
    check_true("  carrying the page markers", "p.1 begins here" in text)
    check_true("the report goes to stderr, not stdout", "words" in r.stderr and not r.stdout,
               r.stderr[-300:] + r.stdout[-300:])

    out = Path(tmp) / "elsewhere"
    r = run_cli(pdf, "--no-ocr", "-o", out)
    check("-o writes into the folder named", sorted(p.name for p in out.glob("*.md")),
          ["miller-2019.md"])

    r = run_cli(pdf, "--no-ocr", "--stdout")
    check_true("--stdout prints the same text", r.stdout.strip() and
               r.stdout.strip() == text.strip(), "stdout differs from the written file")
    r = run_cli(pdf, pdf, "--stdout")
    check("  and refuses two sources", r.returncode, 2)

    r = run_cli(work / "missing.pdf")
    check("a missing file exits non-zero", r.returncode, 1)


# ------------------------------------------------------- the contract with a client ---- #

async def _session(fn):
    from mcp import ClientSession, StdioServerParameters, stdio_client
    params = StdioServerParameters(
        command=sys.executable, args=["-m", "unpetrify.server"], cwd=str(REPO),
        env={**os.environ, "PYTHONPATH": str(SRC), "IPSISSIMA_NO_TESSERACT": "1"})
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            await fn(s)


def result(out):
    if out.structured_content:
        return out.structured_content
    return json.loads(out.content[0].text) if out.content else {}


def test_server(tmp):
    print("\nthe server")
    try:
        import mcp                                                       # noqa: F401
    except ImportError:
        print("   skip  the MCP SDK is not installed in this interpreter")
        return

    async def body(s):
        tools_offered = {t.name for t in (await s.list_tools()).tools}
        check("it offers the PDF tools and read_text, and nothing of Ipsissima's",
              sorted(tools_offered),
              sorted(["extract_text", "read_text", "assess_pdf", "page_images", "repair_source",
                      "collation_disputes", "settle_disputes", "add_page_numbers"]))
        if not MILLER.exists():
            print("   skip  the Miller fixture is not in this checkout")
            return
        out = Path(tmp) / "server"
        r = result(await s.call_tool("extract_text", {"sources": [str(MILLER)], "out": str(out),
                                                      "allow_ocr": False}))
        check("extract_text writes the text", [Path(w).name for w in r.get("written", [])
                                               if w.endswith(".md")], ["miller-2019-uksc-41.md"])
        check_true("  and says to read it with read_text", "read_text" in r.get("next", ""))
        md = next((w for w in r.get("written", []) if w.endswith(".md")), None)
        if md:
            whole = Path(md).read_text(encoding="utf-8")
            first = result(await s.call_tool("read_text", {"path": md}))
            parts = [first.get("text", "")]
            for n in range(2, (first.get("parts") or 1) + 1):
                parts.append(result(await s.call_tool("read_text", {"path": md, "part": n}))
                             .get("text", ""))
            check("read_text gives back the whole file", "".join(parts), whole)
            bad = result(await s.call_tool("read_text", {"path": md, "part": 99}))
            check("  and refuses a part that is not there", bad.get("ok"), False)
            # The fixture fits one part; the cutting is checked in-process with smaller parts.
            from unpetrify import server
            keep, server.PART_CHARS = server.PART_CHARS, 20_000
            try:
                first = server.read_text(md)
                got = [server.read_text(md, n)["text"] for n in range(1, first["parts"] + 1)]
            finally:
                server.PART_CHARS = keep
            check_true("a long file comes in several parts", first["parts"] > 1,
                       f"{len(whole)} characters")
            check("  which join back into the file", "".join(got), whole)
            check_true("  each cut at a paragraph break",
                       all(g.endswith("\n\n") for g in got[:-1]), [g[-20:] for g in got])

    asyncio.run(_session(body))


def main():
    print("== unpetrify: the command and the server")
    tmp = tempfile.mkdtemp(prefix="unpetrify-test-")
    try:
        test_where_it_writes(tmp)
        test_command(tmp)
        test_server(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print()
    if FAILED:
        print(f"{len(FAILED)} check(s) failed:")
        for f in FAILED:
            print(f"   - {f}")
        sys.exit(1)
    print("all passed")


if __name__ == "__main__":
    main()
