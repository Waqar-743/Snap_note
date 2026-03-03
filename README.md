<p align="center">
  <img src="SnapNote-App.png" alt="SnapNote" width="150" />
</p>

<h1 align="center">SnapNote</h1>

<p align="center">
  <strong>A modern desktop note-taking app with clipboard capture, OCR, and dark mode.</strong><br/>
  Built with Tauri v2 + React + TypeScript + TipTap
</p>

<p align="center">
  <a href="https://github.com/Waqar-743/Snap_note/releases">
    <img src="https://img.shields.io/github/v/release/Waqar-743/Snap_note?style=flat-square" alt="Release" />
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="Platforms" />
  <img src="https://img.shields.io/github/license/Waqar-743/Snap_note?style=flat-square" alt="License" />
</p>

---

## Features

- **Multi-Tab Editor** — Work on multiple notes simultaneously with tabs you can rename, close, and create
- **Global Clipboard Capture** — Press `Ctrl+Alt+C` (or `⌘+Alt+C` on macOS) anywhere to auto-insert copied text/images into the active tab
- **Show / Focus App** — Press `Ctrl+Alt+O` (or `⌘+Alt+O`) to bring the app to the foreground instantly
- **Dark / Light Mode** — Toggle with one click; your preference is remembered
- **Rich Text Editing** — Bold, italic, underline, strikethrough, highlight, headings, lists, task lists, blockquotes, code blocks, and more
- **Image Paste + OCR** — Paste images directly; hover to extract text via Tesseract OCR
- **Cross-platform** — Windows, macOS, and Linux



## Download

Download the latest installers from the [Releases page](https://github.com/Waqar-743/Snap_note/releases).

| Platform | File |
|----------|------|
| Windows (recommended) | `SnapNote_x.x.x_x64-setup.exe` |
| Windows (MSI) | `SnapNote_x.x.x_x64_en-US.msi` |
| Linux (AppImage) | `SnapNote_x.x.x_amd64.AppImage` |
| Linux (deb) | `SnapNote_x.x.x_amd64.deb` |

## Development

```bash
cd snapnote
npm install
npm run tauri dev
```

### Build Installers

```bash
cd snapnote
npm run tauri build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+C` | Capture clipboard into active tab |
| `Ctrl+Alt+O` | Show / focus the app window |
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Ctrl+Shift+X` | Strikethrough |
| `Ctrl+Shift+H` | Highlight |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |

> On macOS, replace `Ctrl` with `⌘`.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, TipTap Editor
- **Backend:** Tauri v2, Rust
- **OCR:** Tesseract (via rusty-tesseract)
- **Icons:** Lucide React

                                                                   **Build with Headache**
