mod data;
mod pets;
mod shortcuts;
mod tray;
mod vault;
mod window;

use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let position_sender = window::start_position_tracking();
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(move |window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::Moved(position) = event {
                let is_collapsed = window
                    .outer_size()
                    .map(|size| size.width <= 80 && size.height <= 80)
                    .unwrap_or(false);
                if is_collapsed {
                    let _ =
                        position_sender.send((window.app_handle().clone(), position.x, position.y));
                }
            }
        })
        .setup(|app| {
            let data_state = data::initialize(app.handle()).map_err(std::io::Error::other)?;
            let pet_state = pets::initialize(app.handle()).map_err(std::io::Error::other)?;
            let vault_state = vault::initialize(app.handle()).map_err(std::io::Error::other)?;
            app.manage(data_state);
            app.manage(pet_state);
            app.manage(vault_state);
            tray::install(app)?;
            shortcuts::install(app)?;
            window::collapse_main_window(app.handle().clone())?;
            data::start_clipboard_monitor(app.handle().clone());
            vault::start_auto_lock(app.handle().clone());
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
            pets::list_pets,
            pets::get_selected_pet,
            pets::select_pet,
            pets::import_pet,
            pets::delete_pet,
            vault::vault_status,
            vault::create_vault,
            vault::unlock_vault,
            vault::lock_vault,
            vault::list_vault_entries,
            vault::get_vault_entry,
            vault::create_vault_entry,
            vault::update_vault_entry,
            vault::delete_vault_entry,
            vault::change_vault_password,
            vault::set_vault_auto_lock,
            vault::copy_vault_username,
            vault::copy_vault_password,
            vault::set_vault_content_protected,
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
