use serde_json::Value;
use tauri::{AppHandle, Runtime, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::pdf::webview_create_pdf;

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

/// Print the current WebView contents to PDF using the platform's native engine.
///
/// Returns the raw PDF bytes (before pdf-lib post-processing).
/// The JS frontend receives these bytes, runs pdf-lib to embed resume.json,
/// then calls `save_pdf` to write the final file.
#[tauri::command]
pub async fn print_to_pdf<R: Runtime>(window: WebviewWindow<R>) -> Result<Vec<u8>, String> {
    webview_create_pdf(window).await
}

/// Open a native Save dialog and write raw PDF bytes to the chosen path.
///
/// `bytes`        — raw PDF bytes produced by pdf-lib in the JS frontend
/// `default_name` — suggested filename shown in the dialog (e.g. "John_Doe_resume.pdf")
///
/// Returns the absolute path of the saved file, or an error string.
#[tauri::command]
pub async fn save_pdf<R: Runtime>(
    app: AppHandle<R>,
    bytes: Vec<u8>,
    default_name: String,
) -> Result<String, String> {
    // Show the native save dialog on the main thread.
    let path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("PDF Document", &["pdf"])
        .blocking_save_file();

    let path = match path {
        Some(p) => p,
        None => return Err("cancelled".into()),
    };

    let path_str = path
        .as_path()
        .ok_or("Could not resolve save path")?
        .to_string_lossy()
        .to_string();

    std::fs::write(&path_str, &bytes)
        .map_err(|e| format!("Failed to write PDF: {e}"))?;

    Ok(path_str)
}
