# Rationale conversion, Zettlr export, and co-editing

Read this only when one of the three applies. None is part of an ordinary reconstruction.

## Converting an existing map (Rationale `.rtnl`)

The author has argument maps built in Rationale (Austhink) from the 2000s. `.rtnl` is a plain-text
imperative script — `Create`, `CreateChild`, `SetText`, `CreateAnnotation`, then layout calls that
can be ignored. Convert with:

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/rationale_to_argdown.py "map.rtnl" -o "map.argdown"
```

The four translation decisions it encodes, each of which matters:

| Rationale | Argdown | Why |
|---|---|---|
| `CompoundReason` with ≥2 claims | an argument with a PCS | a compound is **linked**; sibling `+` would assert convergence |
| `CompoundReason` with 1 claim | a plain `+` relation | a one-premise "argument" is noise |
| `CompoundObjection` on an **Inference** | an undercut `_` | Rationale's way of objecting to the step rather than a premise |
| `Note` annotation | `note:` metadata | **a note is not a reason** — attaching it with `+` would add support the source does not contain |

It also tags claims at Rationale depth ≤ 2 as `#core`, which gives the converted file a fold-up
view it would not otherwise have, and stamps every node with its `rationale_id` so any claim can
be traced back to the source.

**A converted map is a transcription, not a reading.** Diff it against a reconstruction built from
the finished prose: where they disagree, the usual cause is that the author revised the argument's
architecture between planning and publication, and the difference is itself the interesting
finding. Say which is which rather than reconciling them silently.

## Embedding in Markdown (Zettlr → Pandoc)

Fenced blocks are rendered during export. **Three classes, and the choice matters:**

| Class | HTML / Reveal.js | Word / PDF | Use for |
|---|---|---|---|
| `.argdown-live` | **re-flowing map** — fold a Part and the rest moves to fill the gap | static image | teaching, talks, anything read on screen |
| `.argdown-map` | static map, as a zoomable web-component | static image | a figure meant to be printed |
| `.argdown` | syntax-highlighted source | source | showing the notation itself |

    ```{.argdown-live caption="..." height="460px" depth="1" folded="sec0,sec1"}
    # Part One {isGroup: true}

    [claim]: The thing being argued for.
        + [reason]: Something that supports it.
    ```

`depth` and `folded` set the *opening* state — a slide can start at the main claim and expand as
you talk. Headings become foldable clusters, so **write the argument under `#` headings** or
there is nothing to fold.

**A block that fails validation fails the export with the Argdown error message.** That is
deliberate; a silently missing diagram is worse, because it ships.

Three filters are wired up, chosen per output type:

| Profile | Filters | Result |
|---|---|---|
| HTML · Reveal.js · themed Reveal.js | `argdown-live-filter.mjs`, then `@argdown/pandoc-filter` | re-flowing map · web-component |
| XeLaTeX PDF · Word · Word (No Notes) | `argdown.lua` (in Zettlr's `lua-filter/`) | static images for both classes |

The live filter must come **first**: it claims `.argdown-live` and leaves `.argdown-map` to the
official one.

**The MetaString trap.** The Node filter emits a *static image* unless told otherwise, and it
reads its `mode` setting only when pandoc hands it as `MetaInlines`. A defaults file's own
`metadata:` block arrives as `MetaString` and is **silently ignored** — the export looks
successful and is still a flat picture. The setting therefore lives in a separate metadata file
referenced from `metadata-files:`:

```yaml
# app/argdown-pandoc-metadata.yaml
argdown:
  mode: web-component
```

Measured 16 Aug 2026: `metadata:` → 0 web-components; `metadata-files:` → 3. Per-block attributes
still override it, so one block can opt out with `` ```{.argdown-map mode="inline"} ``.

## Co-editing safety

If the author also edits the file by hand, follow the protocol in
the project notes: run the co-editing guard before writing,
`diff` if it reports CHANGED, `snapshot` after. Never rewrite such a file wholesale, and never
revert an author's rewording.

