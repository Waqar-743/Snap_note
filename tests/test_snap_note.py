"""Unit tests for SnapNote application logic."""

import sys
import unittest
import unittest.mock as mock

# Provide a minimal tkinter stub so tests run in headless environments
# where a real display may not be available.
import types

# ---------------------------------------------------------------------------
# Lightweight tkinter / PIL stubs
# ---------------------------------------------------------------------------

_tk_stub = types.ModuleType("tkinter")
_tk_stub.END = "end"
_tk_stub.INSERT = "insert"
_tk_stub.SEL_FIRST = "sel.first"
_tk_stub.SEL_LAST = "sel.last"
_tk_stub.SEL = "sel"
_tk_stub.TOP = "top"
_tk_stub.BOTTOM = "bottom"
_tk_stub.LEFT = "left"
_tk_stub.RIGHT = "right"
_tk_stub.BOTH = "both"
_tk_stub.X = "x"
_tk_stub.Y = "y"
_tk_stub.WORD = "word"
_tk_stub.VERTICAL = "vertical"
_tk_stub.HORIZONTAL = "horizontal"
_tk_stub.FLAT = "flat"
_tk_stub.W = "w"
_tk_stub.TclError = Exception


class _FakeVar:
    def __init__(self, value=""):
        self._v = value

    def set(self, v):
        self._v = v

    def get(self):
        return self._v


class _FakeText:
    def __init__(self, *a, **kw):
        self._content = ""
        self._modified = False
        self.images_inserted = []

    def delete(self, start, end):
        self._content = ""

    def insert(self, idx, text):
        self._content += text

    def get(self, start, end):
        return self._content

    def image_create(self, idx, **kw):
        self.images_inserted.append(kw.get("image"))

    def bind(self, *a, **kw):
        pass

    def edit_modified(self, flag=None):
        if flag is None:
            return self._modified
        self._modified = flag

    def winfo_width(self):
        return 800

    def tag_add(self, *a):
        pass

    def mark_set(self, *a):
        pass

    def yview(self, *a):
        pass

    def xview(self, *a):
        pass

    def pack(self, **kw):
        pass


class _FakeWidget:
    def __init__(self, *a, **kw):
        pass

    def pack(self, **kw):
        pass

    def config(self, **kw):
        pass

    def add_cascade(self, **kw):
        pass

    def add_command(self, **kw):
        pass

    def add_separator(self, **kw):
        pass


class _FakeMenu(_FakeWidget):
    pass


class _FakeButton(_FakeWidget):
    pass


class _FakeLabel(_FakeWidget):
    pass


class _FakeFrame(_FakeWidget):
    pass


class _FakeSeparator(_FakeWidget):
    pass


class _FakeScrollbar(_FakeWidget):
    pass


class _FakeRoot:
    def __init__(self):
        self._title = ""
        self._clipboard = ""
        self.after_calls = []

    def title(self, t=None):
        if t is not None:
            self._title = t
        return self._title

    def configure(self, **kw):
        pass

    def config(self, **kw):
        pass

    def minsize(self, *a):
        pass

    def geometry(self, *a):
        pass

    def bind(self, *a, **kw):
        pass

    def protocol(self, *a, **kw):
        pass

    def clipboard_get(self):
        return self._clipboard

    def clipboard_clear(self):
        self._clipboard = ""

    def clipboard_append(self, text):
        self._clipboard += text

    def after(self, ms, fn):
        self.after_calls.append(fn)

    def destroy(self):
        pass


_tk_stub.Tk = _FakeRoot
_tk_stub.Menu = _FakeMenu
_tk_stub.Button = _FakeButton
_tk_stub.Label = _FakeLabel
_tk_stub.Frame = _FakeFrame
_tk_stub.Scrollbar = _FakeScrollbar
_tk_stub.Text = _FakeText
_tk_stub.StringVar = _FakeVar
_tk_stub.Event = object

_ttk_stub = types.ModuleType("tkinter.ttk")
_ttk_stub.Separator = _FakeSeparator
_tk_stub.ttk = _ttk_stub

_filedialog_stub = types.ModuleType("tkinter.filedialog")
_filedialog_stub.asksaveasfilename = mock.MagicMock(return_value="")
_filedialog_stub.askopenfilename = mock.MagicMock(return_value="")
_tk_stub.filedialog = _filedialog_stub

_messagebox_stub = types.ModuleType("tkinter.messagebox")
_messagebox_stub.showinfo = mock.MagicMock()
_messagebox_stub.showwarning = mock.MagicMock()
_messagebox_stub.showerror = mock.MagicMock()
_messagebox_stub.askyesno = mock.MagicMock(return_value=True)
_messagebox_stub.askyesnocancel = mock.MagicMock(return_value=False)
_tk_stub.messagebox = _messagebox_stub

sys.modules.setdefault("tkinter", _tk_stub)
sys.modules.setdefault("tkinter.ttk", _ttk_stub)
sys.modules.setdefault("tkinter.filedialog", _filedialog_stub)
sys.modules.setdefault("tkinter.messagebox", _messagebox_stub)

# PIL stubs
_pil_stub = types.ModuleType("PIL")
_pil_image_stub = types.ModuleType("PIL.Image")
_pil_imagetk_stub = types.ModuleType("PIL.ImageTk")
_pil_imagegrab_stub = types.ModuleType("PIL.ImageGrab")


class _FakePILImage:
    LANCZOS = "LANCZOS"

    def __init__(self, width=100, height=80, mode="RGB"):
        self.width = width
        self.height = height
        self.mode = mode

    def resize(self, size, resample=None):
        return _FakePILImage(size[0], size[1], self.mode)


_pil_image_stub.Image = _FakePILImage
_pil_image_stub.LANCZOS = "LANCZOS"
_pil_imagetk_stub.PhotoImage = mock.MagicMock(return_value=object())
_pil_imagegrab_stub.grabclipboard = mock.MagicMock(return_value=None)

sys.modules.setdefault("PIL", _pil_stub)
sys.modules.setdefault("PIL.Image", _pil_image_stub)
sys.modules.setdefault("PIL.ImageTk", _pil_imagetk_stub)
sys.modules.setdefault("PIL.ImageGrab", _pil_imagegrab_stub)

# Now import the module under test
import importlib  # noqa: E402

import main as snap_main  # noqa: E402

# Patch module-level names used inside main.py
snap_main.HAS_PIL = True
snap_main.Image = _pil_image_stub
snap_main.ImageTk = _pil_imagetk_stub
snap_main.ImageGrab = _pil_imagegrab_stub


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_app():
    """Return a SnapNote instance with a fake root."""
    root = _FakeRoot()
    app = snap_main.SnapNote.__new__(snap_main.SnapNote)
    app.root = root
    app._images = []
    app.current_file = None
    app.is_modified = False
    app.text = _FakeText()
    app.status_var = _FakeVar(value="Ready")
    return app


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestTitleUpdate(unittest.TestCase):
    def test_untitled_when_no_file(self):
        app = _make_app()
        app._update_title()
        self.assertIn("Untitled", app.root.title())

    def test_modified_marker_shown(self):
        app = _make_app()
        app.is_modified = True
        app._update_title()
        self.assertIn("\u2022", app.root.title())

    def test_filename_shown(self):
        app = _make_app()
        app.current_file = "/home/user/my_note.txt"
        app._update_title()
        self.assertIn("my_note.txt", app.root.title())


class TestStatusBar(unittest.TestCase):
    def test_set_status_updates_var(self):
        app = _make_app()
        app._set_status("hello")
        self.assertEqual(app.status_var.get(), "hello")

    def test_status_reset_scheduled(self):
        app = _make_app()
        app._set_status("msg")
        self.assertEqual(len(app.root.after_calls), 1)


class TestPasteText(unittest.TestCase):
    def test_paste_inserts_clipboard_text(self):
        app = _make_app()
        app.root._clipboard = "hello world"
        app.paste_text()
        self.assertEqual(app.text._content, "hello world")

    def test_paste_empty_clipboard_shows_status(self):
        app = _make_app()
        app.root._clipboard = ""
        app.paste_text()
        self.assertIn("empty", app.status_var.get().lower())

    def test_paste_no_clipboard_shows_status(self):
        app = _make_app()

        def _raise():
            raise _tk_stub.TclError("no clipboard")

        app.root.clipboard_get = _raise
        app.paste_text()
        self.assertIn("clipboard", app.status_var.get().lower())


class TestCopyText(unittest.TestCase):
    def test_copy_selected_text(self):
        app = _make_app()

        # Monkey-patch text.get to simulate a selection
        app.text.get = lambda start, end: (
            "selected" if start == _tk_stub.SEL_FIRST else ""
        )
        app.copy_text()
        self.assertEqual(app.root._clipboard, "selected")

    def test_copy_no_selection_shows_status(self):
        app = _make_app()

        def _raise(start, end):
            raise _tk_stub.TclError("no selection")

        app.text.get = _raise
        app.copy_text()
        self.assertIn("selected", app.status_var.get().lower())


class TestCutText(unittest.TestCase):
    def test_cut_moves_text_to_clipboard(self):
        app = _make_app()
        deleted = []

        app.text.get = lambda s, e: "cut me"
        app.text.delete = lambda s, e: deleted.append((s, e))
        app.cut_text()

        self.assertEqual(app.root._clipboard, "cut me")
        self.assertEqual(len(deleted), 1)

    def test_cut_no_selection_shows_status(self):
        app = _make_app()

        def _raise(s, e):
            raise _tk_stub.TclError

        app.text.get = _raise
        app.cut_text()
        self.assertIn("selected", app.status_var.get().lower())


class TestNewNote(unittest.TestCase):
    def test_new_clears_content(self):
        app = _make_app()
        app.text._content = "existing"
        app.is_modified = False  # no confirm needed
        app.new_note()
        self.assertEqual(app.text._content, "")

    def test_new_resets_current_file(self):
        app = _make_app()
        app.current_file = "/some/file.txt"
        app.is_modified = False
        app.new_note()
        self.assertIsNone(app.current_file)


class TestInsertPilImage(unittest.TestCase):
    def test_inserts_image_into_text_widget(self):
        app = _make_app()
        img = _FakePILImage(width=200, height=100)
        app._insert_pil_image(img)
        self.assertEqual(len(app._images), 1)
        self.assertTrue(app.is_modified)

    def test_wide_image_is_resized(self):
        app = _make_app()
        # text widget reports width=800 → max_width=700
        img = _FakePILImage(width=1200, height=400)
        # patch resize to track call
        resized = []
        original_resize = img.resize

        def _resize(size, resample=None):
            resized.append(size)
            return _FakePILImage(size[0], size[1])

        img.resize = _resize
        app._insert_pil_image(img)
        self.assertTrue(len(resized) > 0, "resize should have been called")
        self.assertLessEqual(resized[0][0], 700)


class TestPasteImage(unittest.TestCase):
    def test_paste_image_no_pil_shows_warning(self):
        app = _make_app()
        snap_main.HAS_PIL = False
        try:
            app.paste_image()
            _messagebox_stub.showwarning.assert_called()
        finally:
            snap_main.HAS_PIL = True

    def test_paste_image_no_clipboard_image_shows_info(self):
        app = _make_app()
        app._get_clipboard_image = lambda: None
        app.paste_image()
        _messagebox_stub.showinfo.assert_called()

    def test_paste_image_inserts_when_available(self):
        app = _make_app()
        img = _FakePILImage(150, 100)
        app._get_clipboard_image = lambda: img
        inserted = []
        app._insert_pil_image = lambda i: inserted.append(i)
        app.paste_image()
        self.assertEqual(len(inserted), 1)
        self.assertIs(inserted[0], img)


class TestClearAll(unittest.TestCase):
    def test_clear_confirmed_deletes_content(self):
        app = _make_app()
        _messagebox_stub.askyesno.return_value = True
        app.text._content = "some text"
        app.clear_all()
        self.assertEqual(app.text._content, "")

    def test_clear_cancelled_keeps_content(self):
        app = _make_app()
        _messagebox_stub.askyesno.return_value = False
        app.text._content = "some text"
        app.clear_all()
        self.assertEqual(app.text._content, "some text")


if __name__ == "__main__":
    unittest.main()
