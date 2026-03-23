mod commands;
mod pdf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::validate_resume,
            commands::generate_html,
            commands::print_to_pdf,
            commands::save_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Flouka Studio");
}
