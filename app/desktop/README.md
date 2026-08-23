# Ipsissima — the desktop shell

A window around the application, and one thing a web page cannot do: be told by the operating
system that a file was double-clicked.

**The application is not in this folder.** It is the single self-contained HTML file that
`build_argdown_viewer.mjs --standalone --editor` produces — the same file that runs in a browser,
the same file that gets emailed. `build_desktop.mjs` builds it and stages it into `dist/`, and
Tauri wraps that. If logic starts moving into the Rust crate, the browser version and the app
version have begun to diverge and something has gone wrong.

## What the shell adds

| | in a browser | in the app |
|---|---|---|
| open a folder read-write | Chromium only (`showDirectoryPicker`) | every platform |
| save the `.argdown` in place | Chromium only | every platform |
| double-click a `.argdown` to open it | no | yes |
| reload the manuscript when it changes on disk | **impossible** | yes |

The middle two are parity: Safari and Firefox readers currently get a degraded Ipsissima — the
map and the panes render perfectly (measured, see *Toolchain notes*), but `showDirectoryPicker`
is `undefined`, so Save can only offer a download. The shell is what levels them up.

The last row is the one the web has no equivalent of at all. Edit the essay in Zettlr and the
passage under the claim updates, because `argdown-host.js` watches the manuscript files. It
watches **only** the manuscript, never the `.argdown` — the reconstruction is what the editor
holds, and reloading that underneath someone would replace what they are typing. The manuscript
is read-only in Ipsissima by design, which is exactly what makes it safe to reload.

## Layout

```
desktop/
  build_desktop.mjs        builds the page and stages it into dist/, then checks
                           the staged file actually contains the host adapter
  dist/                    generated; never edited
  tauri.mjs                the Tauri CLI with a PATH that has Rust on it — Homebrew's
                           rustup is keg-only, so `cargo` is not on a plain PATH
  rust-path.mjs            where that PATH comes from; shared with install.mjs
  src-tauri/
    tauri.conf.json        window, bundle targets, and the .argdown file association
    capabilities/          what the window may ask the host for — fs and dialog, nothing else
    icons/source.png       the 1024px master; the platform set is regenerated from it
    src/lib.rs             the window, and the open-file queue
```

The frontend half of the bridge is `../../Build scripts/argdown-host.js`, inlined into the page
by the builder like every other module. In a browser it detects no host and every existing path
runs unchanged.

## Building

Needs Rust (`brew install rustup && rustup default stable`) and Xcode command line tools.
`rustup` is keg-only, so put its shims on `PATH` first:

```bash
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
```

Then:

```bash
npm install
npm run dev      # a window, with the devtools available
npm run build    # a .app and a .dmg in src-tauri/target/release/bundle/
```

`npm run build --no-bundle` compiles the binary without packaging it, which is much faster when
what you are testing is the Rust.

## Five things that fail silently

Every one of these was hit while building this, and not one of them produced an error. The build
reported success and the app opened; something was just missing.

**The frontend is not rebuilt when it changes.** `tauri::generate_context!()` embeds
`../dist/index.html` at macro-expansion time, and cargo does not track that file. Edit the
template, rebuild the page, run `tauri build` — and you get an app containing the *previous*
frontend. `build.rs` now emits `cargo:rerun-if-changed=../dist/index.html`, which is the whole
fix, but it is worth knowing why it is there.

**A CSP nonce silently kills the map.** Tauri adds a nonce to the directives it manages, and a
nonce makes the browser ignore `'unsafe-inline'`. The map renderer builds its stylesheet at
runtime — `document.createElement("style")` in `argdown-live-map.js` — so that element can carry
no nonce and is dropped. What you see is a window with a working toolbar, an unstyled filter bar,
and no map at all, because `.alm{height:100%;min-height:320px}` never applied and the container
collapsed to nothing. `dangerousDisableAssetCspModification: ["style-src"]` in `tauri.conf.json`
is what makes `'unsafe-inline'` mean what it says.

**Watching is behind a cargo feature.** `tauri-plugin-fs`'s `watch` is *not* on by default. Build
without it and there is no watch command, `fs.watch` does nothing, and the manuscript never
reloads — no error on either side. `features = ["watch"]` in `Cargo.toml`, and
`fs:allow-unwatch` in the capability alongside `fs:allow-watch`.

**The fs scope is not the whole disk, and a refusal looks like an empty folder.** The capability
allows `$HOME/**` and `/Volumes/**`. A folder outside those is refused by the host, and
`readDirDeep` used to swallow that into "nothing readable in that folder" — which sends someone
hunting for a missing file that is sitting right there. The root directory's failure now
propagates and says which of the two it is; a subfolder that will not read is still tolerated.

## The menu

Built in Rust (`build_menu` in `src/lib.rs`) and attached with `Builder::menu`, not with
`app.set_menu()` in `setup` — both put the same menu on screen, only the first delivers its
events.

**No menu item has behaviour of its own.** Each emits its id, the page receives it on
`ipsissima://menu`, and runs exactly what the corresponding toolbar button runs. A File ▸ Open
that is a second implementation of Open is a second thing to keep correct.

**One item per menu, even when it is the same command.** About appears in both the application
menu and Help. Building it once and adding it to both gives a menu that renders perfectly and
does nothing: a macOS `NSMenuItem` belongs to one menu, and putting one instance in two silently
breaks its action. Build two items sharing an id — the id is what makes them the same command.

**Testing a native menu with synthetic clicks does not work**, and this cost an afternoon. macOS
menu tracking is a modal run loop; a synthetic mouse click highlights the item and dismisses the
menu without ever selecting it. Every click looked like a dead menu item. Use the accelerator, or
open the menu and drive it with arrow keys and Return — those are real key events and dispatch
normally.

## Two more things that are easy to get wrong

**The open-file race.** On macOS a double-click delivers the file through `RunEvent::Opened`,
which can fire before the webview exists; on Windows and Linux the first file arrives as
`argv[1]`, earlier still. Emitting at that moment sends it nowhere and the app opens an empty
window over the file the reader just clicked. So paths are queued, and the page drains the queue
with `take_pending_open` once it is ready. Anything arriving later is emitted live. Both routes
end at the same handler.

**One instance.** File associations do not respect one — on Windows every double-click spawns a
fresh process. Without `tauri-plugin-single-instance`, opening three reconstructions gives three
copies of Ipsissima rather than three files opened in one.

## Not done yet

Code signing. Unsigned builds trigger Gatekeeper on macOS and SmartScreen on Windows; removing
that needs an Apple Developer membership and a Windows certificate. The workflow has the secret
names in place, commented out — when they exist, nothing else changes.
