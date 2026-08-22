// Prevents a console window appearing alongside the app on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ipsissima_lib::run()
}
