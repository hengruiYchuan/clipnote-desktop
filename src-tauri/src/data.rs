use arboard::Clipboard;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

const MAX_CLIP_BYTES: usize = 256 * 1024;
const MAX_NOTE_BYTES: usize = 256 * 1024;
const MAX_NOTE_IMAGE_BYTES: usize = 6 * 1024 * 1024;
const MAX_NOTE_IMAGES: usize = 8;
const MAX_NOTE_IMAGES_BYTES: usize = 24 * 1024 * 1024;
const NOTE_IMAGE_TOKEN_PREFIX: &str = "{{clipnote-image:";
const CLIPBOARD_POLL_INTERVAL: Duration = Duration::from_millis(650);

#[derive(Clone)]
pub struct DataState {
    db_path: Arc<PathBuf>,
    paused: Arc<AtomicBool>,
    suppressed_clipboard_sequence: Arc<AtomicU32>,
}

impl DataState {
    pub(crate) fn db_path(&self) -> &Path {
        self.db_path.as_ref()
    }
    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::Relaxed)
    }

    fn suppress_clipboard_sequence(&self, sequence: u32) {
        if sequence != 0 {
            self.suppressed_clipboard_sequence
                .store(sequence, Ordering::Release);
        }
    }

    fn consume_suppressed_sequence(&self, sequence: Option<u32>) -> bool {
        let Some(sequence) = sequence.filter(|sequence| *sequence != 0) else {
            return false;
        };
        self.suppressed_clipboard_sequence
            .compare_exchange(sequence, 0, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
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

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteImage {
    id: String,
    data_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub(crate) id: i64,
    title: String,
    body: String,
    tone: String,
    images: Vec<NoteImage>,
    source_clip_ids: Vec<i64>,
    pub(crate) desktop_pinned: bool,
    pub(crate) desktop_x: Option<i32>,
    pub(crate) desktop_y: Option<i32>,
    pub(crate) desktop_width: i32,
    pub(crate) desktop_height: i32,
    pub(crate) always_on_top: bool,
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
    images: Vec<NoteImage>,
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
        suppressed_clipboard_sequence: Arc::new(AtomicU32::new(0)),
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
    let mut last_sequence = None;

    loop {
        thread::sleep(CLIPBOARD_POLL_INTERVAL);
        let current_sequence = clipboard_sequence_number();
        if !should_read_clipboard(last_sequence, current_sequence) {
            continue;
        }
        if state.consume_suppressed_sequence(current_sequence) {
            last_sequence = current_sequence;
            continue;
        }
        if state.is_paused() {
            last_sequence = current_sequence;
            continue;
        }

        let Ok(content) = clipboard.get_text() else {
            continue;
        };
        last_sequence = current_sequence;
        if last_seen.as_ref() == Some(&content) {
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

pub fn suppress_current_clipboard(app: &AppHandle) {
    if let Some(sequence) = clipboard_sequence_number() {
        app.state::<DataState>()
            .suppress_clipboard_sequence(sequence);
    }
}

fn should_read_clipboard(last_sequence: Option<u32>, current_sequence: Option<u32>) -> bool {
    match (last_sequence, current_sequence) {
        (Some(last), Some(current)) => last != current,
        _ => true,
    }
}

#[cfg(windows)]
fn clipboard_sequence_number() -> Option<u32> {
    use windows_sys::Win32::System::DataExchange::GetClipboardSequenceNumber;

    Some(unsafe { GetClipboardSequenceNumber() })
}

#[cfg(not(windows))]
fn clipboard_sequence_number() -> Option<u32> {
    None
}

pub(crate) fn open_connection(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .busy_timeout(Duration::from_secs(2))
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

pub(crate) fn initialize_schema(connection: &Connection) -> Result<(), String> {
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
               images_json TEXT NOT NULL DEFAULT '[]',
               source_clip_ids TEXT NOT NULL DEFAULT '[]',
               desktop_pinned INTEGER NOT NULL DEFAULT 0,
               desktop_x INTEGER,
               desktop_y INTEGER,
               desktop_width INTEGER NOT NULL DEFAULT 320,
               desktop_height INTEGER NOT NULL DEFAULT 260,
               always_on_top INTEGER NOT NULL DEFAULT 1,
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
    ensure_note_columns(connection)
}

fn ensure_note_columns(connection: &Connection) -> Result<(), String> {
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
    if !columns.iter().any(|column| column == "images_json") {
        connection
            .execute(
                "ALTER TABLE notes ADD COLUMN images_json TEXT NOT NULL DEFAULT '[]'",
                [],
            )
            .map_err(|error| error.to_string())?;
    }
    for (name, definition) in [
        ("source_clip_ids", "TEXT NOT NULL DEFAULT '[]'"),
        ("desktop_pinned", "INTEGER NOT NULL DEFAULT 0"),
        ("desktop_x", "INTEGER"),
        ("desktop_y", "INTEGER"),
        ("desktop_width", "INTEGER NOT NULL DEFAULT 320"),
        ("desktop_height", "INTEGER NOT NULL DEFAULT 260"),
        ("always_on_top", "INTEGER NOT NULL DEFAULT 1"),
    ] {
        if !columns.iter().any(|column| column == name) {
            connection
                .execute(
                    &format!("ALTER TABLE notes ADD COLUMN {name} {definition}"),
                    [],
                )
                .map_err(|error| error.to_string())?;
        }
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

pub fn read_collapsed_position(app: &AppHandle) -> Result<Option<(i32, i32)>, String> {
    let state = app.state::<DataState>();
    let connection = open_connection(&state.db_path)?;
    read_collapsed_position_from(&connection)
}

fn read_collapsed_position_from(connection: &Connection) -> Result<Option<(i32, i32)>, String> {
    let read_value = |key: &str| -> Result<Option<i32>, String> {
        let value = connection
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
                row.get::<_, String>(0)
            })
            .optional()
            .map_err(|error| error.to_string())?;
        Ok(value.and_then(|value| value.parse::<i32>().ok()))
    };
    Ok(
        match (read_value("collapsed_x")?, read_value("collapsed_y")?) {
            (Some(x), Some(y)) => Some((x, y)),
            _ => None,
        },
    )
}

pub fn save_collapsed_position(app: &AppHandle, x: i32, y: i32) -> Result<(), String> {
    let state = app.state::<DataState>();
    let mut connection = open_connection(&state.db_path)?;
    save_collapsed_position_to(&mut connection, x, y)
}

fn save_collapsed_position_to(connection: &mut Connection, x: i32, y: i32) -> Result<(), String> {
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    for (key, value) in [("collapsed_x", x), ("collapsed_y", y)] {
        transaction
            .execute(
                "INSERT INTO settings(key, value) VALUES(?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value.to_string()],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
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
pub fn delete_unfavorited_clips(
    app: AppHandle,
    state: State<'_, DataState>,
) -> Result<usize, String> {
    let connection = open_connection(&state.db_path)?;
    let deleted = delete_unfavorited_from(&connection)?;
    if deleted > 0 {
        app.emit("clips-changed", ())
            .map_err(|error| error.to_string())?;
    }
    Ok(deleted)
}

fn delete_unfavorited_from(connection: &Connection) -> Result<usize, String> {
    connection
        .execute("DELETE FROM clips WHERE favorite = 0", [])
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
            "SELECT id, title, body, tone, image_data, images_json, source_clip_ids,
                    desktop_pinned, desktop_x, desktop_y, desktop_width, desktop_height,
                    always_on_top, created_at, updated_at
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
    let mut body: String = row.get(2)?;
    let legacy_image: String = row.get(4)?;
    let images_json: String = row.get(5)?;
    let source_clip_ids_json: String = row.get(6)?;
    let mut images = serde_json::from_str::<Vec<NoteImage>>(&images_json).unwrap_or_default();
    if images.is_empty() && !legacy_image.is_empty() {
        images.push(NoteImage {
            id: "legacy".into(),
            data_url: legacy_image,
        });
        if !body.contains(&note_image_token("legacy")) {
            body = if body.is_empty() {
                note_image_token("legacy")
            } else {
                format!("{}\n\n{body}", note_image_token("legacy"))
            };
        }
    }
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        body,
        tone: row.get(3)?,
        images,
        source_clip_ids: serde_json::from_str(&source_clip_ids_json).unwrap_or_default(),
        desktop_pinned: row.get::<_, i64>(7)? != 0,
        desktop_x: row.get(8)?,
        desktop_y: row.get(9)?,
        desktop_width: row.get(10)?,
        desktop_height: row.get(11)?,
        always_on_top: row.get::<_, i64>(12)? != 0,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

#[tauri::command]
pub fn get_note(state: State<'_, DataState>, id: i64) -> Result<Note, String> {
    let connection = open_connection(&state.db_path)?;
    note_by_id(&connection, id).map_err(|_| "便签不存在".to_string())
}

#[tauri::command]
pub fn create_note_from_clips(
    app: AppHandle,
    state: State<'_, DataState>,
    ids: Vec<i64>,
) -> Result<Note, String> {
    let connection = open_connection(&state.db_path)?;
    let note = create_note_from_clips_in(&connection, &ids)?;
    app.emit("notes-changed", ())
        .map_err(|error| error.to_string())?;
    Ok(note)
}

fn create_note_from_clips_in(connection: &Connection, ids: &[i64]) -> Result<Note, String> {
    if ids.is_empty() || ids.len() > 100 {
        return Err("请选择 1 到 100 条剪贴板记录".into());
    }
    if ids
        .iter()
        .enumerate()
        .any(|(index, id)| ids[..index].contains(id))
    {
        return Err("剪贴板选择中包含重复记录".into());
    }
    let mut clips = Vec::with_capacity(ids.len());
    for id in ids {
        let clip = connection
            .query_row(
                "SELECT title, content FROM clips WHERE id = ?1",
                [id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "有剪贴板记录已不存在".to_string())?;
        clips.push(clip);
    }
    let title = if clips.len() == 1 {
        clips[0].0.clone()
    } else {
        format!("来自剪贴板的 {} 条内容", clips.len())
    };
    let body = clips
        .iter()
        .map(|(_, content)| content.trim())
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");
    let source_clip_ids = serde_json::to_string(ids).map_err(|error| error.to_string())?;
    let timestamp = now_timestamp();
    connection
        .execute(
            "INSERT INTO notes(title, body, tone, image_data, images_json, source_clip_ids,
                               created_at, updated_at)
             VALUES(?1, ?2, 'paper', '', '[]', ?3, ?4, ?4)",
            params![title, body, source_clip_ids, timestamp],
        )
        .map_err(|error| error.to_string())?;
    note_by_id(connection, connection.last_insert_rowid())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoteStateInput {
    pub(crate) desktop_pinned: bool,
    pub(crate) desktop_x: Option<i32>,
    pub(crate) desktop_y: Option<i32>,
    pub(crate) desktop_width: i32,
    pub(crate) desktop_height: i32,
    pub(crate) always_on_top: bool,
}

#[tauri::command]
pub fn update_note_desktop_state(
    app: AppHandle,
    id: i64,
    input: DesktopNoteStateInput,
) -> Result<Note, String> {
    update_note_desktop_state_for_app(&app, id, input)
}

pub(crate) fn update_note_desktop_state_for_app(
    app: &AppHandle,
    id: i64,
    input: DesktopNoteStateInput,
) -> Result<Note, String> {
    if !(220..=900).contains(&input.desktop_width) || !(160..=900).contains(&input.desktop_height) {
        return Err("桌面便签尺寸超出范围".into());
    }
    let state = app.state::<DataState>();
    let connection = open_connection(&state.db_path)?;
    let changed = connection
        .execute(
            "UPDATE notes SET desktop_pinned = ?1, desktop_x = ?2, desktop_y = ?3,
                              desktop_width = ?4, desktop_height = ?5, always_on_top = ?6
             WHERE id = ?7",
            params![
                input.desktop_pinned as i64,
                input.desktop_x,
                input.desktop_y,
                input.desktop_width,
                input.desktop_height,
                input.always_on_top as i64,
                id,
            ],
        )
        .map_err(|error| error.to_string())?;
    require_changed(changed, "便签不存在")?;
    let note = note_by_id(&connection, id)?;
    app.emit("notes-changed", ())
        .map_err(|error| error.to_string())?;
    Ok(note)
}

pub(crate) fn note_for_app(app: &AppHandle, id: i64) -> Result<Note, String> {
    let state = app.state::<DataState>();
    let connection = open_connection(&state.db_path)?;
    note_by_id(&connection, id).map_err(|_| "便签不存在".to_string())
}

pub(crate) fn pinned_notes_for_app(app: &AppHandle) -> Result<Vec<Note>, String> {
    let state = app.state::<DataState>();
    let connection = open_connection(&state.db_path)?;
    Ok(list_notes_from(&connection)?
        .into_iter()
        .filter(|note| note.desktop_pinned)
        .collect())
}

#[tauri::command]
pub fn create_note(
    app: AppHandle,
    state: State<'_, DataState>,
    input: NoteInput,
) -> Result<Note, String> {
    let connection = open_connection(&state.db_path)?;
    let (title, body, tone, images_json) = validate_note(input)?;
    let timestamp = now_timestamp();
    connection
        .execute(
            "INSERT INTO notes(title, body, tone, image_data, images_json, created_at, updated_at)
             VALUES(?1, ?2, ?3, '', ?4, ?5, ?5)",
            params![title, body, tone, images_json, timestamp],
        )
        .map_err(|error| error.to_string())?;
    let note = note_by_id(&connection, connection.last_insert_rowid())?;
    app.emit("notes-changed", ())
        .map_err(|error| error.to_string())?;
    Ok(note)
}

#[tauri::command]
pub fn update_note(
    app: AppHandle,
    state: State<'_, DataState>,
    id: i64,
    input: NoteInput,
) -> Result<Note, String> {
    let connection = open_connection(&state.db_path)?;
    let (title, body, tone, images_json) = validate_note(input)?;
    let changed = connection
        .execute(
            "UPDATE notes SET title = ?1, body = ?2, tone = ?3, image_data = '', images_json = ?4,
             updated_at = ?5 WHERE id = ?6",
            params![title, body, tone, images_json, now_timestamp(), id],
        )
        .map_err(|error| error.to_string())?;
    require_changed(changed, "便签不存在")?;
    let note = note_by_id(&connection, id)?;
    app.emit("notes-changed", ())
        .map_err(|error| error.to_string())?;
    Ok(note)
}

#[tauri::command]
pub fn delete_note(app: AppHandle, state: State<'_, DataState>, id: i64) -> Result<(), String> {
    let connection = open_connection(&state.db_path)?;
    let changed = connection
        .execute("DELETE FROM notes WHERE id = ?1", [id])
        .map_err(|error| error.to_string())?;
    require_changed(changed, "便签不存在")?;
    app.emit("notes-changed", ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_note_markdown(
    state: State<'_, DataState>,
    id: i64,
    destination: String,
) -> Result<String, String> {
    let destination = markdown_destination(destination)?;
    let parent = destination
        .parent()
        .filter(|path| path.is_dir())
        .ok_or_else(|| "导出目录不存在".to_string())?;
    let connection = open_connection(&state.db_path)?;
    let note = note_by_id(&connection, id).map_err(|_| "便签不存在".to_string())?;
    export_note_to(&note, &destination, parent)?;
    Ok(destination.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn export_notes_markdown(
    state: State<'_, DataState>,
    ids: Vec<i64>,
    destination: String,
) -> Result<String, String> {
    if ids.is_empty() || ids.len() > 500 {
        return Err("请选择要导出的便签".into());
    }
    if ids
        .iter()
        .enumerate()
        .any(|(index, id)| ids[..index].contains(id))
    {
        return Err("导出列表包含重复便签".into());
    }
    let destination = markdown_destination(destination)?;
    let parent = destination
        .parent()
        .filter(|path| path.is_dir())
        .ok_or_else(|| "导出目录不存在".to_string())?;
    let connection = open_connection(&state.db_path)?;
    let notes = ids
        .iter()
        .map(|id| note_by_id(&connection, *id).map_err(|_| "有便签已不存在".to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    export_notes_to(&notes, &destination, parent)?;
    Ok(destination.to_string_lossy().into_owned())
}

fn markdown_destination(destination: String) -> Result<PathBuf, String> {
    let destination = PathBuf::from(destination);
    let extension = destination
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if !extension.eq_ignore_ascii_case("md") {
        return Err("导出文件必须使用 .md 扩展名".into());
    }
    Ok(destination)
}

fn export_note_to(note: &Note, destination: &Path, parent: &Path) -> Result<(), String> {
    let export_title = note
        .title
        .lines()
        .map(str::trim)
        .collect::<Vec<_>>()
        .join(" ");
    let mut markdown = format!("# {export_title}\n");
    let assets_name = format!("note-{}.assets", note.id);
    let assets_dir = parent.join(&assets_name);
    let exported_body = export_note_body(note, &assets_name, &assets_dir, "image")?;
    if !exported_body.trim().is_empty() {
        markdown.push('\n');
        markdown.push_str(exported_body.trim());
        markdown.push('\n');
    }
    fs::write(destination, markdown).map_err(|error| error.to_string())
}

fn export_notes_to(notes: &[Note], destination: &Path, parent: &Path) -> Result<(), String> {
    let assets_name = format!(
        "{}.assets",
        destination
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("ClipNote-便签合集")
    );
    let assets_dir = parent.join(&assets_name);
    let mut markdown = String::from("# ClipNote 便签合集\n");
    for note in notes {
        let export_title = note
            .title
            .lines()
            .map(str::trim)
            .collect::<Vec<_>>()
            .join(" ");
        let image_prefix = format!("note-{}-image", note.id);
        let body = export_note_body(note, &assets_name, &assets_dir, &image_prefix)?;
        markdown.push_str(&format!("\n## {export_title}\n"));
        if !body.trim().is_empty() {
            markdown.push('\n');
            markdown.push_str(body.trim());
            markdown.push('\n');
        }
    }
    fs::write(destination, markdown).map_err(|error| error.to_string())
}

fn export_note_body(
    note: &Note,
    assets_name: &str,
    assets_dir: &Path,
    image_prefix: &str,
) -> Result<String, String> {
    let mut exported_body = note.body.clone();
    if !note.images.is_empty() {
        fs::create_dir_all(assets_dir).map_err(|error| error.to_string())?;
        let export_title = note
            .title
            .lines()
            .map(str::trim)
            .collect::<Vec<_>>()
            .join(" ");
        let alt = export_title.replace(']', "\\]");
        for (index, note_image) in note.images.iter().enumerate() {
            let (extension, image) = decode_note_image(&note_image.data_url)?;
            let image_name = format!("{image_prefix}-{}.{extension}", index + 1);
            fs::write(assets_dir.join(&image_name), image).map_err(|error| error.to_string())?;
            let reference = format!("![{alt}](<./{assets_name}/{image_name}>)");
            let token = note_image_token(&note_image.id);
            if exported_body.contains(&token) {
                exported_body = exported_body.replace(&token, &reference);
            } else {
                exported_body.push_str(&format!("\n\n{reference}"));
            }
        }
    }
    Ok(exported_body)
}

fn decode_note_image(data_url: &str) -> Result<(&'static str, Vec<u8>), String> {
    let (prefix, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "便签图片格式无效".to_string())?;
    let extension = match prefix {
        "data:image/png;base64" => "png",
        "data:image/jpeg;base64" => "jpg",
        "data:image/webp;base64" => "webp",
        "data:image/gif;base64" => "gif",
        _ => return Err("便签图片格式不支持导出".into()),
    };
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| "便签图片编码无效".to_string())?;
    if bytes.is_empty() || bytes.len() > MAX_NOTE_IMAGE_BYTES {
        return Err("便签图片大小无效".into());
    }
    Ok((extension, bytes))
}

fn note_by_id(connection: &Connection, id: i64) -> Result<Note, String> {
    connection
        .query_row(
            "SELECT id, title, body, tone, image_data, images_json, source_clip_ids,
                    desktop_pinned, desktop_x, desktop_y, desktop_width, desktop_height,
                    always_on_top, created_at, updated_at
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
    validate_note_images(&input.images, &input.body)?;
    let body = input.body.trim().to_string();
    let title = if input.title.trim().is_empty() {
        body.lines()
            .map(str::trim)
            .find(|line| !line.is_empty() && !line.starts_with(NOTE_IMAGE_TOKEN_PREFIX))
            .map(derive_title)
            .filter(|title| !title.is_empty())
            .unwrap_or_else(|| {
                if input.images.is_empty() {
                    "未命名便签"
                } else {
                    "图片便签"
                }
                .into()
            })
    } else {
        truncate_chars(input.title.trim(), 80)
    };
    if body.is_empty() && input.images.is_empty() && input.title.trim().is_empty() {
        return Err("便签内容不能为空".into());
    }
    let tone = match input.tone.as_str() {
        "sun" | "mint" | "paper" => input.tone,
        _ => "paper".into(),
    };
    let images_json = serde_json::to_string(&input.images).map_err(|error| error.to_string())?;
    Ok((title, body, tone, images_json))
}

fn validate_note_images(images: &[NoteImage], body: &str) -> Result<(), String> {
    if images.len() > MAX_NOTE_IMAGES {
        return Err(format!("每张便签最多添加 {MAX_NOTE_IMAGES} 张图片"));
    }
    let mut total_bytes = 0;
    for (index, image) in images.iter().enumerate() {
        if image.id.is_empty()
            || image.id.len() > 64
            || !image.id.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '-' | '_')
            })
            || images[..index].iter().any(|other| other.id == image.id)
        {
            return Err("便签图片标识无效".into());
        }
        total_bytes += decode_note_image(&image.data_url)?.1.len();
    }
    if total_bytes > MAX_NOTE_IMAGES_BYTES {
        return Err("便签图片总大小超过限制".into());
    }

    let mut remaining = body;
    while let Some(start) = remaining.find(NOTE_IMAGE_TOKEN_PREFIX) {
        let after_prefix = &remaining[start + NOTE_IMAGE_TOKEN_PREFIX.len()..];
        let end = after_prefix
            .find("}}")
            .ok_or_else(|| "正文中的图片标记不完整".to_string())?;
        let image_id = &after_prefix[..end];
        if !images.iter().any(|image| image.id == image_id) {
            return Err("正文引用了不存在的图片".into());
        }
        remaining = &after_prefix[end + 2..];
    }
    Ok(())
}

fn note_image_token(id: &str) -> String {
    format!("{NOTE_IMAGE_TOKEN_PREFIX}{id}}}}}")
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
    fn bulk_delete_preserves_favorite_clips() {
        let connection = test_connection();
        let favorite = upsert_clip(&connection, "keep me", 10).unwrap().unwrap();
        upsert_clip(&connection, "remove one", 20).unwrap();
        upsert_clip(&connection, "remove two", 30).unwrap();
        connection
            .execute("UPDATE clips SET favorite = 1 WHERE id = ?1", [favorite.id])
            .unwrap();

        assert_eq!(delete_unfavorited_from(&connection).unwrap(), 2);
        let remaining = list_clips_from(&connection).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].preview, "keep me");
        assert!(remaining[0].favorite);
    }

    #[test]
    fn clips_are_classified_for_the_library() {
        assert_eq!(classify_clip("https://tauri.app"), "link");
        assert_eq!(classify_clip(r"C:\\Users\\clip.txt"), "path");
        assert_eq!(classify_clip("const answer = 42;\nanswer"), "code");
        assert_eq!(classify_clip("ordinary note"), "text");
    }

    #[test]
    fn clipboard_is_opened_only_when_the_windows_sequence_changes() {
        assert!(should_read_clipboard(None, Some(10)));
        assert!(!should_read_clipboard(Some(10), Some(10)));
        assert!(should_read_clipboard(Some(10), Some(11)));
        assert!(should_read_clipboard(None, None));
    }

    #[test]
    fn collapsed_window_position_round_trips_through_settings() {
        let mut connection = test_connection();
        assert_eq!(read_collapsed_position_from(&connection).unwrap(), None);

        save_collapsed_position_to(&mut connection, 320, 180).unwrap();

        assert_eq!(
            read_collapsed_position_from(&connection).unwrap(),
            Some((320, 180))
        );
    }

    #[test]
    fn notes_can_be_created_updated_and_deleted() {
        let connection = test_connection();
        let (title, body, tone, images_json) = validate_note(NoteInput {
            title: "".into(),
            body: "First line\nDetails".into(),
            tone: "sun".into(),
            images: vec![],
        })
        .unwrap();
        connection
            .execute(
                "INSERT INTO notes(title, body, tone, images_json, created_at, updated_at)
                 VALUES(?1, ?2, ?3, ?4, 1, 1)",
                params![title, body, tone, images_json],
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
    fn selected_clips_are_merged_into_a_note_with_sources() {
        let connection = test_connection();
        let first = upsert_clip(&connection, "第一段", 1).unwrap().unwrap();
        let second = upsert_clip(&connection, "第二段", 2).unwrap().unwrap();

        let note = create_note_from_clips_in(&connection, &[first.id, second.id]).unwrap();

        assert_eq!(note.source_clip_ids, vec![first.id, second.id]);
        assert!(note.body.contains("第一段\n\n---\n\n第二段"));
        assert_eq!(note.title, "来自剪贴板的 2 条内容");
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
        assert!(columns.iter().any(|column| column == "images_json"));
        assert!(columns.iter().any(|column| column == "source_clip_ids"));
        assert!(columns.iter().any(|column| column == "desktop_pinned"));
        initialize_schema(&connection).unwrap();

        let (title, body, _, images_json) = validate_note(NoteInput {
            title: "".into(),
            body: "".into(),
            tone: "paper".into(),
            images: vec![NoteImage {
                id: "first".into(),
                data_url: "data:image/png;base64,iVBORw0KGgo=".into(),
            }],
        })
        .unwrap();
        assert_eq!(title, "图片便签");
        assert!(body.is_empty());
        assert!(images_json.contains("data:image/png;base64,"));

        connection
            .execute(
                "INSERT INTO notes(title, body, tone, image_data, created_at, updated_at)
                 VALUES('旧便签', '旧正文', 'paper', ?1, 1, 1)",
                ["data:image/png;base64,iVBORw0KGgo="],
            )
            .unwrap();
        let migrated = note_by_id(&connection, connection.last_insert_rowid()).unwrap();
        assert_eq!(migrated.images.len(), 1);
        assert!(migrated.body.starts_with("{{clipnote-image:legacy}}"));
    }

    #[test]
    fn exports_markdown_with_images_in_their_body_order() {
        let root = std::env::temp_dir().join(format!("clipnote-export-{}", now_timestamp()));
        fs::create_dir_all(&root).unwrap();
        let destination = root.join("发布记录.md");
        let note = Note {
            id: 42,
            title: "发布截图".into(),
            body: "构建前\n\n{{clipnote-image:first}}\n\n构建后\n\n{{clipnote-image:second}}"
                .into(),
            tone: "paper".into(),
            images: vec![
                NoteImage {
                    id: "first".into(),
                    data_url: "data:image/png;base64,Zmlyc3Q=".into(),
                },
                NoteImage {
                    id: "second".into(),
                    data_url: "data:image/webp;base64,c2Vjb25k".into(),
                },
            ],
            source_clip_ids: vec![],
            desktop_pinned: false,
            desktop_x: None,
            desktop_y: None,
            desktop_width: 320,
            desktop_height: 260,
            always_on_top: true,
            created_at: 1,
            updated_at: 1,
        };

        export_note_to(&note, &destination, &root).unwrap();

        let markdown = fs::read_to_string(&destination).unwrap();
        assert!(markdown.contains("# 发布截图"));
        let first_reference = "![发布截图](<./note-42.assets/image-1.png>)";
        let second_reference = "![发布截图](<./note-42.assets/image-2.webp>)";
        assert!(markdown.find("构建前").unwrap() < markdown.find(first_reference).unwrap());
        assert!(markdown.find(first_reference).unwrap() < markdown.find("构建后").unwrap());
        assert!(markdown.find("构建后").unwrap() < markdown.find(second_reference).unwrap());
        assert_eq!(
            fs::read(root.join("note-42.assets/image-1.png")).unwrap(),
            b"first"
        );
        assert_eq!(
            fs::read(root.join("note-42.assets/image-2.webp")).unwrap(),
            b"second"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn exports_selected_notes_into_one_markdown_document() {
        let root = std::env::temp_dir().join(format!("clipnote-batch-export-{}", now_timestamp()));
        fs::create_dir_all(&root).unwrap();
        let destination = root.join("项目便签.md");
        let notes = vec![
            Note {
                id: 7,
                title: "需求".into(),
                body: "先看需求\n\n{{clipnote-image:first}}".into(),
                tone: "paper".into(),
                images: vec![NoteImage {
                    id: "first".into(),
                    data_url: "data:image/png;base64,Zmlyc3Q=".into(),
                }],
                source_clip_ids: vec![],
                desktop_pinned: false,
                desktop_x: None,
                desktop_y: None,
                desktop_width: 320,
                desktop_height: 260,
                always_on_top: true,
                created_at: 1,
                updated_at: 2,
            },
            Note {
                id: 3,
                title: "结论".into(),
                body: "可以发布。".into(),
                tone: "mint".into(),
                images: vec![],
                source_clip_ids: vec![],
                desktop_pinned: false,
                desktop_x: None,
                desktop_y: None,
                desktop_width: 320,
                desktop_height: 260,
                always_on_top: true,
                created_at: 1,
                updated_at: 1,
            },
        ];

        export_notes_to(&notes, &destination, &root).unwrap();

        let markdown = fs::read_to_string(&destination).unwrap();
        assert!(markdown.starts_with("# ClipNote 便签合集"));
        assert!(markdown.find("## 需求").unwrap() < markdown.find("## 结论").unwrap());
        assert!(markdown.contains("![需求](<./项目便签.assets/note-7-image-1.png>)"));
        assert_eq!(
            fs::read(root.join("项目便签.assets/note-7-image-1.png")).unwrap(),
            b"first"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
