use super::{crypto, VaultEntry, VaultEntryInput, VaultEntrySummary};
use rusqlite::{params, Connection, OptionalExtension, Row, MAIN_DB};
use std::{path::Path, time::Duration};
use zeroize::Zeroizing;

pub fn initialize(path: &Path) -> Result<(), String> {
    let connection = open(path)?;
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS vault_meta (
               id INTEGER PRIMARY KEY CHECK(id = 1),
               schema_version INTEGER NOT NULL,
               kdf_salt BLOB NOT NULL,
               kdf_memory_kib INTEGER NOT NULL,
               kdf_iterations INTEGER NOT NULL,
               kdf_parallelism INTEGER NOT NULL,
               wrap_nonce BLOB NOT NULL,
               wrapped_key BLOB NOT NULL
             );
             CREATE TABLE IF NOT EXISTS vault_entries (
               id TEXT PRIMARY KEY,
               nonce BLOB NOT NULL,
               ciphertext BLOB NOT NULL,
               created_at INTEGER NOT NULL,
               updated_at INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_vault_entries_updated_at
               ON vault_entries(updated_at DESC);
             CREATE TABLE IF NOT EXISTS vault_settings (
               key TEXT PRIMARY KEY,
               value TEXT NOT NULL
             );",
        )
        .map_err(|error| error.to_string())
}

pub fn is_initialized(path: &Path) -> Result<bool, String> {
    let connection = open(path)?;
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM vault_meta WHERE id = 1)",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

pub fn create(path: &Path, password: &str) -> Result<Zeroizing<[u8; crypto::KEY_BYTES]>, String> {
    let mut connection = open(path)?;
    if is_initialized_with(&connection)? {
        return Err("密码本已经初始化".into());
    }
    let (key, wrapped) = crypto::create_vault_key(password)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO vault_meta(
               id, schema_version, kdf_salt, kdf_memory_kib, kdf_iterations,
               kdf_parallelism, wrap_nonce, wrapped_key
             ) VALUES(1, 1, ?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                wrapped.salt.as_slice(),
                wrapped.memory_kib,
                wrapped.iterations,
                wrapped.parallelism,
                wrapped.nonce.as_slice(),
                wrapped.ciphertext,
            ],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(key)
}

pub fn unlock(path: &Path, password: &str) -> Result<Zeroizing<[u8; crypto::KEY_BYTES]>, String> {
    let connection = open(path)?;
    let wrapped = read_wrapped_key(&connection)?.ok_or_else(|| "密码本尚未初始化".to_string())?;
    crypto::unwrap_vault_key(password, &wrapped)
}

pub fn change_password(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
    new_password: &str,
) -> Result<(), String> {
    let wrapped = crypto::wrap_vault_key(new_password, key)?;
    let connection = open(path)?;
    let changed = connection
        .execute(
            "UPDATE vault_meta SET
               kdf_salt = ?1, kdf_memory_kib = ?2, kdf_iterations = ?3,
               kdf_parallelism = ?4, wrap_nonce = ?5, wrapped_key = ?6
             WHERE id = 1",
            params![
                wrapped.salt.as_slice(),
                wrapped.memory_kib,
                wrapped.iterations,
                wrapped.parallelism,
                wrapped.nonce.as_slice(),
                wrapped.ciphertext,
            ],
        )
        .map_err(|error| error.to_string())?;
    if changed == 1 {
        Ok(())
    } else {
        Err("密码本尚未初始化".into())
    }
}

pub fn list_entries(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
) -> Result<Vec<VaultEntrySummary>, String> {
    let connection = open(path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, nonce, ciphertext, created_at, updated_at
             FROM vault_entries ORDER BY updated_at DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let mut entries = statement
        .query_map([], encrypted_row)
        .map_err(|error| error.to_string())?
        .map(|row| {
            row.map_err(|error| error.to_string())
                .and_then(|row| decrypt_row(key, row))
        })
        .map(|result| result.map(VaultEntrySummary::from))
        .collect::<Result<Vec<_>, String>>()?;
    entries.sort_by(|left, right| {
        right
            .pinned
            .cmp(&left.pinned)
            .then_with(|| right.favorite.cmp(&left.favorite))
            .then_with(|| right.last_used_at.cmp(&left.last_used_at))
            .then_with(|| right.updated_at.cmp(&left.updated_at))
    });
    Ok(entries)
}

pub fn get_entry(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
    id: &str,
) -> Result<VaultEntry, String> {
    let connection = open(path)?;
    let row = connection
        .query_row(
            "SELECT id, nonce, ciphertext, created_at, updated_at
             FROM vault_entries WHERE id = ?1",
            [id],
            encrypted_row,
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "密码条目不存在".to_string())?;
    decrypt_row(key, row)
}

pub fn create_entry(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
    input: VaultEntryInput,
    timestamp: i64,
) -> Result<VaultEntry, String> {
    let input = input.validate()?;
    let id = crypto::random_id()?;
    let plaintext = Zeroizing::new(serde_json::to_vec(&input).map_err(|e| e.to_string())?);
    let (nonce, ciphertext) = crypto::encrypt_entry(key, &id, &plaintext)?;
    let connection = open(path)?;
    connection
        .execute(
            "INSERT INTO vault_entries(id, nonce, ciphertext, created_at, updated_at)
             VALUES(?1, ?2, ?3, ?4, ?4)",
            params![id, nonce.as_slice(), ciphertext, timestamp],
        )
        .map_err(|error| error.to_string())?;
    Ok(VaultEntry::from_input(id, input, timestamp, timestamp))
}

pub fn update_entry(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
    id: &str,
    input: VaultEntryInput,
    timestamp: i64,
) -> Result<VaultEntry, String> {
    let input = input.validate()?;
    let existing = get_entry(path, key, id)?;
    let plaintext = Zeroizing::new(serde_json::to_vec(&input).map_err(|e| e.to_string())?);
    let (nonce, ciphertext) = crypto::encrypt_entry(key, id, &plaintext)?;
    let connection = open(path)?;
    let changed = connection
        .execute(
            "UPDATE vault_entries SET nonce = ?1, ciphertext = ?2, updated_at = ?3
             WHERE id = ?4",
            params![nonce.as_slice(), ciphertext, timestamp, id],
        )
        .map_err(|error| error.to_string())?;
    if changed != 1 {
        return Err("密码条目不存在".into());
    }
    Ok(VaultEntry::from_input(
        id.to_string(),
        input,
        existing.created_at,
        timestamp,
    ))
}

pub fn export_backup(path: &Path, destination: &Path) -> Result<(), String> {
    let connection = open(path)?;
    connection
        .backup(MAIN_DB, destination, None)
        .map_err(|error| error.to_string())
}

pub fn list_full_entries(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
) -> Result<Vec<VaultEntry>, String> {
    let connection = open(path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, nonce, ciphertext, created_at, updated_at
             FROM vault_entries ORDER BY updated_at DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let entries = statement
        .query_map([], encrypted_row)
        .map_err(|error| error.to_string())?
        .map(|row| {
            row.map_err(|error| error.to_string())
                .and_then(|row| decrypt_row(key, row))
        })
        .collect();
    entries
}

pub fn merge_backup(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
    backup_path: &Path,
    backup_key: &[u8; crypto::KEY_BYTES],
    timestamp: i64,
) -> Result<(usize, usize), String> {
    let existing = list_full_entries(path, key)?;
    let mut identities = existing
        .iter()
        .map(entry_identity)
        .collect::<std::collections::HashSet<_>>();
    let backup_entries = list_full_entries(backup_path, backup_key)?;
    let mut imported = 0;
    let mut skipped = 0;
    for entry in backup_entries {
        if !identities.insert(entry_identity(&entry)) {
            skipped += 1;
            continue;
        }
        create_entry(path, key, entry.into_input(), timestamp)?;
        imported += 1;
    }
    Ok((imported, skipped))
}

fn entry_identity(entry: &VaultEntry) -> (String, String, String) {
    (
        entry.title.trim().to_lowercase(),
        entry.username.trim().to_lowercase(),
        entry.url.trim().trim_end_matches('/').to_lowercase(),
    )
}

pub fn update_entry_preferences(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
    id: &str,
    favorite: Option<bool>,
    pinned: Option<bool>,
) -> Result<(), String> {
    let entry = get_entry(path, key, id)?;
    let mut input = entry.into_input();
    if let Some(favorite) = favorite {
        input.favorite = favorite;
    }
    if let Some(pinned) = pinned {
        input.pinned = pinned;
    }
    write_entry_payload(path, key, id, &input, None)
}

pub fn touch_entry(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
    id: &str,
    timestamp: i64,
) -> Result<(), String> {
    let entry = get_entry(path, key, id)?;
    let mut input = entry.into_input();
    input.last_used_at = timestamp;
    write_entry_payload(path, key, id, &input, None)
}

fn write_entry_payload(
    path: &Path,
    key: &[u8; crypto::KEY_BYTES],
    id: &str,
    input: &VaultEntryInput,
    updated_at: Option<i64>,
) -> Result<(), String> {
    let plaintext = Zeroizing::new(serde_json::to_vec(input).map_err(|error| error.to_string())?);
    let (nonce, ciphertext) = crypto::encrypt_entry(key, id, &plaintext)?;
    let connection = open(path)?;
    let changed = if let Some(updated_at) = updated_at {
        connection.execute(
            "UPDATE vault_entries SET nonce = ?1, ciphertext = ?2, updated_at = ?3 WHERE id = ?4",
            params![nonce.as_slice(), ciphertext, updated_at, id],
        )
    } else {
        connection.execute(
            "UPDATE vault_entries SET nonce = ?1, ciphertext = ?2 WHERE id = ?3",
            params![nonce.as_slice(), ciphertext, id],
        )
    }
    .map_err(|error| error.to_string())?;
    if changed == 1 {
        Ok(())
    } else {
        Err("密码条目不存在".into())
    }
}

pub fn delete_entry(path: &Path, id: &str) -> Result<(), String> {
    let connection = open(path)?;
    let changed = connection
        .execute("DELETE FROM vault_entries WHERE id = ?1", [id])
        .map_err(|error| error.to_string())?;
    if changed == 1 {
        Ok(())
    } else {
        Err("密码条目不存在".into())
    }
}

pub fn read_auto_lock_seconds(path: &Path) -> Result<u64, String> {
    let connection = open(path)?;
    let value = connection
        .query_row(
            "SELECT value FROM vault_settings WHERE key = 'auto_lock_seconds'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(value
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| (30..=86_400).contains(value))
        .unwrap_or(300))
}

pub fn write_auto_lock_seconds(path: &Path, seconds: u64) -> Result<(), String> {
    let connection = open(path)?;
    connection
        .execute(
            "INSERT INTO vault_settings(key, value) VALUES('auto_lock_seconds', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [seconds.to_string()],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub fn read_or_create_browser_token(path: &Path) -> Result<String, String> {
    let connection = open(path)?;
    if let Some(token) = connection
        .query_row(
            "SELECT value FROM vault_settings WHERE key = 'browser_pairing_token'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
    {
        return Ok(token);
    }
    let token = format!("{}{}", crypto::random_id()?, crypto::random_id()?);
    connection
        .execute(
            "INSERT INTO vault_settings(key, value) VALUES('browser_pairing_token', ?1)",
            [&token],
        )
        .map_err(|error| error.to_string())?;
    Ok(token)
}

pub fn rotate_browser_token(path: &Path) -> Result<String, String> {
    let token = format!("{}{}", crypto::random_id()?, crypto::random_id()?);
    let connection = open(path)?;
    connection
        .execute(
            "INSERT INTO vault_settings(key, value) VALUES('browser_pairing_token', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [&token],
        )
        .map_err(|error| error.to_string())?;
    Ok(token)
}

fn open(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .busy_timeout(Duration::from_secs(2))
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

fn is_initialized_with(connection: &Connection) -> Result<bool, String> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM vault_meta WHERE id = 1)",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

fn read_wrapped_key(connection: &Connection) -> Result<Option<crypto::WrappedVaultKey>, String> {
    connection
        .query_row(
            "SELECT kdf_salt, kdf_memory_kib, kdf_iterations, kdf_parallelism,
                    wrap_nonce, wrapped_key
             FROM vault_meta WHERE id = 1",
            [],
            |row| {
                let salt = fixed_blob::<{ crypto::SALT_BYTES }>(row, 0)?;
                let nonce = fixed_blob::<{ crypto::NONCE_BYTES }>(row, 4)?;
                Ok(crypto::WrappedVaultKey {
                    salt,
                    memory_kib: row.get(1)?,
                    iterations: row.get(2)?,
                    parallelism: row.get(3)?,
                    nonce,
                    ciphertext: row.get(5)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

struct EncryptedRow {
    id: String,
    nonce: [u8; crypto::NONCE_BYTES],
    ciphertext: Vec<u8>,
    created_at: i64,
    updated_at: i64,
}

fn encrypted_row(row: &Row<'_>) -> rusqlite::Result<EncryptedRow> {
    Ok(EncryptedRow {
        id: row.get(0)?,
        nonce: fixed_blob::<{ crypto::NONCE_BYTES }>(row, 1)?,
        ciphertext: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn decrypt_row(key: &[u8; crypto::KEY_BYTES], row: EncryptedRow) -> Result<VaultEntry, String> {
    let plaintext = crypto::decrypt_entry(key, &row.id, &row.nonce, &row.ciphertext)?;
    let input: VaultEntryInput =
        serde_json::from_slice(&plaintext).map_err(|_| "密码条目格式已损坏".to_string())?;
    Ok(VaultEntry::from_input(
        row.id,
        input,
        row.created_at,
        row.updated_at,
    ))
}

fn fixed_blob<const N: usize>(row: &Row<'_>, index: usize) -> rusqlite::Result<[u8; N]> {
    let bytes: Vec<u8> = row.get(index)?;
    bytes.try_into().map_err(|_| {
        rusqlite::Error::FromSqlConversionFailure(
            index,
            rusqlite::types::Type::Blob,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "invalid fixed-size blob",
            )),
        )
    })
}
