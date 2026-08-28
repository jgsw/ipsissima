# Publishing Ipsissima-MCP

What this buys is one line. Today the install is a clone, a virtual environment and a path typed
into a configuration file; published, it is:

```bash
claude mcp add ipsissima -- uvx ipsissima-mcp
```

`uvx` makes the environment, installs the package into it and throws it away afterwards, so
nothing here has to explain virtual environments, [PEP 668](https://peps.python.org/pep-0668/),
or absolute paths. **Node still has to be on the machine** — the bundled parser is JavaScript —
but nothing has to be installed for it.

**Publishing is not reversible.** A name on PyPI is claimed permanently, and a released version
can be yanked but never replaced: if `0.1.0` is wrong, the fix is `0.1.1`, and `0.1.0` stays
visible. Both `ipsissima-mcp` and `ipsissima` were free when this was written, and a free name
stays free only until somebody takes it.

---

## Before publishing anything

```bash
cd app && npm test          # includes "the package carries what it serves", which builds a wheel
```

That test is the one that matters here. It builds the wheel and looks inside it for the parser,
all ten documents, every declared dependency and the console script — because the failure this
package is prone to is *silent*: a server that starts, registers its tools, answers the handshake
and hands the model `(missing: …)` where the instructions should be. It did exactly that until
the documents were moved inside the package.

Then check the built artifact by hand at least once:

```bash
uv build --wheel --out-dir dist ipsissima-mcp
uvx --from dist/ipsissima_mcp-*.whl ipsissima-mcp
```

The second command should sit there waiting for JSON-RPC on stdin, which is a server working.
`ipsissima-mcp/tests/test_installable.py` is the automated form of the same question.

## Rehearse on TestPyPI

TestPyPI is a separate index with separate accounts, and it is the only way to find out what the
page looks like before the real one is permanent.

```bash
uv publish --publish-url https://test.pypi.org/legacy/ dist/*
```

Then install from it, in a throwaway environment, and read the rendered README at
`https://test.pypi.org/project/ipsissima-mcp/`:

```bash
uvx --index-url https://test.pypi.org/simple/ \
    --extra-index-url https://pypi.org/simple/ ipsissima-mcp
```

The second index is not optional: TestPyPI does not carry `pymupdf` or `onnxruntime`, and without
somewhere to get them the install fails for reasons that have nothing to do with this package.

## Publishing, route A: trusted publishing (recommended)

PyPI can accept an upload from a named GitHub workflow without any token existing at all, which
is both safer and less to look after than a secret in the repository settings.

1. Create the project's publisher at <https://pypi.org/manage/account/publishing/> — PyPI project
   name `ipsissima-mcp`, owner `jgsw`, repository `ipsissima`, workflow `publish-pypi.yml`,
   environment `pypi`. This can be done *before* the project exists; that is what "pending
   publisher" means, and it is how a first release avoids needing a token.
2. Run the **Publish to PyPI** workflow from the Actions tab, giving it the tag to build from.

Nothing else is needed, and there is no secret to rotate or leak.

## Publishing, route B: an API token

If you would rather not use Actions:

1. Make a token at <https://pypi.org/manage/account/token/>, scoped to this project once it
   exists, or account-wide for the first upload.
2. `uv publish --token pypi-…  dist/*`

Keep the token out of the repository and out of your shell history — `uv publish` reads
`UV_PUBLISH_TOKEN` from the environment if you would rather not put it on the command line.

## Afterwards

The install instructions live in **three** places and all three now lead with the `.mcpb` bundle,
which is the right answer for somebody who does not want a terminal at all:

- `ipsissima-mcp/README.md` — the Install section
- `README.md` — the "Ipsissima-MCP, the other half" section
- `site/index.md` — "The other half"

What publishing adds is the *terminal* install, for people who are in one already: `uvx
ipsissima-mcp` in place of the clone-and-venv under "The developer's way". Put it there rather
than at the top; the bundle should stay first.

## The two are not alternatives

The `.mcpb` bundle (built by `build_mcpb.mjs`, attached to every release) declares its
dependencies rather than carrying them, and the host resolves them **from PyPI**. Today that
works because the bundle carries this project's own source and `uv` builds it locally. Once
`ipsissima-mcp` is published, the bundle could instead depend on the released version by name,
which would make it smaller still and let it update without a new bundle. That is a change worth
making deliberately, not a consequence of publishing.

## Versions

`version` lives in `pyproject.toml` and is not derived from the git tag; the two are kept in step
by hand. The desktop application is versioned separately and they are not required to match —
`0.1.0` in both today is a coincidence of timing, not a policy.
