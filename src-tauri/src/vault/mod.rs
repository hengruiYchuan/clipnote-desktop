mod clipboard;
mod crypto;
mod store;

use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
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

struct VaultSession {
    key: Zeroizing<[u8; crypto::KEY_BYTES]>,
    last_activity: Instant,
}

pub struct VaultState {
    db_path: Arc<PathBuf>,
    session: Mutex<Option<VaultSession>>,
    auto_lock_seconds: AtomicU64,
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
    updated_at: i64,
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
            created_at,
            updated_at,
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
    validate_master_password(&password)?;
    let key = store::create(&state.db_path, &password)?;
    set_session(&state, key)
}

#[tauri::command]
pub fn unlock_vault(state: State<'_, VaultState>, password: String) -> Result<(), String> {
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

#[tauri::command]
pub fn copy_vault_username(
    app: AppHandle,
    state: State<'_, VaultState>,
    id: String,
) -> Result<(), String> {
    let username = with_key(&state, |key| {
        Ok(store::get_entry(&state.db_path, key, &id)?.username)
    })?;
    clipboard::copy_secret(app, username, Duration::from_secs(SECRET_CLEAR_SECONDS))
}

#[tauri::command]
pub fn copy_vault_password(
    app: AppHandle,
    state: State<'_, VaultState>,
    id: String,
) -> Result<(), String> {
    let password = with_key(&state, |key| {
        Ok(store::get_entry(&state.db_path, key, &id)?.password)
    })?;
    clipboard::copy_secret(app, password, Duration::from_secs(SECRET_CLEAR_SECONDS))
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
        };
        let entry = store::create_entry(&path, &key, input, 10).unwrap();
        assert_eq!(store::list_entries(&path, &key).unwrap().len(), 1);
        assert_eq!(
            store::get_entry(&path, &key, &entry.id).unwrap().password,
            "top-secret-value"
        );

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
}
