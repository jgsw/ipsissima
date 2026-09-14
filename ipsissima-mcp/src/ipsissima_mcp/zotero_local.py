#!/usr/bin/env python3
"""Write to the Zotero running on this computer, with Zotero's own consent dialog.

TWO PROGRAMS THE READER RUNS, CONVERSING ON THEIR OWN MACHINE. Nothing here touches
zotero.org: since Zotero 10 the desktop application's local API (127.0.0.1:23119) accepts
writes, and what it writes lands in the local library, travelling further only when Zotero's
own sync runs -- on the user's account, on the user's schedule, by the user's program. That
is the C1 narrowing the author ruled for the read side, and it covers this side in the same
sentence.

CONSENT IS ZOTERO'S, BY NAME. The first write asks `POST /api/local/authorize` with
`{"appName": "Ipsissima"}`, and ZOTERO shows the dialog -- "Allow / Always Allow / Deny",
naming Ipsissima -- and answers with a local key. The key is unrelated to any zotero.org
credential, works only on this machine, and is revocable in Zotero's Settings > Advanced.
"Allow" grants a SINGLE-USE key (consumed by the first write); only "Always Allow" answers
with `remember: true`, and only then is the key persisted, so a one-time grant never quietly
becomes a standing one.

THE PROTOCOL, as measured on Zotero 10.0.2 and read against
zotero.org/support/dev/web_api/v3/local_api:

  * every write carries a `Zotero-Server-ID` header, read off `GET /api/`'s response headers
    (428 without it); the ID changes when Zotero restarts, so it is fetched, not stored
  * files go up in three phases -- announce (md5, filename, filesize, mtime, with
    `If-Match: <old md5>` for a replacement or `If-None-Match: *` for a first upload), send
    the bytes to the returned upload URL, then confirm -- and a file Zotero already holds
    answers `{"exists": 1}` at the first phase, which is the staleness check coming free
  * partial uploads are not supported locally; a changed file goes up whole

EVERY FAILURE IS A SENTENCE, not a stack trace: Zotero not running, consent denied, the
dialog rate-limited, a version conflict -- each names what to check, in the reader's terms.
"""
from __future__ import annotations

import hashlib
import json
import os
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:23119"
APP_NAME = "Ipsissima"

NOT_RUNNING = ("Zotero is not answering on this computer. Check that Zotero is running and "
               "that Settings > Advanced > 'Allow other applications on this computer to "
               "communicate with Zotero' is on.")
DENIED = ("Zotero asked, and write access for Ipsissima was declined. Nothing was written. "
          "Run again to be asked again.")
RATE_LIMITED = ("Zotero is declining to show another permission dialog just now (more than "
                "five asks in a minute). Wait a minute and run again.")
NEEDS_ZOTERO_10 = ("This Zotero cannot accept local writes -- writing through the local API "
                   "needs Zotero 10 or later.")


def key_path():
    """Where the remembered key lives -- ONE file for the desktop app and this toolchain, so
    one 'Always Allow' covers both drivers of the same machinery."""
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "Ipsissima"
    elif os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home())) / "Ipsissima"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME",
                                   Path.home() / ".config")) / "ipsissima"
    return base / "zotero-local-api-key"


class ZoteroLocal:
    """The local API, reads and consented writes. `base` and `keyfile` are parameters for the
    tests, which run against a fake Zotero rather than anyone's library."""

    def __init__(self, base=BASE, keyfile=None, ask=True):
        self.base = base.rstrip("/")
        self.keyfile = Path(keyfile) if keyfile else key_path()
        self.ask = ask                   # False: never pop the dialog (report instead)
        self._server_id = None
        self._key = None

    # ---- plumbing ------------------------------------------------------------------- #

    def _request(self, method, path, body=None, headers=None, timeout=20):
        req = urllib.request.Request(self.base + path, data=body, method=method,
                                     headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, dict(r.headers), r.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read()
        except (urllib.error.URLError, TimeoutError, OSError):
            raise SystemExit(NOT_RUNNING)

    def server_id(self):
        """Fetched fresh per session: it names the running Zotero, and restarts change it."""
        if self._server_id:
            return self._server_id
        status, headers, _ = self._request("GET", "/api/")
        sid = headers.get("Zotero-Server-ID", "")
        if status != 200 or not sid:
            raise SystemExit(NEEDS_ZOTERO_10 if status == 200 else NOT_RUNNING)
        self._server_id = sid
        return sid

    # ---- consent -------------------------------------------------------------------- #

    def _load_key(self):
        try:
            return self.keyfile.read_text(encoding="utf-8").strip() or None
        except OSError:
            return None

    def _store_key(self, key):
        self.keyfile.parent.mkdir(parents=True, exist_ok=True)
        self.keyfile.write_text(key + "\n", encoding="utf-8")
        try:
            self.keyfile.chmod(stat.S_IRUSR | stat.S_IWUSR)
        except OSError:
            pass

    def _drop_key(self):
        try:
            self.keyfile.unlink()
        except OSError:
            pass

    def authorize(self):
        """Ask Zotero to ask the user. Returns a key; persists it ONLY on 'Always Allow'."""
        if not self.ask:
            raise SystemExit("Zotero has no remembered authorization for Ipsissima, and this "
                             "run was told not to ask. Run once interactively and answer "
                             "Zotero's dialog.")
        body = json.dumps({"appName": APP_NAME}).encode("utf-8")
        status, _h, out = self._request(
            "POST", "/api/local/authorize", body,
            {"Content-Type": "application/json", "Zotero-Server-ID": self.server_id()},
            timeout=180)               # the user is reading a dialog; give them time
        if status == 403:
            raise SystemExit(DENIED)
        if status == 429:
            raise SystemExit(RATE_LIMITED)
        if status != 200:
            raise SystemExit(f"Zotero declined the authorization request ({status}): "
                             f"{out.decode('utf-8', 'replace')[:200]}")
        got = json.loads(out.decode("utf-8"))
        if got.get("remember"):
            self._store_key(got["key"])
        return got["key"]

    def _write_headers(self, extra=None):
        if self._key is None:
            self._key = self._load_key() or self.authorize()
        h = {"Zotero-Server-ID": self.server_id(), "Zotero-API-Key": self._key}
        h.update(extra or {})
        return h

    def write(self, method, path, body=None, headers=None):
        """A write, with one honest retry: a 401/403 after a stored key means the key was
        single-use and is now spent, or was revoked -- drop it and ask properly once."""
        status, h, out = self._request(method, path, body, self._write_headers(headers))
        if status in (401, 403):
            self._drop_key()
            self._key = self.authorize()
            status, h, out = self._request(method, path, body, self._write_headers(headers))
        return status, h, out

    # ---- reads ---------------------------------------------------------------------- #

    def get_json(self, path):
        status, _h, out = self._request("GET", path)
        if status == 404:
            return None
        if status != 200:
            raise SystemExit(f"Zotero answered {status} for {path}: "
                             f"{out.decode('utf-8', 'replace')[:200]}")
        return json.loads(out.decode("utf-8"))

    def item(self, key):
        return self.get_json(f"/api/users/0/items/{key}")

    def children(self, key):
        return self.get_json(f"/api/users/0/items/{key}/children") or []

    # ---- writes --------------------------------------------------------------------- #

    def create_items(self, items):
        """POST a list of item JSONs. Returns the web-API-shaped result; raises on any
        failure inside it, because a half-created batch reported as success is the drift
        this module exists to prevent."""
        body = json.dumps(items).encode("utf-8")
        status, _h, out = self.write("POST", "/api/users/0/items", body,
                                     {"Content-Type": "application/json"})
        if status != 200:
            raise SystemExit(f"Zotero declined the item write ({status}): "
                             f"{out.decode('utf-8', 'replace')[:300]}")
        got = json.loads(out.decode("utf-8"))
        failed = got.get("failed") or {}
        if failed:
            raise SystemExit("Zotero rejected item(s): " + json.dumps(failed)[:300])
        return got

    def upload_file(self, item_key, path, old_md5=None):
        """The three-phase upload. Returns 'unchanged' | 'uploaded'."""
        data = Path(path).read_bytes()
        md5 = hashlib.md5(data).hexdigest()
        cond = {"If-Match": old_md5} if old_md5 else {"If-None-Match": "*"}
        form = urllib.parse.urlencode({
            "md5": md5, "filename": Path(path).name, "filesize": len(data),
            "mtime": int(Path(path).stat().st_mtime * 1000)}).encode("utf-8")
        status, _h, out = self.write(
            "POST", f"/api/users/0/items/{item_key}/file", form,
            {"Content-Type": "application/x-www-form-urlencoded", **cond})
        if status == 412:
            raise SystemExit(
                "Zotero holds a different version of this file than the one being replaced "
                "-- someone or something changed it since it was last stored. Nothing was "
                "overwritten; check the copy in Zotero, then run again.")
        if status != 200:
            raise SystemExit(f"Zotero declined the upload announcement ({status}): "
                             f"{out.decode('utf-8', 'replace')[:200]}")
        got = json.loads(out.decode("utf-8"))
        if got.get("exists"):
            return "unchanged"
        up_url = got["url"]
        up_path = up_url[len(self.base):] if up_url.startswith(self.base) else up_url
        status, _h, out = self.write("POST", up_path, data,
                                     {"Content-Type": "application/octet-stream"})
        if status not in (200, 201):
            raise SystemExit(f"Zotero declined the file bytes ({status}): "
                             f"{out.decode('utf-8', 'replace')[:200]}")
        # The upload key comes back as a field or only as the tail of the upload URL,
        # depending on version; both spellings of the same fact.
        upload_key = got.get("uploadKey") or up_path.rstrip("/").rsplit("/", 1)[-1]
        form = urllib.parse.urlencode({"upload": upload_key}).encode("utf-8")
        status, _h, out = self.write(
            "POST", f"/api/users/0/items/{item_key}/file", form,
            {"Content-Type": "application/x-www-form-urlencoded", **cond})
        if status != 204:
            raise SystemExit(f"Zotero declined the upload confirmation ({status}): "
                             f"{out.decode('utf-8', 'replace')[:200]}")
        return "uploaded"
