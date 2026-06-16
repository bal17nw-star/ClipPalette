use tauri::State;

use crate::db::{self, DbConn};
use crate::models::{ClipItem, OgpData, SearchOptions, Snippet};

#[tauri::command]
pub async fn get_clips(
    db: State<'_, DbConn>,
    opts: SearchOptions,
) -> Result<Vec<ClipItem>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::search_clips(&conn, &opts).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_clip(db: State<'_, DbConn>, id: i64) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::delete_clip(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_sensitive(db: State<'_, DbConn>, id: i64) -> Result<bool, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::toggle_sensitive(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_pin(db: State<'_, DbConn>, id: i64) -> Result<bool, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::toggle_pin(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_tags(
    db: State<'_, DbConn>,
    id: i64,
    tags: Vec<String>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::update_tags(&conn, id, &tags).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_ogp(
    db: State<'_, DbConn>,
    id: i64,
    ogp: OgpData,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::update_ogp(
        &conn,
        id,
        ogp.title.as_deref(),
        ogp.image.as_deref(),
        ogp.domain.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_ogp(url: String) -> Result<OgpData, String> {
    tokio::task::spawn_blocking(move || fetch_ogp_blocking(&url))
        .await
        .map_err(|e| e.to_string())?
}

fn fetch_ogp_blocking(url: &str) -> Result<OgpData, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("ClipPalette/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(url).send().map_err(|e| e.to_string())?;
    let html = resp.text().map_err(|e| e.to_string())?;

    let domain = url::extract_domain(url);
    let document = scraper::Html::parse_document(&html);
    let meta_sel = scraper::Selector::parse("meta").unwrap();

    let mut title: Option<String> = None;
    let mut image: Option<String> = None;

    for el in document.select(&meta_sel) {
        let property = el.value().attr("property").unwrap_or("");
        let name = el.value().attr("name").unwrap_or("");
        let content = el.value().attr("content").unwrap_or("");

        if property == "og:title" || (title.is_none() && name == "twitter:title") {
            title = Some(content.to_string());
        }
        if property == "og:image" || (image.is_none() && name == "twitter:image") {
            image = Some(content.to_string());
        }
    }

    // Fallback to <title> tag
    if title.is_none() {
        let title_sel = scraper::Selector::parse("title").unwrap();
        if let Some(el) = document.select(&title_sel).next() {
            title = Some(el.inner_html());
        }
    }

    Ok(OgpData {
        title,
        image,
        domain,
        description: None,
    })
}

mod url {
    pub fn extract_domain(url: &str) -> Option<String> {
        let without_scheme = url.trim_start_matches("https://").trim_start_matches("http://");
        let domain = without_scheme.split('/').next()?;
        let domain = domain.trim_start_matches("www.");
        Some(domain.to_string())
    }
}

// --- Snippets ---

#[tauri::command]
pub async fn get_snippets(db: State<'_, DbConn>) -> Result<Vec<Snippet>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::get_snippets(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_snippet(
    db: State<'_, DbConn>,
    trigger: String,
    content: String,
    description: Option<String>,
) -> Result<i64, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let trigger = trigger.trim_start_matches('/').to_string();
    db::upsert_snippet(&conn, &trigger, &content, description.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_snippet(db: State<'_, DbConn>, id: i64) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::delete_snippet(&conn, id).map_err(|e| e.to_string())
}

// --- Settings ---

#[tauri::command]
pub async fn get_setting(db: State<'_, DbConn>, key: String) -> Result<Option<String>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_setting(
    db: State<'_, DbConn>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

// --- Clipboard write ---

#[tauri::command]
pub async fn write_to_clipboard(text: String) -> Result<(), String> {
    use arboard::Clipboard;
    tokio::task::spawn_blocking(move || {
        let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
        cb.set_text(&text).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
