use std::{fs, io::Cursor, process::Command, time::{SystemTime, UNIX_EPOCH}};

use arboard::Clipboard;
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use rusty_tesseract::{image_to_string, Args, Image};
use serde::Serialize;
use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const IMAGE_DATA_URL_CAP_BYTES: usize = 1_500_000;

#[derive(Debug, Clone, Serialize)]
struct ClipboardCaptured {
    #[serde(rename = "type")]
    payload_type: String,
    data: String,
    source: Option<String>,
}

fn shortcut_for_platform() -> Shortcut {
    #[cfg(target_os = "macos")]
    {
        Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::KeyS)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyS)
    }
}

fn clipboard_image_payload() -> Result<Option<ClipboardCaptured>, String> {
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    let image = match clipboard.get_image() {
        Ok(image) => image,
        Err(_) => return Ok(None),
    };

    let width = image.width as u32;
    let height = image.height as u32;
    let image_bytes = image.bytes.into_owned();
    let rgba = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, image_bytes)
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
            source: Some("data_url".to_string()),
        }));
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let file_path = std::env::temp_dir().join(format!("snapnote-clipboard-{timestamp}.png"));

    fs::write(&file_path, &png_data).map_err(|error| error.to_string())?;

    Ok(Some(ClipboardCaptured {
        payload_type: "image".to_string(),
        data: file_path.to_string_lossy().to_string(),
        source: Some("path".to_string()),
    }))
}

fn capture_clipboard_payload() -> Result<Option<ClipboardCaptured>, String> {
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;

    if let Ok(text) = clipboard.get_text() {
        let trimmed = text.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(Some(ClipboardCaptured {
                payload_type: "text".to_string(),
                data: trimmed,
                source: None,
            }));
        }
    }

    clipboard_image_payload()
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

    let image_input = Image::from_path(&temp_path)
        .map_err(|error| format!("Unable to prepare image for OCR: {error}"))?;
    let text_result = image_to_string(&image_input, &Args::default());

    let _ = fs::remove_file(temp_path);

    let text = text_result.map_err(|error| {
        format!(
            "OCR processing failed. Ensure Tesseract language data is installed. Details: {error}"
        )
    })?;

    Ok(text.trim().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let capture_shortcut = shortcut_for_platform();
    let handler_shortcut = capture_shortcut.clone();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, triggered_shortcut, event| {
                    if event.state == ShortcutState::Pressed
                        && *triggered_shortcut == handler_shortcut
                    {
                        if let Ok(Some(payload)) = capture_clipboard_payload() {
                            let _ = app.emit("clipboard-captured", payload);
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![extract_text_from_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
