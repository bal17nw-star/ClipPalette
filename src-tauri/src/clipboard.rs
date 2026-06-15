use arboard::Clipboard;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use chrono::Utc;
use image::{ImageBuffer, RgbaImage};
use regex::Regex;
use sha2::{Digest, Sha256};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::db::{self, DbConn};
use crate::models::{ClipItem, ClipType};

const POLL_MS: u64 = 400;
const MAX_IMAGE_PX: u32 = 480;

const BLOCKED_APPS: &[&str] = &[
    "1password", "bitwarden", "keepass", "lastpass",
    "dashlane", "roboform", "enpass", "nordpass",
];

// ── Public entry point ──────────────────────────────────────────────────────

pub fn start(app: AppHandle, db: DbConn) {
    std::thread::Builder::new()
        .name("clipboard-monitor".into())
        .spawn(move || {
            // Outer restart loop: if the inner loop panics, restart after 2 s
            loop {
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    run(&app, &db);
                }));
                if result.is_err() {
                    eprintln!("[ClipPalette] monitor panicked — restarting in 2 s");
                    std::thread::sleep(Duration::from_secs(2));
                }
            }
        })
        .expect("clipboard monitor thread");
}

// ── Inner polling loop ───────────────────────────────────────────────────────

fn run(app: &AppHandle, db: &DbConn) {
    let mut cb = new_clipboard();

    let url_re = Regex::new(r"(?i)^https?://[^\s]{3,}$").unwrap();

    // Separate hashes for image vs text so one format can't block the other
    let mut last_text_hash = String::new();
    let mut last_image_hash = String::new();

    // Consecutive read-failure counter — used to trigger clipboard re-init
    let mut text_err_count: u32 = 0;

    // Windows: track sequence number so we don't even try on idle iterations
    #[cfg(target_os = "windows")]
    let mut last_seq = win::seq();

    loop {
        std::thread::sleep(Duration::from_millis(POLL_MS));

        // ── Fast skip: nothing changed on Windows ────────────────────────
        #[cfg(target_os = "windows")]
        {
            let seq = win::seq();
            if seq == last_seq {
                continue;
            }
            last_seq = seq;
        }

        // ── Image branch (only when image format is actually present) ────
        #[cfg(target_os = "windows")]
        let try_image = win::has_image();
        #[cfg(not(target_os = "windows"))]
        let try_image = true;

        if try_image {
            if let Ok(img) = cb.get_image() {
                let hash = hash_bytes(&img.bytes);
                if hash != last_image_hash {
                    last_image_hash = hash.clone();
                    last_text_hash.clear(); // text slot reset when image arrives

                    let src = foreground_app();
                    if !is_blocked(&src) {
                        if let Some(b64) = encode_image(img) {
                            let item = ClipItem {
                                id: 0,
                                content: format!("[image:{}]", &hash[..8]),
                                content_hash: hash,
                                clip_type: ClipType::Image.to_string(),
                                source_app: src,
                                created_at: Utc::now().to_rfc3339(),
                                is_pinned: false,
                                tags: vec![],
                                ogp_title: None,
                                ogp_image: None,
                                ogp_domain: None,
                                image_data: Some(b64),
                                is_sensitive: false,
                            };
                            save_and_emit(app, db, item);
                        }
                    }
                }
                // Image found — no point also reading text this iteration
                continue;
            }
        }

        // ── Text branch ──────────────────────────────────────────────────
        match cb.get_text() {
            Ok(raw) => {
                text_err_count = 0;
                let text = raw.trim().to_string();
                if text.is_empty() {
                    continue;
                }

                let hash = hash_str(&text);
                if hash == last_text_hash {
                    continue;
                }
                last_text_hash = hash.clone();
                last_image_hash.clear(); // image slot reset when text arrives

                let src = foreground_app();
                if is_blocked(&src) {
                    continue;
                }

                let clip_type = if url_re.is_match(&text) {
                    ClipType::Url
                } else if looks_like_code(&text) {
                    ClipType::Code
                } else {
                    ClipType::Text
                };

                let sensitive = is_sensitive_content(&text);

                // Read sensitive_mode from settings (default: "masked")
                // Lock is released before save_and_emit re-acquires it.
                let sensitive_mode = db
                    .lock()
                    .ok()
                    .and_then(|conn| db::get_setting(&conn, "sensitive_mode").ok().flatten())
                    .unwrap_or_else(|| "masked".to_string());

                if sensitive && sensitive_mode == "skip" {
                    continue;
                }

                let item = ClipItem {
                    id: 0,
                    content: text,
                    content_hash: hash,
                    clip_type: clip_type.to_string(),
                    source_app: src,
                    created_at: Utc::now().to_rfc3339(),
                    is_pinned: false,
                    tags: vec![],
                    ogp_title: None,
                    ogp_image: None,
                    ogp_domain: None,
                    image_data: None,
                    is_sensitive: sensitive,
                };
                save_and_emit(app, db, item);
            }

            Err(e) => {
                text_err_count += 1;
                eprintln!(
                    "[ClipPalette] get_text error #{text_err_count}: {e}"
                );
                // After 5 consecutive errors recreate the Clipboard handle
                if text_err_count >= 5 {
                    eprintln!("[ClipPalette] recreating clipboard handle");
                    cb = new_clipboard();
                    text_err_count = 0;
                }
            }
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn new_clipboard() -> Clipboard {
    loop {
        match Clipboard::new() {
            Ok(c) => return c,
            Err(e) => {
                eprintln!("[ClipPalette] Clipboard::new failed: {e} — retrying in 1 s");
                std::thread::sleep(Duration::from_secs(1));
            }
        }
    }
}

fn save_and_emit(app: &AppHandle, db: &DbConn, item: ClipItem) {
    // Release the mutex before emitting so the frontend's get_clips call doesn't block
    let id = match db.lock() {
        Ok(conn) => match db::upsert_clip(&conn, &item) {
            Ok(id) => id,
            Err(e) => { eprintln!("[ClipPalette] upsert_clip failed: {e}"); return; }
        },
        Err(e) => { eprintln!("[ClipPalette] db mutex poisoned: {e}"); return; }
    };
    let mut saved = item;
    saved.id = id;
    let _ = app.emit("clip:new", &saved);
}

fn hash_str(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    hex::encode(h.finalize())
}

fn hash_bytes(b: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(b);
    hex::encode(h.finalize())
}

fn encode_image(img: arboard::ImageData<'_>) -> Option<String> {
    let rgba: RgbaImage =
        ImageBuffer::from_raw(img.width as u32, img.height as u32, img.bytes.into_owned())?;
    let dyn_img = image::DynamicImage::ImageRgba8(rgba);
    let resized = if dyn_img.width() > MAX_IMAGE_PX || dyn_img.height() > MAX_IMAGE_PX {
        dyn_img.thumbnail(MAX_IMAGE_PX, MAX_IMAGE_PX)
    } else {
        dyn_img
    };
    let mut buf = Vec::new();
    resized
        .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
        .ok()?;
    Some(format!("data:image/png;base64,{}", STANDARD.encode(&buf)))
}

fn looks_like_code(text: &str) -> bool {
    let lines: Vec<&str> = text.lines().collect();

    // 2行以上インデントがあればコード
    let indented = lines
        .iter()
        .filter(|l| (l.starts_with("    ") || l.starts_with('\t')) && !l.trim().is_empty())
        .count();
    if indented >= 2 {
        return true;
    }

    // 強シグナル 1 つでコード確定
    let strong = [
        "() {", "() =>", "=> {", ") {", ") =>",
        "fn ", "func ", "def ", "pub fn ",
        "SELECT ", "INSERT INTO", "UPDATE ", "DELETE FROM",
        "#include", "package main", "using namespace",
    ];
    if strong.iter().any(|&p| text.contains(p)) {
        return true;
    }

    if lines.len() < 2 {
        return false;
    }

    // 弱シグナル 2 つ以上
    let weak = [
        "const ", "let ", "var ", "function ", "class ",
        "import ", "export ", "return ", "require(",
        "if (", "for (", "while (", "elif ", "else:",
        "->", "=>", "!= ", "== ", "&& ", "|| ",
        "public ", "private ", "protected ", "void ",
        ":= ", "mod ", "use ",
    ];
    weak.iter().filter(|&&p| text.contains(p)).count() >= 2
}

#[cfg(target_os = "windows")]
fn foreground_app() -> Option<String> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::ProcessStatus::GetModuleFileNameExW;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if handle.is_null() {
            return None;
        }
        let mut buf = [0u16; 260];
        let len = GetModuleFileNameExW(handle, std::ptr::null_mut(), buf.as_mut_ptr(), 260);
        CloseHandle(handle);
        if len == 0 {
            return None;
        }
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        path.split('\\').last().map(|s| s.to_string())
    }
}

#[cfg(not(target_os = "windows"))]
fn foreground_app() -> Option<String> {
    None
}

fn is_sensitive_content(text: &str) -> bool {
    use std::sync::OnceLock;
    static PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
    let patterns = PATTERNS.get_or_init(|| {
        let raw = [
            r"sk-[a-zA-Z0-9]{20,}",
            r"sk-proj-",
            r"ghp_[a-zA-Z0-9]{36}",
            r"github_pat_",
            r"AKIA[0-9A-Z]{16}",
            r"-----BEGIN .{0,30}PRIVATE KEY-----",
            r"eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+",
        ];
        raw.iter().filter_map(|p| Regex::new(p).ok()).collect()
    });
    patterns.iter().any(|re| re.is_match(text))
}

fn is_blocked(app: &Option<String>) -> bool {
    let Some(name) = app else { return false };
    let lower = name.to_lowercase();
    BLOCKED_APPS.iter().any(|&b| lower.contains(b))
}

// ── Windows-specific clipboard inspection ────────────────────────────────────
#[cfg(target_os = "windows")]
mod win {
    use windows_sys::Win32::System::DataExchange::{
        GetClipboardSequenceNumber, IsClipboardFormatAvailable,
    };

    pub fn seq() -> u32 {
        unsafe { GetClipboardSequenceNumber() }
    }

    pub fn has_image() -> bool {
        const CF_BITMAP: u32 = 2;
        const CF_DIB: u32 = 8;
        const CF_DIBV5: u32 = 17;
        unsafe {
            IsClipboardFormatAvailable(CF_BITMAP) != 0
                || IsClipboardFormatAvailable(CF_DIB) != 0
                || IsClipboardFormatAvailable(CF_DIBV5) != 0
        }
    }
}
