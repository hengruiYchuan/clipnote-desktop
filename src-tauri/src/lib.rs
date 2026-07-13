mod shortcuts;
mod tray;
mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            tray::install(app)?;
            shortcuts::install(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window::expand_main_window,
            window::collapse_main_window,
            window::toggle_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClipNote");
}
