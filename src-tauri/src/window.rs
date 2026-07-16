use serde::Serialize;
use std::{
    sync::mpsc::{self, RecvTimeoutError, Sender},
    thread,
    time::Duration,
};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};

const MAIN_WINDOW: &str = "main";
const EDGE_MARGIN: i32 = 12;
const COLLAPSED_WIDTH: u32 = 56;
const COLLAPSED_HEIGHT: u32 = 56;
const EXPANDED_WIDTH: u32 = 648;
const EXPANDED_HEIGHT: u32 = 1000;
const STICKY_LABEL_PREFIX: &str = "sticky-";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Geometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

pub fn collapsed_geometry(area: WorkArea, _scale: f64) -> Geometry {
    Geometry {
        x: area.x + area.width as i32 - COLLAPSED_WIDTH as i32 - EDGE_MARGIN,
        y: area.y + (area.height as i32 - COLLAPSED_HEIGHT as i32) / 2,
        width: COLLAPSED_WIDTH,
        height: COLLAPSED_HEIGHT,
    }
}

pub fn collapsed_geometry_at(area: WorkArea, position: Option<(i32, i32)>) -> Geometry {
    let default = collapsed_geometry(area, 1.0);
    let Some((x, y)) = position else {
        return default;
    };
    let maximum_x = area.x + area.width.saturating_sub(COLLAPSED_WIDTH) as i32;
    let maximum_y = area.y + area.height.saturating_sub(COLLAPSED_HEIGHT) as i32;
    Geometry {
        x: x.clamp(area.x, maximum_x),
        y: y.clamp(area.y, maximum_y),
        width: COLLAPSED_WIDTH,
        height: COLLAPSED_HEIGHT,
    }
}

pub fn expanded_geometry(area: WorkArea, _scale: f64) -> Geometry {
    let width = EXPANDED_WIDTH.min(area.width.saturating_sub(40));
    let height = EXPANDED_HEIGHT.min(area.height.saturating_sub(80));
    Geometry {
        x: area.x + area.width as i32 - width as i32 - EDGE_MARGIN,
        y: area.y + (area.height as i32 - height as i32) / 2,
        width,
        height,
    }
}

fn current_work_area(app: &AppHandle) -> Result<(WorkArea, f64), String> {
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "main window is unavailable".to_string())?;
    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "no monitor is available for the main window".to_string())?;
    let position = monitor.position();
    let size = monitor.size();
    Ok((
        WorkArea {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        },
        monitor.scale_factor(),
    ))
}

fn work_area_for_position(
    app: &AppHandle,
    position: (i32, i32),
) -> Result<Option<WorkArea>, String> {
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "main window is unavailable".to_string())?;
    let center = (
        position.0 + COLLAPSED_WIDTH as i32 / 2,
        position.1 + COLLAPSED_HEIGHT as i32 / 2,
    );
    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    Ok(monitors.into_iter().find_map(|monitor| {
        let monitor_position = monitor.position();
        let size = monitor.size();
        let inside = center.0 >= monitor_position.x
            && center.0 < monitor_position.x + size.width as i32
            && center.1 >= monitor_position.y
            && center.1 < monitor_position.y + size.height as i32;
        inside.then_some(WorkArea {
            x: monitor_position.x,
            y: monitor_position.y,
            width: size.width,
            height: size.height,
        })
    }))
}

pub fn start_position_tracking() -> Sender<(AppHandle, i32, i32)> {
    let (sender, receiver) = mpsc::channel::<(AppHandle, i32, i32)>();
    thread::Builder::new()
        .name("clipnote-window-position".into())
        .spawn(move || {
            while let Ok(mut latest) = receiver.recv() {
                loop {
                    match receiver.recv_timeout(Duration::from_millis(350)) {
                        Ok(next) => latest = next,
                        Err(RecvTimeoutError::Timeout) => {
                            let _ =
                                crate::data::save_collapsed_position(&latest.0, latest.1, latest.2);
                            break;
                        }
                        Err(RecvTimeoutError::Disconnected) => {
                            let _ =
                                crate::data::save_collapsed_position(&latest.0, latest.1, latest.2);
                            return;
                        }
                    }
                }
            }
        })
        .expect("failed to start window position tracker");
    sender
}

fn apply_geometry(app: &AppHandle, geometry: Geometry) -> Result<(), String> {
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "main window is unavailable".to_string())?;
    window
        .set_size(PhysicalSize::new(geometry.width, geometry.height))
        .map_err(|error| error.to_string())?;
    window
        .set_position(PhysicalPosition::new(geometry.x, geometry.y))
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_main_window_mode(app: AppHandle) -> Result<&'static str, String> {
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "main window is unavailable".to_string())?;
    let width = window
        .outer_size()
        .map_err(|error| error.to_string())?
        .width;
    Ok(if width <= COLLAPSED_WIDTH + 24 {
        "collapsed"
    } else {
        "expanded"
    })
}

#[tauri::command]
pub fn expand_main_window(app: AppHandle) -> Result<(), String> {
    let (area, scale) = current_work_area(&app)?;
    apply_geometry(&app, expanded_geometry(area, scale))?;
    app.emit("shell-mode-changed", "expanded")
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn collapse_main_window(app: AppHandle) -> Result<(), String> {
    let saved_position = crate::data::read_collapsed_position(&app)?;
    let (current_area, _) = current_work_area(&app)?;
    let area = match saved_position {
        Some(position) => work_area_for_position(&app, position)?.unwrap_or(current_area),
        None => current_area,
    };
    apply_geometry(&app, collapsed_geometry_at(area, saved_position))?;
    app.emit("shell-mode-changed", "collapsed")
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn start_drag_main_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "main window is unavailable".to_string())?
        .start_dragging()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn hide_main_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "main window is unavailable".to_string())?
        .hide()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn toggle_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "main window is unavailable".to_string())?;
    let width = window
        .outer_size()
        .map_err(|error| error.to_string())?
        .width;
    if width <= COLLAPSED_WIDTH + 24 {
        expand_main_window(app)
    } else {
        collapse_main_window(app)
    }
}

fn sticky_label(id: i64) -> Result<String, String> {
    if id <= 0 {
        return Err("便签编号无效".into());
    }
    Ok(format!("{STICKY_LABEL_PREFIX}{id}"))
}

pub fn restore_desktop_notes(app: &AppHandle) -> Result<(), String> {
    for note in crate::data::pinned_notes_for_app(app)? {
        create_sticky_window(app, &note)?;
    }
    Ok(())
}

fn create_sticky_window(app: &AppHandle, note: &crate::data::Note) -> Result<(), String> {
    let label = sticky_label(note.id)?;
    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|error| error.to_string())?;
        let _ = window.set_focus();
        return Ok(());
    }
    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("ClipNote 桌面便签")
        .inner_size(note.desktop_width as f64, note.desktop_height as f64)
        .min_inner_size(220.0, 160.0)
        .resizable(true)
        .decorations(false)
        .transparent(false)
        .always_on_top(note.always_on_top)
        .shadow(true);
    if let (Some(x), Some(y)) = (note.desktop_x, note.desktop_y) {
        builder = builder.position(x as f64, y as f64);
    }
    builder.build().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_desktop_note(app: AppHandle, id: i64) -> Result<(), String> {
    let mut note = crate::data::note_for_app(&app, id)?;
    note.desktop_pinned = true;
    note = crate::data::update_note_desktop_state_for_app(
        &app,
        id,
        crate::data::DesktopNoteStateInput {
            desktop_pinned: true,
            desktop_x: note.desktop_x,
            desktop_y: note.desktop_y,
            desktop_width: note.desktop_width,
            desktop_height: note.desktop_height,
            always_on_top: note.always_on_top,
        },
    )?;
    create_sticky_window(&app, &note)
}

fn sticky_geometry(app: &AppHandle, id: i64) -> Result<(i32, i32, i32, i32), String> {
    let window = app
        .get_webview_window(&sticky_label(id)?)
        .ok_or_else(|| "桌面便签窗口不存在".to_string())?;
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let position = window
        .outer_position()
        .map_err(|error| error.to_string())?
        .to_logical::<i32>(scale);
    let size = window
        .outer_size()
        .map_err(|error| error.to_string())?
        .to_logical::<i32>(scale);
    Ok((position.x, position.y, size.width, size.height))
}

#[tauri::command]
pub fn save_desktop_note_geometry(app: AppHandle, id: i64) -> Result<(), String> {
    let note = crate::data::note_for_app(&app, id)?;
    let (x, y, width, height) = sticky_geometry(&app, id)?;
    crate::data::update_note_desktop_state_for_app(
        &app,
        id,
        crate::data::DesktopNoteStateInput {
            desktop_pinned: true,
            desktop_x: Some(x),
            desktop_y: Some(y),
            desktop_width: width,
            desktop_height: height,
            always_on_top: note.always_on_top,
        },
    )?;
    Ok(())
}

#[tauri::command]
pub fn set_desktop_note_always_on_top(
    app: AppHandle,
    id: i64,
    always_on_top: bool,
) -> Result<(), String> {
    let window = app
        .get_webview_window(&sticky_label(id)?)
        .ok_or_else(|| "桌面便签窗口不存在".to_string())?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|error| error.to_string())?;
    let note = crate::data::note_for_app(&app, id)?;
    crate::data::update_note_desktop_state_for_app(
        &app,
        id,
        crate::data::DesktopNoteStateInput {
            desktop_pinned: true,
            desktop_x: note.desktop_x,
            desktop_y: note.desktop_y,
            desktop_width: note.desktop_width,
            desktop_height: note.desktop_height,
            always_on_top,
        },
    )?;
    Ok(())
}

#[tauri::command]
pub fn start_drag_desktop_note(app: AppHandle, id: i64) -> Result<(), String> {
    app.get_webview_window(&sticky_label(id)?)
        .ok_or_else(|| "桌面便签窗口不存在".to_string())?
        .start_dragging()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn retract_desktop_note(app: AppHandle, id: i64) -> Result<(), String> {
    let note = crate::data::note_for_app(&app, id)?;
    let geometry = sticky_geometry(&app, id).ok();
    crate::data::update_note_desktop_state_for_app(
        &app,
        id,
        crate::data::DesktopNoteStateInput {
            desktop_pinned: false,
            desktop_x: geometry.map(|value| value.0).or(note.desktop_x),
            desktop_y: geometry.map(|value| value.1).or(note.desktop_y),
            desktop_width: geometry.map(|value| value.2).unwrap_or(note.desktop_width),
            desktop_height: geometry.map(|value| value.3).unwrap_or(note.desktop_height),
            always_on_top: note.always_on_top,
        },
    )?;
    if let Some(window) = app.get_webview_window(&sticky_label(id)?) {
        window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collapsed_window_hugs_the_right_work_area() {
        let area = WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };
        assert_eq!(
            collapsed_geometry(area, 1.0),
            Geometry {
                x: 1852,
                y: 512,
                width: 56,
                height: 56,
            }
        );
    }

    #[test]
    fn expanded_window_keeps_a_twelve_pixel_desktop_margin() {
        let area = WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };
        assert_eq!(
            expanded_geometry(area, 1.0),
            Geometry {
                x: 1260,
                y: 40,
                width: 648,
                height: 1000,
            }
        );
    }

    #[test]
    fn saved_collapsed_position_is_clamped_to_the_visible_area() {
        let area = WorkArea {
            x: 100,
            y: 200,
            width: 800,
            height: 600,
        };
        assert_eq!(
            collapsed_geometry_at(area, Some((9999, 50))),
            Geometry {
                x: 844,
                y: 200,
                width: 56,
                height: 56,
            }
        );
    }
}
