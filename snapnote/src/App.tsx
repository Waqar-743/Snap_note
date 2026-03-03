import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Minus,
  Undo2,
  Redo2,
  Sun,
  Moon,
  Clipboard,
  ScanSearch,
  Keyboard,
  X,
} from "lucide-react";

import logoWhite from "./assets/logo-white.png";
import logoDark from "./assets/logo-dark.png";

/* ── Types ───────────────────────────────────────────── */
type ClipboardPayload = {
  type: "text" | "image";
  data: string;
};

/* ── Dark mode hook ──────────────────────────────────── */
function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("snapnote-theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("snapnote-theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, setDark] as const;
}

/* ── Helpers ─────────────────────────────────────────── */
const readFileAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read image data."));
    reader.readAsDataURL(file);
  });

const readUrlAsDataUrl = async (src: string) => {
  const response = await fetch(src);
  const blob = await response.blob();
  return readFileAsDataUrl(blob);
};

const isMac =
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

/* ── OCR Image Node ─────────────────────────────────── */
const OCRImageNode = (props: NodeViewProps) => {
  const [isExtracting, setIsExtracting] = useState(false);

  const handleExtract = async () => {
    const currentSrc = String(props.node.attrs.src ?? "");
    if (!currentSrc || isExtracting) return;

    try {
      setIsExtracting(true);
      const base64Data = currentSrc.startsWith("data:image")
        ? currentSrc
        : await readUrlAsDataUrl(currentSrc);
      const extracted = await invoke<string>("extract_text_from_image", {
        base64_data: base64Data,
      });
      const position =
        typeof props.getPos === "function" ? props.getPos() : null;

      if (typeof position === "number") {
        props.editor
          .chain()
          .focus()
          .insertContentAt(position + props.node.nodeSize, {
            type: "paragraph",
            content: [
              { type: "text", text: extracted || "(No text detected)" },
            ],
          })
          .run();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OCR extraction failed.";
      props.editor
        .chain()
        .focus()
        .insertContent({
          type: "paragraph",
          content: [{ type: "text", text: message }],
        })
        .run();
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <NodeViewWrapper className="image-node-block group relative my-4 flex justify-center">
      <img
        src={String(props.node.attrs.src ?? "")}
        alt="Pasted"
        className="max-h-[300px] max-w-full rounded-lg border border-gray-200 object-contain dark:border-gray-700"
      />
      <button
        type="button"
        onClick={handleExtract}
        className="absolute right-2 top-2 flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-black/90"
      >
        <ScanSearch className="h-3.5 w-3.5" />
        {isExtracting ? "Extracting..." : "Extract Text"}
      </button>
    </NodeViewWrapper>
  );
};

const OCRImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(OCRImageNode);
  },
});

/* ── Toolbar Button ─────────────────────────────────── */
const ToolbarBtn = ({
  title,
  active,
  onClick,
  children,
  className = "",
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className={`no-drag inline-flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 ${
      active
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    } ${className}`}
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />
);

/* ── Shortcut Overlay ────────────────────────────────── */
const ShortcutOverlay = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="relative w-[360px] rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        <X className="h-4 w-4" />
      </button>
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
        Keyboard Shortcuts
      </h3>
      <div className="space-y-2 text-sm">
        {[
          [`${mod}+Alt+C`, "Capture clipboard to note"],
          [`${mod}+Alt+O`, "Show / focus app"],
          [`${mod}+B`, "Bold"],
          [`${mod}+I`, "Italic"],
          [`${mod}+U`, "Underline"],
          [`${mod}+Shift+X`, "Strikethrough"],
          [`${mod}+Shift+H`, "Highlight"],
          [`${mod}+Z`, "Undo"],
          [`${mod}+Shift+Z`, "Redo"],
        ].map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">{desc}</span>
            <kbd className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Main App ────────────────────────────────────────── */
function App() {
  const [dark, setDark] = useDarkMode();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);
  const editorWrapRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        horizontalRule: {
          HTMLAttributes: { class: "editor-hr" },
        },
      }),
      OCRImage.configure({ allowBase64: true }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder: "Start typing your note…",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    editorProps: {
      attributes: {
        class:
          "tiptap-editor min-h-[calc(100vh-160px)] px-6 py-4 focus:outline-none",
      },
      handlePaste: (_view, event) => {
        const imageItem = Array.from(
          event.clipboardData?.items ?? []
        ).find((item) => item.type.startsWith("image/"));
        if (!imageItem) return false;

        const imageFile = imageItem.getAsFile();
        if (!imageFile) return false;

        void readFileAsDataUrl(imageFile).then((dataUrl) => {
          editor?.chain().focus().setImage({ src: dataUrl }).run();
        });
        return true;
      },
    },
  });

  /* ── Clipboard-captured listener ─────────────────── */
  useEffect(() => {
    if (!editor) return;

    let unlisten: UnlistenFn | undefined;

    void listen<ClipboardPayload>("clipboard-captured", (event) => {
      const payload = event.payload;
      setCapturedCount((n) => n + 1);

      if (payload.type === "text") {
        editor
          .chain()
          .focus("end")
          .insertContent(payload.data)
          .setHorizontalRule()
          .run();
      } else {
        const src = payload.data.startsWith("data:image")
          ? payload.data
          : convertFileSrc(payload.data);
        editor
          .chain()
          .focus("end")
          .setImage({ src })
          .setHorizontalRule()
          .run();
      }

      // Visual flash feedback
      if (editorWrapRef.current) {
        editorWrapRef.current.classList.add("captured-flash");
        setTimeout(
          () => editorWrapRef.current?.classList.remove("captured-flash"),
          1200
        );
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      if (unlisten) void unlisten();
    };
  }, [editor]);

  const toggleDark = useCallback(() => setDark((d) => !d), [setDark]);

  if (!editor) return null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 transition-colors duration-300 dark:bg-gray-950">
      {/* ── Header ──────────────────────────────────── */}
      <header className="drag-region flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2.5">
          <img
            src={dark ? logoWhite : logoDark}
            alt="SnapNote"
            className="h-7 w-auto object-contain"
          />
          <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
            SnapNote
          </span>
        </div>

        <div className="no-drag flex items-center gap-1">
          {/* Captured badge */}
          {capturedCount > 0 && (
            <div className="mr-2 flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <Clipboard className="h-3 w-3" />
              {capturedCount}
            </div>
          )}

          <ToolbarBtn
            title="Keyboard shortcuts"
            onClick={() => setShowShortcuts(true)}
          >
            <Keyboard className="h-4 w-4" />
          </ToolbarBtn>

          <ToolbarBtn
            title={dark ? "Light mode" : "Dark mode"}
            onClick={toggleDark}
          >
            {dark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </ToolbarBtn>
        </div>
      </header>

      {/* ── Toolbar ─────────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white px-3 py-1.5 dark:border-gray-800 dark:bg-gray-900">
        <ToolbarBtn
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Highlight"
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          title="Bullet List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Ordered List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Task List"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListTodo className="h-4 w-4" />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          title="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Inline Code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Horizontal Rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </ToolbarBtn>

        <div className="flex-1" />

        <ToolbarBtn
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarBtn>
      </div>

      {/* ── Editor ──────────────────────────────────── */}
      <div
        ref={editorWrapRef}
        className="flex-1 overflow-y-auto bg-white transition-colors duration-300 dark:bg-gray-900"
      >
        <EditorContent editor={editor} />
      </div>

      {/* ── Status Bar ──────────────────────────────── */}
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50 px-3 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-500">
        <span>
          {mod}+Alt+C to capture &nbsp;·&nbsp; {mod}+Alt+O to show
        </span>
        <span>
          {editor.storage.characterCount?.characters?.() ??
            editor.getText().length}{" "}
          chars
        </span>
      </footer>

      {/* ── Shortcut Overlay ────────────────────────── */}
      {showShortcuts && (
        <ShortcutOverlay onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

export default App;
