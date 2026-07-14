mod data;
mod shortcuts;
mod tray;
mod window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_state = data::initialize(app.handle()).map_err(std::io::Error::other)?;
            app.manage(data_state);
            tray::install(app)?;
            shortcuts::install(app)?;
            window::collapse_main_window(app.handle().clone())?;
            data::start_clipboard_monitor(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            data::get_capture_paused,
            data::set_capture_paused,
            data::list_clips,
            data::set_clip_favorite,
            data::copy_clip,
            data::delete_clip,
            data::list_notes,
            data::create_note,
            data::update_note,
            data::delete_note,
            window::get_main_window_mode,
            window::expand_main_window,
            window::collapse_main_window,
            window::start_drag_main_window,
            window::hide_main_window,
            window::toggle_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClipNote");
}
