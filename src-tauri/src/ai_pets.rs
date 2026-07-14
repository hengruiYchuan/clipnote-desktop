use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const CREDENTIAL_TARGET: &str = "ClipNote/AI/OpenAI";
const DEFAULT_MODEL: &str = "gpt-image-1.5";
const MAX_REFERENCE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPetProviderStatus {
    provider: &'static str,
    configured: bool,
    default_model: &'static str,
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
}

#[derive(Deserialize)]
struct ImageResponse {
    data: Vec<ImageResult>,
}

#[derive(Deserialize)]
struct ImageResult {
    b64_json: Option<String>,
}

#[derive(Deserialize)]
struct ApiErrorEnvelope {
    error: ApiError,
}

#[derive(Deserialize)]
struct ApiError {
    message: String,
}

#[tauri::command]
pub fn ai_pet_provider_status() -> AiPetProviderStatus {
    AiPetProviderStatus {
        provider: "openai",
        configured: read_credential().is_ok(),
        default_model: DEFAULT_MODEL,
    }
}

#[tauri::command]
pub fn set_ai_pet_api_key(api_key: String) -> Result<(), String> {
    let api_key = zeroize::Zeroizing::new(api_key);
    let api_key = api_key.trim();
    if api_key.len() < 20 || api_key.len() > 512 {
        return Err("API Key 格式无效".into());
    }
    write_credential(api_key)
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
    let api_key = read_credential()?;
    let prompt = format!(
        "Create one full-body desktop companion character based on: {}. Style: {}. Centered, facing slightly toward the viewer, clean readable silhouette, transparent background, no text, no border, no floor, no cast shadow, no extra characters. Keep every part inside the canvas with generous transparent padding. This will be displayed at 56 pixels.",
        input.prompt.trim(),
        input.style.trim(),
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|error| error.to_string())?;
    let response = if input.reference_data_url.trim().is_empty() {
        client
            .post("https://api.openai.com/v1/images/generations")
            .bearer_auth(api_key.as_str())
            .json(&serde_json::json!({
                "model": DEFAULT_MODEL,
                "prompt": prompt,
                "size": "1024x1024",
                "quality": "medium",
                "background": "transparent",
                "output_format": "png"
            }))
            .send()
            .await
    } else {
        let (mime, reference) = decode_reference(&input.reference_data_url)?;
        let part = reqwest::multipart::Part::bytes(reference)
            .file_name("reference.png")
            .mime_str(mime)
            .map_err(|error| error.to_string())?;
        let form = reqwest::multipart::Form::new()
            .text("model", DEFAULT_MODEL)
            .text("prompt", prompt)
            .text("size", "1024x1024")
            .text("quality", "medium")
            .text("background", "transparent")
            .text("output_format", "png")
            .part("image", part);
        client
            .post("https://api.openai.com/v1/images/edits")
            .bearer_auth(api_key.as_str())
            .multipart(form)
            .send()
            .await
    }
    .map_err(|error| format!("AI 服务连接失败：{error}"))?;

    let status = response.status();
    if response
        .content_length()
        .is_some_and(|length| length > 32 * 1024 * 1024)
    {
        return Err("AI 返回内容过大".into());
    }
    let body = response.bytes().await.map_err(|error| error.to_string())?;
    if body.len() > 32 * 1024 * 1024 {
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
    let encoded = response
        .data
        .first()
        .and_then(|result| result.b64_json.as_deref())
        .ok_or_else(|| "AI 没有返回图片".to_string())?;
    let png = STANDARD
        .decode(encoded)
        .map_err(|_| "AI 返回的图片编码无效".to_string())?;
    let state = app.state::<crate::pets::PetState>();
    crate::pets::install_generated_pet(&state, &input.name, &input.description, &png)
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
        return Err("尚未配置 OpenAI API Key".into());
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
        };
        assert!(validate_input(&input).is_ok());
        assert!(decode_reference("data:text/plain;base64,SGVsbG8=").is_err());
    }
}
