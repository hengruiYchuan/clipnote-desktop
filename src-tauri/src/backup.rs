use rusqlite::{Connection, MAIN_DB};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter, Manager, State};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

const MANIFEST_NAME: &str = "manifest.json";
const DATABASE_NAME: &str = "data/clipnote.sqlite3";
const VAULT_DATABASE_NAME: &str = "data/vault.sqlite3";
const PREFERENCES_NAME: &str = "preferences.json";
const MAX_ARCHIVE_BYTES: u64 = 512 * 1024 * 1024;
const MAX_ENTRY_BYTES: u64 = 128 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    schema_version: u8,
    product: String,
    created_at: i64,
    includes: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    preferences_json: String,
    clips: i64,
    notes: i64,
}

#[tauri::command]
pub fn export_full_backup(
    state: State<'_, crate::data::DataState>,
    pets: State<'_, crate::pets::PetState>,
    vault: State<'_, crate::vault::VaultState>,
    destination: String,
    preferences_json: String,
) -> Result<String, String> {
    let destination = backup_path(destination)?;
    validate_preferences(&preferences_json)?;
    let work = temporary_directory(state.db_path(), "export")?;
    let snapshot = work.join("clipnote.sqlite3");
    let vault_snapshot = work.join("vault.sqlite3");
    let result = (|| {
        let source = crate::data::open_connection(state.db_path())?;
        source
            .backup(MAIN_DB, &snapshot, None)
            .map_err(|error| error.to_string())?;
        let vault_source = crate::data::open_connection(vault.db_path())?;
        vault_source
            .backup(MAIN_DB, &vault_snapshot, None)
            .map_err(|error| error.to_string())?;
        let file = File::create(&destination).map_err(|error| error.to_string())?;
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o600);
        let manifest = BackupManifest {
            schema_version: 1,
            product: "ClipNote".into(),
            created_at: now_timestamp(),
            includes: vec![
                "database".into(),
                "vault-encrypted".into(),
                "preferences".into(),
                "pets".into(),
            ],
        };
        write_bytes(
            &mut zip,
            MANIFEST_NAME,
            &serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
            options,
        )?;
        write_bytes(
            &mut zip,
            PREFERENCES_NAME,
            preferences_json.as_bytes(),
            options,
        )?;
        write_file(&mut zip, DATABASE_NAME, &snapshot, options)?;
        write_file(&mut zip, VAULT_DATABASE_NAME, &vault_snapshot, options)?;
        add_directory(&mut zip, pets.root(), pets.root(), "pets", options)?;
        zip.finish().map_err(|error| error.to_string())?;
        Ok(destination.to_string_lossy().into_owned())
    })();
    let _ = fs::remove_dir_all(work);
    result
}

#[tauri::command]
pub fn restore_full_backup(
    app: AppHandle,
    state: State<'_, crate::data::DataState>,
    pets: State<'_, crate::pets::PetState>,
    vault: State<'_, crate::vault::VaultState>,
    source: String,
) -> Result<RestoreResult, String> {
    let source = backup_path(source)?;
    let metadata = fs::metadata(&source).map_err(|_| "备份文件不存在".to_string())?;
    if metadata.len() == 0 || metadata.len() > MAX_ARCHIVE_BYTES {
        return Err("备份文件大小无效".into());
    }
    let work = temporary_directory(state.db_path(), "restore")?;
    let result = (|| {
        let file = File::open(&source).map_err(|error| error.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|_| "备份容器格式无效".to_string())?;
        extract_archive(&mut archive, &work)?;
        let manifest: BackupManifest = serde_json::from_slice(
            &fs::read(work.join(MANIFEST_NAME)).map_err(|_| "备份缺少清单".to_string())?,
        )
        .map_err(|_| "备份清单格式无效".to_string())?;
        if manifest.schema_version != 1 || manifest.product != "ClipNote" {
            return Err("备份版本或产品标识无效".into());
        }
        let preferences_json = fs::read_to_string(work.join(PREFERENCES_NAME))
            .map_err(|_| "备份缺少界面设置".to_string())?;
        validate_preferences(&preferences_json)?;
        let restored_db = work.join(DATABASE_NAME);
        validate_database(&restored_db)?;
        let restored_vault = work.join(VAULT_DATABASE_NAME);
        validate_sqlite(&restored_vault, "密码本备份数据库")?;

        for (label, window) in app.webview_windows() {
            if label.starts_with("sticky-") {
                let _ = window.close();
            }
        }
        let rollback = state
            .db_path()
            .with_file_name("clipnote.before-restore.sqlite3");
        let current = crate::data::open_connection(state.db_path())?;
        current
            .backup(MAIN_DB, &rollback, None)
            .map_err(|error| error.to_string())?;
        drop(current);
        let source_connection = crate::data::open_connection(&restored_db)?;
        source_connection
            .backup(MAIN_DB, state.db_path(), None)
            .map_err(|error| error.to_string())?;
        vault.lock_for_restore()?;
        let vault_rollback = vault
            .db_path()
            .with_file_name("vault.before-restore.sqlite3");
        let current_vault = crate::data::open_connection(vault.db_path())?;
        current_vault
            .backup(MAIN_DB, &vault_rollback, None)
            .map_err(|error| error.to_string())?;
        drop(current_vault);
        let vault_source = crate::data::open_connection(&restored_vault)?;
        vault_source
            .backup(MAIN_DB, vault.db_path(), None)
            .map_err(|error| error.to_string())?;
        let restored = crate::data::open_connection(state.db_path())?;
        crate::data::initialize_schema(&restored)?;

        let restored_pets = work.join("pets");
        if restored_pets.is_dir() {
            let previous = pets.root().with_file_name("pets.before-restore");
            if previous.exists() {
                fs::remove_dir_all(&previous).map_err(|error| error.to_string())?;
            }
            if pets.root().exists() {
                fs::rename(pets.root(), &previous).map_err(|error| error.to_string())?;
            }
            fs::rename(&restored_pets, pets.root()).map_err(|error| error.to_string())?;
        }
        let clips = restored
            .query_row("SELECT COUNT(*) FROM clips", [], |row| row.get(0))
            .map_err(|error| error.to_string())?;
        let notes = restored
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .map_err(|error| error.to_string())?;
        app.emit("clips-changed", ())
            .map_err(|error| error.to_string())?;
        app.emit("notes-changed", ())
            .map_err(|error| error.to_string())?;
        app.emit("vault-locked", ())
            .map_err(|error| error.to_string())?;
        crate::window::restore_desktop_notes(&app)?;
        Ok(RestoreResult {
            preferences_json,
            clips,
            notes,
        })
    })();
    let _ = fs::remove_dir_all(work);
    result
}

fn backup_path(value: String) -> Result<PathBuf, String> {
    let path = PathBuf::from(value);
    if !path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("clipnote"))
    {
        return Err("备份文件必须使用 .clipnote 扩展名".into());
    }
    Ok(path)
}

fn validate_preferences(value: &str) -> Result<(), String> {
    let parsed = serde_json::from_str::<serde_json::Value>(value)
        .map_err(|_| "界面设置格式无效".to_string())?;
    let valid = parsed
        .get("collapseLongClips")
        .and_then(|value| value.as_bool())
        .is_some()
        && matches!(
            parsed.get("previewLines").and_then(|value| value.as_u64()),
            Some(4 | 6 | 8)
        );
    if value.len() > 64 * 1024 || !valid {
        return Err("界面设置格式无效".into());
    }
    Ok(())
}

fn validate_database(path: &Path) -> Result<(), String> {
    let connection = validate_sqlite(path, "备份数据库")?;
    for table in ["clips", "notes", "settings"] {
        let exists: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                [table],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if exists != 1 {
            return Err("备份数据库缺少必要数据表".into());
        }
    }
    Ok(())
}

fn validate_sqlite(path: &Path, label: &str) -> Result<Connection, String> {
    let connection = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| format!("{label}无效"))?;
    let integrity: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|_| format!("{label}校验失败"))?;
    if integrity != "ok" {
        return Err(format!("{label}完整性校验失败"));
    }
    Ok(connection)
}

fn extract_archive(archive: &mut ZipArchive<File>, root: &Path) -> Result<(), String> {
    if archive.len() > 5_000 {
        return Err("备份内文件数量过多".into());
    }
    let mut total_size = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        if entry.size() > MAX_ENTRY_BYTES {
            return Err("备份内单个文件过大".into());
        }
        total_size = total_size.saturating_add(entry.size());
        if total_size > MAX_ARCHIVE_BYTES {
            return Err("备份解压后内容过大".into());
        }
        let relative = entry
            .enclosed_name()
            .ok_or_else(|| "备份包含无效路径".to_string())?;
        let destination = root.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&destination).map_err(|error| error.to_string())?;
            continue;
        }
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut output = File::create(destination).map_err(|error| error.to_string())?;
        std::io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn add_directory(
    zip: &mut ZipWriter<File>,
    root: &Path,
    current: &Path,
    prefix: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    if !current.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(current).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let relative = path.strip_prefix(root).map_err(|error| error.to_string())?;
        let name = format!("{prefix}/{}", relative.to_string_lossy().replace('\\', "/"));
        if path.is_dir() {
            add_directory(zip, root, &path, prefix, options)?;
        } else {
            write_file(zip, &name, &path, options)?;
        }
    }
    Ok(())
}

fn write_file(
    zip: &mut ZipWriter<File>,
    name: &str,
    path: &Path,
    options: SimpleFileOptions,
) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    write_bytes(zip, name, &bytes, options)
}

fn write_bytes(
    zip: &mut ZipWriter<File>,
    name: &str,
    bytes: &[u8],
    options: SimpleFileOptions,
) -> Result<(), String> {
    zip.start_file(name, options)
        .map_err(|error| error.to_string())?;
    zip.write_all(bytes).map_err(|error| error.to_string())
}

fn temporary_directory(db_path: &Path, purpose: &str) -> Result<PathBuf, String> {
    let root = db_path
        .parent()
        .ok_or_else(|| "应用数据目录无效".to_string())?;
    let path = root.join(format!(".backup-{purpose}-{}", now_timestamp()));
    if path.exists() {
        fs::remove_dir_all(&path).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

fn now_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_backup_extension_and_preferences() {
        assert!(backup_path("backup.clipnote".into()).is_ok());
        assert!(backup_path("backup.zip".into()).is_err());
        assert!(validate_preferences(r#"{"collapseLongClips":true,"previewLines":6}"#).is_ok());
        assert!(validate_preferences(r#"{"previewLines":12}"#).is_err());
    }
}
