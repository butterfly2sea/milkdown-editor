//! Cross-process registry of which running instance owns which document.
//!
//! Several windows/processes are allowed at once, but the same file must never
//! be editable in two of them: both sides auto-save, so they would silently
//! overwrite each other. Each instance publishes a small record (pid, IPC port,
//! owned documents) into a shared JSON file. Opening a document that another
//! *live* instance already owns forwards a command to that instance over
//! loopback TCP and focuses its window instead of opening a second copy.
//!
//! The registry lives in the OS temp dir rather than the app data dir because
//! it has to be readable before `tauri::App` exists — the CLI early-exit check
//! runs before the builder, so no window ever flashes for a forwarded file.
//! Getting wiped on reboot is a bonus: stale records cannot outlive a crash by
//! more than one boot, and liveness probing handles them within a boot anyway.

use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

/// How long to wait for a loopback connect/write before declaring an instance
/// dead. Generous enough for a busy machine, short enough not to stall opening.
const IPC_TIMEOUT: Duration = Duration::from_millis(300);
/// A lock file older than this belonged to a process that died holding it.
const LOCK_STALE_AFTER: Duration = Duration::from_secs(5);
/// Reply a listener writes back once it has acted on a command.
const IPC_ACK: &str = "ok";

#[derive(Serialize, Deserialize, Default)]
struct Registry {
    instances: Vec<Instance>,
}

#[derive(Serialize, Deserialize)]
struct Instance {
    pid: u32,
    port: u16,
    docs: Vec<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "lowercase")]
enum IpcCommand {
    /// Bring the owning window to the front.
    Focus,
    /// Bring the owning window to the front and open `path` in it.
    Open { path: String },
}

/// Result of trying to take ownership of a document.
pub enum ClaimOutcome {
    Claimed,
    /// Another live instance owns it; the payload is its IPC port.
    Busy(u16),
}

/// Managed Tauri state: this instance's own IPC port.
pub struct DocRegistry {
    pub port: u16,
}

// -- paths ------------------------------------------------------------------

fn registry_path() -> PathBuf {
    // Namespaced per user: /tmp is shared on Linux, and a file owned by another
    // user would be unwritable.
    let user = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "default".to_string());
    let safe: String = user
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    std::env::temp_dir().join(format!("milkdown-editor-open-docs-{safe}.json"))
}

fn lock_path() -> PathBuf {
    registry_path().with_extension("lock")
}

/// Resolve a path to the form used as the registry key, so that `./a.md`, a
/// symlink and an absolute path all name the same document.
pub fn normalize(path: &str) -> String {
    let candidate = Path::new(path);
    let resolved = fs::canonicalize(candidate).unwrap_or_else(|_| candidate.to_path_buf());
    let text = resolved.to_string_lossy().to_string();
    // Windows canonicalization yields the `\\?\` verbatim prefix, which paths
    // coming from the frontend never have.
    text.strip_prefix(r"\\?\")
        .map(str::to_string)
        .unwrap_or(text)
}

// -- registry file access ---------------------------------------------------

/// Best-effort inter-process lock. If it cannot be acquired we proceed anyway:
/// a momentarily inconsistent registry is far better than a hung launch.
struct FileLock {
    path: PathBuf,
    held: bool,
}

impl FileLock {
    fn acquire() -> Self {
        let path = lock_path();
        for _ in 0..100 {
            match OpenOptions::new().create_new(true).write(true).open(&path) {
                Ok(_) => return FileLock { path, held: true },
                Err(_) => {
                    if let Ok(modified) = fs::metadata(&path).and_then(|m| m.modified()) {
                        let stale = modified
                            .elapsed()
                            .map(|age| age > LOCK_STALE_AFTER)
                            .unwrap_or(false);
                        if stale {
                            let _ = fs::remove_file(&path);
                            continue;
                        }
                    }
                    std::thread::sleep(Duration::from_millis(20));
                }
            }
        }
        FileLock { path, held: false }
    }
}

impl Drop for FileLock {
    fn drop(&mut self) {
        if self.held {
            let _ = fs::remove_file(&self.path);
        }
    }
}

fn read_registry() -> Registry {
    fs::read_to_string(registry_path())
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write_registry(registry: &Registry) {
    let Ok(text) = serde_json::to_string(registry) else {
        return;
    };
    let path = registry_path();
    let tmp = path.with_extension("json.tmp");
    // Write-then-rename so a reader never sees a half-written file.
    if fs::write(&tmp, text).is_ok() && fs::rename(&tmp, &path).is_err() {
        let _ = fs::remove_file(&tmp);
    }
}

/// Run `f` against the registry under the file lock, persisting the result.
fn with_registry<T>(f: impl FnOnce(&mut Registry) -> T) -> T {
    let _lock = FileLock::acquire();
    let mut registry = read_registry();
    let result = f(&mut registry);
    write_registry(&registry);
    result
}

// -- loopback IPC -----------------------------------------------------------

fn addr_of(port: u16) -> SocketAddr {
    SocketAddr::from((Ipv4Addr::LOCALHOST, port))
}

/// An instance is alive if its listener still accepts connections. Connecting
/// and closing without writing is the probe; the listener ignores empty lines.
fn is_alive(port: u16) -> bool {
    TcpStream::connect_timeout(&addr_of(port), IPC_TIMEOUT).is_ok()
}

/// Send `command` and wait for the acknowledgement. A bare successful write is
/// not proof of delivery: ephemeral ports get recycled, so an unrelated process
/// on a stale port would accept the bytes and the caller would wrongly conclude
/// another instance took the document — leaving the file unopened.
fn send_command(port: u16, command: &IpcCommand) -> bool {
    let Ok(payload) = serde_json::to_string(command) else {
        return false;
    };
    let Ok(mut stream) = TcpStream::connect_timeout(&addr_of(port), IPC_TIMEOUT) else {
        return false;
    };
    let _ = stream.set_write_timeout(Some(IPC_TIMEOUT));
    let _ = stream.set_read_timeout(Some(IPC_TIMEOUT));
    if stream.write_all(payload.as_bytes()).is_err() || stream.write_all(b"\n").is_err() {
        return false;
    }
    let mut reply = String::new();
    BufReader::new(&stream).read_line(&mut reply).is_ok() && reply.trim() == IPC_ACK
}

/// Drop records whose process is gone. `self_port` is never probed — this
/// instance's own listener may not be up yet during startup.
fn prune(registry: &mut Registry, self_port: Option<u16>) {
    registry
        .instances
        .retain(|instance| Some(instance.port) == self_port || is_alive(instance.port));
}

fn owner_port(registry: &Registry, path: &str, self_port: Option<u16>) -> Option<u16> {
    registry
        .instances
        .iter()
        .find(|instance| {
            Some(instance.port) != self_port && instance.docs.iter().any(|doc| doc == path)
        })
        .map(|instance| instance.port)
}

fn focus_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Bind an ephemeral loopback port and serve one-line JSON commands on it.
/// Returns the port other instances should address this one at.
pub fn start_listener(app: tauri::AppHandle) -> Option<u16> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).ok()?;
    let port = listener.local_addr().ok()?.port();

    std::thread::spawn(move || {
        for incoming in listener.incoming() {
            let Ok(mut stream) = incoming else { continue };
            let _ = stream.set_read_timeout(Some(IPC_TIMEOUT));
            let _ = stream.set_write_timeout(Some(IPC_TIMEOUT));
            let mut line = String::new();
            if BufReader::new(&stream).read_line(&mut line).is_err() {
                continue;
            }
            let line = line.trim();
            if line.is_empty() {
                continue; // liveness probe
            }
            match serde_json::from_str::<IpcCommand>(line) {
                Ok(IpcCommand::Focus) => focus_main(&app),
                Ok(IpcCommand::Open { path }) => {
                    focus_main(&app);
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("open-file", path);
                    }
                }
                Err(err) => {
                    eprintln!("[doc-registry] ignoring malformed command: {err}");
                    continue; // no ack: the sender must not count this as handled
                }
            }
            let _ = writeln!(stream, "{IPC_ACK}");
        }
    });

    Some(port)
}

// -- ownership --------------------------------------------------------------

/// Take ownership of `path` for this instance, or report who already has it.
pub fn claim(self_port: u16, path: &str) -> ClaimOutcome {
    if self_port == 0 {
        return ClaimOutcome::Claimed; // no listener: nothing to coordinate with
    }
    let path = normalize(path);
    with_registry(|registry| {
        prune(registry, Some(self_port));
        if let Some(port) = owner_port(registry, &path, Some(self_port)) {
            return ClaimOutcome::Busy(port);
        }
        match registry
            .instances
            .iter_mut()
            .find(|instance| instance.port == self_port)
        {
            Some(instance) => {
                if !instance.docs.iter().any(|doc| doc == &path) {
                    instance.docs.push(path);
                }
            }
            None => registry.instances.push(Instance {
                pid: std::process::id(),
                port: self_port,
                docs: vec![path],
            }),
        }
        ClaimOutcome::Claimed
    })
}

pub fn release(self_port: u16, path: &str) {
    let path = normalize(path);
    with_registry(|registry| {
        if let Some(instance) = registry
            .instances
            .iter_mut()
            .find(|instance| instance.port == self_port)
        {
            instance.docs.retain(|doc| doc != &path);
        }
    });
}

/// Drop this instance's whole record. Called when the app exits.
pub fn unregister(self_port: u16) {
    with_registry(|registry| {
        registry.instances.retain(|instance| instance.port != self_port);
    });
}

/// Ask the instance owning `path` to come to the front. Returns false when
/// nobody owns it (or the owner did not answer).
pub fn focus_owner(self_port: u16, path: &str) -> bool {
    let path = normalize(path);
    let port = with_registry(|registry| {
        prune(registry, Some(self_port));
        owner_port(registry, &path, Some(self_port))
    });
    match port {
        Some(port) => send_command(port, &IpcCommand::Focus),
        None => false,
    }
}

/// Startup path: hand `path` to whichever live instance already owns it.
/// Returns true when the hand-off succeeded, meaning this process should exit
/// without ever creating a window.
pub fn forward_to_owner(path: &str) -> bool {
    let path = normalize(path);
    let port = with_registry(|registry| {
        prune(registry, None);
        owner_port(registry, &path, None)
    });
    match port {
        Some(port) => send_command(port, &IpcCommand::Open { path }),
        None => false,
    }
}

// -- Tauri commands ---------------------------------------------------------

#[tauri::command]
pub fn claim_document(path: String, state: tauri::State<'_, DocRegistry>) -> String {
    match claim(state.port, &path) {
        ClaimOutcome::Claimed => "claimed".to_string(),
        ClaimOutcome::Busy(port) => {
            // Put the window that already has the document in front, so the
            // "already open elsewhere" warning lands next to the real editor.
            send_command(port, &IpcCommand::Focus);
            "busy".to_string()
        }
    }
}

#[tauri::command]
pub fn release_document(path: String, state: tauri::State<'_, DocRegistry>) {
    release(state.port, &path);
}

#[tauri::command]
pub fn focus_document_owner(path: String, state: tauri::State<'_, DocRegistry>) -> bool {
    focus_owner(state.port, &path)
}
