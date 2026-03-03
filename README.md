<p align="center">
  <img src="SnapNote-logo-white.png" alt="SnapNote" width="120" />
</p>

<h1 align="center">SnapNote</h1>

<p align="center">
  A modern desktop note-taking app with clipboard capture, OCR, and dark mode.<br/>
  Built with <strong>Tauri v2 + React + TypeScript + TipTap</strong>.
</p>

---

## Features

- **Global Clipboard Capture** — Press `Ctrl+Alt+C` (or `⌘+Alt+C` on macOS) anywhere to auto-insert copied text/images into your note
- **Show / Focus App** — Press `Ctrl+Alt+O` (or `⌘+Alt+O` on macOS) to bring the app to the foreground
- **Dark / Light Mode** — Toggle with one click; remembers your preference
- **Rich Text Editor** — Bold, italic, underline, strikethrough, highlight, headings, lists, task lists, blockquotes, code, and more
- **Image Paste + OCR** — Paste images directly; hover to extract text via Tesseract OCR
- **Cross-platform** — Windows, macOS, and Linux

## Run the app

> **Important:** Run commands from the `snapnote/` folder, not the parent workspace folder.

```bash
cd snapnote
npm install
npm run tauri dev
```

### Headless / Dev Container

```bash
cd snapnote
npm run tauri:dev:headless
```

## Build installers

```bash
cd snapnote
npm run tauri build
```

Outputs are in `src-tauri/target/release/bundle/` (`.msi`, `.exe`, `.deb`, `.AppImage`, `.dmg`).

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+C` | Capture clipboard into note |
| `Ctrl+Alt+O` | Show / focus the app window |
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Ctrl+Shift+X` | Strikethrough |
| `Ctrl+Shift+H` | Highlight |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |

> On macOS, replace `Ctrl` with `⌘`.

## Troubleshooting

- **`ENOENT ... package.json`** — You are in the wrong directory. Use `cd snapnote`.
- **Port 1420 in use** — Run `npm run ports:clean` then `npm run tauri dev`.
- **OCR not working** — Install Tesseract:
  - Linux: `sudo apt install tesseract-ocr`
  - macOS: `brew install tesseract`
  - Windows: Install from [UB-Mannheim builds](https://github.com/UB-Mannheim/tesseract/wiki) and add to `PATH`.

***Create with Headaches***
