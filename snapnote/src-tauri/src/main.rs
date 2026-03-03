// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    io::Cursor,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use rusty_tesseract::{image_to_string, Args, Image};
use serde::Serialize;
use tauri::{Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const IMAGE_DATA_URL_CAP_BYTES: usize = 1_500_000;

#[derive(Debug, Clone, Serialize)]
struct ClipboardCaptured {
    #[serde(rename = "type")]
    payload_type: String,
    data: String,
}

fn capture_shortcut_for_platform() -> Shortcut {
    #[cfg(target_os = "macos")]
    {
        Shortcut::new(Some(Modifiers::META | Modifiers::ALT), Code::KeyC)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyC)
    }
}

fn show_app_shortcut_for_platform() -> Shortcut {
    #[cfg(target_os = "macos")]
    {
        Shortcut::new(Some(Modifiers::META | Modifiers::ALT), Code::KeyO)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyO)
    }
}

fn clipboard_image_payload(app: &tauri::AppHandle) -> Result<Option<ClipboardCaptured>, String> {
    let image = match app.clipboard().read_image() {
        Ok(image) => image,
        Err(_) => return Ok(None),
    };

    let rgba = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(
        image.width(),
        image.height(),
        image.rgba().to_vec(),
    )
    .ok_or_else(|| "Clipboard image conversion failed".to_string())?;

    let mut png_data = Vec::new();
    DynamicImage::ImageRgba8(rgba)
        .write_to(&mut Cursor::new(&mut png_data), ImageFormat::Png)
        .map_err(|error| error.to_string())?;

    if png_data.len() <= IMAGE_DATA_URL_CAP_BYTES {
        let encoded = STANDARD.encode(png_data);
        return Ok(Some(ClipboardCaptured {
            payload_type: "image".to_string(),
            data: format!("data:image/png;base64,{encoded}"),
        }));
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let file_path = std::env::temp_dir().join(format!("snapnote-clipboard-{timestamp}.png"));
    fs::write(&file_path, &png_data).map_err(|error| error.to_string())?;

    let bytes = fs::read(&file_path).map_err(|error| error.to_string())?;
    let encoded = STANDARD.encode(bytes);

    Ok(Some(ClipboardCaptured {
        payload_type: "image".to_string(),
        data: format!("data:image/png;base64,{encoded}"),
    }))
}

fn capture_clipboard_payload(app: &tauri::AppHandle) -> Result<Option<ClipboardCaptured>, String> {
    if let Ok(text) = app.clipboard().read_text() {
        let trimmed = text.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(Some(ClipboardCaptured {
                payload_type: "text".to_string(),
                data: trimmed,
            }));
        }
    }

    clipboard_image_payload(app)
}

fn ensure_tesseract_available() -> Result<(), String> {
    match Command::new("tesseract").arg("--version").output() {
        Ok(output) if output.status.success() => Ok(()),
        Ok(_) | Err(_) => Err(
            "OCR engine not available. Install Tesseract and restart the app. Linux: `sudo apt install tesseract-ocr`, macOS: `brew install tesseract`, Windows: install Tesseract and add it to PATH.".to_string(),
        ),
    }
}

#[tauri::command]
fn extract_text_from_image(base64_data: String) -> Result<String, String> {
    ensure_tesseract_available()?;

    let encoded_segment = base64_data
        .split(',')
        .next_back()
        .ok_or_else(|| "Invalid base64 image payload".to_string())?;

    let decoded = STANDARD
        .decode(encoded_segment)
        .map_err(|error| format!("Failed to decode image data: {error}"))?;

    let temp_path = std::env::temp_dir().join("snapnote-ocr-input.png");
    fs::write(&temp_path, decoded).map_err(|error| error.to_string())?;

    let image_input =
        Image::from_path(&temp_path).map_err(|error| format!("Unable to prepare image for OCR: {error}"))?;
    let text_result = image_to_string(&image_input, &Args::default());

    let _ = fs::remove_file(temp_path);

    let text = text_result.map_err(|error| {
        format!(
            "OCR processing failed. Ensure Tesseract language data is installed. Details: {error}"
        )
    })?;

    Ok(text.trim().to_string())
}

fn main() {
    let capture_shortcut = capture_shortcut_for_platform();
    let show_app_shortcut = show_app_shortcut_for_platform();
    let capture_handler_shortcut = capture_shortcut.clone();
    let show_handler_shortcut = show_app_shortcut.clone();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, triggered_shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }

                    if *triggered_shortcut == capture_handler_shortcut {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            if let Ok(Some(payload)) = capture_clipboard_payload(&app_handle) {
                                let _ = app_handle.emit("clipboard-captured", payload);
                            }
                        });
                        return;
                    }

                    if *triggered_shortcut == show_handler_shortcut {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            app.global_shortcut()
                .register(capture_shortcut)
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            app.global_shortcut()
                .register(show_app_shortcut)
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![extract_text_from_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
