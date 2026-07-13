use tauri::App;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn install(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let toggle = Shortcut::new(Some(Modifiers::ALT), Code::Space);
    let handler_shortcut = toggle.clone();
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, triggered, event| {
                if triggered == &handler_shortcut && event.state() == ShortcutState::Pressed {
                    let _ = crate::window::toggle_main_window(app.clone());
                }
            })
            .build(),
    )?;
    app.global_shortcut().register(toggle)?;
    Ok(())
}
