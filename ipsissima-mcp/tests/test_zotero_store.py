#!/usr/bin/env python3
"""Tests for the local-write client and the store-in-Zotero machinery.

    python3 ipsissima-mcp/tests/test_zotero_store.py

AGAINST A FAKE ZOTERO, ALWAYS. These tests exercise the protocol measured on Zotero 10.0.2
-- the Zotero-Server-ID header, the authorize dialog's three answers, single-use keys, the
three-phase upload with md5 verified server-side -- by implementing that protocol in a
threaded server here and pointing the client at it. A test that wrote to a real library
would be a test with a side effect in someone's research records.
"""
import hashlib
import json
import sys
import tempfile
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"))
from zotero_local import ZoteroLocal, DENIED                                 # noqa: E402
import zotero_store                                                          # noqa: E402

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}"
          + ("" if ok else f"\n          got {got!r} want {want!r}"))


def check_raises(name, fn, phrase):
    global fails
    try:
        fn()
    except SystemExit as e:
        ok = phrase in str(e)
        if not ok:
            fails += 1
        print(f"  {'ok  ' if ok else 'FAIL'}  {name}"
              + ("" if ok else f"\n          said {str(e)[:120]!r}"))
        return
    fails += 1
    print(f"  FAIL  {name}\n          did not refuse at all")


SID = "TESTSRV1"


class FakeZotero(BaseHTTPRequestHandler):
    """The protocol as documented, small enough to read whole."""
    state = None                       # injected per server

    def log_message(self, *a):
        pass

    def _send(self, code, body=b"", headers=None, ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Zotero-Server-ID", SID)
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n)

    def do_GET(self):
        s = self.state
        if self.path == "/api/":
            return self._send(200, b"local api", ctype="text/plain")
        if self.path.startswith("/api/users/0/items/"):
            rest = self.path[len("/api/users/0/items/"):]
            if rest.endswith("/children"):
                key = rest[:-len("/children")]
                kids = [it for it in s["items"].values()
                        if it["data"].get("parentItem") == key]
                return self._send(200, json.dumps(kids).encode())
            it = s["items"].get(rest)
            return (self._send(200, json.dumps(it).encode()) if it
                    else self._send(404, b"Not found", ctype="text/plain"))
        self._send(404, b"?", ctype="text/plain")

    def _authed(self):
        s = self.state
        if self.headers.get("Zotero-Server-ID") != SID:
            self._send(428, b"Zotero-Server-ID not provided", ctype="text/plain")
            return False
        key = self.headers.get("Zotero-API-Key")
        if key not in s["valid_keys"]:
            self._send(401, b"API key required", ctype="text/plain")
            return False
        if s.get("single_use"):
            s["spent"].add(key)        # consumed by this write; the NEXT one fails
            s["valid_keys"] = s["valid_keys"] - s["spent"]
        return True

    def do_POST(self):
        s = self.state
        if self.path == "/api/local/authorize":
            if self.headers.get("Zotero-Server-ID") != SID:
                return self._send(428, b"Zotero-Server-ID not provided", ctype="text/plain")
            s["asks"] += 1
            if s["auth_mode"] == "deny":
                return self._send(403, json.dumps({"denied": True}).encode())
            key = f"KEY{s['asks']:029d}"
            s["valid_keys"] = s["valid_keys"] | {key}
            remember = s["auth_mode"] == "always"
            return self._send(200, json.dumps({"key": key, "remember": remember}).encode())
        if not self._authed():
            return
        if self.path == "/api/users/0/items":
            items = json.loads(self._body().decode())
            success = {}
            for i, it in enumerate(items):
                key = f"NEW{len(s['items']):05d}"
                s["items"][key] = {"key": key, "data": dict(it, key=key)}
                success[str(i)] = key
            return self._send(200, json.dumps(
                {"success": success, "failed": {}}).encode())
        if self.path.startswith("/api/local/uploads/"):
            up = s["uploads"].get(self.path.rsplit("/", 1)[-1])
            if not up:
                return self._send(404, b"no such upload", ctype="text/plain")
            data = self._body()
            if hashlib.md5(data).hexdigest() != up["md5"]:
                return self._send(400, b"hash mismatch", ctype="text/plain")
            up["bytes"] = data
            return self._send(201, b"")
        if self.path.startswith("/api/users/0/items/") and self.path.endswith("/file"):
            key = self.path[len("/api/users/0/items/"):-len("/file")]
            it = s["items"].get(key)
            if not it:
                return self._send(404, b"no item", ctype="text/plain")
            form = dict(urllib.parse.parse_qsl(self._body().decode()))
            have = it["data"].get("md5")
            if "upload" in form:
                up = s["uploads"].get(form["upload"])
                if not up or "bytes" not in up:
                    return self._send(400, b"no completed upload", ctype="text/plain")
                it["data"]["md5"] = up["md5"]
                s["files"][key] = up["bytes"]
                return self._send(204, b"")
            if have and self.headers.get("If-Match") != have:
                return self._send(412, b"file changed", ctype="text/plain")
            if not have and self.headers.get("If-None-Match") != "*":
                return self._send(412, b"expected If-None-Match", ctype="text/plain")
            if have == form.get("md5"):
                return self._send(200, json.dumps({"exists": 1}).encode())
            upkey = f"UP{len(s['uploads']):05d}"
            s["uploads"][upkey] = {"md5": form["md5"]}
            return self._send(200, json.dumps(
                {"url": f"/api/local/uploads/{upkey}", "uploadKey": upkey}).encode())
        self._send(404, b"?", ctype="text/plain")


def fake_server(auth_mode="always", single_use=False):
    state = {"auth_mode": auth_mode, "single_use": single_use, "asks": 0,
             "valid_keys": set(), "spent": set(), "items": {}, "uploads": {},
             "files": {}}
    handler = type("H", (FakeZotero,), {"state": state})
    srv = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, state, f"http://127.0.0.1:{srv.server_address[1]}"


def library(state):
    """A parent item with one PDF attachment -- the shape a converted source points at."""
    state["items"]["PARENT01"] = {"key": "PARENT01", "data": {
        "key": "PARENT01", "itemType": "journalArticle", "title": "A Fixture Article"}}
    state["items"]["ATTACH01"] = {"key": "ATTACH01", "data": {
        "key": "ATTACH01", "itemType": "attachment", "parentItem": "PARENT01",
        "filename": "fixture.pdf", "contentType": "application/pdf"}}


def fixture_folder(td):
    root = Path(td) / "reading"
    (root / "source").mkdir(parents=True)
    (root / "source" / "essay.md").write_text(
        '---\ntitle: "An essay"\nzotero: "ATTACH01"\n---\n\nThe text itself.\n',
        encoding="utf-8")
    (root / "reading.argdown").write_text(
        '===\ndefaults:\n    chapter: "source/essay.md"\n===\n\n'
        "[A claim]: The text itself. {fidelity: \"quotation\"}\n", encoding="utf-8")
    return root / "reading.argdown"


# ---- consent ------------------------------------------------------------------------- #
print("consent, Zotero's own")
with tempfile.TemporaryDirectory() as td:
    srv, state, base = fake_server(auth_mode="allow")
    kf = Path(td) / "keys" / "zotero-local-api-key"
    z = ZoteroLocal(base=base, keyfile=kf)
    z.create_items([{"itemType": "attachment", "linkMode": "imported_file",
                     "title": "x", "filename": "x", "contentType": "text/plain"}])
    check("a plain Allow answers a key and the write succeeds", state["asks"], 1)
    check("  and a single-visit key is NOT persisted", kf.exists(), False)
    srv.shutdown()

    srv, state, base = fake_server(auth_mode="always")
    z = ZoteroLocal(base=base, keyfile=kf)
    z.create_items([{"itemType": "attachment", "linkMode": "imported_file",
                     "title": "x", "filename": "x", "contentType": "text/plain"}])
    check("Always Allow persists the key", kf.exists(), True)
    z2 = ZoteroLocal(base=base, keyfile=kf)
    z2.create_items([{"itemType": "attachment", "linkMode": "imported_file",
                      "title": "y", "filename": "y", "contentType": "text/plain"}])
    check("  and a later run reuses it without a second dialog", state["asks"], 1)
    srv.shutdown()

    srv, state, base = fake_server(auth_mode="deny")
    z = ZoteroLocal(base=base, keyfile=Path(td) / "none")
    check_raises("a denial is a sentence, and nothing is written",
                 lambda: z.create_items([{}]), DENIED[:30])
    check("  no item appeared", len(state["items"]), 0)
    srv.shutdown()

    srv, state, base = fake_server(auth_mode="allow", single_use=True)
    z = ZoteroLocal(base=base, keyfile=Path(td) / "none2")
    z.create_items([{"itemType": "attachment", "linkMode": "imported_file",
                     "title": "x", "filename": "x", "contentType": "text/plain"}])
    z.create_items([{"itemType": "attachment", "linkMode": "imported_file",
                     "title": "y", "filename": "y", "contentType": "text/plain"}])
    check("a spent single-use key re-asks rather than failing", state["asks"] >= 2, True)
    srv.shutdown()

# ---- the three-phase upload ---------------------------------------------------------- #
print("the three-phase upload")
with tempfile.TemporaryDirectory() as td:
    srv, state, base = fake_server()
    library(state)
    z = ZoteroLocal(base=base, keyfile=Path(td) / "k")
    f = Path(td) / "copy.txt"
    f.write_text("the argument, verbatim", encoding="utf-8")
    made = z.create_items([{"itemType": "attachment", "linkMode": "imported_file",
                            "parentItem": "PARENT01", "title": f.name,
                            "filename": f.name, "contentType": "text/plain"}])
    key = made["success"]["0"]
    check("upload lands the exact bytes", z.upload_file(key, f), "uploaded")
    check("  and the server holds them", state["files"][key],
          b"the argument, verbatim")
    check("an unchanged file is recognised, not re-sent",
          z.upload_file(key, f, old_md5=state["items"][key]["data"]["md5"]), "unchanged")
    f.write_text("the argument, revised", encoding="utf-8")
    old = state["items"][key]["data"]["md5"]
    check("a changed file replaces under If-Match", z.upload_file(key, f, old_md5=old),
          "uploaded")
    check_raises("a replacement against the wrong md5 is refused, nothing overwritten",
                 lambda: z.upload_file(key, f, old_md5="0" * 32), "Nothing was")
    srv.shutdown()

# ---- the store machinery, end to end ------------------------------------------------- #
print("store, end to end")
with tempfile.TemporaryDirectory() as td:
    srv, state, base = fake_server()
    library(state)
    z = ZoteroLocal(base=base, keyfile=Path(td) / "k")
    ad = fixture_folder(td)

    lines = zotero_store.store(ad, z=z)
    said = "\n".join(lines)
    check("first run stores the argdown and the source",
          said.count("stored"), 2)
    kids = [it for it in state["items"].values()
            if it["data"].get("parentItem") == "PARENT01"
            and it["data"].get("filename") in ("reading.argdown", "essay.md")]
    check("  as two attachments under the parent item", len(kids), 2)
    check("  the argdown's bytes are byte-identical",
          state["files"][[k["key"] for k in kids
                          if k["data"]["filename"] == "reading.argdown"][0]],
          ad.read_bytes())

    lines = zotero_store.store(ad, z=z)
    check("a second run finds every copy current",
          "\n".join(lines).count("current"), 2)

    ad.write_text(ad.read_text(encoding="utf-8") + "\n// a new thought\n",
                  encoding="utf-8")
    lines = zotero_store.store(ad, check_only=True, z=z)
    said = "\n".join(lines)
    check("--check flags the stale copy and writes nothing",
          ("BEHIND" in said, "refreshed" in said), (True, False))
    lines = zotero_store.store(ad, z=z)
    check("a plain run refreshes it", "\n".join(lines).count("refreshed"), 1)
    lines = zotero_store.store(ad, check_only=True, z=z)
    check("  after which the copy is current again",
          "\n".join(lines).count("current"), 2)

    exp = Path(td) / "reading.html"
    exp.write_text("<title>the export</title>", encoding="utf-8")
    lines = zotero_store.store(ad, export=exp, z=z)
    check("an export given is stored beside them", "\n".join(lines).count("stored"), 1)
    srv.shutdown()

# ---- the refusals -------------------------------------------------------------------- #
print("the refusals, each a sentence")
with tempfile.TemporaryDirectory() as td:
    srv, state, base = fake_server()
    z = ZoteroLocal(base=base, keyfile=Path(td) / "k")
    no_ch = Path(td) / "bare.argdown"
    no_ch.write_text("[A]: b.\n", encoding="utf-8")
    check_raises("a sourceless map has no home item", lambda: zotero_store.store(no_ch, z=z),
                 "no chapter")
    ad = fixture_folder(td)
    (ad.parent / "source" / "essay.md").write_text("no front matter\n", encoding="utf-8")
    check_raises("a source with no zotero key is said, not guessed",
                 lambda: zotero_store.store(ad, z=z), "zotero:")
    (ad.parent / "source" / "essay.md").write_text(
        '---\nzotero: "ATTACH01"\n---\nx\n', encoding="utf-8")
    check_raises("a key the library does not hold is said",
                 lambda: zotero_store.store(ad, z=z), "no item with attachment key")
    state["items"]["ATTACH01"] = {"key": "ATTACH01", "data": {
        "key": "ATTACH01", "itemType": "attachment", "filename": "f.pdf"}}
    check_raises("a standalone attachment has nowhere to hang copies",
                 lambda: zotero_store.store(ad, z=z), "standalone")
    srv.shutdown()

print()
if fails:
    print(f"{fails} FAILED")
    sys.exit(1)
print("all store checks passed, and no real library was ever touched")
