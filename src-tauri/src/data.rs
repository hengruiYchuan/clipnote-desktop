use arboard::Clipboard;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

const MAX_CLIP_BYTES: usize = 256 * 1024;
const MAX_NOTE_BYTES: usize = 256 * 1024;
const MAX_NOTE_IMAGE_BYTES: usize = 6 * 1024 * 1024;
const CLIPBOARD_POLL_INTERVAL: Duration = Duration::from_millis(650);

#[derive(Clone)]
pub struct DataState {
    db_path: Arc<PathBuf>,
    paused: Arc<AtomicBool>,
}

impl DataState {
    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::Relaxed)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipItem {
    id: i64,
    kind: String,
    source: String,
    captured_at: i64,
    title: String,
    preview: String,
    favorite: bool,
    use_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    id: i64,
    title: String,
    body: String,
    tone: String,
    image_data: String,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteInput {
    title: String,
    body: String,
    tone: String,
    #[serde(default)]
    image_data: String,
}

pub fn initialize(app: &AppHandle) -> Result<DataState, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    let db_path = app_data_dir.join("clipnote.sqlite3");
    let connection = open_connection(&db_path)?;
    initialize_schema(&connection)?;
    let paused = read_paused(&connection)?;

    Ok(DataState {
        db_path: Arc::new(db_path),
        paused: Arc::new(AtomicBool::new(paused)),
    })
}

pub fn start_clipboard_monitor(app: AppHandle) {
    let state = app.state::<DataState>().inner().clone();
    thread::Builder::new()
        .name("clipnote-clipboard".into())
        .spawn(move || monitor_clipboard(app, state))
        .expect("failed to start clipboard monitor");
}

fn monitor_clipboard(app: AppHandle, state: DataState) {
    let mut clipboard = loop {
        match Clipboard::new() {
            Ok(clipboard) => break clipboard,
            Err(_) => thread::sleep(Duration::from_secs(2)),
        }
    };
    let mut last_seen: Option<String> = None;

    loop {
        thread::sleep(CLIPBOARD_POLL_INTERVAL);
        let Ok(content) = clipboard.get_text() else {
            continue;
        };
        if last_seen.as_ref() == Some(&content) {
            continue;
        }
        if state.is_paused() {
            last_seen = Some(content);
            continue;
        }

        if let Ok(item) = open_connection(&state.db_path)
            .and_then(|connection| upsert_clip(&connection, &content, now_timestamp()))
        {
            last_seen = Some(content);
            if item.is_some() {
                let _ = app.emit("clips-changed", ());
            }
        }
    }
}

fn open_connection(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .busy_timeout(Duration::from_secs(2))
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

fn initialize_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS clips (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               content TEXT NOT NULL UNIQUE,
               kind TEXT NOT NULL,
               title TEXT NOT NULL,
               captured_at INTEGER NOT NULL,
               favorite INTEGER NOT NULL DEFAULT 0,
               use_count INTEGER NOT NULL DEFAULT 0
             );
             CREATE INDEX IF NOT EXISTS idx_clips_captured_at
               ON clips(captured_at DESC);
             CREATE TABLE IF NOT EXISTS notes (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               title TEXT NOT NULL,
               body TEXT NOT NULL,
               tone TEXT NOT NULL,
               image_data TEXT NOT NULL DEFAULT '',
               created_at INTEGER NOT NULL,
               updated_at INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_notes_updated_at
               ON notes(updated_at DESC);
             CREATE TABLE IF NOT EXISTS settings (
               key TEXT PRIMARY KEY,
               value TEXT NOT NULL
             );",
        )
        .map_err(|error| error.to_string())?;
    ensure_note_image_column(connection)
}

fn ensure_note_image_column(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(notes)")
        .map_err(|error| error.to_string())?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    if !columns.iter().any(|column| column == "image_data") {
        connection
            .execute(
                "ALTER TABLE notes ADD COLUMN image_data TEXT NOT NULL DEFAULT ''",
                [],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn read_paused(connection: &Connection) -> Result<bool, String> {
    let value = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'capture_paused'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(value.as_deref() == Some("true"))
}

fn set_paused(state: &DataState, paused: bool) -> Result<(), String> {
    let connection = open_connection(&state.db_path)?;
    connection
        .execute(
            "INSERT INTO settings(key, value) VALUES('capture_paused', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [if paused { "true" } else { "false" }],
        )
        .map_err(|error| error.to_string())?;
    state.paused.store(paused, Ordering::Relaxed);
    Ok(())
}

pub fn toggle_capture(app: &AppHandle) -> Result<bool, String> {
    let state = app.state::<DataState>();
    let paused = !state.is_paused();
    set_paused(&state, paused)?;
    app.emit("capture-state-changed", paused)
        .map_err(|error| error.to_string())?;
    Ok(paused)
}

#[tauri::command]
pub fn get_capture_paused(state: State<'_, DataState>) -> bool {
    state.is_paused()
}

#[tauri::command]
pub fn set_capture_paused(
    app: AppHandle,
    state: State<'_, DataState>,
    paused: bool,
) -> Result<(), String> {
    set_paused(&state, paused)?;
    app.emit("capture-state-changed", paused)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_clips(state: State<'_, DataState>) -> Result<Vec<ClipItem>, String> {
    let connection = open_connection(&state.db_path)?;
    list_clips_from(&connection)
}

fn list_clips_from(connection: &Connection) -> Result<Vec<ClipItem>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, kind, captured_at, title, content, favorite, use_count
             FROM clips ORDER BY captured_at DESC, id DESC LIMIT 500",
        )
        .map_err(|error| error.to_string())?;
    let items = statement
        .query_map([], clip_from_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(items)
}

fn clip_from_row(row: &Row<'_>) -> rusqlite::Result<ClipItem> {
    Ok(ClipItem {
        id: row.get(0)?,
        kind: row.get(1)?,
        source: "系统剪贴板".into(),
        captured_at: row.get(2)?,
        title: row.get(3)?,
        preview: row.get(4)?,
        favorite: row.get::<_, i64>(5)? != 0,
        use_count: row.get(6)?,
    })
}

fn upsert_clip(
    connection: &Connection,
    content: &str,
    captured_at: i64,
) -> Result<Option<ClipItem>, String> {
    if content.trim().is_empty() || content.len() > MAX_CLIP_BYTES {
        return Ok(None);
    }
    let kind = classify_clip(content);
    let title = derive_title(content);
    connection
        .execute(
            "INSERT INTO clips(content, kind, title, captured_at)
             VALUES(?1, ?2, ?3, ?4)
             ON CONFLICT(content) DO UPDATE SET
               kind = excluded.kind,
               title = excluded.title,
               captured_at = excluded.captured_at",
            params![content, kind, title, captured_at],
        )
        .map_err(|error| error.to_string())?;
    connection
        .query_row(
            "SELECT id, kind, captured_at, title, content, favorite, use_count
             FROM clips WHERE content = ?1",
            [content],
            clip_from_row,
        )
        .map(Some)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_clip_favorite(
    app: AppHandle,
    state: State<'_, DataState>,
    id: i64,
    favorite: bool,
) -> Result<(), String> {
    let connection = open_connection(&state.db_path)?;
    let changed = connection
        .execute(
            "UPDATE clips SET favorite = ?1 WHERE id = ?2",
            params![favorite as i64, id],
        )
        .map_err(|error| error.to_string())?;
    require_changed(changed, "剪贴板记录不存在")?;
    app.emit("clips-changed", ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn copy_clip(app: AppHandle, state: State<'_, DataState>, id: i64) -> Result<(), String> {
    let connection = open_connection(&state.db_path)?;
    let content = connection
        .query_row("SELECT content FROM clips WHERE id = ?1", [id], |row| {
            row.get::<_, String>(0)
        })
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "剪贴板记录不存在".to_string())?;
    Clipboard::new()
        .and_then(|mut clipboard| clipboard.set_text(content))
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE clips SET use_count = use_count + 1 WHERE id = ?1",
            [id],
        )
        .map_err(|error| error.to_string())?;
    app.emit("clips-changed", ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_clip(app: AppHandle, state: State<'_, DataState>, id: i64) -> Result<(), String> {
    let connection = open_connection(&state.db_path)?;
    let changed = connection
        .execute("DELETE FROM clips WHERE id = ?1", [id])
        .map_err(|error| error.to_string())?;
    require_changed(changed, "剪贴板记录不存在")?;
    app.emit("clips-changed", ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_notes(state: State<'_, DataState>) -> Result<Vec<Note>, String> {
    let connection = open_connection(&state.db_path)?;
    list_notes_from(&connection)
}

fn list_notes_from(connection: &Connection) -> Result<Vec<Note>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, body, tone, image_data, created_at, updated_at
             FROM notes ORDER BY updated_at DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let notes = statement
        .query_map([], note_from_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(notes)
}

fn note_from_row(row: &Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        body: row.get(2)?,
        tone: row.get(3)?,
        image_data: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

#[tauri::command]
pub fn create_note(state: State<'_, DataState>, input: NoteInput) -> Result<Note, String> {
    let connection = open_connection(&state.db_path)?;
    let (title, body, tone, image_data) = validate_note(input)?;
    let timestamp = now_timestamp();
    connection
        .execute(
            "INSERT INTO notes(title, body, tone, image_data, created_at, updated_at)
             VALUES(?1, ?2, ?3, ?4, ?5, ?5)",
            params![title, body, tone, image_data, timestamp],
        )
        .map_err(|error| error.to_string())?;
    note_by_id(&connection, connection.last_insert_rowid())
}

#[tauri::command]
pub fn update_note(state: State<'_, DataState>, id: i64, input: NoteInput) -> Result<Note, String> {
    let connection = open_connection(&state.db_path)?;
    let (title, body, tone, image_data) = validate_note(input)?;
    let changed = connection
        .execute(
            "UPDATE notes SET title = ?1, body = ?2, tone = ?3, image_data = ?4,
             updated_at = ?5 WHERE id = ?6",
            params![title, body, tone, image_data, now_timestamp(), id],
        )
        .map_err(|error| error.to_string())?;
    require_changed(changed, "便签不存在")?;
    note_by_id(&connection, id)
}

#[tauri::command]
pub fn delete_note(state: State<'_, DataState>, id: i64) -> Result<(), String> {
    let connection = open_connection(&state.db_path)?;
    let changed = connection
        .execute("DELETE FROM notes WHERE id = ?1", [id])
        .map_err(|error| error.to_string())?;
    require_changed(changed, "便签不存在")
}

fn note_by_id(connection: &Connection, id: i64) -> Result<Note, String> {
    connection
        .query_row(
            "SELECT id, title, body, tone, image_data, created_at, updated_at
             FROM notes WHERE id = ?1",
            [id],
            note_from_row,
        )
        .map_err(|error| error.to_string())
}

fn validate_note(input: NoteInput) -> Result<(String, String, String, String), String> {
    if input.body.len() > MAX_NOTE_BYTES {
        return Err("便签内容过长".into());
    }
    if input.image_data.len() > MAX_NOTE_IMAGE_BYTES {
        return Err("截图大小超过限制".into());
    }
    let image_data = input.image_data.trim().to_string();
    let supported_image = [
        "data:image/png;base64,",
        "data:image/jpeg;base64,",
        "data:image/webp;base64,",
        "data:image/gif;base64,",
    ];
    if !image_data.is_empty()
        && !supported_image
            .iter()
            .any(|prefix| image_data.starts_with(prefix))
    {
        return Err("截图格式不支持".into());
    }
    let body = input.body.trim().to_string();
    let title = if input.title.trim().is_empty() {
        if body.is_empty() && !image_data.is_empty() {
            "图片便签".into()
        } else {
            derive_title(&body)
        }
    } else {
        truncate_chars(input.title.trim(), 80)
    };
    if title.is_empty() && body.is_empty() && image_data.is_empty() {
        return Err("便签内容不能为空".into());
    }
    let tone = match input.tone.as_str() {
        "sun" | "mint" | "paper" => input.tone,
        _ => "paper".into(),
    };
    Ok((title, body, tone, image_data))
}

fn classify_clip(content: &str) -> &'static str {
    let trimmed = content.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return "link";
    }
    let bytes = trimmed.as_bytes();
    if trimmed.starts_with("\\\\")
        || (bytes.get(1) == Some(&b':') && matches!(bytes.get(2), Some(b'\\' | b'/')))
    {
        return "path";
    }
    let code_markers = [
        "const ",
        "let ",
        "function ",
        "fn ",
        "class ",
        "import ",
        "SELECT ",
        "{",
        "=>",
    ];
    if trimmed.contains('\n') && code_markers.iter().any(|marker| trimmed.contains(marker)) {
        return "code";
    }
    "text"
}

fn derive_title(content: &str) -> String {
    let first_line = content
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or_default();
    let normalized = first_line.split_whitespace().collect::<Vec<_>>().join(" ");
    truncate_chars(&normalized, 48)
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let prefix = chars.by_ref().take(max_chars).collect::<String>();
    if chars.next().is_some() {
        format!("{prefix}…")
    } else {
        prefix
    }
}

fn now_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn require_changed(changed: usize, message: &str) -> Result<(), String> {
    if changed == 0 {
        Err(message.into())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        initialize_schema(&connection).unwrap();
        connection
    }

    #[test]
    fn repeated_clip_moves_to_the_top_without_losing_favorite() {
        let connection = test_connection();
        let first = upsert_clip(&connection, "alpha", 10).unwrap().unwrap();
        connection
            .execute("UPDATE clips SET favorite = 1 WHERE id = ?1", [first.id])
            .unwrap();
        upsert_clip(&connection, "beta", 20).unwrap();
        upsert_clip(&connection, "alpha", 30).unwrap();

        let clips = list_clips_from(&connection).unwrap();
        assert_eq!(clips[0].preview, "alpha");
        assert!(clips[0].favorite);
        assert_eq!(clips.len(), 2);
    }

    #[test]
    fn clips_are_classified_for_the_library() {
        assert_eq!(classify_clip("https://tauri.app"), "link");
        assert_eq!(classify_clip(r"C:\\Users\\clip.txt"), "path");
        assert_eq!(classify_clip("const answer = 42;\nanswer"), "code");
        assert_eq!(classify_clip("ordinary note"), "text");
    }

    #[test]
    fn notes_can_be_created_updated_and_deleted() {
        let connection = test_connection();
        let (title, body, tone, image_data) = validate_note(NoteInput {
            title: "".into(),
            body: "First line\nDetails".into(),
            tone: "sun".into(),
            image_data: "".into(),
        })
        .unwrap();
        connection
            .execute(
                "INSERT INTO notes(title, body, tone, image_data, created_at, updated_at)
                 VALUES(?1, ?2, ?3, ?4, 1, 1)",
                params![title, body, tone, image_data],
            )
            .unwrap();
        let id = connection.last_insert_rowid();
        assert_eq!(note_by_id(&connection, id).unwrap().title, "First line");

        connection
            .execute(
                "UPDATE notes SET body = 'Changed', updated_at = 2 WHERE id = ?1",
                [id],
            )
            .unwrap();
        assert_eq!(list_notes_from(&connection).unwrap()[0].body, "Changed");
        connection
            .execute("DELETE FROM notes WHERE id = ?1", [id])
            .unwrap();
        assert!(list_notes_from(&connection).unwrap().is_empty());
    }

    #[test]
    fn image_only_notes_are_valid_and_legacy_tables_are_migrated() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE notes (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   title TEXT NOT NULL,
                   body TEXT NOT NULL,
                   tone TEXT NOT NULL,
                   created_at INTEGER NOT NULL,
                   updated_at INTEGER NOT NULL
                 );",
            )
            .unwrap();
        initialize_schema(&connection).unwrap();

        let columns = connection
            .prepare("PRAGMA table_info(notes)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert!(columns.iter().any(|column| column == "image_data"));

        let (title, body, _, image_data) = validate_note(NoteInput {
            title: "".into(),
            body: "".into(),
            tone: "paper".into(),
            image_data: "data:image/png;base64,iVBORw0KGgo=".into(),
        })
        .unwrap();
        assert_eq!(title, "图片便签");
        assert!(body.is_empty());
        assert!(image_data.starts_with("data:image/png;base64,"));
    }
}
