use serde_json::Value;

/// Validate a JSON Resume.
/// Phase 1: delegated to the JS validator package in the frontend.
/// This command is scaffolded for future file-drop support from Rust.
#[tauri::command]
pub fn validate_resume(json: String) -> Result<Value, String> {
    let _ = json;
    Ok(serde_json::json!({ "delegated": true }))
}

/// Generate HTML from a JSON Resume string.
/// Phase 1: the JS frontend calls xebec-render directly.
/// This command is scaffolded for Phase 2 server-side rendering.
#[tauri::command]
pub fn generate_html(json: String, config: Option<Value>) -> Result<String, String> {
    let _ = (json, config);
    Err("generate_html: use the JS xebec-render module directly in Phase 1".into())
}

/// Write raw PDF bytes to a file chosen by the user via the native save dialog.
/// The PDF bytes come from pdf-lib running in the JS frontend.
/// Full implementation in Phase 2 once the print_to_pdf command exists.
#[tauri::command]
pub async fn save_pdf(
    _app: tauri::AppHandle,
    _bytes: Vec<u8>,
    _default_name: String,
) -> Result<String, String> {
    Err("save_pdf: full implementation in Phase 2".into())
}
