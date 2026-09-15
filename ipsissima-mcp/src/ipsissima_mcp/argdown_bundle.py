#!/usr/bin/env python3
"""The argdown-bundle format: one file carrying the reconstruction AND the text it reads.

A FAITHFUL PORT of `app/src/argdown-bundle.js`, which is the format's home and keeps the full
design rationale. The short version: the sources are attached after the map as Argdown LINE
comments (`//|`), which the parser discards and which no carried text can close early -- an
essay containing `*/`, `-->` or a line of `===` rides through untouched, so there is no
escaping rule because there is nothing to escape. A bundle is still a valid .argdown: same
graph, same tools, same extension.

TWO IMPLEMENTATIONS OF ONE FORMAT ARE HELD TOGETHER BY A CROSS-CHECK (E10, the positions
py/js precedent): `tests/test_zotero_store.py` attaches with this module and detaches with
the JavaScript one, and the round trip must be byte-identical both ways. Change the format
in either home and that check says so.

    //>argdown-bundle 1
    //>meta {"created":"2026-08-21T10:00:00.000Z"}
    //>file source/essay.md
    //| # The essay
    //|
    //| Text with --> and === and {metadata: "blocks"} in it, carried safely.
    //>end
"""
from __future__ import annotations

import json
import re

VERSION = 1
OPEN = "//>argdown-bundle"
LINE = "//|"
END = "//>end"

_SPLIT = re.compile(r"\r?\n")


def _first_marker(text):
    for i, line in enumerate(_SPLIT.split(text)):
        if line.startswith(OPEN):
            return i
    return -1


def is_bundle(text):
    return _first_marker(str(text or "")) >= 0


def strip(text):
    """The reconstruction alone. Idempotent, and safe on a file that never had an attachment."""
    s = str(text or "")
    at = _first_marker(s)
    if at < 0:
        return s
    return "\n".join(_SPLIT.split(s)[:at]).rstrip("\n") + "\n"


def attach(argdown, files, meta=None):
    """Attach sources: files is [(path, text), ...] in reading order, paths exactly as the
    .argdown cites them. Any existing attachment is replaced, never appended to.

    DETERMINISTIC WHEN TOLD TO BE: the JS home stamps `created` with the clock, right for a
    file a person saves. A bundle a machine regenerates to compare against a stored copy
    must hash the same for the same inputs, so a caller-supplied `created` is used verbatim
    and the clock only fills silence.
    """
    from datetime import datetime, timezone
    out = [strip(argdown).rstrip("\n"), "", f"{OPEN} {VERSION}"]
    m = dict(meta or {})
    m.setdefault("created", datetime.now(timezone.utc).isoformat(timespec="milliseconds")
                 .replace("+00:00", "Z"))
    # JSON.stringify's spelling exactly: compact separators, insertion order (created last
    # when the clock supplied it, as in the JS home) -- the cross-check compares bytes.
    out.append("//>meta " + json.dumps(m, separators=(",", ":")))
    for path, text in files or []:
        if not path:
            continue
        out.append("//>file " + path)
        for line in _SPLIT.split(str(text or "")):
            # An empty line is a bare `//|` with no trailing space: editors that trim
            # trailing whitespace on save must not be able to change the carried text.
            out.append(LINE if line == "" else LINE + " " + line)
    out.extend([END, ""])
    return "\n".join(out)


def detach(text):
    """Take a bundle apart; None for a file that is not one. Tolerant the way the JS home is:
    unknown directives are skipped, and a truncated bundle yields what it does have."""
    s = str(text or "")
    at = _first_marker(s)
    if at < 0:
        return None
    lines = _SPLIT.split(s)
    try:
        version = int((lines[at][len(OPEN):] or "").strip() or "1")
    except ValueError:
        version = 1
    meta, files, cur, truncated = {}, [], None, True
    for line in lines[at + 1:]:
        if line.startswith(END):
            truncated = False
            break
        if line.startswith(LINE):
            if cur is None:
                continue
            body = line[len(LINE):]
            cur["lines"].append(body[1:] if body.startswith(" ") else body)
            continue
        if line.startswith("//>file "):
            cur = {"path": line[8:].strip(), "lines": []}
            files.append(cur)
            continue
        if line.startswith("//>meta "):
            try:
                meta = json.loads(line[8:]) or {}
            except ValueError:
                meta = {}
            continue
    return {"version": version, "meta": meta, "truncated": truncated,
            "argdown": "\n".join(lines[:at]).rstrip("\n") + "\n",
            "files": [{"path": f["path"], "text": "\n".join(f["lines"])}
                      for f in files if f["path"]]}
