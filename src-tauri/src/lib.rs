mod doc_registry;
mod reveal;

use doc_registry::DocRegistry;
use tauri::{Emitter, Manager};
use std::fs;
use std::sync::Mutex;

struct PendingFile(Mutex<Option<String>>);

const MENU_NEW: &str = "menu-new";
const MENU_OPEN: &str = "menu-open";
const MENU_OPEN_FOLDER: &str = "menu-open-folder";
const MENU_REVEAL_FILE: &str = "menu-reveal-file";
const MENU_SAVE: &str = "menu-save";
const MENU_SAVE_AS: &str = "menu-save-as";
const MENU_EXPORT_HTML: &str = "menu-export-html";
const MENU_UNDO: &str = "menu-undo";
const MENU_REDO: &str = "menu-redo";
const MENU_FIND: &str = "menu-find";
const MENU_FIND_REPLACE: &str = "menu-find-replace";
const MENU_IMAGE_STORAGE_BASE64: &str = "menu-image-storage-base64";
const MENU_IMAGE_STORAGE_LOCAL: &str = "menu-image-storage-local";
const MENU_IMAGE_STORAGE_URL: &str = "menu-image-storage-url";
const MENU_SYNC_FILE: &str = "menu-sync-file";
const MENU_MARK_SYNC: &str = "menu-mark-sync";
const MENU_TOGGLE_SIDEBAR: &str = "menu-toggle-sidebar";
const MENU_TOGGLE_THEME: &str = "menu-toggle-theme";
const MENU_TOGGLE_FULLSCREEN: &str = "menu-toggle-fullscreen";
const MENU_LANG_EN: &str = "menu-lang-en";
const MENU_LANG_ZH: &str = "menu-lang-zh";
const MENU_SETTINGS: &str = "menu-settings";
const MENU_ABOUT: &str = "menu-about";

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MenuLabels {
    menu_file: String,
    menu_edit: String,
    menu_view: String,
    menu_help: String,
    menu_new: String,
    menu_open: String,
    menu_open_folder: String,
    menu_reveal_file: String,
    menu_save: String,
    menu_save_as: String,
    menu_export_html: String,
    menu_toggle_sidebar: String,
    menu_toggle_theme: String,
    menu_toggle_fullscreen: String,
    menu_settings: String,
    menu_about: String,
    menu_undo: String,
    menu_redo: String,
    menu_find: String,
    menu_find_replace: String,
    menu_image_storage: String,
    menu_image_base64: String,
    menu_image_local: String,
    menu_image_url: String,
    menu_sync_file: String,
    menu_mark_sync: String,
}

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    build_menu_with_labels(app, &default_labels(), "local")
}

fn build_menu_with_labels(
    app: &tauri::AppHandle,
    labels: &MenuLabels,
    image_storage_mode: &str,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{
        CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
    };

    let file_menu = SubmenuBuilder::new(app, &labels.menu_file)
        .item(&MenuItemBuilder::with_id("new", &labels.menu_new).accelerator("CmdOrCtrl+N").build(app)?)
        .item(&MenuItemBuilder::with_id("open", &labels.menu_open).accelerator("CmdOrCtrl+O").build(app)?)
        .item(&MenuItemBuilder::with_id("open-folder", &labels.menu_open_folder).build(app)?)
        .item(&MenuItemBuilder::with_id("reveal-file", &labels.menu_reveal_file).build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("save", &labels.menu_save).accelerator("CmdOrCtrl+S").build(app)?)
        .item(&MenuItemBuilder::with_id("save-as", &labels.menu_save_as).accelerator("CmdOrCtrl+Shift+S").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("export-html", &labels.menu_export_html).build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("sync-file", &labels.menu_sync_file).build(app)?)
        .item(&MenuItemBuilder::with_id("mark-sync", &labels.menu_mark_sync).build(app)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let image_storage_menu = SubmenuBuilder::new(app, &labels.menu_image_storage)
        .item(
            &CheckMenuItemBuilder::with_id("image-storage-base64", &labels.menu_image_base64)
                .checked(image_storage_mode == "base64")
                .build(app)?,
        )
        .item(
            &CheckMenuItemBuilder::with_id("image-storage-local", &labels.menu_image_local)
                .checked(image_storage_mode == "local")
                .build(app)?,
        )
        .item(
            &CheckMenuItemBuilder::with_id("image-storage-url", &labels.menu_image_url)
                .checked(image_storage_mode == "url")
                .build(app)?,
        )
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, &labels.menu_edit)
        .item(&MenuItemBuilder::with_id("undo", &labels.menu_undo).accelerator("CmdOrCtrl+Z").build(app)?)
        .item(&MenuItemBuilder::with_id("redo", &labels.menu_redo).accelerator("CmdOrCtrl+Shift+Z").build(app)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(&image_storage_menu)
        .separator()
        .item(&MenuItemBuilder::with_id("find", &labels.menu_find).accelerator("CmdOrCtrl+F").build(app)?)
        .item(&MenuItemBuilder::with_id("find-replace", &labels.menu_find_replace).accelerator("CmdOrCtrl+H").build(app)?)
        .build()?;

    let lang_submenu = SubmenuBuilder::new(app, "Language / 语言")
        .item(&MenuItemBuilder::with_id("lang-en", "English").build(app)?)
        .item(&MenuItemBuilder::with_id("lang-zh", "中文").build(app)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, &labels.menu_view)
        .item(&MenuItemBuilder::with_id("toggle-sidebar", &labels.menu_toggle_sidebar).accelerator("CmdOrCtrl+\\").build(app)?)
        .item(&MenuItemBuilder::with_id("toggle-theme", &labels.menu_toggle_theme).accelerator("CmdOrCtrl+/").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("toggle-fullscreen", &labels.menu_toggle_fullscreen).accelerator("F11").build(app)?)
        .separator()
        .item(&lang_submenu)
        .separator()
        .item(&MenuItemBuilder::with_id("settings", &labels.menu_settings).accelerator("CmdOrCtrl+,").build(app)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, &labels.menu_help)
        .item(&MenuItemBuilder::with_id("about", &labels.menu_about).build(app)?)
        .build()?;

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()
}

#[tauri::command]
fn update_menu(
    app: tauri::AppHandle,
    labels: MenuLabels,
    image_storage_mode: String,
) -> Result<(), String> {
    eprintln!("[menu] update_menu called, file={}", labels.menu_file);
    let menu = build_menu_with_labels(&app, &labels, &image_storage_mode)
        .map_err(|e| e.to_string())?;

    // Try window first, then app
    if let Some(window) = app.get_webview_window("main") {
        eprintln!("[menu] setting menu on window");
        window.set_menu(menu).map_err(|e| {
            eprintln!("[menu] window.set_menu error: {}", e);
            e.to_string()
        })?;
    } else {
        eprintln!("[menu] no window found, setting on app");
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
    eprintln!("[menu] update_menu done");
    Ok(())
}

fn default_labels() -> MenuLabels {
    MenuLabels {
        menu_file: "File".into(),
        menu_edit: "Edit".into(),
        menu_view: "View".into(),
        menu_help: "Help".into(),
        menu_new: "New".into(),
        menu_open: "Open...".into(),
        menu_open_folder: "Open Folder...".into(),
        menu_reveal_file: "Show in File Manager".into(),
        menu_save: "Save".into(),
        menu_save_as: "Save As...".into(),
        menu_export_html: "Export HTML".into(),
        menu_toggle_sidebar: "Toggle Sidebar".into(),
        menu_toggle_theme: "Toggle Theme".into(),
        menu_toggle_fullscreen: "Toggle Fullscreen".into(),
        menu_settings: "Settings...".into(),
        menu_about: "About".into(),
        menu_undo: "Undo".into(),
        menu_redo: "Redo".into(),
        menu_find: "Find...".into(),
        menu_find_replace: "Find and Replace...".into(),
        menu_image_storage: "Image Storage".into(),
        menu_image_base64: "Embed as Base64".into(),
        menu_image_local: "Local Asset Files".into(),
        menu_image_url: "Online URLs".into(),
        menu_sync_file: "Sync Current File".into(),
        menu_mark_sync: "Mark for Sync".into(),
    }
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
fn take_pending_file(state: tauri::State<'_, PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

/// Clear WebView cache when app version changes to prevent stale frontend resources.
fn clear_webview_cache_on_upgrade(app: &tauri::App) {
    let data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return,
    };

    let version = app.config().version.clone().unwrap_or_default();
    let version_file = data_dir.join(".cache_version");

    // Read previously cached version
    let prev_version = fs::read_to_string(&version_file).unwrap_or_default();

    if prev_version.trim() == version {
        return; // Same version, no need to clear cache
    }

    eprintln!("[cache] Version changed: {:?} -> {}, clearing WebView cache", prev_version.trim(), version);

    // Remove WebView cache directories
    for dir_name in &["WebKitCache", "CacheStorage"] {
        let cache_dir = data_dir.join(dir_name);
        if cache_dir.exists() {
            if let Err(e) = fs::remove_dir_all(&cache_dir) {
                eprintln!("[cache] Failed to remove {}: {}", dir_name, e);
            }
        }
    }

    // Save current version
    let _ = fs::create_dir_all(&data_dir);
    let _ = fs::write(&version_file, &version);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn is_markdown_file(path: &str) -> bool {
    path.ends_with(".md") || path.ends_with(".markdown")
}

fn is_safe_path(path: &str) -> bool {
    let p = std::path::Path::new(path);
    p.is_absolute()
        && !path.contains('\0')
        && !p.components().any(|c| matches!(c, std::path::Component::ParentDir))
        && p.exists()
}

fn is_openable_path(path: &str) -> bool {
    if !is_safe_path(path) {
        return false;
    }
    let p = std::path::Path::new(path);
    is_markdown_file(path) || p.is_dir()
}

fn menu_event_name(id: &str) -> Option<&'static str> {
    match id {
        "new" => Some(MENU_NEW),
        "open" => Some(MENU_OPEN),
        "open-folder" => Some(MENU_OPEN_FOLDER),
        "reveal-file" => Some(MENU_REVEAL_FILE),
        "save" => Some(MENU_SAVE),
        "save-as" => Some(MENU_SAVE_AS),
        "export-html" => Some(MENU_EXPORT_HTML),
        "undo" => Some(MENU_UNDO),
        "redo" => Some(MENU_REDO),
        "find" => Some(MENU_FIND),
        "find-replace" => Some(MENU_FIND_REPLACE),
        "image-storage-base64" => Some(MENU_IMAGE_STORAGE_BASE64),
        "image-storage-local" => Some(MENU_IMAGE_STORAGE_LOCAL),
        "image-storage-url" => Some(MENU_IMAGE_STORAGE_URL),
        "sync-file" => Some(MENU_SYNC_FILE),
        "mark-sync" => Some(MENU_MARK_SYNC),
        "toggle-sidebar" => Some(MENU_TOGGLE_SIDEBAR),
        "toggle-theme" => Some(MENU_TOGGLE_THEME),
        "toggle-fullscreen" => Some(MENU_TOGGLE_FULLSCREEN),
        "lang-en" => Some(MENU_LANG_EN),
        "lang-zh" => Some(MENU_LANG_ZH),
        "settings" => Some(MENU_SETTINGS),
        "about" => Some(MENU_ABOUT),
        _ => None,
    }
}

/// First openable path on the command line, if any.
fn cli_openable_path() -> Option<String> {
    std::env::args().skip(1).find(|arg| is_openable_path(arg))
}

pub fn run() {
    // Before anything is built: if this launch is about a markdown file that a
    // live instance already has open, hand it over and quit. Doing it here (not
    // in `setup`) means no window is ever created, so nothing flashes on screen.
    let cli_path = cli_openable_path();
    if let Some(path) = cli_path.as_deref() {
        if is_markdown_file(path) && doc_registry::forward_to_owner(path) {
            eprintln!("[doc-registry] {path} is open in another window; handed off");
            std::process::exit(0);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            update_menu,
            open_url,
            take_pending_file,
            doc_registry::claim_document,
            doc_registry::release_document,
            doc_registry::focus_document_owner,
            reveal::reveal_in_file_manager
        ])
        .setup(move |app| {
            // Clear stale WebView cache after version upgrade
            clear_webview_cache_on_upgrade(app);

            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;

            // Initialize pending file state
            app.manage(PendingFile(Mutex::new(None)));

            // Announce this instance so others can hand documents to it. Port 0
            // means the listener could not bind; ownership then degrades to
            // "everyone opens everything", which is the pre-existing behaviour.
            let port = doc_registry::start_listener(app.handle().clone()).unwrap_or(0);
            app.manage(DocRegistry { port });

            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    use tauri::TitleBarStyle;
                    let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
                    let _ = window.set_title("");
                }
            }

            // A file or folder to open was passed on the command line. The
            // early-exit check above already established that no other instance
            // owns it, so claim it right now — waiting for the frontend to do
            // it leaves a window where a second launch could slip past.
            if let Some(path) = cli_path.clone() {
                if is_markdown_file(&path) {
                    let _ = doc_registry::claim(port, &path);
                }
                *app.state::<PendingFile>().0.lock().unwrap() = Some(path);
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id: &str = event.id().as_ref();
            if let Some(window) = app.get_webview_window("main") {
                if let Some(event_name) = menu_event_name(id) {
                    let _ = window.emit(event_name, ());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // Handle macOS file open events (double-click / Open With)
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = &_event {
                for url in urls {
                    let path = url.to_file_path()
                        .map(|p: std::path::PathBuf| p.to_string_lossy().to_string())
                        .unwrap_or_else(|_| url.to_string());
                    if is_markdown_file(&path) {
                        let self_port = _app.try_state::<DocRegistry>().map(|s| s.port);
                        // Already open in another window? Send it there instead
                        // of loading a second, independently auto-saving copy.
                        if let Some(self_port) = self_port {
                            if doc_registry::focus_owner(self_port, &path) {
                                break;
                            }
                        }
                        if let Some(window) = _app.get_webview_window("main") {
                            let _ = window.emit("open-file", path.clone());
                            let _ = window.set_focus();
                        }
                        if let Some(state) = _app.try_state::<PendingFile>() {
                            *state.0.lock().unwrap() = Some(path);
                        }
                        break;
                    }
                }
            }

            // Leave no record behind for the next launch to probe.
            if let tauri::RunEvent::Exit = &_event {
                if let Some(state) = _app.try_state::<DocRegistry>() {
                    doc_registry::unregister(state.port);
                }
            }
        });
}
