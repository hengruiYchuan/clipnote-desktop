use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{imageops, DynamicImage, GenericImageView, ImageFormat, RgbaImage};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};
use tauri::{AppHandle, Manager, State};

const BUILTIN_PET_ID: &str = "clipnote";
const MANIFEST_FILE: &str = "pet.json";
const SPRITE_FILE: &str = "spritesheet.webp";
const PREVIEW_FILE: &str = "preview.webp";
const MAX_MANIFEST_BYTES: u64 = 32 * 1024;
const MAX_SPRITE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_PREVIEW_BYTES: u64 = 1024 * 1024;
const SPRITE_WIDTH: u32 = 1024;
const SPRITE_HEIGHT: u32 = 640;

#[derive(Clone)]
pub struct PetState {
    root: Arc<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PetAnimation {
    row: u8,
    frames: Vec<u8>,
    frame_duration_ms: u64,
    #[serde(rename = "loop")]
    looped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetManifest {
    schema_version: u8,
    id: String,
    name: String,
    author: String,
    description: String,
    sprite_file: String,
    preview_file: String,
    cell_width: u32,
    cell_height: u32,
    columns: u8,
    rows: u8,
    animations: BTreeMap<String, PetAnimation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetSummary {
    id: String,
    name: String,
    author: String,
    description: String,
    preview_data_url: String,
    built_in: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetDefinition {
    id: String,
    name: String,
    author: String,
    description: String,
    sprite_data_url: String,
    cell_width: u32,
    cell_height: u32,
    columns: u8,
    rows: u8,
    animations: BTreeMap<String, PetAnimation>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetSelection {
    selected_pet_id: String,
}

pub fn initialize(app: &AppHandle) -> Result<PetState, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("pets");
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(PetState {
        root: Arc::new(root),
    })
}

#[tauri::command]
pub fn list_pets(state: State<'_, PetState>) -> Result<Vec<PetSummary>, String> {
    let mut pets = vec![builtin_summary()];
    let entries = fs::read_dir(state.root.as_ref()).map_err(|error| error.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Ok((manifest, _, preview)) = load_pack(&path) {
            pets.push(summary_from_pack(&manifest, &preview));
        }
    }
    pets[1..].sort_by(|left, right| left.name.cmp(&right.name));
    Ok(pets)
}

#[tauri::command]
pub fn get_selected_pet(state: State<'_, PetState>) -> Result<Option<PetDefinition>, String> {
    let selected = read_selected_id(state.root.as_ref());
    if selected == BUILTIN_PET_ID {
        return Ok(None);
    }
    let directory = managed_pet_directory(state.root.as_ref(), &selected)?;
    match load_pack(&directory) {
        Ok((manifest, sprite, _)) => Ok(Some(definition_from_pack(manifest, &sprite))),
        Err(_) => {
            write_selected_id(state.root.as_ref(), BUILTIN_PET_ID)?;
            Ok(None)
        }
    }
}

#[tauri::command]
pub fn select_pet(state: State<'_, PetState>, id: String) -> Result<(), String> {
    if id != BUILTIN_PET_ID {
        let directory = managed_pet_directory(state.root.as_ref(), &id)?;
        load_pack(&directory)?;
    }
    write_selected_id(state.root.as_ref(), &id)
}

#[tauri::command]
pub fn import_pet(state: State<'_, PetState>, manifest_path: String) -> Result<PetSummary, String> {
    let source_manifest = PathBuf::from(manifest_path);
    let source_directory = source_manifest
        .parent()
        .ok_or_else(|| "宠物清单路径无效".to_string())?;
    let manifest = read_manifest(&source_manifest)?;
    validate_manifest(&manifest)?;
    let sprite = read_limited(&source_directory.join(SPRITE_FILE), MAX_SPRITE_BYTES)?;
    let preview = read_limited(&source_directory.join(PREVIEW_FILE), MAX_PREVIEW_BYTES)?;
    validate_webp(&sprite, Some((SPRITE_WIDTH, SPRITE_HEIGHT)), "宠物图集")?;
    validate_webp(&preview, None, "宠物预览")?;

    let target = managed_pet_directory(state.root.as_ref(), &manifest.id)?;
    if target.exists() {
        return Err("同名宠物已经存在，请先删除旧版本".into());
    }
    let temporary = state.root.join(format!(".{}.importing", manifest.id));
    if temporary.exists() {
        fs::remove_dir_all(&temporary).map_err(|error| error.to_string())?;
    }
    fs::create_dir(&temporary).map_err(|error| error.to_string())?;
    let import_result = (|| {
        let manifest_bytes = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
        fs::write(temporary.join(MANIFEST_FILE), manifest_bytes).map_err(|e| e.to_string())?;
        fs::write(temporary.join(SPRITE_FILE), &sprite).map_err(|e| e.to_string())?;
        fs::write(temporary.join(PREVIEW_FILE), &preview).map_err(|e| e.to_string())?;
        fs::rename(&temporary, &target).map_err(|e| e.to_string())
    })();
    if let Err(error) = import_result {
        let _ = fs::remove_dir_all(&temporary);
        return Err(error);
    }
    Ok(summary_from_pack(&manifest, &preview))
}

#[tauri::command]
pub fn delete_pet(state: State<'_, PetState>, id: String) -> Result<(), String> {
    if id == BUILTIN_PET_ID {
        return Err("默认桌宠需要保留".into());
    }
    let directory = managed_pet_directory(state.root.as_ref(), &id)?;
    if !directory.exists() {
        return Err("桌宠不存在".into());
    }
    fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
    if read_selected_id(state.root.as_ref()) == id {
        write_selected_id(state.root.as_ref(), BUILTIN_PET_ID)?;
    }
    Ok(())
}

fn builtin_summary() -> PetSummary {
    PetSummary {
        id: BUILTIN_PET_ID.into(),
        name: "纸片夹精灵".into(),
        author: "ClipNote".into(),
        description: "ClipNote 的原创轻量桌宠".into(),
        preview_data_url: String::new(),
        built_in: true,
    }
}

fn summary_from_pack(manifest: &PetManifest, preview: &[u8]) -> PetSummary {
    PetSummary {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        author: manifest.author.clone(),
        description: manifest.description.clone(),
        preview_data_url: webp_data_url(preview),
        built_in: false,
    }
}

fn definition_from_pack(manifest: PetManifest, sprite: &[u8]) -> PetDefinition {
    PetDefinition {
        id: manifest.id,
        name: manifest.name,
        author: manifest.author,
        description: manifest.description,
        sprite_data_url: webp_data_url(sprite),
        cell_width: manifest.cell_width,
        cell_height: manifest.cell_height,
        columns: manifest.columns,
        rows: manifest.rows,
        animations: manifest.animations,
    }
}

fn load_pack(directory: &Path) -> Result<(PetManifest, Vec<u8>, Vec<u8>), String> {
    let manifest = read_manifest(&directory.join(MANIFEST_FILE))?;
    validate_manifest(&manifest)?;
    let expected = managed_pet_directory(
        directory
            .parent()
            .ok_or_else(|| "宠物目录无效".to_string())?,
        &manifest.id,
    )?;
    if expected != directory {
        return Err("宠物目录与清单 ID 不一致".into());
    }
    let sprite = read_limited(&directory.join(SPRITE_FILE), MAX_SPRITE_BYTES)?;
    let preview = read_limited(&directory.join(PREVIEW_FILE), MAX_PREVIEW_BYTES)?;
    validate_webp(&sprite, Some((SPRITE_WIDTH, SPRITE_HEIGHT)), "宠物图集")?;
    validate_webp(&preview, None, "宠物预览")?;
    Ok((manifest, sprite, preview))
}

fn read_manifest(path: &Path) -> Result<PetManifest, String> {
    let bytes = read_limited(path, MAX_MANIFEST_BYTES)?;
    serde_json::from_slice(&bytes).map_err(|_| "pet.json 格式无效".into())
}

fn read_limited(path: &Path, maximum: u64) -> Result<Vec<u8>, String> {
    let metadata = fs::metadata(path).map_err(|_| format!("缺少 {}", file_label(path)))?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > maximum {
        return Err(format!("{} 大小不符合要求", file_label(path)));
    }
    fs::read(path).map_err(|error| error.to_string())
}

fn file_label(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("宠物文件")
        .to_string()
}

fn validate_manifest(manifest: &PetManifest) -> Result<(), String> {
    if manifest.schema_version != 1 {
        return Err("宠物包版本不受支持".into());
    }
    validate_pet_id(&manifest.id)?;
    validate_text(&manifest.name, 1, 48, "宠物名称")?;
    validate_text(&manifest.author, 1, 64, "作者")?;
    validate_text(&manifest.description, 0, 160, "宠物描述")?;
    if manifest.sprite_file != SPRITE_FILE || manifest.preview_file != PREVIEW_FILE {
        return Err("宠物资源必须使用标准文件名".into());
    }
    if manifest.cell_width != 128
        || manifest.cell_height != 128
        || manifest.columns != 8
        || manifest.rows != 5
    {
        return Err("宠物图集必须是 8 x 5 个 128 像素单元".into());
    }
    for (name, row) in [
        ("idle", 0),
        ("paused", 1),
        ("captured", 2),
        ("dragging", 3),
        ("error", 4),
    ] {
        let animation = manifest
            .animations
            .get(name)
            .ok_or_else(|| format!("缺少 {name} 动画"))?;
        if animation.row != row
            || animation.frames.is_empty()
            || animation.frames.len() > 8
            || animation.frames.iter().any(|frame| *frame >= 8)
            || !(50..=5000).contains(&animation.frame_duration_ms)
        {
            return Err(format!("{name} 动画参数无效"));
        }
    }
    Ok(())
}

fn validate_pet_id(id: &str) -> Result<(), String> {
    let valid = !id.is_empty()
        && id.len() <= 48
        && id.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || (index > 0 && byte == b'-')
        })
        && !id.ends_with('-');
    if valid {
        Ok(())
    } else {
        Err("宠物 ID 只能包含小写字母、数字和中划线".into())
    }
}

fn validate_text(value: &str, minimum: usize, maximum: usize, label: &str) -> Result<(), String> {
    let length = value.trim().chars().count();
    if (minimum..=maximum).contains(&length) {
        Ok(())
    } else {
        Err(format!("{label} 长度不符合要求"))
    }
}

fn validate_webp(
    bytes: &[u8],
    exact_dimensions: Option<(u32, u32)>,
    label: &str,
) -> Result<(), String> {
    let image = image::load_from_memory_with_format(bytes, ImageFormat::WebP)
        .map_err(|_| format!("{label} 不是有效的 WebP"))?;
    let dimensions = image.dimensions();
    if let Some(expected) = exact_dimensions {
        if dimensions != expected {
            return Err(format!(
                "{label} 尺寸必须为 {} x {}",
                expected.0, expected.1
            ));
        }
    } else if dimensions.0 == 0 || dimensions.1 == 0 || dimensions.0 > 256 || dimensions.1 > 256 {
        return Err("宠物预览尺寸不能超过 256 x 256".into());
    }
    Ok(())
}

fn managed_pet_directory(root: &Path, id: &str) -> Result<PathBuf, String> {
    validate_pet_id(id)?;
    Ok(root.join(id))
}

fn selection_path(root: &Path) -> PathBuf {
    root.join("selection.json")
}

fn read_selected_id(root: &Path) -> String {
    fs::read(selection_path(root))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<PetSelection>(&bytes).ok())
        .map(|selection| selection.selected_pet_id)
        .filter(|id| id == BUILTIN_PET_ID || validate_pet_id(id).is_ok())
        .unwrap_or_else(|| BUILTIN_PET_ID.into())
}

fn write_selected_id(root: &Path, id: &str) -> Result<(), String> {
    if id != BUILTIN_PET_ID {
        validate_pet_id(id)?;
    }
    let bytes = serde_json::to_vec_pretty(&PetSelection {
        selected_pet_id: id.into(),
    })
    .map_err(|error| error.to_string())?;
    fs::write(selection_path(root), bytes).map_err(|error| error.to_string())
}

fn webp_data_url(bytes: &[u8]) -> String {
    format!("data:image/webp;base64,{}", STANDARD.encode(bytes))
}

pub fn install_generated_pet(
    state: &PetState,
    name: &str,
    description: &str,
    source_png: &[u8],
) -> Result<PetSummary, String> {
    validate_text(name, 1, 48, "宠物名称")?;
    validate_text(description, 0, 160, "宠物描述")?;
    let source = image::load_from_memory_with_format(source_png, ImageFormat::Png)
        .map_err(|_| "AI 返回的宠物原画格式无效".to_string())?
        .into_rgba8();
    if source.width() == 0
        || source.height() == 0
        || source.width() > 4096
        || source.height() > 4096
    {
        return Err("AI 返回的宠物原画尺寸无效".into());
    }

    let id = generated_pet_id()?;
    let target = managed_pet_directory(state.root.as_ref(), &id)?;
    let temporary = state.root.join(format!(".{id}.generating"));
    if temporary.exists() {
        fs::remove_dir_all(&temporary).map_err(|error| error.to_string())?;
    }
    fs::create_dir(&temporary).map_err(|error| error.to_string())?;

    let manifest = generated_manifest(id.clone(), name, description);
    let atlas = build_generated_atlas(&source)?;
    let preview = imageops::crop_imm(&atlas, 0, 0, 128, 128).to_image();
    let result = (|| {
        fs::write(
            temporary.join(MANIFEST_FILE),
            serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
        DynamicImage::ImageRgba8(atlas)
            .save_with_format(temporary.join(SPRITE_FILE), ImageFormat::WebP)
            .map_err(|error| error.to_string())?;
        DynamicImage::ImageRgba8(preview)
            .save_with_format(temporary.join(PREVIEW_FILE), ImageFormat::WebP)
            .map_err(|error| error.to_string())?;
        let sprite = read_limited(&temporary.join(SPRITE_FILE), MAX_SPRITE_BYTES)?;
        let preview = read_limited(&temporary.join(PREVIEW_FILE), MAX_PREVIEW_BYTES)?;
        validate_webp(&sprite, Some((SPRITE_WIDTH, SPRITE_HEIGHT)), "宠物图集")?;
        validate_webp(&preview, None, "宠物预览")?;
        fs::rename(&temporary, &target).map_err(|error| error.to_string())?;
        write_selected_id(state.root.as_ref(), &id)
    })();
    if let Err(error) = result {
        let _ = fs::remove_dir_all(&temporary);
        return Err(error);
    }
    let preview = read_limited(&target.join(PREVIEW_FILE), MAX_PREVIEW_BYTES)?;
    Ok(summary_from_pack(&manifest, &preview))
}

fn generated_pet_id() -> Result<String, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let mut random = [0u8; 4];
    getrandom::fill(&mut random).map_err(|_| "系统随机数不可用".to_string())?;
    Ok(format!(
        "ai-{timestamp}-{}",
        random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    ))
}

fn generated_manifest(id: String, name: &str, description: &str) -> PetManifest {
    let animations = [
        ("idle", 0, 220),
        ("paused", 1, 420),
        ("captured", 2, 90),
        ("dragging", 3, 120),
        ("error", 4, 180),
    ]
    .into_iter()
    .map(|(name, row, duration)| {
        (
            name.to_string(),
            PetAnimation {
                row,
                frames: (0..8).collect(),
                frame_duration_ms: duration,
                looped: true,
            },
        )
    })
    .collect();
    PetManifest {
        schema_version: 1,
        id,
        name: name.trim().into(),
        author: "AI Pet Studio".into(),
        description: description.trim().into(),
        sprite_file: SPRITE_FILE.into(),
        preview_file: PREVIEW_FILE.into(),
        cell_width: 128,
        cell_height: 128,
        columns: 8,
        rows: 5,
        animations,
    }
}

fn build_generated_atlas(source: &RgbaImage) -> Result<RgbaImage, String> {
    let bounds = alpha_bounds(source).ok_or_else(|| "AI 返回的原画没有可见内容".to_string())?;
    let cropped = imageops::crop_imm(source, bounds.0, bounds.1, bounds.2, bounds.3).to_image();
    let scale = (104.0 / cropped.width() as f32).min(104.0 / cropped.height() as f32);
    let width = ((cropped.width() as f32 * scale).round() as u32).max(1);
    let height = ((cropped.height() as f32 * scale).round() as u32).max(1);
    let base = imageops::resize(&cropped, width, height, imageops::FilterType::Lanczos3);
    let mut atlas = RgbaImage::new(SPRITE_WIDTH, SPRITE_HEIGHT);
    let row_offsets: [[(i32, i32); 8]; 5] = [
        [
            (0, 1),
            (0, 0),
            (0, -1),
            (0, 0),
            (0, 1),
            (0, 0),
            (0, -1),
            (0, 0),
        ],
        [
            (0, 2),
            (0, 2),
            (0, 1),
            (0, 1),
            (0, 2),
            (0, 2),
            (0, 1),
            (0, 1),
        ],
        [
            (0, 2),
            (0, -3),
            (0, -6),
            (0, -2),
            (0, 1),
            (0, 0),
            (0, -1),
            (0, 0),
        ],
        [
            (-3, 1),
            (-2, 0),
            (-1, -1),
            (0, 0),
            (1, 1),
            (2, 0),
            (3, -1),
            (1, 0),
        ],
        [
            (0, 1),
            (-1, 0),
            (1, 0),
            (-1, 1),
            (1, 1),
            (0, 0),
            (-1, 0),
            (1, 0),
        ],
    ];
    for (row, offsets) in row_offsets.iter().enumerate() {
        for (column, (dx, dy)) in offsets.iter().enumerate() {
            let mut frame = base.clone();
            if row == 1 {
                for pixel in frame.pixels_mut() {
                    let gray =
                        (u16::from(pixel[0]) + u16::from(pixel[1]) + u16::from(pixel[2])) / 3;
                    pixel[0] = gray as u8;
                    pixel[1] = gray as u8;
                    pixel[2] = gray as u8;
                }
            } else if row == 4 {
                for pixel in frame.pixels_mut() {
                    pixel[0] = pixel[0].saturating_add(28);
                    pixel[1] = pixel[1].saturating_sub(18);
                }
            }
            let x = column as i64 * 128 + (128 - width) as i64 / 2 + i64::from(*dx);
            let y = row as i64 * 128 + 118 - i64::from(height) + i64::from(*dy);
            imageops::overlay(&mut atlas, &frame, x, y);
        }
    }
    Ok(atlas)
}

fn alpha_bounds(image: &RgbaImage) -> Option<(u32, u32, u32, u32)> {
    let mut min_x = image.width();
    let mut min_y = image.height();
    let mut max_x = 0;
    let mut max_y = 0;
    let mut found = false;
    for (x, y, pixel) in image.enumerate_pixels() {
        if pixel[3] < 8 {
            continue;
        }
        found = true;
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
    }
    found.then_some((min_x, min_y, max_x - min_x + 1, max_y - min_y + 1))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_manifest() -> PetManifest {
        let animations = ["idle", "paused", "captured", "dragging", "error"]
            .into_iter()
            .enumerate()
            .map(|(row, name)| {
                (
                    name.to_string(),
                    PetAnimation {
                        row: row as u8,
                        frames: vec![0, 1, 2],
                        frame_duration_ms: 180,
                        looped: true,
                    },
                )
            })
            .collect();
        PetManifest {
            schema_version: 1,
            id: "mint-bot".into(),
            name: "薄荷机器人".into(),
            author: "ClipNote".into(),
            description: "测试宠物".into(),
            sprite_file: SPRITE_FILE.into(),
            preview_file: PREVIEW_FILE.into(),
            cell_width: 128,
            cell_height: 128,
            columns: 8,
            rows: 5,
            animations,
        }
    }

    #[test]
    fn accepts_the_standard_pet_contract() {
        assert!(validate_manifest(&valid_manifest()).is_ok());
    }

    #[test]
    fn rejects_paths_and_nonstandard_geometry() {
        let mut manifest = valid_manifest();
        manifest.sprite_file = "../secret.webp".into();
        assert_eq!(
            validate_manifest(&manifest).unwrap_err(),
            "宠物资源必须使用标准文件名"
        );

        manifest.sprite_file = SPRITE_FILE.into();
        manifest.columns = 7;
        assert!(validate_manifest(&manifest).is_err());
    }

    #[test]
    fn rejects_unsafe_pet_ids_and_corrupt_images() {
        assert!(validate_pet_id("mint-bot").is_ok());
        assert!(validate_pet_id("../mint").is_err());
        assert!(validate_pet_id("MintBot").is_err());
        assert!(validate_webp(b"not-an-image", None, "宠物预览").is_err());
    }

    #[test]
    fn assembles_a_transparent_source_into_the_fixed_atlas() {
        let mut source = RgbaImage::new(200, 240);
        for y in 30..220 {
            for x in 50..150 {
                source.put_pixel(x, y, image::Rgba([40, 150, 120, 255]));
            }
        }
        let atlas = build_generated_atlas(&source).unwrap();
        assert_eq!(atlas.dimensions(), (SPRITE_WIDTH, SPRITE_HEIGHT));
        assert!(atlas.pixels().any(|pixel| pixel[3] > 0));
        assert_eq!(atlas.get_pixel(0, 0)[3], 0);
    }
}
