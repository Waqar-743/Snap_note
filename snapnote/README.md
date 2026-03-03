# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Run the app

Important: run commands from this folder (`snapnote/`), not the parent workspace folder.

```bash
cd /workspaces/Snap_note/snapnote
npm install
npm run tauri:dev
```

## Headless/dev-container run

If you are in a headless container (GTK display error), use:

```bash
cd /workspaces/Snap_note/snapnote
npm run tauri:dev:headless
```

## Troubleshooting

- `ENOENT ... /workspaces/Snap_note/package.json`: you are in the wrong directory. Use `cd /workspaces/Snap_note/snapnote`.
- `Port 1420 is already in use`: run `npm run ports:clean` and then `npm run tauri:dev`.
- OCR button says Tesseract is missing:
	- Linux: `sudo apt install tesseract-ocr`
	- macOS: `brew install tesseract`
	- Windows: install Tesseract and add it to `PATH`.
