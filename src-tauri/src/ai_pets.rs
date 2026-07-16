use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::RequestBuilder;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use url::Url;

const CREDENTIAL_TARGET: &str = "ClipNote/AI/OpenAI";
const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MODEL: &str = "gpt-image-1.5";
const DEFAULT_TEXT_MODEL: &str = "gpt-4.1-mini";
const MAX_REFERENCE_BYTES: usize = 8 * 1024 * 1024;
const MAX_RESPONSE_BYTES: usize = 32 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPetProviderStatus {
    provider: &'static str,
    configured: bool,
    base_url: String,
    model: String,
    text_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiPetProviderConfig {
    base_url: String,
    api_key: String,
    model: String,
    #[serde(default = "default_text_model")]
    text_model: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPetProviderInput {
    base_url: String,
    #[serde(default)]
    api_key: String,
    model: String,
    #[serde(default)]
    text_model: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateAiPetInput {
    name: String,
    description: String,
    prompt: String,
    style: String,
    #[serde(default)]
    reference_data_url: String,
    #[serde(default)]
    mode: String,
}

#[derive(Deserialize)]
struct ImageResponse {
    data: Vec<ImageResult>,
}

#[derive(Deserialize)]
struct ImageResult {
    b64_json: Option<String>,
    url: Option<String>,
}

#[derive(Deserialize)]
struct ApiErrorEnvelope {
    error: ApiError,
}

#[derive(Deserialize)]
struct ApiError {
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartTextInput {
    action: String,
    content: String,
    #[serde(default)]
    instruction: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: String,
}

#[tauri::command]
pub fn ai_pet_provider_status() -> AiPetProviderStatus {
    let config = read_provider_config().ok();
    AiPetProviderStatus {
        provider: "openai-compatible",
        configured: config.is_some(),
        base_url: config
            .as_ref()
            .map(|config| config.base_url.clone())
            .unwrap_or_else(|| DEFAULT_BASE_URL.into()),
        model: config
            .as_ref()
            .map(|config| config.model.clone())
            .unwrap_or_else(|| DEFAULT_MODEL.into()),
        text_model: config
            .map(|config| config.text_model)
            .unwrap_or_else(|| DEFAULT_TEXT_MODEL.into()),
    }
}

#[tauri::command]
pub fn set_ai_pet_provider(input: AiPetProviderInput) -> Result<(), String> {
    let config = merge_provider_input(input)?;
    write_provider_config(&config)
}

#[tauri::command]
pub fn set_ai_pet_api_key(api_key: String) -> Result<(), String> {
    set_ai_pet_provider(AiPetProviderInput {
        base_url: DEFAULT_BASE_URL.into(),
        api_key,
        model: DEFAULT_MODEL.into(),
        text_model: DEFAULT_TEXT_MODEL.into(),
    })
}

#[tauri::command]
pub async fn smart_text_action(input: SmartTextInput) -> Result<String, String> {
    if input.content.trim().is_empty() || input.content.len() > 256 * 1024 {
        return Err("待处理内容为空或过长".into());
    }
    match input.action.as_str() {
        "format-json" => {
            let value: serde_json::Value = serde_json::from_str(&input.content)
                .map_err(|error| format!("JSON 格式错误：{error}"))?;
            serde_json::to_string_pretty(&value).map_err(|error| error.to_string())
        }
        "clean-whitespace" => Ok(clean_whitespace(&input.content)),
        "extract-urls" => extract_urls(&input.content),
        "base64-encode" => Ok(STANDARD.encode(input.content.as_bytes())),
        "base64-decode" => {
            let bytes = STANDARD
                .decode(input.content.trim())
                .map_err(|_| "Base64 格式无效".to_string())?;
            String::from_utf8(bytes).map_err(|_| "Base64 内容不是 UTF-8 文本".to_string())
        }
        "summarize" | "translate-zh" | "polish" | "custom" => ai_text_action(input).await,
        _ => Err("未知的智能操作".into()),
    }
}

async fn ai_text_action(input: SmartTextInput) -> Result<String, String> {
    if input.content.len() > 64 * 1024 {
        return Err("AI 处理内容需要小于 64 KB".into());
    }
    let config = read_provider_config()?;
    let instruction = match input.action.as_str() {
        "summarize" => "请用简洁的中文总结以下内容，保留关键事实与待办事项。",
        "translate-zh" => "请将以下内容翻译成自然、准确的简体中文，只输出译文。",
        "polish" => "请润色以下内容，使表达清晰、自然、专业，保持原意，只输出结果。",
        "custom" => {
            let value = input.instruction.trim();
            if value.is_empty() || value.chars().count() > 500 {
                return Err("请输入 1 到 500 字的处理要求".into());
            }
            value
        }
        _ => return Err("未知的 AI 操作".into()),
    };
    let payload = serde_json::json!({
        "model": config.text_model,
        "messages": [
            {"role": "system", "content": "你是 ClipNote 的文本整理助手。严格执行用户选择的文本操作，不添加解释。"},
            {"role": "user", "content": format!("{instruction}\n\n---\n{}", input.content)}
        ],
        "temperature": 0.2
    });
    let response = with_auth(
        image_client(120)?
            .post(api_endpoint(&config.base_url, "chat/completions")?)
            .json(&payload),
        &config.api_key,
    )
    .send()
    .await
    .map_err(|error| format!("AI 服务连接失败：{error}"))?;
    if !response.status().is_success() {
        return Err(api_error(response).await);
    }
    let response: ChatResponse = response
        .json()
        .await
        .map_err(|_| "AI 文本返回格式无效".to_string())?;
    response
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "AI 没有返回文本".to_string())
}

fn clean_whitespace(value: &str) -> String {
    let mut blank = false;
    value
        .lines()
        .filter_map(|line| {
            let cleaned = line.split_whitespace().collect::<Vec<_>>().join(" ");
            if cleaned.is_empty() {
                if blank {
                    None
                } else {
                    blank = true;
                    Some(String::new())
                }
            } else {
                blank = false;
                Some(cleaned)
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn extract_urls(value: &str) -> Result<String, String> {
    let mut urls = Vec::new();
    for token in value.split_whitespace() {
        let candidate =
            token.trim_matches(|character: char| "()[]{}<>\"',.;，。；".contains(character));
        if let Ok(url) = Url::parse(candidate) {
            if matches!(url.scheme(), "http" | "https")
                && !urls.iter().any(|item| item == url.as_str())
            {
                urls.push(url.to_string());
            }
        }
    }
    if urls.is_empty() {
        Err("内容中没有找到 HTTP 或 HTTPS 地址".into())
    } else {
        Ok(urls.join("\n"))
    }
}

fn default_text_model() -> String {
    DEFAULT_TEXT_MODEL.into()
}

#[tauri::command]
pub async fn test_ai_pet_provider(input: AiPetProviderInput) -> Result<(), String> {
    let config = merge_provider_input(input)?;
    let client = image_client(20)?;
    let response = with_auth(
        client.get(api_endpoint(&config.base_url, "models")?),
        &config.api_key,
    )
    .send()
    .await
    .map_err(|error| format!("生成服务连接失败：{error}"))?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(api_error(response).await)
    }
}

#[tauri::command]
pub fn clear_ai_pet_api_key() -> Result<(), String> {
    delete_credential()
}

#[tauri::command]
pub async fn generate_ai_pet(
    app: AppHandle,
    input: GenerateAiPetInput,
) -> Result<crate::pets::PetSummary, String> {
    validate_input(&input)?;
    let config = read_provider_config()?;
    let background = if supports_native_transparency(&config.model) {
        "transparent background with generous transparent padding"
    } else {
        "flat solid pure green (#00FF00) background with generous green padding"
    };
    let prompt = format!(
        "Create one full-body desktop companion character based on: {}. Style: {}. Centered, facing slightly toward the viewer, clean readable silhouette, {background}, no text, no border, no floor, no cast shadow, no extra characters. Keep every part inside the canvas. This will be displayed at 56 pixels.",
        input.prompt.trim(),
        input.style.trim(),
    );
    let client = image_client(180)?;
    let response = if input.reference_data_url.trim().is_empty() {
        let mut payload = serde_json::json!({
            "model": config.model.clone(),
            "prompt": prompt,
            "size": "1024x1024",
            "n": 1
        });
        add_native_transparency_options(&mut payload, &config.model);
        with_auth(
            client
                .post(api_endpoint(&config.base_url, "images/generations")?)
                .json(&payload),
            &config.api_key,
        )
        .send()
        .await
    } else {
        let (mime, reference) = decode_reference(&input.reference_data_url)?;
        let part = reqwest::multipart::Part::bytes(reference)
            .file_name("reference.png")
            .mime_str(mime)
            .map_err(|error| error.to_string())?;
        let form = reqwest::multipart::Form::new()
            .text("model", config.model.clone())
            .text("prompt", prompt)
            .text("size", "1024x1024")
            .part("image", part);
        let form = add_native_transparency_form(form, &config.model);
        with_auth(
            client
                .post(api_endpoint(&config.base_url, "images/edits")?)
                .multipart(form),
            &config.api_key,
        )
        .send()
        .await
    }
    .map_err(|error| format!("AI 服务连接失败：{error}"))?;

    let png = image_response_bytes(&client, response).await?;
    let full_mode = input.mode == "full";
    if full_mode {
        app.emit(
            "ai-pet-generation-progress",
            serde_json::json!({
                "completed": 1, "total": 5, "state": "idle"
            }),
        )
        .map_err(|error| error.to_string())?;
        let states = [
            ("paused", "resting calmly with sleepy relaxed eyes and a settled pose"),
            ("captured", "celebrating a successful clipboard capture with a bright excited expression and energetic pose"),
            ("dragging", "being gently pulled sideways while holding balance, focused expression and dynamic pose"),
            ("error", "showing a worried but charming error expression with a slightly startled pose"),
        ];
        let mut images = vec![png.clone()];
        for (index, (state, pose)) in states.into_iter().enumerate() {
            let prompt = format!(
                "Edit this exact desktop companion into the {state} state: {pose}. Preserve the exact same character identity, colors, materials, proportions and art style. One full-body character, centered, {background}, no text, no border, no floor, no shadow."
            );
            images.push(generate_state_edit(&client, &config, &png, &prompt).await?);
            app.emit(
                "ai-pet-generation-progress",
                serde_json::json!({
                    "completed": index + 2, "total": 5, "state": state
                }),
            )
            .map_err(|error| error.to_string())?;
        }
        let state = app.state::<crate::pets::PetState>();
        return crate::pets::install_generated_pet_states(
            &state,
            &input.name,
            &input.description,
            &images,
        );
    }
    let state = app.state::<crate::pets::PetState>();
    crate::pets::install_generated_pet(&state, &input.name, &input.description, &png)
}

async fn generate_state_edit(
    client: &reqwest::Client,
    config: &AiPetProviderConfig,
    base_png: &[u8],
    prompt: &str,
) -> Result<Vec<u8>, String> {
    let part = reqwest::multipart::Part::bytes(base_png.to_vec())
        .file_name("character.png")
        .mime_str("image/png")
        .map_err(|error| error.to_string())?;
    let form = reqwest::multipart::Form::new()
        .text("model", config.model.clone())
        .text("prompt", prompt.to_string())
        .text("size", "1024x1024")
        .part("image", part);
    let response = with_auth(
        client
            .post(api_endpoint(&config.base_url, "images/edits")?)
            .multipart(add_native_transparency_form(form, &config.model)),
        &config.api_key,
    )
    .send()
    .await
    .map_err(|error| format!("AI 状态原画生成失败：{error}"))?;
    image_response_bytes(client, response).await
}

async fn image_response_bytes(
    client: &reqwest::Client,
    response: reqwest::Response,
) -> Result<Vec<u8>, String> {
    let status = response.status();
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err("AI 返回内容过大".into());
    }
    let body = response.bytes().await.map_err(|error| error.to_string())?;
    if body.len() > MAX_RESPONSE_BYTES {
        return Err("AI 返回内容过大".into());
    }
    if !status.is_success() {
        let message = serde_json::from_slice::<ApiErrorEnvelope>(&body)
            .map(|error| error.error.message)
            .unwrap_or_else(|_| format!("AI 服务返回 {status}"));
        return Err(message);
    }
    let response: ImageResponse =
        serde_json::from_slice(&body).map_err(|_| "AI 返回格式无效".to_string())?;
    let result = response
        .data
        .first()
        .ok_or_else(|| "AI 没有返回图片".to_string())?;
    image_result_bytes(client, result).await
}

fn merge_provider_input(input: AiPetProviderInput) -> Result<AiPetProviderConfig, String> {
    let existing = read_provider_config().ok();
    let api_key = if input.api_key.trim().is_empty() {
        existing
            .as_ref()
            .map(|config| config.api_key.clone())
            .unwrap_or_default()
    } else {
        input.api_key.trim().to_string()
    };
    if api_key.len() > 1024 {
        return Err("API Key 过长".into());
    }
    let model = input.model.trim();
    if model.is_empty() || model.chars().count() > 160 || model.chars().any(char::is_control) {
        return Err("模型名称格式无效".into());
    }
    let text_model = input.text_model.trim();
    if !text_model.is_empty()
        && (text_model.chars().count() > 160 || text_model.chars().any(char::is_control))
    {
        return Err("文本模型名称格式无效".into());
    }
    Ok(AiPetProviderConfig {
        base_url: normalize_base_url(&input.base_url)?,
        api_key,
        model: model.into(),
        text_model: if input.text_model.trim().is_empty() {
            existing
                .as_ref()
                .map(|config| config.text_model.clone())
                .unwrap_or_else(default_text_model)
        } else {
            input.text_model.trim().to_string()
        },
    })
}

fn normalize_base_url(value: &str) -> Result<String, String> {
    if value.trim().len() > 512 {
        return Err("接口地址过长".into());
    }
    let mut url = Url::parse(value.trim()).map_err(|_| "接口地址格式无效".to_string())?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("接口地址需要使用 HTTP 或 HTTPS，且不包含账号、参数或片段".into());
    }
    if url.path().is_empty() || url.path() == "/" {
        url.set_path("/v1");
    }
    Ok(url.as_str().trim_end_matches('/').to_string())
}

fn api_endpoint(base_url: &str, path: &str) -> Result<Url, String> {
    Url::parse(&format!(
        "{}/{}",
        base_url.trim_end_matches('/'),
        path.trim_start_matches('/')
    ))
    .map_err(|_| "接口地址格式无效".to_string())
}

fn image_client(timeout_seconds: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_seconds))
        .build()
        .map_err(|error| error.to_string())
}

fn with_auth(request: RequestBuilder, api_key: &str) -> RequestBuilder {
    if api_key.is_empty() {
        request
    } else {
        request.bearer_auth(api_key)
    }
}

fn supports_native_transparency(model: &str) -> bool {
    matches!(model, "gpt-image-1" | "gpt-image-1.5")
}

fn add_native_transparency_options(payload: &mut serde_json::Value, model: &str) {
    if !supports_native_transparency(model) {
        return;
    }
    if let Some(object) = payload.as_object_mut() {
        object.insert("quality".into(), "medium".into());
        object.insert("background".into(), "transparent".into());
        object.insert("output_format".into(), "png".into());
    }
}

fn add_native_transparency_form(
    form: reqwest::multipart::Form,
    model: &str,
) -> reqwest::multipart::Form {
    if supports_native_transparency(model) {
        form.text("quality", "medium")
            .text("background", "transparent")
            .text("output_format", "png")
    } else {
        form
    }
}

async fn image_result_bytes(
    client: &reqwest::Client,
    result: &ImageResult,
) -> Result<Vec<u8>, String> {
    if let Some(encoded) = result.b64_json.as_deref() {
        return STANDARD
            .decode(encoded)
            .map_err(|_| "AI 返回的图片编码无效".to_string());
    }
    let image_url = result
        .url
        .as_deref()
        .ok_or_else(|| "AI 没有返回图片数据".to_string())?;
    let parsed = Url::parse(image_url).map_err(|_| "AI 返回的图片地址无效".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("AI 返回的图片地址无效".into());
    }
    let response = client
        .get(parsed)
        .send()
        .await
        .map_err(|error| format!("下载 AI 图片失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("下载 AI 图片失败：{}", response.status()));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err("AI 返回内容过大".into());
    }
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;
    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err("AI 返回内容过大".into());
    }
    Ok(bytes.to_vec())
}

async fn api_error(response: reqwest::Response) -> String {
    let status = response.status();
    response
        .bytes()
        .await
        .ok()
        .and_then(|body| serde_json::from_slice::<ApiErrorEnvelope>(&body).ok())
        .map(|error| error.error.message)
        .unwrap_or_else(|| format!("生成服务返回 {status}"))
}

fn validate_input(input: &GenerateAiPetInput) -> Result<(), String> {
    if input.name.trim().is_empty() || input.name.chars().count() > 48 {
        return Err("宠物名称需要 1 到 48 个字符".into());
    }
    if input.description.chars().count() > 160 {
        return Err("宠物描述不能超过 160 个字符".into());
    }
    if input.prompt.trim().chars().count() < 4 || input.prompt.chars().count() > 1200 {
        return Err("形象描述需要 4 到 1200 个字符".into());
    }
    if input.style.trim().is_empty() || input.style.chars().count() > 120 {
        return Err("画风描述无效".into());
    }
    Ok(())
}

fn decode_reference(data_url: &str) -> Result<(&'static str, Vec<u8>), String> {
    let (prefix, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "参考图格式无效".to_string())?;
    let mime = match prefix {
        "data:image/png;base64" => "image/png",
        "data:image/jpeg;base64" => "image/jpeg",
        "data:image/webp;base64" => "image/webp",
        _ => return Err("参考图只支持 PNG、JPEG 或 WebP".into()),
    };
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| "参考图编码无效".to_string())?;
    if bytes.is_empty() || bytes.len() > MAX_REFERENCE_BYTES {
        return Err("参考图大小需要在 8 MB 以内".into());
    }
    Ok((mime, bytes))
}

fn write_provider_config(config: &AiPetProviderConfig) -> Result<(), String> {
    let serialized = serde_json::to_string(config).map_err(|error| error.to_string())?;
    write_credential(&serialized)
}

fn read_provider_config() -> Result<AiPetProviderConfig, String> {
    let stored = read_credential()?;
    if let Ok(mut config) = serde_json::from_str::<AiPetProviderConfig>(&stored) {
        config.base_url = normalize_base_url(&config.base_url)?;
        if config.model.trim().is_empty() {
            return Err("保存的模型名称格式无效".into());
        }
        if config.text_model.trim().is_empty() {
            config.text_model = default_text_model();
        }
        return Ok(config);
    }
    Ok(AiPetProviderConfig {
        base_url: DEFAULT_BASE_URL.into(),
        api_key: stored.trim().to_string(),
        model: DEFAULT_MODEL.into(),
        text_model: DEFAULT_TEXT_MODEL.into(),
    })
}

#[cfg(windows)]
fn write_credential(secret: &str) -> Result<(), String> {
    use std::ptr;
    use windows_sys::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };
    let mut target = wide(CREDENTIAL_TARGET);
    let mut username = wide("ClipNote");
    let mut blob = secret.as_bytes().to_vec();
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: target.as_mut_ptr(),
        CredentialBlobSize: blob.len() as u32,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: username.as_mut_ptr(),
        Comment: ptr::null_mut(),
        TargetAlias: ptr::null_mut(),
        Attributes: ptr::null_mut(),
        ..Default::default()
    };
    if unsafe { CredWriteW(&credential, 0) } == 0 {
        Err(std::io::Error::last_os_error().to_string())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn read_credential() -> Result<zeroize::Zeroizing<String>, String> {
    use std::{ptr, slice};
    use windows_sys::Win32::Security::Credentials::{
        CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
    };
    let target = wide(CREDENTIAL_TARGET);
    let mut credential: *mut CREDENTIALW = ptr::null_mut();
    if unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut credential) } == 0 {
        return Err("尚未配置图片生成服务".into());
    }
    let result = unsafe {
        let credential_ref = &*credential;
        let bytes = slice::from_raw_parts(
            credential_ref.CredentialBlob,
            credential_ref.CredentialBlobSize as usize,
        );
        String::from_utf8(bytes.to_vec()).map(zeroize::Zeroizing::new)
    };
    unsafe { CredFree(credential.cast()) };
    result.map_err(|_| "保存的 API Key 格式无效".to_string())
}

#[cfg(windows)]
fn delete_credential() -> Result<(), String> {
    use windows_sys::Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC};
    let target = wide(CREDENTIAL_TARGET);
    if unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) } == 0 {
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(1168) {
            Ok(())
        } else {
            Err(error.to_string())
        }
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_generation_input_and_reference_size() {
        let input = GenerateAiPetInput {
            name: "纸飞机".into(),
            description: "轻盈的桌面伙伴".into(),
            prompt: "一只由折纸构成的小狐狸".into(),
            style: "清爽扁平插画".into(),
            reference_data_url: String::new(),
            mode: "light".into(),
        };
        assert!(validate_input(&input).is_ok());
        assert!(decode_reference("data:text/plain;base64,SGVsbG8=").is_err());
    }

    #[test]
    fn normalizes_openai_compatible_endpoints() {
        assert_eq!(
            normalize_base_url("http://127.0.0.1:9999").unwrap(),
            "http://127.0.0.1:9999/v1"
        );
        assert_eq!(
            normalize_base_url("https://example.com/openai/v1/").unwrap(),
            "https://example.com/openai/v1"
        );
        assert_eq!(
            api_endpoint("https://example.com/v1", "images/generations")
                .unwrap()
                .as_str(),
            "https://example.com/v1/images/generations"
        );
        assert!(normalize_base_url("file:///tmp/images").is_err());
        assert!(normalize_base_url("https://user:pass@example.com/v1").is_err());
    }

    #[test]
    fn validates_provider_model_and_optional_key() {
        let input = AiPetProviderInput {
            base_url: "http://localhost:9999".into(),
            api_key: "token".into(),
            model: "gpt-image-2".into(),
            text_model: "gpt-4.1-mini".into(),
        };
        let config = merge_provider_input(input).unwrap();
        assert_eq!(config.base_url, "http://localhost:9999/v1");
        assert_eq!(config.model, "gpt-image-2");
        assert_eq!(config.api_key, "token");
        assert!(!supports_native_transparency("gpt-image-2"));
        assert!(supports_native_transparency("gpt-image-1.5"));
    }

    #[test]
    fn local_smart_actions_are_deterministic() {
        assert_eq!(
            clean_whitespace("  alpha   beta  \n\n\n gamma "),
            "alpha beta\n\ngamma"
        );
        assert_eq!(
            extract_urls("打开 https://example.com/a 和 https://example.com/a").unwrap(),
            "https://example.com/a"
        );
    }
}
