use tauri::command;

#[cfg(target_os = "macos")]
#[command]
pub fn set_app_icon(_app: tauri::AppHandle, _name: String) -> Result<(), String> {
    Err("Alternate upstream artwork is not distributed by the controlled fork".to_string())
}

#[cfg(not(target_os = "macos"))]
#[command]
pub fn set_app_icon(_name: String) -> Result<(), String> {
    Ok(())
}
