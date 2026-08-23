#!/usr/bin/env python3
"""What the server promises a client, and what it refuses to do without an answer.

TWO HALVES, and the split is deliberate. `sources.describe` is pure — paths in, a reading of the
request out — so it is tested directly against folders built here, and every case is one that
cost a real reconstruction to get wrong. The server itself is then driven over a REAL stdio MCP
session, because the thing most likely to break is the contract with the client rather than the
logic behind it: a return type the SDK cannot build a schema from, a tool that raises on import,
a prompt whose file has moved.

The stdio half needs the MCP SDK. Without it the pure half still runs and the rest reports itself
skipped, rather than failing and being ignored ever after.
"""
import asyncio
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                           # ipsissima-mcp/
REPO = HERE.parents[1]                       # the repository root
sys.path.insert(0, str(ROOT / "src"))

from ipsissima_mcp import sources                                        # noqa: E402

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


# ------------------------------------------------------- reading a request ---- #

def build(tmp):
    """A folder shaped like the two mistakes that cost the most."""
    d = Path(tmp)
    (d / "book").mkdir()
    for name in ("chapter-1 v1.docx", "chapter-1 v2.docx", "chapter-2.docx",
                 "chapter-2.pdf", "notes.rtfd"):
        (d / "book" / name).write_text("word " * 200, encoding="utf-8")
    # v2 must be the newer file for the "which draft" suggestion to mean anything.
    later = time.time()
    os.utime(d / "book" / "chapter-1 v1.docx", (later - 600, later - 600))
    os.utime(d / "book" / "chapter-1 v2.docx", (later, later))

    (d / "one").mkdir()
    (d / "one" / "paper.md").write_text("# A paper\n\n" + "word " * 300, encoding="utf-8")
    return d


def test_sources(d):
    print("\nReading what was asked for")

    plan = sources.describe([str(d / "book")])
    check("the unsupported file is reported, not silently dropped",
          [Path(s["path"]).name for s in plan["skipped"]], ["notes.rtfd"])
    check("four sources found", plan["count"], 4)

    # THE ADVICE THIS PROJECT MOST WANTS TO GIVE: a PDF beside the .docx it was made from.
    adv = [a for a in plan["advice"] if a["kind"] == "better-format-available"]
    check("one better-format warning", len(adv), 1)
    check("it names the .docx as the one to use", adv[0]["use"], "chapter-2.docx")
    check("and the .pdf as the one to avoid", adv[0]["instead_of"], ["chapter-2.pdf"])

    qs = {q["id"]: q for q in plan["questions"]}
    check_true("two drafts of chapter 1 raise a question", "draft:chapter 1" in qs)
    check("the newer draft is suggested, not chosen",
          qs["draft:chapter 1"]["suggested"], "chapter-1 v2.docx")
    check_true("several sources raise the grouping question", "grouping" in qs,
               "one map or one each is never inferable from the files")

    # ONE SOURCE IS THE COMMON CASE and must not be interrogated.
    plan = sources.describe([str(d / "one")])
    check("one source: nothing to ask", plan["questions"], [])
    check("one source: nothing to advise", plan["advice"], [])
    check("markdown is gold", plan["sources"][0]["metal"], "gold")

    # A path that is not there is reported rather than treated as an empty folder.
    plan = sources.describe([str(d / "nope")])
    check("a missing path is reported", len(plan["unreadable"]), 1)
    check("and yields no sources", plan["count"], 0)

    check("the version pattern strips a draft marker",
          sources._stem_key("/x/Introduction (draft 3).docx"), "introduction")
    check("but leaves an ordinary name alone",
          sources._stem_key("/x/chapter-2.docx"), "chapter 2")


# --------------------------------------------------- the contract with a client ---- #

async def _session(fn):
    from mcp import ClientSession, StdioServerParameters, stdio_client
    exe = REPO / ".venv" / "bin" / "ipsissima-mcp"
    cmd = (str(exe), []) if exe.exists() else (sys.executable,
                                               ["-m", "ipsissima_mcp.server"])
    params = StdioServerParameters(command=cmd[0], args=cmd[1], cwd=str(REPO))
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            await fn(s)


def result(out):
    """A tool's dict, however the SDK chose to carry it."""
    import json
    if out.structured_content:
        return out.structured_content
    return json.loads(out.content[0].text) if out.content else {}


def test_server(d):
    print("\nThe contract with a client")
    try:
        import mcp                                                       # noqa: F401
    except ImportError:
        print("   skip  the MCP SDK is not installed in this interpreter")
        print("         (pip install -e ipsissima-mcp, or run from the project venv)")
        return

    async def body(s):
        tools = {t.name for t in (await s.list_tools()).tools}
        for name in ("plan_job", "extract_text", "assess_pdf", "page_images",
                     "repair_source", "check_reconstruction", "split_manuscript"):
            check_true(f"tool `{name}` is offered", name in tools)

        prompts = {p.name for p in (await s.list_prompts()).prompts}
        check_true("the reconstruction instructions are served as a prompt",
                   "reconstruct_argument" in prompts)
        check_true("extraction alone is offered as its own prompt",
                   "extract_text_only" in prompts)

        res = {str(r.uri) for r in (await s.list_resources()).resources}
        check_true("the Argdown syntax reference is a resource",
                   "ipsissima://argdown/syntax" in res)

        # The prompt is the file on disk, not a copy compiled into the server.
        p = await s.get_prompt("reconstruct_argument", {"source_path": "source/x.md"})
        text = p.messages[0].content.text
        check_true("the prompt carries the extraction instructions",
                   "reconstruct its argument" in text or "Reconstruct an argument" in text)
        check_true("and is told which source this job is about", "source/x.md" in text)

        # THE REFUSAL IS THE FEATURE. Several sources and no grouping means the assistant has
        # not asked, and guessing here costs a whole reconstruction.
        out = result(await s.call_tool("extract_text",
                                       {"sources": [str(d / "book")],
                                        "out": str(d / "out")}))
        check("several sources with no grouping is refused", out.get("ok"), False)
        check("and says what it needs answered", out.get("needs_answer"), "grouping")
        check_true("nothing was written", not (d / "out").exists())

        # One source needs no answer, and a dry run still writes nothing.
        out = result(await s.call_tool("extract_text",
                                       {"sources": [str(d / "one" / "paper.md")],
                                        "out": str(d / "out"), "dry_run": True}))
        check("one source runs without an answer", out.get("ok"), True)
        check("a dry run writes nothing", out.get("written"), [])

        out = result(await s.call_tool("extract_text",
                                       {"sources": [str(d / "one" / "paper.md")],
                                        "out": str(d / "out")}))
        check("and a real run writes one file", len(out.get("written", [])), 1)
        check_true("into source/", (d / "out" / "source").is_dir())

        # The checker's faults come back as data, on a real sample.
        sample = REPO / "samples" / "Darwin 1859 - Natural selection"
        check_true(f"the Darwin sample is where the test expects it ({sample})",
                   sample.is_dir(), "a skipped check reads exactly like a passing one")
        if sample.is_dir():
            out = result(await s.call_tool("check_reconstruction",
                                           {"path": str(sample / "darwin-natural-selection.argdown"),
                                            "source_root": str(sample)}))
            check_true("the checker returns findings, not prose",
                       isinstance(out.get("findings"), list))
            check_true("every finding says where it is",
                       all(f.get("title") or f.get("line") is not None
                           for f in out.get("findings", [])),
                       "a fault with no location cannot be acted on")

        # A file that does not exist is an answer, not a crash.
        out = result(await s.call_tool("check_reconstruction", {"path": str(d / "no.argdown")}))
        check("a missing file is reported", out.get("ok"), False)

    asyncio.run(_session(body))


def main():
    print("== the MCP server and how it reads a request")
    tmp = tempfile.mkdtemp(prefix="ipsissima-server-test-")
    try:
        d = build(tmp)
        test_sources(d)
        test_server(d)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print()
    if FAILED:
        print(f"{len(FAILED)} check(s) failed:")
        for f in FAILED:
            print(f"   - {f}")
        sys.exit(1)
    print("every check passed")


if __name__ == "__main__":
    main()
