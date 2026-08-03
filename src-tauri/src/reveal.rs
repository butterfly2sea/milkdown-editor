//! "Show in file manager" for the current document.
//!
//! Every desktop has its own way of opening a folder *with a file selected*,
//! and none of them is a plain "open this directory" call. Each platform gets
//! its native incantation here; if that fails for any reason we still fall back
//! to opening the containing folder, which is the part the user actually asked
//! for.

use std::path::Path;
use std::process::Command;

#[tauri::command(async)]
pub fn reveal_in_file_manager(path: String) -> Result<(), String> {
    // The path comes from the frontend's "current file" state, but validate it
    // anyway rather than handing arbitrary strings to a process spawn.
    if !crate::is_safe_path(&path) {
        return Err(format!("not a valid path: {path}"));
    }
    let target = Path::new(&path);

    if reveal(target) {
        return Ok(());
    }

    let folder = if target.is_dir() {
        target
    } else {
        target.parent().ok_or_else(|| "no parent folder".to_string())?
    };
    open::that(folder).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn reveal(target: &Path) -> bool {
    // Explorer wants `/select,<path>` as a single argument, and it exits with a
    // non-zero status even on success — so only the spawn itself is checked.
    Command::new("explorer")
        .arg(format!("/select,{}", target.display()))
        .spawn()
        .is_ok()
}

#[cfg(target_os = "macos")]
fn reveal(target: &Path) -> bool {
    Command::new("open").arg("-R").arg(target).spawn().is_ok()
}

#[cfg(all(unix, not(target_os = "macos")))]
fn reveal(target: &Path) -> bool {
    // The freedesktop.org interface every major Linux file manager implements.
    // `gdbus` ships with glib, which is already pulled in by GTK/WebKit.
    Command::new("gdbus")
        .args([
            "call",
            "--session",
            "--dest",
            "org.freedesktop.FileManager1",
            "--object-path",
            "/org/freedesktop/FileManager1",
            "--method",
            "org.freedesktop.FileManager1.ShowItems",
        ])
        .arg(format!("['{}']", file_uri(target)))
        .arg("")
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// Percent-encode a path into a `file://` URI. Keeps the result free of quotes
/// and spaces, so it can be embedded in the D-Bus array literal above.
#[cfg(all(unix, not(target_os = "macos")))]
fn file_uri(target: &Path) -> String {
    let mut uri = String::from("file://");
    for byte in target.to_string_lossy().bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' => {
                uri.push(byte as char)
            }
            _ => uri.push_str(&format!("%{byte:02X}")),
        }
    }
    uri
}
