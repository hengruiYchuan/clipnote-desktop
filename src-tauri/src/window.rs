use serde::Serialize;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

const MAIN_WINDOW: &str = "main";
const EDGE_MARGIN: i32 = 12;
const COLLAPSED_WIDTH: u32 = 112;
const COLLAPSED_HEIGHT: u32 = 322;
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
pub fn expand_main_window(app: AppHandle) -> Result<(), String> {
    let (area, scale) = current_work_area(&app)?;
    apply_geometry(&app, expanded_geometry(area, scale))
}

#[tauri::command]
pub fn collapse_main_window(app: AppHandle) -> Result<(), String> {
    let (area, scale) = current_work_area(&app)?;
    apply_geometry(&app, collapsed_geometry(area, scale))
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
                x: 1796,
                y: 379,
                width: 112,
                height: 322,
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
}
