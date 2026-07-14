use serde::Serialize;
use std::{
    sync::mpsc::{self, RecvTimeoutError, Sender},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};

const MAIN_WINDOW: &str = "main";
const EDGE_MARGIN: i32 = 12;
const COLLAPSED_WIDTH: u32 = 56;
const COLLAPSED_HEIGHT: u32 = 56;
const EXPANDED_WIDTH: u32 = 648;
const EXPANDED_HEIGHT: u32 = 1000;

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
