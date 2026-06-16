mod clipboard;
mod commands;
mod db;
mod models;

use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let alt_v = Shortcut::new(Some(Modifiers::ALT), Code::KeyV);
                        if *shortcut == alt_v {
                            toggle_window(app);
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // --- Database ---
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("clippalette.db");

            let conn = db::open_db(db_path.to_str().unwrap())
                .expect("failed to open database");
            db::init_schema(&conn).expect("failed to initialize schema");

            let db: db::DbConn = Arc::new(Mutex::new(conn));
            app.manage(db.clone());

            // --- Clipboard monitor ---
            clipboard::start(app.handle().clone(), db);

            // --- System tray ---
            let show_item = MenuItem::with_id(app, "show", "Show ClipPalette", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("ClipPalette")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // --- Global shortcut (Alt+V) ---
            let alt_v = Shortcut::new(Some(Modifiers::ALT), Code::KeyV);
            app.global_shortcut().register(alt_v)?;

            // --- Close-to-hide behavior ---
            let window = app.get_webview_window("main").unwrap();
            window.on_window_event({
                let win = window.clone();
                move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                }
            });

            // On autostart, keep window hidden; otherwise show on first launch
            #[cfg(not(debug_assertions))]
            {
                use tauri_plugin_autostart::ManagerExt;
                let autolaunch = app.autolaunch();
                if !autolaunch.is_enabled().unwrap_or(false) {
                    let _ = autolaunch.enable();
                }

                let args: Vec<String> = std::env::args().collect();
                if !args.contains(&"--autostart".to_string()) {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            #[cfg(debug_assertions)]
            {
                let _ = window.show();
                let _ = window.set_focus();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_clips,
            commands::delete_clip,
            commands::toggle_pin,
            commands::toggle_sensitive,
            commands::update_tags,
            commands::update_ogp,
            commands::fetch_ogp,
            commands::get_snippets,
            commands::upsert_snippet,
            commands::delete_snippet,
            commands::get_setting,
            commands::set_setting,
            commands::write_to_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
            let _ = win.center();
        }
    }
}
