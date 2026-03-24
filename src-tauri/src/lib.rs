use tauri::{Emitter, Manager};

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
    menu_sync_file: String,
    menu_mark_sync: String,
}

fn build_menu(app: &tauri::AppHandle) -> tauri::menu::Menu<tauri::Wry> {
    build_menu_with_labels(app, &default_labels())
}

fn build_menu_with_labels(app: &tauri::AppHandle, labels: &MenuLabels) -> tauri::menu::Menu<tauri::Wry> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

    let file_menu = SubmenuBuilder::new(app, &labels.menu_file)
        .item(&MenuItemBuilder::with_id("new", &labels.menu_new).accelerator("CmdOrCtrl+N").build(app).unwrap())
        .item(&MenuItemBuilder::with_id("open", &labels.menu_open).accelerator("CmdOrCtrl+O").build(app).unwrap())
        .item(&MenuItemBuilder::with_id("open-folder", &labels.menu_open_folder).build(app).unwrap())
        .separator()
        .item(&MenuItemBuilder::with_id("save", &labels.menu_save).accelerator("CmdOrCtrl+S").build(app).unwrap())
        .item(&MenuItemBuilder::with_id("save-as", &labels.menu_save_as).accelerator("CmdOrCtrl+Shift+S").build(app).unwrap())
        .separator()
        .item(&MenuItemBuilder::with_id("export-html", &labels.menu_export_html).build(app).unwrap())
        .separator()
        .item(&MenuItemBuilder::with_id("sync-file", &labels.menu_sync_file).build(app).unwrap())
        .item(&MenuItemBuilder::with_id("mark-sync", &labels.menu_mark_sync).build(app).unwrap())
        .separator()
        .item(&PredefinedMenuItem::quit(app, None).unwrap())
        .build().unwrap();

    let edit_menu = SubmenuBuilder::new(app, &labels.menu_edit)
        .item(&MenuItemBuilder::with_id("undo", &labels.menu_undo).accelerator("CmdOrCtrl+Z").build(app).unwrap())
        .item(&MenuItemBuilder::with_id("redo", &labels.menu_redo).accelerator("CmdOrCtrl+Shift+Z").build(app).unwrap())
        .separator()
        .item(&PredefinedMenuItem::cut(app, None).unwrap())
        .item(&PredefinedMenuItem::copy(app, None).unwrap())
        .item(&PredefinedMenuItem::paste(app, None).unwrap())
        .item(&PredefinedMenuItem::select_all(app, None).unwrap())
        .separator()
        .item(&MenuItemBuilder::with_id("find", &labels.menu_find).accelerator("CmdOrCtrl+F").build(app).unwrap())
        .item(&MenuItemBuilder::with_id("find-replace", &labels.menu_find_replace).accelerator("CmdOrCtrl+H").build(app).unwrap())
        .build().unwrap();

    let lang_submenu = SubmenuBuilder::new(app, "Language / 语言")
        .item(&MenuItemBuilder::with_id("lang-en", "English").build(app).unwrap())
        .item(&MenuItemBuilder::with_id("lang-zh", "中文").build(app).unwrap())
        .build().unwrap();

    let view_menu = SubmenuBuilder::new(app, &labels.menu_view)
        .item(&MenuItemBuilder::with_id("toggle-sidebar", &labels.menu_toggle_sidebar).accelerator("CmdOrCtrl+\\").build(app).unwrap())
        .item(&MenuItemBuilder::with_id("toggle-theme", &labels.menu_toggle_theme).accelerator("CmdOrCtrl+/").build(app).unwrap())
        .separator()
        .item(&MenuItemBuilder::with_id("toggle-fullscreen", &labels.menu_toggle_fullscreen).accelerator("F11").build(app).unwrap())
        .separator()
        .item(&lang_submenu)
        .separator()
        .item(&MenuItemBuilder::with_id("settings", &labels.menu_settings).accelerator("CmdOrCtrl+,").build(app).unwrap())
        .build().unwrap();

    let help_menu = SubmenuBuilder::new(app, &labels.menu_help)
        .item(&MenuItemBuilder::with_id("about", &labels.menu_about).build(app).unwrap())
        .build().unwrap();

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build().unwrap()
}

#[tauri::command]
fn update_menu(app: tauri::AppHandle, labels: MenuLabels) -> Result<(), String> {
    eprintln!("[menu] update_menu called, file={}", labels.menu_file);
    let menu = build_menu_with_labels(&app, &labels);

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
        menu_sync_file: "Sync Current File".into(),
        menu_mark_sync: "Mark for Sync".into(),
    }
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn is_markdown_file(path: &str) -> bool {
    path.ends_with(".md") || path.ends_with(".markdown")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // When another instance is launched with a file path, forward to the existing window
            for arg in args.iter().skip(1) {
                if is_markdown_file(arg) {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("open-file", arg.to_string());
                        let _ = window.set_focus();
                    }
                    break;
                }
            }
        }))
        .invoke_handler(tauri::generate_handler![update_menu, open_url])
        .setup(|app| {
            let menu = build_menu(&app.handle());
            app.set_menu(menu)?;

            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    use tauri::TitleBarStyle;
                    let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
                    let _ = window.set_title("");
                }
            }

            // Check CLI args for a file to open (file association / right-click open)
            let args: Vec<String> = std::env::args().collect();
            for arg in args.iter().skip(1) {
                if is_markdown_file(arg) {
                    let path = arg.clone();
                    if let Some(window) = app.get_webview_window("main") {
                        let window_clone = window.clone();
                        // Emit after frontend is ready
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(800));
                            let _ = window_clone.emit("open-file", path);
                        });
                    }
                    break;
                }
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id: &str = event.id().as_ref();
            if let Some(window) = app.get_webview_window("main") {
                let event_name = format!("menu-{}", id);
                let _ = window.emit(&event_name, ());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
