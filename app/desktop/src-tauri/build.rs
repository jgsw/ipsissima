//! REBUILD WHEN THE FRONTEND CHANGES, which cargo does not work out for itself.
//!
//! The whole application is `../dist/index.html`, embedded into the binary by
//! `tauri::generate_context!()` at macro-expansion time. Cargo tracks Rust sources and
//! `tauri.conf.json`; it does not track that file. So editing the Argdown template, rebuilding
//! the page, and running `tauri build` produces an app containing the PREVIOUS frontend — the
//! build reports success, the app opens, and it is silently the old one. That cost an hour here
//! before it was noticed, and it would cost it again on every frontend-only change.
fn main() {
    println!("cargo:rerun-if-changed=../dist/index.html");
    tauri_build::build()
}
