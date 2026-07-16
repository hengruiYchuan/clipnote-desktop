mod browser;
mod clipboard;
mod crypto;
mod import;
mod store;

use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};
use zeroize::Zeroizing;

const MIN_MASTER_PASSWORD_CHARS: usize = 10;
const MIN_AUTO_LOCK_SECONDS: u64 = 30;
const MAX_AUTO_LOCK_SECONDS: u64 = 86_400;
const SECRET_CLEAR_SECONDS: u64 = 30;
const PAIRING_CLEAR_SECONDS: u64 = 120;

struct VaultSession {
    key: Zeroizing<[u8; crypto::KEY_BYTES]>,
    last_activity: Instant,
}

pub struct VaultState {
    db_path: Arc<PathBuf>,
    session: Mutex<Option<VaultSession>>,
    auto_lock_seconds: AtomicU64,
}

impl VaultState {
    pub(crate) fn db_path(&self) -> &Path {
        self.db_path.as_ref()
    }

    pub(crate) fn lock_for_restore(&self) -> Result<(), String> {
        *self
            .session
            .lock()
            .map_err(|_| "密码本会话异常".to_string())? = None;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    initialized: bool,
    unlocked: bool,
    auto_lock_seconds: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntryInput {
    title: String,
    #[serde(default)]
    username: String,
    #[serde(default)]
    password: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    note: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    favorite: bool,
    #[serde(default)]
    pinned: bool,
    #[serde(default)]
    last_used_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntry {
    id: String,
    title: String,
    username: String,
    password: String,
    url: String,
    note: String,
    tags: Vec<String>,
    favorite: bool,
    pinned: bool,
    last_used_at: i64,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntrySummary {
    id: String,
    title: String,
    username: String,
    url: String,
    tags: Vec<String>,
    favorite: bool,
    pinned: bool,
    last_used_at: i64,
    updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultRestoreResult {
    imported: usize,
    skipped: usize,
    replaced: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultImportPreviewRow {
    index: usize,
    title: String,
    username: String,
    url: String,
    tags: Vec<String>,
    duplicate: bool,
    has_password: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultImportResult {
    imported: usize,
    skipped: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBridgeInfo {
    port: u16,
}

impl VaultEntryInput {
    fn validate(mut self) -> Result<Self, String> {
        self.title = self.title.trim().to_string();
        self.username = self.username.trim().to_string();
        self.url = self.url.trim().to_string();
        self.tags = self
            .tags
            .into_iter()
            .map(|tag| tag.trim().to_string())
            .filter(|tag| !tag.is_empty())
            .take(20)
            .collect();
        if self.title.is_empty() {
            return Err("名称不能为空".into());
        }
        if self.title.chars().count() > 120
            || self.username.chars().count() > 512
            || self.password.chars().count() > 4096
            || self.url.chars().count() > 2048
            || self.note.chars().count() > 16_384
            || self.tags.iter().any(|tag| tag.chars().count() > 60)
        {
            return Err("密码条目内容过长".into());
        }
        Ok(self)
    }
}

impl VaultEntry {
    fn from_input(id: String, input: VaultEntryInput, created_at: i64, updated_at: i64) -> Self {
        Self {
            id,
            title: input.title,
            username: input.username,
            password: input.password,
            url: input.url,
            note: input.note,
            tags: input.tags,
            favorite: input.favorite,
            pinned: input.pinned,
            last_used_at: input.last_used_at,
            created_at,
            updated_at,
        }
    }

    pub(super) fn into_input(self) -> VaultEntryInput {
        VaultEntryInput {
            title: self.title,
            username: self.username,
            password: self.password,
            url: self.url,
            note: self.note,
            tags: self.tags,
            favorite: self.favorite,
            pinned: self.pinned,
            last_used_at: self.last_used_at,
        }
    }
}

impl From<VaultEntry> for VaultEntrySummary {
    fn from(entry: VaultEntry) -> Self {
        Self {
            id: entry.id,
            title: entry.title,
            username: entry.username,
            url: entry.url,
            tags: entry.tags,
            favorite: entry.favorite,
            pinned: entry.pinned,
            last_used_at: entry.last_used_at,
            updated_at: entry.updated_at,
        }
    }
}

pub fn initialize(app: &AppHandle) -> Result<VaultState, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    let db_path = app_data_dir.join("vault.sqlite3");
    store::initialize(&db_path)?;
    let auto_lock_seconds = store::read_auto_lock_seconds(&db_path)?;
    Ok(VaultState {
        db_path: Arc::new(db_path),
        session: Mutex::new(None),
        auto_lock_seconds: AtomicU64::new(auto_lock_seconds),
    })
}

pub fn start_auto_lock(app: AppHandle) {
    thread::Builder::new()
        .name("clipnote-vault-lock".into())
        .spawn(move || loop {
            thread::sleep(Duration::from_secs(1));
            let state = app.state::<VaultState>();
            let timeout = Duration::from_secs(state.auto_lock_seconds.load(Ordering::Relaxed));
            let did_lock = state
                .session
                .lock()
                .map(|mut session| {
                    let expired = session
                        .as_ref()
                        .is_some_and(|session| session.last_activity.elapsed() >= timeout);
                    if expired {
                        *session = None;
                    }
                    expired
                })
                .unwrap_or(false);
            if did_lock {
                let _ = app.emit("vault-locked", ());
            }
        })
        .expect("failed to start vault auto-lock monitor");
}

fn validate_master_password(password: &str) -> Result<(), String> {
    if password.chars().count() < MIN_MASTER_PASSWORD_CHARS {
        Err(format!("主密码至少需要 {MIN_MASTER_PASSWORD_CHARS} 个字符"))
    } else {
        Ok(())
    }
}

fn set_session(state: &VaultState, key: Zeroizing<[u8; crypto::KEY_BYTES]>) -> Result<(), String> {
    *state
        .session
        .lock()
        .map_err(|_| "密码本会话异常".to_string())? = Some(VaultSession {
        key,
        last_activity: Instant::now(),
    });
    Ok(())
}

fn with_key<T>(
    state: &VaultState,
    operation: impl FnOnce(&[u8; crypto::KEY_BYTES]) -> Result<T, String>,
) -> Result<T, String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "密码本会话异常".to_string())?;
    let session = session.as_mut().ok_or_else(|| "密码本已锁定".to_string())?;
    session.last_activity = Instant::now();
    operation(&session.key)
}

#[tauri::command]
pub fn vault_status(state: State<'_, VaultState>) -> Result<VaultStatus, String> {
    Ok(VaultStatus {
        initialized: store::is_initialized(&state.db_path)?,
        unlocked: state
            .session
            .lock()
            .map_err(|_| "密码本会话异常".to_string())?
            .is_some(),
        auto_lock_seconds: state.auto_lock_seconds.load(Ordering::Relaxed),
    })
}

#[tauri::command]
pub fn create_vault(state: State<'_, VaultState>, password: String) -> Result<(), String> {
    let password = Zeroizing::new(password);
    validate_master_password(&password)?;
    let key = store::create(&state.db_path, &password)?;
    set_session(&state, key)
}

#[tauri::command]
pub fn unlock_vault(state: State<'_, VaultState>, password: String) -> Result<(), String> {
    let password = Zeroizing::new(password);
    let key = store::unlock(&state.db_path, &password)?;
    set_session(&state, key)
}

#[tauri::command]
pub fn lock_vault(app: AppHandle, state: State<'_, VaultState>) -> Result<(), String> {
    *state
        .session
        .lock()
        .map_err(|_| "密码本会话异常".to_string())? = None;
    app.emit("vault-locked", ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_vault_entries(state: State<'_, VaultState>) -> Result<Vec<VaultEntrySummary>, String> {
    with_key(&state, |key| store::list_entries(&state.db_path, key))
}

#[tauri::command]
pub fn get_vault_entry(state: State<'_, VaultState>, id: String) -> Result<VaultEntry, String> {
    with_key(&state, |key| store::get_entry(&state.db_path, key, &id))
}

#[tauri::command]
pub fn create_vault_entry(
    state: State<'_, VaultState>,
    input: VaultEntryInput,
) -> Result<VaultEntry, String> {
    with_key(&state, |key| {
        store::create_entry(&state.db_path, key, input, now_timestamp())
    })
}

#[tauri::command]
pub fn update_vault_entry(
    state: State<'_, VaultState>,
    id: String,
    input: VaultEntryInput,
) -> Result<VaultEntry, String> {
    with_key(&state, |key| {
        store::update_entry(&state.db_path, key, &id, input, now_timestamp())
    })
}

#[tauri::command]
pub fn delete_vault_entry(state: State<'_, VaultState>, id: String) -> Result<(), String> {
    with_key(&state, |_| store::delete_entry(&state.db_path, &id))
}

#[tauri::command]
pub fn change_vault_password(
    state: State<'_, VaultState>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    let current_password = Zeroizing::new(current_password);
    let new_password = Zeroizing::new(new_password);
    validate_master_password(&new_password)?;
    let verified_key = store::unlock(&state.db_path, &current_password)?;
    with_key(&state, |session_key| {
        if session_key != &*verified_key {
            return Err("密码本会话已变更，请重新解锁".into());
        }
        store::change_password(&state.db_path, session_key, &new_password)
    })
}

#[tauri::command]
pub fn set_vault_auto_lock(state: State<'_, VaultState>, seconds: u64) -> Result<(), String> {
    if !(MIN_AUTO_LOCK_SECONDS..=MAX_AUTO_LOCK_SECONDS).contains(&seconds) {
        return Err("自动锁定时间需要在 30 秒到 24 小时之间".into());
    }
    store::write_auto_lock_seconds(&state.db_path, seconds)?;
    state.auto_lock_seconds.store(seconds, Ordering::Relaxed);
    Ok(())
}

pub fn start_browser_bridge(app: AppHandle) {
    browser::start(app);
}

#[tauri::command]
pub fn export_vault_backup(
    state: State<'_, VaultState>,
    destination: String,
) -> Result<String, String> {
    if !store::is_initialized(&state.db_path)? {
        return Err("密码本尚未初始化".into());
    }
    let destination = validate_backup_path(PathBuf::from(destination), false)?;
    let temporary = destination.with_extension("clipvault.tmp");
    let _ = fs::remove_file(&temporary);
    store::export_backup(&state.db_path, &temporary)?;
    if destination.exists() {
        fs::remove_file(&destination).map_err(|error| error.to_string())?;
    }
    fs::rename(&temporary, &destination).map_err(|error| error.to_string())?;
    Ok(destination.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn restore_vault_backup(
    app: AppHandle,
    state: State<'_, VaultState>,
    source: String,
    password: String,
    mode: String,
) -> Result<VaultRestoreResult, String> {
    let source = validate_backup_path(PathBuf::from(source), true)?;
    let password = Zeroizing::new(password);
    let backup_key = store::unlock(&source, &password)?;
    if mode == "merge" {
        let (imported, skipped) = with_key(&state, |key| {
            store::merge_backup(&state.db_path, key, &source, &backup_key, now_timestamp())
        })?;
        return Ok(VaultRestoreResult {
            imported,
            skipped,
            replaced: false,
        });
    }
    if mode != "replace" {
        return Err("恢复方式无效".into());
    }

    let rollback = state.db_path.with_extension("before-restore.sqlite3");
    let replacement = state.db_path.with_extension("restore.tmp");
    let _ = fs::remove_file(&rollback);
    let _ = fs::remove_file(&replacement);
    store::export_backup(&state.db_path, &rollback)?;
    fs::copy(&source, &replacement).map_err(|error| error.to_string())?;
    store::unlock(&replacement, &password)?;
    *state
        .session
        .lock()
        .map_err(|_| "密码本会话异常".to_string())? = None;
    if let Err(error) = replace_vault_file(&state.db_path, &replacement) {
        let _ = fs::copy(&rollback, &*state.db_path);
        return Err(error);
    }
    app.emit("vault-locked", ())
        .map_err(|error| error.to_string())?;
    Ok(VaultRestoreResult {
        imported: 0,
        skipped: 0,
        replaced: true,
    })
}

#[tauri::command]
pub fn preview_vault_csv(
    state: State<'_, VaultState>,
    source: String,
) -> Result<Vec<VaultImportPreviewRow>, String> {
    let source = validate_csv_path(PathBuf::from(source))?;
    with_key(&state, |key| {
        let existing = store::list_full_entries(&state.db_path, key)?;
        import::preview(&source, &existing)
    })
}

#[tauri::command]
pub fn import_vault_csv(
    state: State<'_, VaultState>,
    source: String,
    selected: Vec<usize>,
) -> Result<VaultImportResult, String> {
    let source = validate_csv_path(PathBuf::from(source))?;
    if selected.is_empty() {
        return Err("请选择要导入的条目".into());
    }
    with_key(&state, |key| {
        let existing = store::list_full_entries(&state.db_path, key)?;
        let rows = import::read_selected(&source, &existing, &selected)?;
        let mut imported = 0;
        let mut skipped = 0;
        for row in rows {
            if row.duplicate || row.input.password.is_empty() {
                skipped += 1;
                continue;
            }
            store::create_entry(&state.db_path, key, row.input, now_timestamp())?;
            imported += 1;
        }
        Ok(VaultImportResult { imported, skipped })
    })
}

fn validate_backup_path(path: PathBuf, must_exist: bool) -> Result<PathBuf, String> {
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("clipvault"))
    {
        return Err("备份文件必须使用 .clipvault 扩展名".into());
    }
    if must_exist && !path.is_file() {
        return Err("备份文件不存在".into());
    }
    if !must_exist && !path.parent().is_some_and(Path::is_dir) {
        return Err("备份目录不存在".into());
    }
    Ok(path)
}

fn validate_csv_path(path: PathBuf) -> Result<PathBuf, String> {
    if !path.is_file()
        || !path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("csv"))
    {
        return Err("请选择 CSV 文件".into());
    }
    if fs::metadata(&path)
        .map_err(|error| error.to_string())?
        .len()
        > 10 * 1024 * 1024
    {
        return Err("CSV 文件不能超过 10 MB".into());
    }
    Ok(path)
}

fn replace_vault_file(destination: &Path, replacement: &Path) -> Result<(), String> {
    for suffix in ["-wal", "-shm"] {
        let sidecar = PathBuf::from(format!("{}{suffix}", destination.to_string_lossy()));
        let _ = fs::remove_file(sidecar);
    }
    fs::remove_file(destination).map_err(|error| error.to_string())?;
    fs::rename(replacement, destination).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn touch_vault_activity(state: State<'_, VaultState>) -> Result<(), String> {
    with_key(&state, |_| Ok(()))
}

#[tauri::command]
pub fn copy_browser_pairing_token(
    app: AppHandle,
    state: State<'_, VaultState>,
) -> Result<BrowserBridgeInfo, String> {
    with_key(&state, |_| Ok(()))?;
    let token = store::read_or_create_browser_token(&state.db_path)?;
    clipboard::copy_secret(app, token, Duration::from_secs(PAIRING_CLEAR_SECONDS))?;
    Ok(BrowserBridgeInfo {
        port: browser::PORT,
    })
}

#[tauri::command]
pub fn rotate_browser_pairing_token(
    app: AppHandle,
    state: State<'_, VaultState>,
) -> Result<BrowserBridgeInfo, String> {
    with_key(&state, |_| Ok(()))?;
    let token = store::rotate_browser_token(&state.db_path)?;
    clipboard::copy_secret(app, token, Duration::from_secs(PAIRING_CLEAR_SECONDS))?;
    Ok(BrowserBridgeInfo {
        port: browser::PORT,
    })
}

#[tauri::command]
pub fn set_vault_entry_favorite(
    state: State<'_, VaultState>,
    id: String,
    favorite: bool,
) -> Result<(), String> {
    with_key(&state, |key| {
        store::update_entry_preferences(&state.db_path, key, &id, Some(favorite), None)
    })
}

#[tauri::command]
pub fn set_vault_entry_pinned(
    state: State<'_, VaultState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    with_key(&state, |key| {
        store::update_entry_preferences(&state.db_path, key, &id, None, Some(pinned))
    })
}

#[tauri::command]
pub fn open_vault_url(state: State<'_, VaultState>, id: String) -> Result<(), String> {
    let raw_url = with_key(&state, |key| {
        Ok(store::get_entry(&state.db_path, key, &id)?.url)
    })?;
    let parsed = url::Url::parse(&raw_url).map_err(|_| "网址格式无效".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("仅支持打开 HTTP 或 HTTPS 网址".into());
    }
    webbrowser::open(parsed.as_str()).map_err(|error| error.to_string())?;
    with_key(&state, |key| {
        store::touch_entry(&state.db_path, key, &id, now_timestamp())
    })
}

#[tauri::command]
pub fn copy_vault_username(
    app: AppHandle,
    state: State<'_, VaultState>,
    id: String,
) -> Result<i64, String> {
    let copied_at = now_timestamp();
    let username = with_key(&state, |key| {
        let entry = store::get_entry(&state.db_path, key, &id)?;
        store::touch_entry(&state.db_path, key, &id, copied_at)?;
        Ok(entry.username)
    })?;
    clipboard::copy_secret(app, username, Duration::from_secs(SECRET_CLEAR_SECONDS))?;
    Ok(copied_at + SECRET_CLEAR_SECONDS as i64)
}

#[tauri::command]
pub fn copy_vault_password(
    app: AppHandle,
    state: State<'_, VaultState>,
    id: String,
) -> Result<i64, String> {
    let copied_at = now_timestamp();
    let password = with_key(&state, |key| {
        let entry = store::get_entry(&state.db_path, key, &id)?;
        store::touch_entry(&state.db_path, key, &id, copied_at)?;
        Ok(entry.password)
    })?;
    clipboard::copy_secret(app, password, Duration::from_secs(SECRET_CLEAR_SECONDS))?;
    Ok(copied_at + SECRET_CLEAR_SECONDS as i64)
}

#[tauri::command]
pub fn set_vault_content_protected(app: AppHandle, protected: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    window
        .set_content_protected(protected)
        .map_err(|error| error.to_string())
}

fn now_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "clipnote-{name}-{}.sqlite3",
            crypto::random_id().unwrap()
        ))
    }

    #[test]
    fn vault_crud_password_change_and_plaintext_absence() {
        let path = test_path("vault");
        store::initialize(&path).unwrap();
        let key = store::create(&path, "correct horse battery staple").unwrap();
        let input = VaultEntryInput {
            title: "邮箱".into(),
            username: "private@example.test".into(),
            password: "top-secret-value".into(),
            url: "https://example.test".into(),
            note: "private note".into(),
            tags: vec!["工作".into()],
            favorite: false,
            pinned: false,
            last_used_at: 0,
        };
        let entry = store::create_entry(&path, &key, input, 10).unwrap();
        assert_eq!(store::list_entries(&path, &key).unwrap().len(), 1);
        assert_eq!(
            store::get_entry(&path, &key, &entry.id).unwrap().password,
            "top-secret-value"
        );
        store::update_entry_preferences(&path, &key, &entry.id, Some(true), Some(true)).unwrap();
        store::touch_entry(&path, &key, &entry.id, 99).unwrap();
        let summary = store::list_entries(&path, &key).unwrap().remove(0);
        assert!(summary.favorite);
        assert!(summary.pinned);
        assert_eq!(summary.last_used_at, 99);

        let bytes = fs::read(&path).unwrap();
        for plaintext in ["private@example.test", "top-secret-value", "private note"] {
            assert!(!bytes
                .windows(plaintext.len())
                .any(|window| window == plaintext.as_bytes()));
        }

        store::change_password(&path, &key, "a completely new master password").unwrap();
        assert!(store::unlock(&path, "correct horse battery staple").is_err());
        assert_eq!(
            store::unlock(&path, "a completely new master password")
                .unwrap()
                .as_ref(),
            &*key
        );
        store::delete_entry(&path, &entry.id).unwrap();
        assert!(store::list_entries(&path, &key).unwrap().is_empty());
        drop(key);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn encrypted_backup_can_be_unlocked_and_merged() {
        let source = test_path("backup-source");
        let destination = test_path("backup-copy");
        let current = test_path("backup-current");
        for path in [&source, &current] {
            store::initialize(path).unwrap();
        }
        let source_key = store::create(&source, "source master password").unwrap();
        store::create_entry(
            &source,
            &source_key,
            VaultEntryInput {
                title: "来源邮箱".into(),
                username: "source@example.test".into(),
                password: "source-secret".into(),
                url: "https://example.test".into(),
                note: String::new(),
                tags: vec!["备份".into()],
                favorite: true,
                pinned: false,
                last_used_at: 7,
            },
            1,
        )
        .unwrap();
        store::export_backup(&source, &destination).unwrap();
        let backup_key = store::unlock(&destination, "source master password").unwrap();

        let current_key = store::create(&current, "current master password").unwrap();
        let (imported, skipped) =
            store::merge_backup(&current, &current_key, &destination, &backup_key, 2).unwrap();
        assert_eq!((imported, skipped), (1, 0));
        assert_eq!(
            store::list_entries(&current, &current_key).unwrap().len(),
            1
        );

        for path in [source, destination, current] {
            let _ = fs::remove_file(path);
        }
    }
}
