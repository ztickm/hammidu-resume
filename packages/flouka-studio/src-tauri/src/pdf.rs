/// Platform PDF generation.
///
/// macOS: calls `WKWebView.createPDFWithConfiguration:completionHandler:` on the
///        live WebView instance that is already rendering the resume preview.
///        This guarantees WYSIWYG — identical engine for preview and export.
///
/// Windows / Linux: stub that returns an error (Phase 3).

#[cfg(target_os = "macos")]
pub use macos::webview_create_pdf;

#[cfg(not(target_os = "macos"))]
pub use other::webview_create_pdf;

// ---------------------------------------------------------------------------
// macOS implementation
// ---------------------------------------------------------------------------
#[cfg(target_os = "macos")]
mod macos {
    use block2::RcBlock;
    use objc2_foundation::NSError;
    use objc2_web_kit::{WKPDFConfiguration, WKWebView};
    use tauri::{Runtime, WebviewWindow};

    /// Ask the live WKWebView to render itself to PDF and return the raw bytes.
    ///
    /// The ObjC completion handler fires on the main thread. We bridge it to
    /// an async Rust future via a `std::sync::mpsc` oneshot channel, receiving
    /// on a blocking background thread so we don't stall the main thread.
    pub async fn webview_create_pdf<R: Runtime>(
        window: WebviewWindow<R>,
    ) -> Result<Vec<u8>, String> {
        let (tx, rx) = std::sync::mpsc::channel::<Result<Vec<u8>, String>>();

        window
            .with_webview(move |webview| {
                // SAFETY: inner() returns the WKWebView* created and owned by
                // Tauri/WRY. We borrow it for the duration of this closure only.
                let wkwebview: &WKWebView =
                    unsafe { &*(webview.inner() as *const WKWebView) };

                // Default PDF configuration — full page, white background.
                let config = unsafe {
                    WKPDFConfiguration::new(objc2::MainThreadMarker::new_unchecked())
                };

                let tx_clone = tx.clone();

                let block = RcBlock::new(
                    move |data: *mut objc2_foundation::NSData,
                          error: *mut NSError| {
                        if !error.is_null() {
                            let desc = unsafe {
                                (*error).localizedDescription().to_string()
                            };
                            let _ = tx_clone.send(Err(desc));
                            return;
                        }
                        if data.is_null() {
                            let _ = tx_clone.send(Err(
                                "WKWebView.createPDF returned nil data".into(),
                            ));
                            return;
                        }
                        // Copy bytes while NSData is still alive (inside this block).
                        let bytes = unsafe { (*data).to_vec() };
                        let _ = tx_clone.send(Ok(bytes));
                    },
                );

                unsafe {
                    wkwebview.createPDFWithConfiguration_completionHandler(
                        Some(&config),
                        &*block,
                    );
                }
            })
            .map_err(|e| format!("with_webview failed: {e}"))?;

        // Receive the result on a background thread so we don't block the async
        // executor or the main thread. Tauri's async commands run on a thread pool.
        std::thread::spawn(move || rx.recv())
            .join()
            .map_err(|_| "PDF thread panicked".to_string())?
            .map_err(|_| "PDF completion channel closed unexpectedly".to_string())?
    }
}

// ---------------------------------------------------------------------------
// Windows / Linux stub
// ---------------------------------------------------------------------------
#[cfg(not(target_os = "macos"))]
mod other {
    use tauri::{Runtime, WebviewWindow};

    pub async fn webview_create_pdf<R: Runtime>(
        _window: WebviewWindow<R>,
    ) -> Result<Vec<u8>, String> {
        Err(
            "print_to_pdf is not yet implemented on this platform (Phase 3). \
             Please use the web-server version or run on macOS."
                .into(),
        )
    }
}
