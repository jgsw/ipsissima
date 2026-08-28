//! Ipsissima — the desktop shell.
//!
//! WHAT THIS IS FOR, AND WHAT IT DELIBERATELY IS NOT. The whole application is the single
//! self-contained HTML file built by `build_argdown_viewer.mjs`; this crate is a window around
//! it plus the one thing a page genuinely cannot do — be told by the operating system that a
//! file was double-clicked. Everything else (the parser, the map, the editor, the exports) stays
//! in the frontend, and the same file still runs as a plain web page. If logic starts migrating
//! into Rust, the two hosts have begun to diverge and something has gone wrong.
//!
//! THE ONE HARD PROBLEM: a file can arrive before there is anywhere to put it.
//!
//! On macOS, launching by double-click delivers the file through `RunEvent::Opened` — and that
//! can fire before the webview exists, let alone before the page's own script has run. On
//! Windows and Linux the first file arrives as `argv[1]` at startup, which is earlier still.
//! Emitting an event at that moment sends it into a void: the window opens, empty, and sits
//! there looking broken while the file the reader clicked is forgotten.
//!
//! So paths are QUEUED rather than emitted, and the frontend drains the queue with
//! `take_pending_open` as soon as it is ready. Anything arriving after that is emitted live.
//! Both routes end at the same handler in the page.

use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

/// Paths the OS has handed us that the frontend has not collected yet.
#[derive(Default)]
struct PendingOpen(Mutex<Vec<String>>);

/// The event the frontend listens on. Namespaced so it cannot collide with a plugin's.
const OPEN_EVENT: &str = "ipsissima://open-paths";

/// A menu item was chosen. The payload is the item's id, and the page decides what it means.
///
/// THE MENU GIVES NO COMMANDS OF ITS OWN. Every item here already exists as a button in the page,
/// and duplicating the behaviour in Rust would be two implementations of one feature, drifting.
/// So the menu is a second set of doorbells for the same handlers: it emits an id, and the page
/// runs exactly what the corresponding button runs. The only items handled natively are the ones
/// that are genuinely the window manager's business — full screen, minimise, quit.
const MENU_EVENT: &str = "ipsissima://menu";

/// Build the application menu.
///
/// Roles rather than raw items wherever one exists (`PredefinedMenuItem`): those come with the
/// platform's own labels, shortcuts and behaviour, already translated, and on macOS they are what
/// puts Services, Hide Others and the window list where a Mac user expects to find them.
fn build_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let item = |id: &str, label: &str, accel: Option<&str>| {
        let mut b = MenuItemBuilder::with_id(id, label);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    };

    // The application menu (macOS). About is OURS rather than the predefined one: the predefined
    // item shows a system panel with a name and a version, and the credits that matter here --
    // Argdown, ArgVu, the licence -- have nowhere to go in it.
    //
    // TWO ITEMS, ONE ID. About appears in both the application menu and the Help menu, and the
    // obvious thing -- build it once and add it to both -- produces a menu that renders perfectly
    // and does nothing: a macOS NSMenuItem belongs to one menu, so putting the same instance in
    // two silently breaks its action. Sharing the ID is what makes them the same COMMAND; the
    // page cannot tell which one was chosen and does not need to.
    let app_menu = SubmenuBuilder::new(app, "Ipsissima")
        .item(&item("about", "About Ipsissima", None)?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    // NEW COMES FIRST, as it does in every File menu, and it is the one that was missing: the
    // app could open a reconstruction and could not begin one, so a blank start meant making an
    // .argdown somewhere else first. It unloads what is open and asks before it does.
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&item("new", "New Reconstruction", Some("CmdOrCtrl+N"))?)
        .separator()
        .item(&item("open", "Open…", Some("CmdOrCtrl+O"))?)
        .item(&item("open-folder", "Open Folder…", Some("CmdOrCtrl+Shift+O"))?)
        .separator()
        .item(&item("save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item("save-as", "Save As…", Some("CmdOrCtrl+Shift+S"))?)
        // EXPORT, because that is what the toolbar button says and what the menu it opens is
        // titled. "Send This Back" describes what the feature is FOR and is not what it is
        // called anywhere else, and one feature under two names is one feature the reader has to
        // learn twice. The same rename was already made on the web side; this was the last of it.
        .item(&item("export", "Export…", Some("CmdOrCtrl+E"))?)
        .separator()
        .close_window()
        .build()?;

    // Undo and redo are OURS, not the predefined roles. The predefined items send the webview a
    // native edit command, which reaches whatever has focus -- and the edit most in need of undo
    // here is a comment written on the MAP, where nothing has focus at all. These route to
    // CodeMirror's history, which is the one place the file's edits are recorded.
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&item("undo", "Undo", Some("CmdOrCtrl+Z"))?)
        .item(&item("redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&item("find", "Find in the Argdown…", Some("CmdOrCtrl+F"))?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&item("view-reasons", "Reasons", Some("CmdOrCtrl+1"))?)
        .item(&item("view-exposition", "Exposition", Some("CmdOrCtrl+2"))?)
        .separator()
        .item(&item("pane-map", "Map", Some("CmdOrCtrl+Alt+1"))?)
        .item(&item("pane-argdown", "Argdown", Some("CmdOrCtrl+Alt+2"))?)
        .item(&item("pane-notes", "Notes", Some("CmdOrCtrl+Alt+3"))?)
        .item(&item("pane-text", "Manuscript", Some("CmdOrCtrl+Alt+4"))?)
        .separator()
        .item(&item("fit", "Fit the Map to the Window", Some("CmdOrCtrl+0"))?)
        .item(&item("layout", "Layout…", None)?)
        .separator()
        .fullscreen()
        .build()?;

    // The walkthrough sits ABOVE the reference, because it is for the reader who cannot yet
    // tell which topic in the reference answers their question. It is also where the tour
    // itself says it will be found when somebody turns it off, so the two have to agree.
    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&item("walkthrough", "Take the Walkthrough", None)?)
        .separator()
        .item(&item("help", "How to Use Ipsissima", Some("CmdOrCtrl+/"))?)
        .item(&item("about", "About Ipsissima", None)?)
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &help_menu])
        .build()
}

/// Hand over everything queued so far, and empty the queue.
///
/// Called once by the page at startup. Draining rather than peeking is deliberate: a second call
/// after a reload should not reopen a file the reader has since closed.
#[tauri::command]
fn take_pending_open(state: tauri::State<'_, PendingOpen>) -> Vec<String> {
    let mut q = state.0.lock().unwrap();
    std::mem::take(&mut *q)
}

/// Queue paths, or emit them if the frontend is already listening.
///
/// `has_window` is the test rather than any notion of "started", because the window is exactly
/// what an emit needs in order to land somewhere.
fn deliver(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    if app.webview_windows().is_empty() {
        app.state::<PendingOpen>().0.lock().unwrap().extend(paths);
        return;
    }
    // Bring the window forward: on macOS, opening a file against an already-running app is
    // expected to raise it, and an app that silently loads the file behind another window reads
    // as having done nothing at all.
    if let Some(w) = app.webview_windows().values().next() {
        let _ = w.set_focus();
    }
    let _ = app.emit(OPEN_EVENT, paths);
}

/// Only ever the files we can actually open. Argument vectors carry flags, and on Windows the
/// first element is the executable itself.
fn argdown_paths<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    args.into_iter()
        .filter(|a| {
            let lower = a.to_lowercase();
            (lower.ends_with(".argdown") || lower.ends_with(".ad"))
                && std::path::Path::new(a).is_file()
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // SINGLE INSTANCE, because file associations do not respect one. On Windows every
    // double-click spawns a fresh process; without this, opening three reconstructions would
    // give three copies of Ipsissima rather than three files opened in one. The callback runs in
    // the FIRST instance and receives the second's argv.
    #[cfg(all(desktop, not(any(target_os = "android", target_os = "ios"))))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            deliver(app, argdown_paths(argv));
        }));
    }

    builder
        // THE MENU IS ATTACHED HERE, on the builder, and not with `app.set_menu()` in `setup`.
        // Both put the same menu on screen; only this one delivers its events. Setting it at
        // runtime gave a menu that opened, highlighted and closed on click while
        // `on_menu_event` never fired once — no error, no warning, just a menu that did nothing.
        .menu(|handle| build_menu(handle))
        .on_menu_event(|app, event| {
            let _ = app.emit(MENU_EVENT, event.id().0.as_str());
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingOpen::default())
        .invoke_handler(tauri::generate_handler![take_pending_open])
        .setup(|app| {
            // Windows and Linux deliver the first file this way, before any event fires.
            let queued = argdown_paths(std::env::args());
            if !queued.is_empty() {
                app.state::<PendingOpen>().0.lock().unwrap().extend(queued);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Ipsissima")
        .run(|app, event| {
            // macOS delivers file opens here, as file:// URLs, both at launch and afterwards.
            //
            // AND THE VARIANT ONLY EXISTS THERE. `RunEvent::Opened` is compiled into Tauri for
            // macOS alone, so on Linux and Windows this arm is not a dead branch — it is a
            // compile error, and the whole crate fails to build:
            //
            //     error[E0599]: no variant named `Opened` found for enum `RunEvent`
            //
            // The comment above was right about the platform from the first day and the code was
            // never told. It went unnoticed because this crate had only ever been built on a Mac;
            // the first release is the first time Linux and Windows ever saw it. Windows and
            // Linux hand the file over in `argv` instead, which `setup` already reads.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                deliver(app, argdown_paths(paths));
            }
            // Without the macOS arm both bindings are unused, and the crate is built with
            // warnings denied on CI.
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app, event);
            }
        });
}
