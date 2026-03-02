#!/usr/bin/env python3
"""SnapNote - A desktop notepad application that handles both text and images."""

import io
import os
import platform
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

try:
    from PIL import Image, ImageGrab, ImageTk

    HAS_PIL = True
except ImportError:
    HAS_PIL = False


class SnapNote:
    """Main application class for SnapNote."""

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("SnapNote")
        self.root.geometry("900x650")
        self.root.configure(bg="#f5f5f5")
        self.root.minsize(600, 400)

        # Keep references to PhotoImage objects to prevent garbage collection
        self._images: list[ImageTk.PhotoImage] = []
        self.current_file: str | None = None
        self.is_modified = False

        self._setup_menu()
        self._setup_toolbar()
        self._setup_editor()
        self._setup_statusbar()
        self._setup_bindings()
        self._update_title()

    # ------------------------------------------------------------------
    # UI setup
    # ------------------------------------------------------------------

    def _setup_menu(self) -> None:
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        # File menu
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="New", accelerator="Ctrl+N", command=self.new_note)
        file_menu.add_command(label="Open…", accelerator="Ctrl+O", command=self.open_file)
        file_menu.add_command(label="Save", accelerator="Ctrl+S", command=self.save_file)
        file_menu.add_command(
            label="Save As…", accelerator="Ctrl+Shift+S", command=self.save_file_as
        )
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.quit_app)

        # Edit menu
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Edit", menu=edit_menu)
        edit_menu.add_command(
            label="Paste Text", accelerator="Ctrl+V", command=self.paste_text
        )
        edit_menu.add_command(
            label="Paste Image", accelerator="Ctrl+Shift+V", command=self.paste_image
        )
        edit_menu.add_separator()
        edit_menu.add_command(label="Copy", accelerator="Ctrl+C", command=self.copy_text)
        edit_menu.add_command(label="Cut", accelerator="Ctrl+X", command=self.cut_text)
        edit_menu.add_separator()
        edit_menu.add_command(
            label="Select All", accelerator="Ctrl+A", command=self.select_all
        )
        edit_menu.add_command(label="Clear All", command=self.clear_all)

        # Insert menu
        insert_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Insert", menu=insert_menu)
        insert_menu.add_command(
            label="Image from File…", command=self.insert_image_from_file
        )

        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="About", command=self.show_about)

    def _setup_toolbar(self) -> None:
        toolbar = tk.Frame(self.root, bg="#dde3ea", bd=0, relief=tk.FLAT)
        toolbar.pack(side=tk.TOP, fill=tk.X)

        btn_cfg = {
            "relief": tk.FLAT,
            "bg": "#dde3ea",
            "activebackground": "#b8c4d0",
            "padx": 10,
            "pady": 5,
            "cursor": "hand2",
            "font": ("Segoe UI", 10),
        }

        tk.Button(toolbar, text="📄 New", command=self.new_note, **btn_cfg).pack(
            side=tk.LEFT, padx=2, pady=2
        )
        tk.Button(toolbar, text="📂 Open", command=self.open_file, **btn_cfg).pack(
            side=tk.LEFT, padx=2, pady=2
        )
        tk.Button(toolbar, text="💾 Save", command=self.save_file, **btn_cfg).pack(
            side=tk.LEFT, padx=2, pady=2
        )

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(
            side=tk.LEFT, fill=tk.Y, padx=6, pady=4
        )

        tk.Button(
            toolbar, text="📋 Paste Text", command=self.paste_text, **btn_cfg
        ).pack(side=tk.LEFT, padx=2, pady=2)
        tk.Button(
            toolbar, text="🖼️ Paste Image", command=self.paste_image, **btn_cfg
        ).pack(side=tk.LEFT, padx=2, pady=2)
        tk.Button(
            toolbar,
            text="🗂️ Image from File",
            command=self.insert_image_from_file,
            **btn_cfg,
        ).pack(side=tk.LEFT, padx=2, pady=2)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(
            side=tk.LEFT, fill=tk.Y, padx=6, pady=4
        )

        tk.Button(
            toolbar, text="🗑️ Clear All", command=self.clear_all, **btn_cfg
        ).pack(side=tk.LEFT, padx=2, pady=2)

    def _setup_editor(self) -> None:
        editor_frame = tk.Frame(self.root, bg="#f5f5f5")
        editor_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=(0, 0))

        scrollbar_y = tk.Scrollbar(editor_frame, orient=tk.VERTICAL)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)

        scrollbar_x = tk.Scrollbar(editor_frame, orient=tk.HORIZONTAL)
        scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)

        self.text = tk.Text(
            editor_frame,
            wrap=tk.WORD,
            font=("Segoe UI", 12),
            bg="white",
            fg="#222222",
            insertbackground="#333333",
            selectbackground="#b3d4fc",
            selectforeground="#000000",
            relief=tk.FLAT,
            borderwidth=0,
            padx=14,
            pady=14,
            undo=True,
            yscrollcommand=scrollbar_y.set,
            xscrollcommand=scrollbar_x.set,
            spacing3=4,
        )
        self.text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar_y.config(command=self.text.yview)
        scrollbar_x.config(command=self.text.xview)

        self.text.bind("<<Modified>>", self._on_modified)

    def _setup_statusbar(self) -> None:
        self.status_var = tk.StringVar(value="Ready")
        status_bar = tk.Label(
            self.root,
            textvariable=self.status_var,
            bd=0,
            relief=tk.FLAT,
            anchor=tk.W,
            bg="#dde3ea",
            fg="#444444",
            padx=8,
            pady=3,
            font=("Segoe UI", 9),
        )
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)

    def _setup_bindings(self) -> None:
        self.root.bind("<Control-n>", lambda _e: self.new_note())
        self.root.bind("<Control-o>", lambda _e: self.open_file())
        self.root.bind("<Control-s>", lambda _e: self.save_file())
        self.root.bind("<Control-S>", lambda _e: self.save_file_as())
        # Ctrl+V is already handled natively for text; override to our handler
        self.text.bind("<Control-v>", lambda _e: (self.paste_text(), "break"))
        self.root.bind("<Control-V>", lambda _e: self.paste_image())
        self.root.bind("<Control-a>", lambda _e: self.select_all())
        self.root.protocol("WM_DELETE_WINDOW", self.quit_app)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _on_modified(self, _event: tk.Event | None = None) -> None:
        if self.text.edit_modified():
            self.is_modified = True
            self._update_title()
            self.text.edit_modified(False)

    def _update_title(self) -> None:
        name = os.path.basename(self.current_file) if self.current_file else "Untitled"
        modified_marker = " \u2022" if self.is_modified else ""
        self.root.title(f"SnapNote \u2014 {name}{modified_marker}")

    def _set_status(self, message: str, duration_ms: int = 3000) -> None:
        self.status_var.set(message)
        self.root.after(duration_ms, lambda: self.status_var.set("Ready"))

    def _confirm_discard(self) -> bool:
        """Return True if it is safe to discard current content."""
        if not self.is_modified:
            return True
        response = messagebox.askyesnocancel(
            "Unsaved Changes", "Save changes before continuing?"
        )
        if response is None:
            return False
        if response:
            self.save_file()
        return True

    def _get_clipboard_image(self) -> "Image.Image | None":
        """Return a PIL Image from the clipboard, or None."""
        if not HAS_PIL:
            return None

        # PIL ImageGrab works natively on Windows and macOS
        try:
            img = ImageGrab.grabclipboard()
            if isinstance(img, Image.Image):
                return img
        except Exception:
            pass

        # Linux fallback: xclip / xsel
        if platform.system() == "Linux":
            import shutil
            import subprocess  # noqa: PLC0415

            candidates = [
                (
                    "xclip",
                    ["xclip", "-selection", "clipboard", "-t", "image/png", "-o"],
                ),
                ("xsel", ["xsel", "--clipboard", "--output"]),
            ]
            for binary, cmd in candidates:
                if shutil.which(binary) is None:
                    continue
                try:
                    result = subprocess.run(  # noqa: S603
                        cmd, capture_output=True, timeout=2, check=False
                    )
                    if result.returncode == 0 and result.stdout:
                        return Image.open(io.BytesIO(result.stdout))
                except Exception:
                    continue

        return None

    def _insert_pil_image(self, image: "Image.Image") -> None:
        """Resize (if needed) and embed a PIL Image inside the Text widget."""
        _DEFAULT_MAX_WIDTH = 700
        _EDITOR_PADDING = 30
        widget_width = self.text.winfo_width()
        max_width = (
            min(_DEFAULT_MAX_WIDTH, widget_width - _EDITOR_PADDING)
            if widget_width > _EDITOR_PADDING
            else _DEFAULT_MAX_WIDTH
        )
        if image.width > max_width:
            ratio = max_width / image.width
            image = image.resize(
                (max_width, int(image.height * ratio)), Image.LANCZOS
            )

        photo = ImageTk.PhotoImage(image)
        self._images.append(photo)  # prevent GC
        self.text.image_create(tk.INSERT, image=photo, padx=4, pady=4)
        self.text.insert(tk.INSERT, "\n")
        self.is_modified = True
        self._update_title()

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------

    def new_note(self) -> None:
        if not self._confirm_discard():
            return
        self.text.delete("1.0", tk.END)
        self._images.clear()
        self.current_file = None
        self.is_modified = False
        self._update_title()
        self._set_status("New note created")

    def paste_text(self) -> None:
        """Paste plain text from the system clipboard."""
        try:
            text = self.root.clipboard_get()
        except tk.TclError:
            self._set_status("No text in clipboard")
            return

        if text:
            self.text.insert(tk.INSERT, text)
            self._set_status(f"Pasted {len(text):,} character(s)")
        else:
            self._set_status("Clipboard is empty")

    def paste_image(self) -> None:
        """Paste an image from the system clipboard."""
        if not HAS_PIL:
            messagebox.showwarning(
                "Pillow Not Installed",
                "Image support requires Pillow.\n\nInstall it with:\n  pip install Pillow",
            )
            return

        image = self._get_clipboard_image()
        if image:
            self._insert_pil_image(image)
            self._set_status(f"Image pasted ({image.width}\u00d7{image.height} px)")
        else:
            messagebox.showinfo(
                "No Image in Clipboard",
                "No image was found in the clipboard.\n\n"
                "Copy an image (e.g. with Print Screen or from a browser) and try again.",
            )
            self._set_status("No image in clipboard")

    def insert_image_from_file(self) -> None:
        """Open a file dialog and insert an image from disk."""
        if not HAS_PIL:
            messagebox.showwarning(
                "Pillow Not Installed",
                "Image support requires Pillow.\n\nInstall it with:\n  pip install Pillow",
            )
            return

        path = filedialog.askopenfilename(
            title="Insert Image",
            filetypes=[
                ("Image files", "*.png *.jpg *.jpeg *.gif *.bmp *.webp *.tiff"),
                ("All files", "*.*"),
            ],
        )
        if path:
            try:
                image = Image.open(path)
                self._insert_pil_image(image)
                self._set_status(f"Inserted image from {os.path.basename(path)}")
            except Exception as exc:
                messagebox.showerror("Image Error", f"Could not open image:\n{exc}")

    def copy_text(self) -> None:
        """Copy the selected text to the clipboard."""
        try:
            selected = self.text.get(tk.SEL_FIRST, tk.SEL_LAST)
        except tk.TclError:
            self._set_status("No text selected")
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(selected)
        self._set_status(f"Copied {len(selected):,} character(s)")

    def cut_text(self) -> None:
        """Cut the selected text to the clipboard."""
        try:
            selected = self.text.get(tk.SEL_FIRST, tk.SEL_LAST)
        except tk.TclError:
            self._set_status("No text selected")
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(selected)
        self.text.delete(tk.SEL_FIRST, tk.SEL_LAST)
        self._set_status(f"Cut {len(selected):,} character(s)")

    def select_all(self) -> str:
        """Select all content in the editor."""
        self.text.tag_add(tk.SEL, "1.0", tk.END)
        self.text.mark_set(tk.INSERT, "1.0")
        return "break"

    def clear_all(self) -> None:
        """Clear all content after confirmation."""
        if messagebox.askyesno("Clear All", "Clear all content? This cannot be undone."):
            self.text.delete("1.0", tk.END)
            self._images.clear()
            self.is_modified = True
            self._update_title()
            self._set_status("Content cleared")

    # ------------------------------------------------------------------
    # File I/O
    # ------------------------------------------------------------------

    def save_file(self) -> None:
        if self.current_file:
            self._write_text_file(self.current_file)
        else:
            self.save_file_as()

    def save_file_as(self) -> None:
        path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")],
        )
        if path:
            self._write_text_file(path)
            self.current_file = path
            self._update_title()

    def _write_text_file(self, path: str) -> None:
        try:
            content = self.text.get("1.0", tk.END)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(content)
            self.is_modified = False
            self._update_title()
            self._set_status(f"Saved to {os.path.basename(path)}")
        except OSError as exc:
            messagebox.showerror("Save Error", f"Could not save file:\n{exc}")

    def open_file(self) -> None:
        if not self._confirm_discard():
            return
        path = filedialog.askopenfilename(
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        if path:
            try:
                with open(path, encoding="utf-8") as fh:
                    content = fh.read()
                self.text.delete("1.0", tk.END)
                self.text.insert("1.0", content)
                self.current_file = path
                self.is_modified = False
                self._images.clear()
                self._update_title()
                self._set_status(f"Opened {os.path.basename(path)}")
            except OSError as exc:
                messagebox.showerror("Open Error", f"Could not open file:\n{exc}")

    # ------------------------------------------------------------------
    # Misc
    # ------------------------------------------------------------------

    def show_about(self) -> None:
        messagebox.showinfo(
            "About SnapNote",
            "SnapNote v1.0\n\n"
            "A desktop notepad that handles both text and images smoothly.\n\n"
            "Features:\n"
            "  • Type or paste text\n"
            "  • Paste images from clipboard (Ctrl+Shift+V)\n"
            "  • Insert images from files\n"
            "  • Save and open text notes\n"
            "  • Undo / Redo support\n",
        )

    def quit_app(self) -> None:
        if not self._confirm_discard():
            return
        self.root.destroy()


def main() -> None:
    root = tk.Tk()
    SnapNote(root)
    root.mainloop()


if __name__ == "__main__":
    main()
