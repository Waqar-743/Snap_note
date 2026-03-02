# SnapNote

A desktop notepad application that handles both **text** and **images** smoothly — think of it as a notepad that goes beyond plain text.

## Features

- 📝 Type or paste plain text, just like a regular notepad
- 🖼️ Paste images directly from the clipboard (`Ctrl+Shift+V`)
- 🗂️ Insert images from local files via the **Insert → Image from File…** menu or toolbar button
- 💾 Save and open text notes (`.txt`)
- ✂️ Full cut / copy / paste / undo / redo support
- 📋 Toolbar with one-click access to all common actions
- 🖥️ Clean, minimal UI with a status bar

## Requirements

- Python 3.10+
- [Pillow](https://pillow.readthedocs.io/) (for image support)

```bash
pip install -r requirements.txt
```

> **Linux clipboard images**: Pasting images from the clipboard on Linux requires
> either `xclip` or `xsel` to be installed (`sudo apt install xclip`).

## Running

```bash
python main.py
```

## Keyboard Shortcuts

| Shortcut         | Action              |
|------------------|---------------------|
| `Ctrl+N`         | New note            |
| `Ctrl+O`         | Open file           |
| `Ctrl+S`         | Save                |
| `Ctrl+Shift+S`   | Save As             |
| `Ctrl+V`         | Paste text          |
| `Ctrl+Shift+V`   | Paste image         |
| `Ctrl+C`         | Copy selected text  |
| `Ctrl+X`         | Cut selected text   |
| `Ctrl+A`         | Select all          |
| `Ctrl+Z`         | Undo                |
| `Ctrl+Y`         | Redo                |

## Running Tests

```bash
python -m pytest tests/ -v
```