use super::{now_timestamp, store, with_key, VaultEntrySummary, VaultState};
use serde::{Deserialize, Serialize};
use std::{cmp::Reverse, io::Read, thread};
use tauri::{AppHandle, Manager};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

pub const PORT: u16 = 32_145;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserStatus {
    unlocked: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserCandidate {
    id: String,
    title: String,
    username: String,
    url: String,
    tags: Vec<String>,
    favorite: bool,
    pinned: bool,
    last_used_at: i64,
}

#[derive(Deserialize)]
struct CredentialRequest {
    id: String,
}

#[derive(Serialize)]
struct BrowserCredential {
    username: String,
    password: String,
}

pub fn start(app: AppHandle) {
    thread::Builder::new()
        .name("clipnote-browser-bridge".into())
        .spawn(move || {
            let Ok(server) = Server::http(("127.0.0.1", PORT)) else {
                return;
            };
            for request in server.incoming_requests() {
                handle_request(&app, request);
            }
        })
        .expect("failed to start browser bridge");
}

fn handle_request(app: &AppHandle, mut request: Request) {
    if request.method() == &Method::Options {
        respond(request, 204, "");
        return;
    }
    let state = app.state::<VaultState>();
    if !authorized(&state, &request) {
        respond_json(
            request,
            401,
            &serde_json::json!({ "error": "配对令牌无效" }),
        );
        return;
    }
    let request_url = request.url().to_string();
    let (path, query) = request_url.split_once('?').unwrap_or((&request_url, ""));
    match (request.method(), path) {
        (&Method::Get, "/v1/status") => {
            let unlocked = state
                .session
                .lock()
                .map(|session| session.is_some())
                .unwrap_or(false);
            respond_json(request, 200, &BrowserStatus { unlocked });
        }
        (&Method::Get, "/v1/candidates") => {
            let params = url::form_urlencoded::parse(query.as_bytes())
                .into_owned()
                .collect::<std::collections::HashMap<_, _>>();
            let page_url = params.get("url").map(String::as_str).unwrap_or_default();
            let search = params.get("q").map(String::as_str).unwrap_or_default();
            match candidates(&state, page_url, search) {
                Ok(candidates) => respond_json(request, 200, &candidates),
                Err(error) => respond_json(request, 423, &serde_json::json!({ "error": error })),
            }
        }
        (&Method::Post, "/v1/credential") => {
            let mut body = String::new();
            if request
                .as_reader()
                .take(32 * 1024)
                .read_to_string(&mut body)
                .is_err()
            {
                respond_json(
                    request,
                    400,
                    &serde_json::json!({ "error": "请求内容无效" }),
                );
                return;
            }
            let Ok(payload) = serde_json::from_str::<CredentialRequest>(&body) else {
                respond_json(
                    request,
                    400,
                    &serde_json::json!({ "error": "请求格式无效" }),
                );
                return;
            };
            match credential(&state, &payload.id) {
                Ok(credential) => respond_json(request, 200, &credential),
                Err(error) => respond_json(request, 423, &serde_json::json!({ "error": error })),
            }
        }
        _ => respond_json(request, 404, &serde_json::json!({ "error": "接口不存在" })),
    }
}

fn authorized(state: &VaultState, request: &Request) -> bool {
    let expected = store::read_or_create_browser_token(&state.db_path).ok();
    let supplied = request
        .headers()
        .iter()
        .find(|header| header.field.equiv("Authorization"))
        .map(|header| header.value.as_str())
        .and_then(|value| value.strip_prefix("Bearer "));
    expected.as_deref() == supplied
}

fn candidates(
    state: &VaultState,
    page_url: &str,
    search: &str,
) -> Result<Vec<BrowserCandidate>, String> {
    let page_host = url::Url::parse(page_url)
        .ok()
        .and_then(|url| url.host_str().map(normalize_host))
        .unwrap_or_default();
    let search = search.trim().to_lowercase();
    let entries = with_key(state, |key| store::list_entries(&state.db_path, key))?;
    let mut scored = entries
        .into_iter()
        .filter_map(|entry| {
            let score = candidate_score(&entry, &page_host, &search);
            (score > 0).then_some((score, entry))
        })
        .collect::<Vec<_>>();
    scored.sort_by_key(|(score, entry)| {
        (
            Reverse(entry.pinned),
            Reverse(entry.favorite),
            Reverse(*score),
            Reverse(entry.last_used_at),
        )
    });
    Ok(scored
        .into_iter()
        .take(20)
        .map(|(_, entry)| BrowserCandidate {
            id: entry.id,
            title: entry.title,
            username: entry.username,
            url: entry.url,
            tags: entry.tags,
            favorite: entry.favorite,
            pinned: entry.pinned,
            last_used_at: entry.last_used_at,
        })
        .collect())
}

fn candidate_score(entry: &VaultEntrySummary, page_host: &str, search: &str) -> u16 {
    let entry_host = url::Url::parse(&entry.url)
        .ok()
        .and_then(|url| url.host_str().map(normalize_host))
        .unwrap_or_default();
    let mut score = if !page_host.is_empty() && page_host == entry_host {
        120
    } else if !page_host.is_empty()
        && !entry_host.is_empty()
        && (page_host.ends_with(&format!(".{entry_host}"))
            || entry_host.ends_with(&format!(".{page_host}")))
    {
        90
    } else {
        0
    };
    if !search.is_empty() {
        let haystack = format!(
            "{}\n{}\n{}\n{}",
            entry.title,
            entry.username,
            entry.url,
            entry.tags.join("\n")
        )
        .to_lowercase();
        if haystack.contains(search) {
            score += 60;
        } else if fuzzy_contains(&haystack, search) {
            score += 25;
        } else {
            return 0;
        }
    }
    score
}

fn fuzzy_contains(haystack: &str, needle: &str) -> bool {
    let mut needle = needle.chars();
    let mut next = needle.next();
    for character in haystack.chars() {
        if next == Some(character) {
            next = needle.next();
            if next.is_none() {
                return true;
            }
        }
    }
    next.is_none()
}

fn normalize_host(host: &str) -> String {
    host.trim_start_matches("www.").to_lowercase()
}

fn credential(state: &VaultState, id: &str) -> Result<BrowserCredential, String> {
    with_key(state, |key| {
        let entry = store::get_entry(&state.db_path, key, id)?;
        store::touch_entry(&state.db_path, key, id, now_timestamp())?;
        Ok(BrowserCredential {
            username: entry.username,
            password: entry.password,
        })
    })
}

fn respond_json(request: Request, status: u16, value: &impl Serialize) {
    let body = serde_json::to_string(value).unwrap_or_else(|_| "{}".into());
    respond_with_type(request, status, body, "application/json; charset=utf-8");
}

fn respond(request: Request, status: u16, body: &str) {
    respond_with_type(
        request,
        status,
        body.to_string(),
        "text/plain; charset=utf-8",
    );
}

fn respond_with_type(request: Request, status: u16, body: String, content_type: &str) {
    let mut response = Response::from_string(body).with_status_code(StatusCode(status));
    for (name, value) in [
        ("Content-Type", content_type),
        ("Access-Control-Allow-Origin", "*"),
        (
            "Access-Control-Allow-Headers",
            "Authorization, Content-Type",
        ),
        ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
        ("Cache-Control", "no-store"),
    ] {
        if let Ok(header) = Header::from_bytes(name, value) {
            response.add_header(header);
        }
    }
    let _ = request.respond(response);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn summary(url: &str, title: &str) -> VaultEntrySummary {
        VaultEntrySummary {
            id: "entry".into(),
            title: title.into(),
            username: "user@example.test".into(),
            url: url.into(),
            tags: vec!["工作".into()],
            favorite: false,
            pinned: false,
            last_used_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn exact_and_subdomain_matches_rank_above_fuzzy_text() {
        let entry = summary("https://example.test/login", "发布后台");
        assert_eq!(candidate_score(&entry, "example.test", ""), 120);
        assert_eq!(candidate_score(&entry, "admin.example.test", ""), 90);
        assert!(candidate_score(&entry, "other.test", "ue") > 0);
        assert_eq!(candidate_score(&entry, "other.test", "missing"), 0);
    }
}
