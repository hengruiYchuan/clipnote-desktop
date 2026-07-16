mod ai_pets;
mod backup;
mod data;
mod pets;
mod process_tools;
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
            let data_state = data::initialize(app.handle()).map_err(|error| {
                std::io::Error::other(format!("初始化 ClipNote 数据库失败：{error}"))
            })?;
            let pet_state = pets::initialize(app.handle())
                .map_err(|error| std::io::Error::other(format!("初始化桌宠目录失败：{error}")))?;
            let vault_state = vault::initialize(app.handle()).map_err(|error| {
                std::io::Error::other(format!("初始化密码本数据库失败：{error}"))
            })?;
            app.manage(data_state);
            app.manage(pet_state);
            app.manage(vault_state);
            window::restore_desktop_notes(app.handle())
                .map_err(|error| std::io::Error::other(format!("恢复桌面便签窗口失败：{error}")))?;
            tray::install(app)?;
            shortcuts::install(app)?;
            window::collapse_main_window(app.handle().clone())?;
            data::start_clipboard_monitor(app.handle().clone());
            vault::start_auto_lock(app.handle().clone());
            vault::start_browser_bridge(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            data::get_capture_paused,
            ai_pets::ai_pet_provider_status,
            ai_pets::set_ai_pet_provider,
            ai_pets::set_ai_pet_api_key,
            ai_pets::test_ai_pet_provider,
            ai_pets::clear_ai_pet_api_key,
            ai_pets::generate_ai_pet,
            ai_pets::smart_text_action,
            backup::export_full_backup,
            backup::restore_full_backup,
            data::set_capture_paused,
            data::list_clips,
            data::set_clip_favorite,
            data::copy_clip,
            data::delete_clip,
            data::delete_unfavorited_clips,
            data::list_notes,
            data::get_note,
            data::create_note,
            data::create_note_from_clips,
            data::update_note,
            data::update_note_desktop_state,
            data::delete_note,
            data::export_note_markdown,
            data::export_notes_markdown,
            pets::list_pets,
            pets::get_selected_pet,
            pets::select_pet,
            pets::import_pet,
            pets::delete_pet,
            process_tools::pick_window_process,
            process_tools::terminate_window_process,
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
            vault::export_vault_backup,
            vault::restore_vault_backup,
            vault::preview_vault_csv,
            vault::import_vault_csv,
            vault::touch_vault_activity,
            vault::copy_browser_pairing_token,
            vault::rotate_browser_pairing_token,
            vault::set_vault_entry_favorite,
            vault::set_vault_entry_pinned,
            vault::open_vault_url,
            vault::copy_vault_username,
            vault::copy_vault_password,
            vault::set_vault_content_protected,
            window::get_main_window_mode,
            window::expand_main_window,
            window::collapse_main_window,
            window::start_drag_main_window,
            window::hide_main_window,
            window::exit_app,
            window::toggle_main_window,
            window::open_desktop_note,
            window::save_desktop_note_geometry,
            window::set_desktop_note_always_on_top,
            window::start_drag_desktop_note,
            window::retract_desktop_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClipNote");
}
