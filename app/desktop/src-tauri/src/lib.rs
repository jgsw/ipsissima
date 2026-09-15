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
        .item(&item("new-debate", "New Debate Map", Some("CmdOrCtrl+Shift+N"))?)
        .item(&item("new-from-text", "New from Text…", None)?)
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
        // The reconstruction, stored under its source's Zotero item as one bundled
        // attachment — docs/ANNOTATIONS-PLAN.md §6, the app-side driver of the same
        // machinery the MCP's zotero_store tool drives. The handler is in the page; the
        // protocol is `zotero_store_bundle` below.
        .item(&item("store-zotero", "Store in Zotero…", None)?)
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
        // The key sits beside the walkthrough because they are the two teachers: the tour for
        // the first meeting, the key for every "what did dash-dot mean again" after it.
        .item(&item("key", "Show the Key", None)?)
        .separator()
        .item(&item("help", "How to Use Ipsissima", Some("CmdOrCtrl+/"))?)
        .item(&item("about", "About Ipsissima", None)?)
        .separator()
        // THE ONE ITEM IN THIS APPLICATION THAT USES THE NETWORK, and it is in a menu rather
        // than on a timer for exactly that reason. See `check_for_updates`.
        .item(&item("check-updates", "Check for Updates…", None)?)
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &help_menu])
        .build()
}

/// Where releases are published. A constant so that `open_releases_page` needs no argument.
const RELEASES: &str = "https://github.com/jgsw/ipsissima/releases";

/// The download page on the site — the one that says what your computer will warn and what to
/// click, rather than a wall of eight assets. Same zero-argument stance as RELEASES.
const DOWNLOADS: &str = "https://jgsw.github.io/ipsissima/#get-the-application";

/// What `check_for_updates` reports back.
#[derive(serde::Serialize)]
struct UpdateCheck {
    current: String,
    latest: Option<String>,
    newer: bool,
    url: String,
    downloads: String,
}

/// Ask GitHub whether there is a newer release. ONLY when the reader asks.
///
/// THIS IS THE ONLY NETWORK REQUEST IPSISSIMA EVER MAKES, and everything about how it is built
/// follows from wanting that sentence to stay easy to check.
///
/// IT LIVES IN RUST RATHER THAN IN THE PAGE. The page is also `Ipsissima.html` — a file people
/// email to each other and open in a browser — and of that file it is still true without
/// qualification that it makes no network request of any kind. Had the fetch gone in the page,
/// that claim would have had to be softened for the web version too, for a feature the web
/// version cannot use. The shell is the part that can be updated, so the shell is the part that
/// asks.
///
/// IT DOWNLOADS NOTHING AND INSTALLS NOTHING. It compares two version strings and hands back a
/// URL; opening it is the reader's next move, in their own browser. An application that can
/// replace its own binary is a different kind of thing to trust, and this one does not need to be.
///
/// Nothing about the machine is sent. The request carries a User-Agent because GitHub's API
/// rejects requests without one, and that is the whole of what leaves.
#[tauri::command]
async fn check_for_updates() -> Result<UpdateCheck, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();

    let resp = reqwest::Client::builder()
        .user_agent(format!("Ipsissima/{current}"))
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?
        .get("https://api.github.com/repos/jgsw/ipsissima/releases/latest")
        .send()
        .await
        .map_err(|e| format!("could not reach GitHub: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub answered {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let latest = body
        .get("tag_name")
        .and_then(|t| t.as_str())
        .map(|t| t.trim_start_matches('v').to_string());

    // STRING INEQUALITY IS NOT THE TEST. "0.10.0" sorts before "0.9.0" as text, so a tenth
    // release would have announced itself as older than the ninth. Compare number by number, and
    // treat anything unparseable as "not newer" rather than guessing.
    let newer = match &latest {
        Some(l) => is_newer(l, &current),
        None => false,
    };

    Ok(UpdateCheck { current, latest, newer, url: RELEASES.to_string(),
                     downloads: DOWNLOADS.to_string() })
}

/// The reader's own highlights for one attachment, from Zotero ON THIS MACHINE.
///
/// This is the C1 narrowing the author ruled for (14 Sep 2026, docs/ANNOTATIONS-PLAN.md):
/// two programs the reader runs, conversing on their own computer — nothing leaves the
/// machine. The host and port are compiled in, the same rule as `open_fixed`: the only thing
/// the page may pass is the eight-character item key, validated to be exactly that, so this
/// command cannot be turned into a way to fetch anything else. It runs only when the reader
/// presses the button that asks (C3: nothing behind the reader's back).
#[tauri::command]
async fn zotero_annotations(key: String) -> Result<serde_json::Value, String> {
    if key.len() != 8 || !key.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) {
        return Err("not a Zotero item key".to_string());
    }
    // `?itemType=annotation` is load-bearing, not a filter for tidiness: measured on
    // Zotero 10.0.2, a bare `/children` answers the attachment's notes and files but NOT
    // its annotations — three marks in the database, zero in the reply — and only the
    // typed query returns them.
    let url =
        format!("http://127.0.0.1:23119/api/users/0/items/{key}/children?itemType=annotation");
    let resp = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?
        .get(&url)
        .send()
        .await
        .map_err(|_| {
            "Zotero is not answering on this machine. Is it running — and is 'Allow other \
             applications on this computer to communicate with Zotero' switched on in its \
             Settings ▸ Advanced?"
                .to_string()
        })?;
    if !resp.status().is_success() {
        return Err(format!("Zotero answered {}", resp.status()));
    }
    resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
}

/// Where the remembered local-API key lives — ONE file shared with the MCP's
/// `zotero_local.py` (its `key_path()` is the reference spelling), so a single
/// "Always Allow" in Zotero covers both drivers of the same machinery.
fn zotero_key_file() -> std::path::PathBuf {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        std::path::PathBuf::from(home)
            .join("Library/Application Support/Ipsissima/zotero-local-api-key")
    }
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var("APPDATA")
            .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_default());
        std::path::PathBuf::from(base).join("Ipsissima/zotero-local-api-key")
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let base = std::env::var("XDG_CONFIG_HOME").unwrap_or_else(|_| {
            format!("{}/.config", std::env::var("HOME").unwrap_or_default())
        });
        std::path::PathBuf::from(base).join("ipsissima/zotero-local-api-key")
    }
}

/// Ask Zotero to ask the user — the one consent flow both write commands share, so the two
/// cannot drift. Persists the key only on "Always Allow", exactly as `zotero_local.py` does.
async fn zotero_authorize(slow: &reqwest::Client, sid: &str) -> Result<String, String> {
    let r = slow.post("http://127.0.0.1:23119/api/local/authorize")
        .header("Zotero-Server-ID", sid)
        .json(&serde_json::json!({"appName": "Ipsissima"}))
        .send().await.map_err(|_| ZOTERO_NOT_RUNNING.to_string())?;
    match r.status().as_u16() {
        403 => Err("Zotero asked, and write access for Ipsissima was declined. Nothing \
                    was written. Try again to be asked again.".to_string()),
        429 => Err("Zotero is declining to show another permission dialog just now. Wait \
                    a minute and try again.".to_string()),
        200 => {
            let v: serde_json::Value = r.json().await.map_err(|e| e.to_string())?;
            let k = v["key"].as_str().unwrap_or_default().to_string();
            if v["remember"].as_bool().unwrap_or(false) {
                if let Some(dir) = zotero_key_file().parent() {
                    let _ = std::fs::create_dir_all(dir);
                }
                let _ = std::fs::write(zotero_key_file(), format!("{k}\n"));
            }
            Ok(k)
        }
        s => Err(format!("Zotero declined the authorization request ({s}).")),
    }
}

fn zotero_stored_key() -> Option<String> {
    std::fs::read_to_string(zotero_key_file())
        .ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

const ZOTERO_NOT_RUNNING: &str =
    "Zotero is not answering on this machine. Is it running — and is 'Allow other \
     applications on this computer to communicate with Zotero' switched on in its \
     Settings ▸ Advanced?";

/// Store the reconstruction in Zotero as ONE bundled attachment — the app-side driver of
/// the machinery `zotero_store.py` drives from the MCP (docs/ANNOTATIONS-PLAN.md §6).
///
/// THE SAME RULES AS `zotero_annotations` AND `open_fixed`: host and port compiled in, and
/// the page may pass only the eight-character attachment key, a bare filename, and the
/// bundle text itself. Consent is Zotero's own dialog (Allow / Always Allow / Deny, naming
/// Ipsissima; revocable in its Settings ▸ Advanced); a remembered key is reused from the
/// one file the MCP shares, a spent or revoked one is re-asked honestly, and nothing here
/// contacts anything but the Zotero on this machine (C1 as ruled 14 Sep).
#[tauri::command]
async fn zotero_store_bundle(key: String, filename: String, bundle: String)
                             -> Result<String, String> {
    if key.len() != 8 || !key.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) {
        return Err("not a Zotero item key".to_string());
    }
    if filename.is_empty() || filename.contains('/') || filename.contains('\\')
        || filename.len() > 120 {
        return Err("not a plain filename".to_string());
    }
    let base = "http://127.0.0.1:23119";
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    // The user may be reading a consent dialog: that one call gets all the time it needs.
    let slow = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;

    // The server id names the RUNNING Zotero and changes on restart: fetched, never stored.
    let sid = http.get(format!("{base}/api/"))
        .send().await.map_err(|_| ZOTERO_NOT_RUNNING.to_string())?
        .headers().get("Zotero-Server-ID")
        .and_then(|v| v.to_str().ok()).map(String::from)
        .ok_or_else(|| "This Zotero cannot accept local writes — writing through the \
                        local API needs Zotero 10 or later.".to_string())?;

    let item: serde_json::Value = {
        let r = http.get(format!("{base}/api/users/0/items/{key}"))
            .send().await.map_err(|_| ZOTERO_NOT_RUNNING.to_string())?;
        if r.status().as_u16() == 404 {
            return Err(format!("Zotero has no item with attachment key {key} — the \
                                source's front matter may be from another library."));
        }
        r.json().await.map_err(|e| e.to_string())?
    };
    let parent = item["data"]["parentItem"].as_str().map(String::from)
        .ok_or_else(|| format!("Attachment {key} has no parent item to hang the copy \
                                under — file it under an item in Zotero first; nothing \
                                was written."))?;

    let kids: serde_json::Value = http
        .get(format!("{base}/api/users/0/items/{parent}/children?limit=100"))
        .send().await.map_err(|_| ZOTERO_NOT_RUNNING.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let mut existing: Option<(String, String)> = None; // (item key, md5)
    if let Some(arr) = kids.as_array() {
        for k in arr {
            if k["data"]["itemType"] == "attachment" && k["data"]["filename"] == *filename {
                existing = Some((
                    k["data"]["key"].as_str().unwrap_or_default().to_string(),
                    k["data"]["md5"].as_str().unwrap_or_default().to_string(),
                ));
            }
        }
    }
    let bytes = bundle.into_bytes();
    let digest = format!("{:x}", md5::compute(&bytes));
    if let Some((_, ref old)) = existing {
        if *old == digest {
            return Ok(format!("current — the copy of {filename} in Zotero already \
                               matches this reconstruction."));
        }
    }

    // Consent: a remembered key from the shared file, else Zotero's own dialog; one honest
    // retry when a stored key turns out spent (single-use "Allow") or revoked.
    let mut api_key = zotero_stored_key();
    let authorize = || zotero_authorize(&slow, &sid);

    // One write, with the retry-once rule, shared by every write below.
    macro_rules! zwrite {
        ($build:expr) => {{
            if api_key.is_none() {
                api_key = Some(authorize().await?);
            }
            let mut resp = $build.header("Zotero-Server-ID", &sid)
                .header("Zotero-API-Key", api_key.clone().unwrap())
                .send().await.map_err(|_| ZOTERO_NOT_RUNNING.to_string())?;
            if matches!(resp.status().as_u16(), 401 | 403) {
                let _ = std::fs::remove_file(zotero_key_file());
                api_key = Some(authorize().await?);
                resp = $build.header("Zotero-Server-ID", &sid)
                    .header("Zotero-API-Key", api_key.clone().unwrap())
                    .send().await.map_err(|_| ZOTERO_NOT_RUNNING.to_string())?;
            }
            resp
        }};
    }

    let (att_key, made) = match existing.clone() {
        Some((k, _)) => (k, false),
        None => {
            let body = serde_json::json!([{
                "itemType": "attachment", "linkMode": "imported_file",
                "parentItem": parent, "title": filename,
                "filename": filename, "contentType": "text/plain", "charset": "utf-8"}]);
            let r = zwrite!(http.post(format!("{base}/api/users/0/items")).json(&body));
            if !r.status().is_success() {
                return Err(format!("Zotero declined the attachment write ({}).",
                                   r.status()));
            }
            let v: serde_json::Value = r.json().await.map_err(|e| e.to_string())?;
            let k = v["success"]["0"].as_str()
                .or_else(|| v["successful"]["0"]["key"].as_str())
                .ok_or("Zotero accepted the attachment but did not name its key")?
                .to_string();
            (k, true)
        }
    };

    // The three-phase upload, exactly as zotero_local.py speaks it.
    let cond: (&str, String) = match existing {
        Some((_, ref old)) if !old.is_empty() => ("If-Match", old.clone()),
        _ => ("If-None-Match", "*".to_string()),
    };
    let mtime = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    // reqwest's .form is not in this feature set; the encoding is four known-safe values
    // and a filename, percent-encoded by hand.
    let enc = |s: &str| s.bytes().map(|b| match b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' => (b as char).to_string(),
        _ => format!("%{b:02X}"),
    }).collect::<String>();
    let form = format!("md5={}&filename={}&filesize={}&mtime={}",
                       digest, enc(&filename), bytes.len(), mtime);
    let r = zwrite!(http.post(format!("{base}/api/users/0/items/{att_key}/file"))
        .header(cond.0, cond.1.clone())
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form.clone()));
    if r.status().as_u16() == 412 {
        return Err("Zotero holds a different version of this file than the one being \
                    replaced — something changed it since it was last stored. Nothing \
                    was overwritten; check the copy in Zotero, then try again.".to_string());
    }
    if !r.status().is_success() {
        return Err(format!("Zotero declined the upload announcement ({}).", r.status()));
    }
    let phase1: serde_json::Value = r.json().await.map_err(|e| e.to_string())?;
    if phase1["exists"].as_i64() == Some(1) {
        return Ok(format!("current — Zotero already holds these exact bytes of \
                           {filename}."));
    }
    let up_url = phase1["url"].as_str().unwrap_or_default();
    let up_path = up_url.strip_prefix(base).unwrap_or(up_url).to_string();
    let upload_key = phase1["uploadKey"].as_str()
        .map(String::from)
        .unwrap_or_else(|| up_path.trim_end_matches('/')
                                  .rsplit('/').next().unwrap_or_default().to_string());
    let r = zwrite!(http.post(format!("{base}{up_path}"))
        .header("Content-Type", "application/octet-stream").body(bytes.clone()));
    if !matches!(r.status().as_u16(), 200 | 201) {
        return Err(format!("Zotero declined the file bytes ({}).", r.status()));
    }
    let confirm = format!("upload={}", enc(&upload_key));
    let r = zwrite!(http.post(format!("{base}/api/users/0/items/{att_key}/file"))
        .header(cond.0, cond.1.clone())
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(confirm.clone()));
    if r.status().as_u16() != 204 {
        return Err(format!("Zotero declined the upload confirmation ({}).", r.status()));
    }
    Ok(format!("{} {filename} under the item its source belongs to. The copy travels \
                with Zotero's own sync from here; nothing else was contacted.",
               if made { "stored" } else { "refreshed" }))
}

/// Create ONE highlight annotation in Zotero, on the attachment the manuscript was
/// converted from — the write-back half of docs/ANNOTATIONS-PLAN.md's agreed scope.
///
/// The mark is created IN Zotero and nowhere else (E10: no second store; the pane re-reads
/// it back through `zotero_annotations` like any other mark). The page supplies what only
/// it knows — the selected words, the printed page, and the exact rectangles resolved from
/// the conversion's geometry sidecar, already in Zotero's own coordinate frame — and every
/// field is validated to be no more than that. Consent is the shared flow above.
#[tauri::command]
async fn zotero_create_highlight(key: String, text: String, page_label: String,
                                 page_index: u32, rects: Vec<[f64; 4]>, sort_top: u32)
                                 -> Result<String, String> {
    if key.len() != 8 || !key.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) {
        return Err("not a Zotero item key".to_string());
    }
    if text.trim().is_empty() || text.len() > 4000 {
        return Err("a highlight carries its words, at most a passage".to_string());
    }
    if page_label.len() > 20 || page_index > 9999 || sort_top > 99999 {
        return Err("not a page".to_string());
    }
    if rects.is_empty() || rects.len() > 100
        || rects.iter().flatten().any(|v| !v.is_finite() || *v < 0.0 || *v > 20000.0) {
        return Err("not a set of page rectangles".to_string());
    }
    let base = "http://127.0.0.1:23119";
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build().map_err(|e| e.to_string())?;
    let slow = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build().map_err(|e| e.to_string())?;
    let sid = http.get(format!("{base}/api/"))
        .send().await.map_err(|_| ZOTERO_NOT_RUNNING.to_string())?
        .headers().get("Zotero-Server-ID")
        .and_then(|v| v.to_str().ok()).map(String::from)
        .ok_or_else(|| "This Zotero cannot accept local writes — writing through the \
                        local API needs Zotero 10 or later.".to_string())?;

    let position = serde_json::json!({"pageIndex": page_index, "rects": rects}).to_string();
    let body = serde_json::json!([{
        "itemType": "annotation", "parentItem": key,
        "annotationType": "highlight", "annotationText": text,
        "annotationComment": "", "annotationColor": "#ffd400",
        "annotationPageLabel": page_label,
        "annotationSortIndex": format!("{page_index:05}|000000|{sort_top:05}"),
        "annotationPosition": position}]);

    let mut api_key = zotero_stored_key();
    for attempt in 0..2 {
        if api_key.is_none() {
            api_key = Some(zotero_authorize(&slow, &sid).await?);
        }
        let r = http.post(format!("{base}/api/users/0/items"))
            .header("Zotero-Server-ID", &sid)
            .header("Zotero-API-Key", api_key.clone().unwrap())
            .json(&body)
            .send().await.map_err(|_| ZOTERO_NOT_RUNNING.to_string())?;
        match r.status().as_u16() {
            401 | 403 if attempt == 0 => {
                let _ = std::fs::remove_file(zotero_key_file());
                api_key = None;
            }
            s if r.status().is_success() => {
                let v: serde_json::Value = r.json().await.map_err(|e| e.to_string())?;
                if !v["failed"].as_object().map(|m| m.is_empty()).unwrap_or(true) {
                    return Err(format!("Zotero rejected the highlight: {}",
                                       v["failed"].to_string()
                                        .chars().take(200).collect::<String>()));
                }
                let _ = s;
                return Ok(format!("highlighted in Zotero, on p. {page_label} of the PDF \
                                   itself — open it there and the mark is where these \
                                   words are printed."));
            }
            s => return Err(format!("Zotero declined the highlight ({s}).")),
        }
    }
    Err("Zotero did not accept the authorization.".to_string())
}

/// One of two fixed pages, in the reader's own browser.
///
/// NO ARGUMENT ON EITHER COMMAND, DELIBERATELY. Each address is a constant compiled into the
/// binary, so there is nothing for the page to pass and nothing to validate: a command that
/// took a URL from the frontend would be a way to make this application open anything at all,
/// which is a large door to leave open for the sake of saving one line. The update dialog
/// offers the choice — the download page that walks through the install, or the release on
/// GitHub for what changed — and each choice is its own doorbell.
fn open_fixed(url: &'static str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut cmd = { let mut c = std::process::Command::new("open"); c.arg(url); c };
    #[cfg(target_os = "windows")]
    let mut cmd = {
        // `start` is a shell builtin rather than a program, so it needs cmd, and the empty
        // string is the window title `start` would otherwise take the URL to be.
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", "start", "", url]);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut cmd = { let mut c = std::process::Command::new("xdg-open"); c.arg(url); c };

    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("could not open a browser: {e}"))
}

#[tauri::command]
fn open_releases_page() -> Result<(), String> { open_fixed(RELEASES) }

#[tauri::command]
fn open_download_page() -> Result<(), String> { open_fixed(DOWNLOADS) }

/// Is `a` a later version than `b`? Numeric, component by component.
fn is_newer(a: &str, b: &str) -> bool {
    let parts = |v: &str| -> Vec<u64> {
        v.split('-')
            .next()
            .unwrap_or("")
            .split('.')
            .map(|n| n.parse().unwrap_or(0))
            .collect()
    };
    let (x, y) = (parts(a), parts(b));
    for i in 0..x.len().max(y.len()) {
        let (p, q) = (x.get(i).copied().unwrap_or(0), y.get(i).copied().unwrap_or(0));
        if p != q {
            return p > q;
        }
    }
    false
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
        .invoke_handler(tauri::generate_handler![take_pending_open, check_for_updates, open_releases_page, open_download_page, zotero_annotations, zotero_store_bundle, zotero_create_highlight])
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


#[cfg(test)]
mod tests {
    use super::is_newer;

    /// THE CASE THAT MAKES THIS A FUNCTION RATHER THAN A `>`. As text, "0.10.0" sorts BEFORE
    /// "0.9.0", so a tenth release would have told everybody they were already up to date --
    /// silently, and only once, months from now, when nobody would connect the two.
    #[test]
    fn ten_is_after_nine() {
        assert!(is_newer("0.10.0", "0.9.0"));
        assert!(!is_newer("0.9.0", "0.10.0"));
        assert!(is_newer("1.0.0", "0.99.99"));
    }

    #[test]
    fn same_version_is_not_newer() {
        assert!(!is_newer("0.1.0", "0.1.0"));
        assert!(!is_newer("1.2.3", "1.2.3"));
    }

    #[test]
    fn each_component_counts() {
        assert!(is_newer("0.1.1", "0.1.0"));
        assert!(is_newer("0.2.0", "0.1.9"));
        assert!(!is_newer("0.1.0", "0.2.0"));
    }

    /// Missing components are zeroes, not failures: a tag of "1.1" against "1.1.0" is the same
    /// release, and must not announce itself as an update every time the reader checks.
    #[test]
    fn short_versions_are_padded() {
        assert!(!is_newer("1.1", "1.1.0"));
        assert!(is_newer("1.2", "1.1.9"));
    }

    /// Anything unparseable counts as "not newer". Being told nothing is better than being sent
    /// to a download page for a release that does not exist.
    #[test]
    fn nonsense_is_not_newer() {
        assert!(!is_newer("", "0.1.0"));
        assert!(!is_newer("banana", "0.1.0"));
    }

    /// A pre-release tag is dropped before comparing, so "0.2.0-beta.1" reads as 0.2.0.
    #[test]
    fn prerelease_suffix_is_ignored() {
        assert!(is_newer("0.2.0-beta.1", "0.1.0"));
        assert!(!is_newer("0.1.0-rc1", "0.1.0"));
    }
}
