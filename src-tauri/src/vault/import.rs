use super::{VaultEntry, VaultEntryInput, VaultImportPreviewRow};
use csv::{ReaderBuilder, StringRecord, Trim};
use std::{collections::HashSet, path::Path};

const MAX_IMPORT_ROWS: usize = 5_000;

pub struct ParsedImportRow {
    pub input: VaultEntryInput,
    pub duplicate: bool,
}

pub fn preview(path: &Path, existing: &[VaultEntry]) -> Result<Vec<VaultImportPreviewRow>, String> {
    parse(path, existing).map(|rows| {
        rows.into_iter()
            .enumerate()
            .map(|(index, row)| VaultImportPreviewRow {
                index,
                title: row.input.title,
                username: row.input.username,
                url: row.input.url,
                tags: row.input.tags,
                duplicate: row.duplicate,
                has_password: !row.input.password.is_empty(),
            })
            .collect()
    })
}

pub fn read_selected(
    path: &Path,
    existing: &[VaultEntry],
    selected: &[usize],
) -> Result<Vec<ParsedImportRow>, String> {
    let selected = selected.iter().copied().collect::<HashSet<_>>();
    Ok(parse(path, existing)?
        .into_iter()
        .enumerate()
        .filter_map(|(index, row)| selected.contains(&index).then_some(row))
        .collect())
}

fn parse(path: &Path, existing: &[VaultEntry]) -> Result<Vec<ParsedImportRow>, String> {
    let mut reader = ReaderBuilder::new()
        .flexible(true)
        .trim(Trim::All)
        .from_path(path)
        .map_err(|error| format!("CSV 读取失败：{error}"))?;
    let headers = reader
        .headers()
        .map_err(|error| format!("CSV 表头无效：{error}"))?
        .iter()
        .map(normalize_header)
        .collect::<Vec<_>>();
    let mut identities = existing.iter().map(entry_identity).collect::<HashSet<_>>();
    let mut rows = Vec::new();
    for (index, record) in reader.records().enumerate() {
        if index >= MAX_IMPORT_ROWS {
            return Err(format!("CSV 最多导入 {MAX_IMPORT_ROWS} 行"));
        }
        let record = record.map_err(|error| format!("CSV 第 {} 行无效：{error}", index + 2))?;
        let title = field(&headers, &record, &["name", "title"]);
        let username = field(&headers, &record, &["username", "loginusername", "email"]);
        let password = field(&headers, &record, &["password", "loginpassword"]);
        let url = field(&headers, &record, &["url", "loginuri", "website"]);
        let note = field(&headers, &record, &["note", "notes", "extra"]);
        let raw_tags = field(
            &headers,
            &record,
            &["tags", "folder", "grouping", "category"],
        );
        if title.is_empty() && username.is_empty() && url.is_empty() && password.is_empty() {
            continue;
        }
        let title = if title.is_empty() {
            url::Url::parse(&url)
                .ok()
                .and_then(|url| url.host_str().map(str::to_string))
                .filter(|host| !host.is_empty())
                .or_else(|| (!username.is_empty()).then(|| username.clone()))
                .unwrap_or_else(|| format!("导入条目 {}", index + 1))
        } else {
            title
        };
        let tags = raw_tags
            .split([',', ';', '，'])
            .map(str::trim)
            .filter(|tag| !tag.is_empty())
            .map(str::to_string)
            .take(20)
            .collect::<Vec<_>>();
        let input = VaultEntryInput {
            title,
            username,
            password,
            url,
            note,
            tags,
            favorite: false,
            pinned: false,
            last_used_at: 0,
        };
        let duplicate = !identities.insert(input_identity(&input));
        rows.push(ParsedImportRow { input, duplicate });
    }
    if rows.is_empty() {
        return Err("CSV 中没有可导入的密码条目".into());
    }
    Ok(rows)
}

fn field(headers: &[String], record: &StringRecord, aliases: &[&str]) -> String {
    aliases
        .iter()
        .find_map(|alias| {
            headers
                .iter()
                .position(|header| header == alias)
                .and_then(|index| record.get(index))
        })
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn normalize_header(value: &str) -> String {
    value
        .trim_start_matches('\u{feff}')
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn entry_identity(entry: &VaultEntry) -> (String, String, String) {
    (
        entry.title.trim().to_lowercase(),
        entry.username.trim().to_lowercase(),
        entry.url.trim().trim_end_matches('/').to_lowercase(),
    )
}

fn input_identity(input: &VaultEntryInput) -> (String, String, String) {
    (
        input.title.trim().to_lowercase(),
        input.username.trim().to_lowercase(),
        input.url.trim().trim_end_matches('/').to_lowercase(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn previews_common_password_manager_columns_without_returning_passwords() {
        let path = std::env::temp_dir().join(format!(
            "clipnote-import-{}.csv",
            crate::vault::crypto::random_id().unwrap()
        ));
        fs::write(
            &path,
            "name,url,username,password,note,folder\n邮箱,https://mail.example.test,user@example.test,secret,说明,工作\n",
        )
        .unwrap();

        let preview = preview(&path, &[]).unwrap();
        assert_eq!(preview.len(), 1);
        assert_eq!(preview[0].title, "邮箱");
        assert!(preview[0].has_password);
        assert!(!preview[0].duplicate);
        let selected = read_selected(&path, &[], &[0]).unwrap();
        assert_eq!(selected[0].input.password, "secret");

        let _ = fs::remove_file(path);
    }
}
