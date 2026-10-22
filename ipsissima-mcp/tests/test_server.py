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
import re
import shutil
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                           # ipsissima-mcp/
REPO = HERE.parents[1]                       # the repository root
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(HERE))

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

    # A POLICY BRIEF, which says what brings what about sentence after sentence, and an essay that
    # says "because" twice in twenty sentences. The first earns the mechanism offer; the second not.
    (d / "brief").mkdir()
    (d / "brief" / "brief.md").write_text("# Community sentences\n\n" + " ".join([
        "Short prison terms cause people to lose their jobs and homes.",
        "Losing a job increases the risk of reoffending.",
        "Community orders reduce reoffending because people keep their work.",
        "Keeping work leads to stable housing.",
        "Stable housing in turn reduces contact with offending peers.",
        "Fewer people in prison lowers the cost to the state.",
        "Lower costs enable investment in probation.",
        "Better probation encourages compliance with orders.",
        "Compliance raises public confidence in community sentences.",
        "Confidence makes courts more likely to use them.",
        "Courts should therefore prefer community orders for short terms.",
        "The government should fund probation accordingly."]) + "\n\n# References\n\n"
        + "Leads to nothing. Causes nothing. " * 20, encoding="utf-8")
    # A TEXT THAT SETS THINGS OUT IN TABLES OF ITS OWN (wave 5, 21 Oct 2026): it earns the advice to
    # rebuild them at extraction (profile 1.21: the comparisons are read with every argument).
    (d / "tabled").mkdir()
    (d / "tabled" / "trials.md").write_text("# Ten trials\n\n" + " ".join([
        "Table 1 sets out the ten evaluations by product and country.",
        "As Table 2 shows, a small fee cut take-up sharply in every trial.",
        "Free distribution did not reduce use (see Table 2).",
        "The studies answer four questions, set out in Table 3."] * 3), encoding="utf-8")
    (d / "essay").mkdir()
    (d / "essay" / "essay.md").write_text("# On reasons\n\n" + " ".join(
        ["A reason is a consideration that counts in favour of something."] * 9 +
        ["We say so because the agent could deliberate to it."] +
        ["An external reason statement is false or incoherent on this view."] * 9 +
        ["That is because nothing in the motivational set answers to it."]), encoding="utf-8")
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

    # UNDER THE PARALLEL METHOD THE MECHANISM IS ALWAYS CONSIDERED (1.17): every plan says so, the
    # causal count is a hint, and nothing is offered or asked. Mutation: gate mech_plan on `causal`
    # -> the essay's plan has no mechanism.
    plan = sources.describe([str(d / "brief")])
    check("a causal brief: the mechanism is considered, not offered",
          (plan.get("mechanism", {}).get("considered"), plan["offers"]), ("always", []))
    check("eleven causal sentences, the references not counted",
          plan["sources"][0]["causal"]["causal_sentences"], 11)
    check("  and the count travels as a hint", plan["mechanism"]["causal_hint"].get("brief.md") is not None, True)
    check("nothing is asked", plan["questions"], [])
    check("an essay with almost no causal words is considered too",
          sources.describe([str(d / "essay")]).get("mechanism", {}).get("considered"), "always")
    # SERIES (reversible): the old offer, for a causal text only. Mutation: drop the series branch
    # -> the brief is offered nothing.
    _was = os.environ.get("IPSISSIMA_MECHANISM_METHOD")
    os.environ["IPSISSIMA_MECHANISM_METHOD"] = "series"
    try:
        plan = sources.describe([str(d / "brief")])
        check("set to series, a causal brief draws the mechanism offer", [o["id"] for o in plan["offers"]], ["mechanism"])
        check("naming the source", plan["offers"][0]["sources"], ["brief.md"])
        check("  and no standing mechanism", "mechanism" in plan, False)
        check("  an essay that says `because` twice draws none", sources.describe([str(d / "essay")])["offers"], [])
    finally:
        if _was is None:
            os.environ.pop("IPSISSIMA_MECHANISM_METHOD", None)
        else:
            os.environ["IPSISSIMA_MECHANISM_METHOD"] = _was
    # TWO FILES, ONE TEXT (Yellowstone, 27 Sep 2026): a record carrying another work's PDF.
    # Mutation: drop the same-text block -> no such question.
    (d / "twins").mkdir()
    for n in ("ripple.md", "macnulty.md"):
        (d / "twins" / n).write_text((d / "brief" / "brief.md").read_text(encoding="utf-8"), encoding="utf-8")
    plan = sources.describe([str(d / "twins")])
    check("two files that read as one text are asked about",
          [q["id"].split(":")[0] for q in plan["questions"] if q["id"].startswith("same-text")], ["same-text"])
    check("  but one brief alone is not", [q for q in sources.describe([str(d / "brief")])["questions"]
                                           if q["id"].startswith("same-text")], [])
    check("under parallel nothing is offered", sources.describe([str(d / "one")])["offers"], [])

    # THE LAYERS, AND THE TABLES (the Purpose episode, wave 5; profile 1.21, ruled 22 Oct 2026). Every
    # plan lists the layers and the way in each feeds; the comparisons are read with every argument,
    # so nothing is offered; a text citing tables of its own is advised to rebuild them at extraction,
    # and a text that cites none is not. Mutations: offer the tables again -> an offer; drop the advice
    # -> none; advise on every text -> "one" draws it.
    plan = sources.describe([str(d / "tabled")])
    adv = [a for a in plan["advice"] if a["kind"] == "tables-cited"]
    check("a text citing its own tables is advised to rebuild them", [a["sources"] for a in adv], [["trials.md"]])
    check_true("  naming the tables it cites, and how", adv and "Table 1, Table 2, Table 3" in adv[0]["message"]
               and "repair_source" in adv[0]["message"], adv and adv[0]["message"][:200])
    check("  and offering nothing: tabulation is part of the reconstruction", plan["offers"], [])
    lay = {x["id"]: x for x in plan["layers"]}
    check("the plan lists the layers", list(lay), ["argument", "order", "mechanism", "tables"])
    check_true("  the tables made with the argument, with the signal",
               lay["tables"]["status"].startswith("with the argument") and
               lay["tables"].get("signal") == {"trials.md": ["Table 1", "Table 2", "Table 3"]}, lay["tables"])
    check("  and each says which way in it feeds", all(x.get("feeds") for x in plan["layers"]), True)
    plan = sources.describe([str(d / "one")])
    check("a text citing no table: no advice, and the tables still made with the argument",
          ([a for a in plan["advice"] if a["kind"] == "tables-cited"], plan["offers"],
           {x["id"]: x["status"] for x in plan["layers"]}["tables"].startswith("with the argument")), ([], [], True))

    # A path that is not there is reported rather than treated as an empty folder.
    plan = sources.describe([str(d / "nope")])
    check("a missing path is reported", len(plan["unreadable"]), 1)
    check("and yields no sources", plan["count"], 0)

    check("the version pattern strips a draft marker",
          sources._stem_key("/x/Introduction (draft 3).docx"), "introduction")
    check("but leaves an ordinary name alone",
          sources._stem_key("/x/chapter-2.docx"), "chapter 2")


# --------------------------------------------------- the contract with a client ---- #

async def _session(fn, env=None):
    from mcp import ClientSession, StdioServerParameters, stdio_client
    exe = REPO / ".venv" / "bin" / "ipsissima-mcp"
    cmd = (str(exe), []) if exe.exists() else (sys.executable,
                                               ["-m", "ipsissima_mcp.server"])
    params = StdioServerParameters(command=cmd[0], args=cmd[1], cwd=str(REPO),
                                   env={**os.environ, **env} if env else None)
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
        for name in ("argdown_plan", "extract_text", "assess_pdf", "page_images",
                     "repair_source", "add_page_numbers", "argdown_check",
                     "split_manuscript", "collation_disputes", "settle_disputes"):
            check_true(f"tool `{name}` is offered", name in tools)

        prompts = {p.name for p in (await s.list_prompts()).prompts}
        check_true("the reconstruction instructions are served as a prompt",
                   "reconstruct_argument" in prompts)
        check_true("extraction alone is offered as its own prompt",
                   "extract_text_only" in prompts)

        res = {str(r.uri) for r in (await s.list_resources()).resources}
        check_true("the Argdown syntax reference is a resource",
                   "ipsissima://argdown/syntax" in res)

        # THE README'S PROBE SENTENCE IS A PROMISE, held here against the live server — a
        # count that has drifted sends a reader debugging the wrong side. The T3 drift is the
        # pedigree (docs/values/AUTOMATION.md 4.1, row 4), and the check's own first public CI
        # run supplied a second: the sentence promised the Zotero tool on machines with no
        # Zotero, because `zotero_lookup` is registered only where a library exists. So the
        # sentence carries the condition, and this check asks for whichever count THIS
        # machine's server should give. The no-library count is exercised on every machine by
        # the forced session below, not only on machines that happen to lack a library.
        # Shown able to fail: bump any number in the sentence and the matching check goes red.
        readme = (REPO / "ipsissima-mcp" / "README.md").read_text(encoding="utf-8")
        m = re.search(r"answers (\d+)\s+tools\s+\((\d+)\s+without a Zotero[^)]*\),\s+"
                      r"(\d+)\s+prompts\s+and\s+(\d+)\s+resources", readme)
        check_true("the README still makes its probe promise, condition included", bool(m))
        if m:
            want = int(m.group(1)) if "zotero_lookup" in tools else int(m.group(2))
            check("the README's tool count is this server's", want, len(tools))
            check("its prompt count too", int(m.group(3)), len(prompts))
            check("and its resource count", int(m.group(4)), len(res))

            async def no_library(s2):
                t2 = {t.name for t in (await s2.list_tools()).tools}
                check_true("  without a library, the Zotero tool is not offered",
                           "zotero_lookup" not in t2)
                check("  and the count is the sentence's without-Zotero number",
                      len(t2), int(m.group(2)))
            await _session(no_library,
                           env={"ZOTERO_DATA_DIR": str(d / "no-zotero-here")})

        # THE TOOL, NOT ONLY THE MODULE, against a library built here -- the Merton shape: the
        # record looked up has no file, and the clean copy is on the reprint's record.
        # PYTHONPATH pins the server to THIS tree's source, which from a worktree is otherwise
        # the main checkout's editable install.
        import sqlite3
        import synthetic_zotero
        lib = synthetic_zotero.Library(d / "zotero")
        lib.record("RD7RL3YD", "The Self-Fulfilling Prophecy", ["Merton"], date="1948",
                   container="The Antioch Review")
        scan = lib.attach("SCANPDF1", "RD7RL3YD", "jstor.pdf", "application/pdf",
                          make=synthetic_zotero.text_pdf)
        lib.record("KLNGK6S9", "The self-fulfilling prophecy", ["Merton"], date="2010")
        html = lib.attach("ULF282D5", "KLNGK6S9", "LitRC.html", "text/html")
        lib.close()

        async def with_library(s3):
            out = result(await s3.call_tool("zotero_lookup", {"key": "RD7RL3YD"}))
            check("  zotero_lookup extracts from the sibling record's HTML",
                  (out.get("pairing") or {}).get("extract_from"), html)
            check("  and pages it by this record's scan",
                  (out.get("pairing") or {}).get("page_numbers_from"), scan)
            # A SCHEMA REFUSAL IS AN ANSWER. It is raised as SystemExit, which `except
            # Exception` does not catch: it took the whole server down, and the client waited
            # on a reply that would never come. Hence the timeout -- the fault is a hang.
            c = sqlite3.connect(d / "zotero" / "zotero.sqlite")
            c.execute("UPDATE version SET version = 100000")
            c.commit()
            c.close()
            try:
                out = result(await asyncio.wait_for(
                    s3.call_tool("zotero_lookup", {"key": "RD7RL3YD"}), 60))
            except (asyncio.TimeoutError, Exception) as e:
                out = {"error": f"no answer: {e!r}"}
            check("  a newer Zotero schema is refused in words",
                  (out.get("ok"), "SCHEMA_MAX" in out.get("error", "")), (False, True))
        await _session(with_library, env={"ZOTERO_DATA_DIR": str(d / "zotero"),
                                          "PYTHONPATH": str(ROOT / "src")})

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

        # THE GEOMETRY SIDECAR IS WRITTEN, NOT RETURNED. A structured-route PDF used to send
        # its whole word-geometry JSON back in `extras` -- 396,684 characters for this fixture
        # -- which overran the client's result limit and lost `next` with it. Shown able to
        # fail: with the strip in server.py's `_reply` removed, both size checks go red.
        pdf = REPO / "fixtures" / "ingest" / "miller-2019-uksc-41.pdf"
        check_true(f"the Miller fixture is where the test expects it ({pdf})",
                   pdf.is_file(), "a skipped check reads exactly like a passing one")
        if pdf.is_file():
            raw = await s.call_tool("extract_text", {"sources": [str(pdf)],
                                                     "out": str(d / "pdf-out")})
            out = result(raw)
            side = d / "pdf-out" / "source" / "miller-2019-uksc-41.md.geometry.json"
            check_true("a structured-route PDF still writes its geometry sidecar",
                       side.is_file() and side.stat().st_size > 20_000)
            check_true("and lists it in `written`", str(side) in out.get("written", []))
            check_true("but the reply carries no geometry",
                       all("geometry" not in src.get("extras", {})
                           for src in out.get("sources", [])))
            size = len(raw.content[0].text) if raw.content else 0
            check_true("so the reply stays small enough to reach the model",
                       0 < size < 30_000, f"the reply was {size} characters")

        # The checker's faults come back as data, on a real sample.
        sample = REPO / "samples" / "Darwin 1859 - Natural selection"
        check_true(f"the Darwin sample is where the test expects it ({sample})",
                   sample.is_dir(), "a skipped check reads exactly like a passing one")
        if sample.is_dir():
            out = result(await s.call_tool("argdown_check",
                                           {"path": str(sample / "darwin-natural-selection.argdown"),
                                            "source_root": str(sample)}))
            check_true("the checker returns findings, not prose",
                       isinstance(out.get("findings"), list))
            check_true("every finding says where it is",
                       all(f.get("title") or f.get("line") is not None
                           for f in out.get("findings", [])),
                       "a fault with no location cannot be acted on")

        # THE MECHANISM REACHES THE CLIENT AS PART OF THE METHOD (1.17): parallel by default, and
        # `next` says to read it with the reconstruction documents and record its depth.
        # Extraction alone is a complete request, so it has none. Mutation: default to series -> fails.
        out = result(await s.call_tool("argdown_plan", {"sources": [str(d / "brief")]}))
        check("the plan carries the mechanism, always considered, and no offer",
              (out.get("mechanism", {}).get("considered"), out.get("offers")), ("always", []))
        check_true("and `next` says to read it with the argument and record its depth",
                   "read with the argument" in out.get("next", "") and "depth" in out.get("next", ""), out.get("next"))
        m = result(await s.call_tool("argdown_method", {"document": "extraction-prompt"}))
        check_true("the extraction prompt's reply points to `mechanism`", '"mechanism" too' in m.get("next", ""),
                   m.get("next"))
        m = result(await s.call_tool("argdown_method", {"document": "mechanism"}))
        check("`mechanism` serves the parallel method by default",
              (m.get("method_in_force"), "Argument and mechanism, reconstructed together" in m.get("text", "")),
              ("parallel", True))
        # EVERYTHING A RECONSTRUCTION READS, IN PARTS (phase 2 of the extraction-materials review):
        # each always-read document once, every part under a client's result limit. Mutations: drop a
        # document from _always_read -> missing; raise _PART_CHARS past the limit -> a part too long.
        first = result(await s.call_tool("argdown_method", {"document": "all"}))
        got, sizes = [], []
        for k in range(1, (first.get("parts") or 0) + 1):
            part = result(await s.call_tool("argdown_method", {"document": "all", "part": k}))
            got += part.get("documents", []); sizes.append(len(part.get("text", "")))
        check("`all` serves every always-read document once, in parts under the result limit",
              (sorted(got), all(n <= 80_000 for n in sizes), 1 < len(sizes) <= 4),
              (sorted(["extraction-prompt", "syntax", "method", "conventions", "tabulation", "mechanism",
                       "mechanism-method", "mechanism-notation"]), True, True))
        m = result(await s.call_tool("argdown_method", {"document": "mechanism-series"}))
        check_true("and the series method is still served by name",
                   m.get("text", "").startswith("# The mechanism pass"), m.get("text", "")[:80])
        out = result(await s.call_tool("argdown_plan", {"sources": [str(d / "brief")],
                                                        "intent": "extract"}))
        check("an extraction-only plan offers nothing", out.get("offers"), [])
        check("  and carries no mechanism", "mechanism" in out, False)
        check("and its `next` says nothing of it", "mechanism" in out.get("next", ""), False)

        # THE COMPARISONS ARE READ WITH EVERY ARGUMENT (profile 1.21). Mutations: drop the tabulation
        # clause from `next` -> fails; drop the rebuild clause -> fails; drop "tabulation" from the
        # extraction prompt's reply -> fails.
        out = result(await s.call_tool("argdown_plan", {"sources": [str(d / "tabled")]}))
        check_true("a plan says to read `tabulation` with the argument, and to rebuild the lost tables first",
                   "read argdown_method `tabulation`" in out.get("next", "") and
                   "rebuild from their pages the tables" in out.get("next", ""), out.get("next"))
        out = result(await s.call_tool("argdown_plan", {"sources": [str(d / "one")]}))
        check_true("  a text citing no table is still told to read `tabulation`, and not to rebuild",
                   "read argdown_method `tabulation`" in out.get("next", "") and "rebuild" not in out.get("next", ""), out.get("next"))
        out = result(await s.call_tool("argdown_plan", {"sources": [str(d / "tabled")], "intent": "extract"}))
        check("  and an extraction-only plan neither offers nor lists layers", (out.get("offers"), "layers" in out), ([], False))
        m = result(await s.call_tool("argdown_method", {"document": "extraction-prompt"}))
        check_true("the extraction prompt's reply names `tabulation`, read with every argument",
                   '"tabulation": the text\'s comparisons are read with every argument' in m.get("next", ""), m.get("next"))
        m = result(await s.call_tool("argdown_method", {"document": "tabulation"}))
        check_true("  and `tabulation` is served as part of the reconstruction, not on a finished map",
                   m.get("text", "").startswith("# The text's comparisons, read with the argument") and
                   "before writing any node" in m.get("next", "") and "frames: none" in m.get("next", ""), m.get("next"))
        # WHAT THE FILE IS FOR (wave 5; B11): the method says which way in each layer feeds, and the
        # three duties. Mutation: drop the section -> fails.
        m = result(await s.call_tool("argdown_method", {"document": "extraction-prompt"}))
        t = m.get("text", "")
        check_true("the extraction prompt says what the file is for, layer by layer",
                   "## What the file is for" in t and "Weigh the accounts" in t and "Tables" in t, t[:200])
        check_true("  and B11's three duties", all(x in t for x in (
            "Every layer answers for its distance from the text",
            "A layer records only what the text supplies",
            "A layer earns its place by what a reader can do with it")))

        # THE INSTRUCTIONS NAME THE LAYERS and the way in each feeds (wave 5). Mutation: put the old
        # paragraph back -> no Tables panel, no Exposition view.
        from ipsissima_mcp.server import INSTRUCTIONS
        check_true("the server instructions name each layer and the way in it feeds",
                   all(x in " ".join(INSTRUCTIONS.split()) for x in ("the Reasons view", "the Exposition view", "the Mechanism view",
                                                   "the Tables panel", "Weigh the accounts", "an empty cell is a question")))

        # A file that does not exist is an answer, not a crash.
        out = result(await s.call_tool("argdown_check", {"path": str(d / "no.argdown")}))
        check("a missing file is reported", out.get("ok"), False)

    asyncio.run(_session(body))

    # REVERSIBLE BY ONE SETTING (the author's condition, 1 Oct 2026): with the method set to
    # series, every offer, instruction and document is as it was before the parallel method.
    async def series(s):
        out = result(await s.call_tool("argdown_plan", {"sources": [str(d / "brief")]}))
        check_true("set to series, `next` says to mention the pass without running it",
                   "without running it" in out.get("next", ""), out.get("next"))
        check("and the offer says series", [o.get("method") for o in out.get("offers", [])], ["series"])
        m = result(await s.call_tool("argdown_method", {"document": "mechanism"}))
        check("and `mechanism` serves the series pass",
              (m.get("method_in_force"), m.get("text", "").startswith("# The mechanism pass")), ("series", True))
    asyncio.run(_session(series, env={"IPSISSIMA_MECHANISM_METHOD": "series"}))


def test_page_images_dir(tmp):
    """page_images never writes into Zotero's storage tree (Dewey *Logic* run, 17 Oct 2026)."""
    print("\npage_images: where the renders go")
    try:
        from ipsissima_mcp.server import _page_images_dir
    except ImportError as exc:
        print(f"   skip the server will not import here ({exc.__class__.__name__})")
        return
    data = Path(tmp) / "Zotero"
    att = data / "storage" / "DRERN8S4"
    att.mkdir(parents=True)
    (data / "zotero.sqlite").write_bytes(b"")
    pdf = att / "Dewey - 1938 - Logic.pdf"
    got = _page_images_dir(pdf)
    check("a Zotero attachment's renders go outside its storage folder",
          str(got).startswith(str(data)), False)
    check("  to a folder named for the attachment", got.name, "DRERN8S4")
    work = Path(tmp) / "my-map" / "source"
    check("a PDF in a working folder still gets page-images/ beside it",
          _page_images_dir(work / "paper.pdf"), work / "page-images")
    no_db = Path(tmp) / "Looks" / "storage" / "ABCD1234" / "x.pdf"
    check("  as does a folder only shaped like storage, with no zotero.sqlite beside it",
          _page_images_dir(no_db), no_db.parent / "page-images")


def main():
    print("== the MCP server and how it reads a request")
    tmp = tempfile.mkdtemp(prefix="ipsissima-server-test-")
    try:
        d = build(tmp)
        test_sources(d)
        test_page_images_dir(tmp)
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
