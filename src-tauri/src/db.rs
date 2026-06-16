use rusqlite::{Connection, OptionalExtension, Result, params};
use std::sync::{Arc, Mutex};
use crate::models::{ClipItem, Snippet, SearchOptions};

pub type DbConn = Arc<Mutex<Connection>>;

pub fn open_db(path: &str) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA synchronous=NORMAL;
         PRAGMA wal_autocheckpoint=200;
         PRAGMA wal_checkpoint(PASSIVE);"
    )?;
    Ok(conn)
}

pub fn init_schema(conn: &Connection) -> Result<()> {
    // Base schema — clips table is defined without is_sensitive so that
    // fresh installs go through the same migration path as upgrades.
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS clips (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            content      TEXT NOT NULL,
            content_hash TEXT NOT NULL UNIQUE,
            clip_type    TEXT NOT NULL DEFAULT 'text',
            source_app   TEXT,
            created_at   TEXT NOT NULL,
            is_pinned    INTEGER NOT NULL DEFAULT 0,
            tags         TEXT NOT NULL DEFAULT '[]',
            ogp_title    TEXT,
            ogp_image    TEXT,
            ogp_domain   TEXT,
            image_data   TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_clips_hash   ON clips(content_hash);
        CREATE INDEX IF NOT EXISTS idx_clips_pinned ON clips(is_pinned DESC, created_at DESC);

        CREATE TABLE IF NOT EXISTS snippets (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            trigger     TEXT NOT NULL UNIQUE,
            content     TEXT NOT NULL,
            description TEXT,
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    ")?;

    run_migrations(conn)?;

    Ok(())
}

/// Versioned migrations. Each version block is idempotent and runs inside a
/// single transaction so a failure leaves the DB in its previous state.
fn run_migrations(conn: &Connection) -> Result<()> {
    let version: u32 = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'schema_version'",
            [],
            |r| r.get::<_, String>(0),
        )
        .optional()?
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    // --- v1 → v2: add is_sensitive column ---
    if version < 2 {
        let tx = conn.unchecked_transaction()?;

        let has_sensitive: bool = {
            let mut stmt = tx.prepare("PRAGMA table_info(clips)")?;
            let names: Vec<String> = stmt
                .query_map([], |row| row.get::<_, String>(1))?
                .filter_map(|r| r.ok())
                .collect();
            names.iter().any(|n| n == "is_sensitive")
        };

        if !has_sensitive {
            tx.execute(
                "ALTER TABLE clips ADD COLUMN is_sensitive INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }

        tx.execute(
            "INSERT INTO settings (key, value) VALUES ('schema_version', '2')
             ON CONFLICT(key) DO UPDATE SET value = '2'",
            [],
        )?;

        tx.commit()?;
    }

    // Future migrations go here:
    // if version < 3 { ... }

    Ok(())
}

/// 同じ content_hash が既存ならcreated_atを更新して先頭へ移動（再コピー対応）
pub fn upsert_clip(conn: &Connection, item: &ClipItem) -> Result<i64> {
    conn.execute(
        "INSERT INTO clips
         (content, content_hash, clip_type, source_app, created_at, is_pinned, tags,
          ogp_title, ogp_image, ogp_domain, image_data, is_sensitive)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
         ON CONFLICT(content_hash) DO UPDATE SET
           created_at   = excluded.created_at,
           source_app   = excluded.source_app,
           is_sensitive = excluded.is_sensitive",
        params![
            item.content,
            item.content_hash,
            item.clip_type,
            item.source_app,
            item.created_at,
            item.is_pinned as i64,
            serde_json::to_string(&item.tags).unwrap_or_default(),
            item.ogp_title,
            item.ogp_image,
            item.ogp_domain,
            item.image_data,
            item.is_sensitive as i64,
        ],
    )?;
    // UPSERT後はhashでidを取得（last_insert_rowid はINSERTのみ更新される）
    conn.query_row(
        "SELECT id FROM clips WHERE content_hash = ?1",
        params![item.content_hash],
        |r| r.get(0),
    )
}

#[allow(dead_code)]
pub fn insert_clip(conn: &Connection, item: &ClipItem) -> Result<i64> {
    upsert_clip(conn, item)
}

pub fn search_clips(conn: &Connection, opts: &SearchOptions) -> Result<Vec<ClipItem>> {
    let limit = opts.limit.unwrap_or(100);
    let offset = opts.offset.unwrap_or(0);

    let mut conditions: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(q) = &opts.query {
        if !q.is_empty() {
            conditions.push("content LIKE ?".into());
            values.push(Box::new(format!("%{}%", q)));
        }
    }
    if let Some(ct) = &opts.clip_type {
        if !ct.is_empty() {
            conditions.push("clip_type = ?".into());
            values.push(Box::new(ct.clone()));
        }
    }
    if let Some(tag) = &opts.tag {
        if !tag.is_empty() {
            conditions.push("tags LIKE ?".into());
            values.push(Box::new(format!("%\"{}\"%" , tag)));
        }
    }
    if opts.pinned_only {
        conditions.push("is_pinned = 1".into());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT id, content, content_hash, clip_type, source_app, created_at,
                is_pinned, tags, ogp_title, ogp_image, ogp_domain, image_data, is_sensitive
         FROM clips
         {}
         ORDER BY is_pinned DESC, created_at DESC
         LIMIT {} OFFSET {}",
        where_clause, limit, offset
    );

    let refs: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(refs.as_slice(), row_to_clip)?;
    rows.collect()
}

fn row_to_clip(row: &rusqlite::Row<'_>) -> Result<ClipItem> {
    let tags_str: String = row.get(7)?;
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    Ok(ClipItem {
        id: row.get(0)?,
        content: row.get(1)?,
        content_hash: row.get(2)?,
        clip_type: row.get(3)?,
        source_app: row.get(4)?,
        created_at: row.get(5)?,
        is_pinned: row.get::<_, i64>(6)? != 0,
        tags,
        ogp_title: row.get(8)?,
        ogp_image: row.get(9)?,
        ogp_domain: row.get(10)?,
        image_data: row.get(11)?,
        is_sensitive: row.get::<_, i64>(12)? != 0,
    })
}

pub fn delete_clip(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM clips WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn toggle_pin(conn: &Connection, id: i64) -> Result<bool> {
    conn.execute(
        "UPDATE clips SET is_pinned = CASE WHEN is_pinned = 0 THEN 1 ELSE 0 END WHERE id = ?1",
        params![id],
    )?;
    let pinned: i64 = conn.query_row(
        "SELECT is_pinned FROM clips WHERE id = ?1",
        params![id],
        |r| r.get(0),
    )?;
    Ok(pinned != 0)
}

pub fn update_tags(conn: &Connection, id: i64, tags: &[String]) -> Result<()> {
    let tags_json = serde_json::to_string(tags).unwrap_or_default();
    conn.execute(
        "UPDATE clips SET tags = ?1 WHERE id = ?2",
        params![tags_json, id],
    )?;
    Ok(())
}

pub fn update_ogp(conn: &Connection, id: i64, title: Option<&str>, image: Option<&str>, domain: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE clips SET ogp_title = ?1, ogp_image = ?2, ogp_domain = ?3 WHERE id = ?4",
        params![title, image, domain, id],
    )?;
    Ok(())
}

// --- Snippets ---

pub fn get_snippets(conn: &Connection) -> Result<Vec<Snippet>> {
    let mut stmt = conn.prepare(
        "SELECT id, trigger, content, description, created_at FROM snippets ORDER BY trigger ASC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Snippet {
            id: row.get(0)?,
            trigger: row.get(1)?,
            content: row.get(2)?,
            description: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn upsert_snippet(conn: &Connection, trigger: &str, content: &str, description: Option<&str>) -> Result<i64> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO snippets (trigger, content, description, created_at) VALUES (?1,?2,?3,?4)
         ON CONFLICT(trigger) DO UPDATE SET content=excluded.content, description=excluded.description",
        params![trigger, content, description, now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_snippet(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |r| r.get(0),
    ).optional()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, value],
    )?;
    Ok(())
}
