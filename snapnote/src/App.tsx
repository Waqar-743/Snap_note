import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type Editor,
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
  Plus,
} from "lucide-react";

import logoDark from "./assets/logo-dark.png";
import logoWhite from "./assets/logo-white.png";

/* ── Types ───────────────────────────────────────────── */
type ClipboardPayload = {
  type: "text" | "image";
  data: string;
};

interface TabData {
  id: string;
  title: string;
  content: string;
}

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

const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

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

/* ── Reusable editor extensions factory ─────────────── */
const makeExtensions = () => [
  StarterKit.configure({
    horizontalRule: { HTMLAttributes: { class: "editor-hr" } },
  }),
  OCRImage.configure({ allowBase64: true }),
  Underline,
  Highlight.configure({ multicolor: false }),
  Placeholder.configure({ placeholder: "Start typing your note…" }),
  TaskList,
  TaskItem.configure({ nested: true }),
];

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
          [`${mod}+Alt+C`, "Capture clipboard to active tab"],
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

/* ── Tab Editor Wrapper ─────────────────────────────── */
function TabEditor({
  tabId,
  initialContent,
  isActive,
  onContentChange,
  editorRef,
}: {
  tabId: string;
  initialContent: string;
  isActive: boolean;
  onContentChange: (id: string, html: string) => void;
  editorRef: (id: string, editor: Editor | null) => void;
}) {
  const editor = useEditor({
    extensions: makeExtensions(),
    content: initialContent,
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
    onUpdate: ({ editor: ed }) => {
      onContentChange(tabId, ed.getHTML());
    },
  });

  useEffect(() => {
    editorRef(tabId, editor);
    return () => {
      editorRef(tabId, null);
    };
  }, [tabId, editor, editorRef]);

  if (!isActive) return null;

  return <EditorContent editor={editor} />;
}

/* ── Main App ────────────────────────────────────────── */
function App() {
  const [dark, setDark] = useDarkMode();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const editorsMapRef = useRef<Map<string, Editor>>(new Map());

  /* ── Tab state ─────────────────────────────────────── */
  const [tabs, setTabs] = useState<TabData[]>(() => {
    const saved = localStorage.getItem("snapnote-tabs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as TabData[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* ignore */
      }
    }
    return [{ id: generateId(), title: "Untitled", content: "" }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const saved = localStorage.getItem("snapnote-active-tab");
    if (saved && tabs.some((t) => t.id === saved)) return saved;
    return tabs[0].id;
  });
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Persist tabs
  useEffect(() => {
    localStorage.setItem("snapnote-tabs", JSON.stringify(tabs));
  }, [tabs]);
  useEffect(() => {
    localStorage.setItem("snapnote-active-tab", activeTabId);
  }, [activeTabId]);

  // Focus rename input
  useEffect(() => {
    if (editingTabId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingTabId]);

  const handleEditorRef = useCallback(
    (id: string, editor: Editor | null) => {
      if (editor) {
        editorsMapRef.current.set(id, editor);
      } else {
        editorsMapRef.current.delete(id);
      }
    },
    []
  );

  const handleContentChange = useCallback((id: string, html: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, content: html } : t))
    );
  }, []);

  const addTab = useCallback(() => {
    const newTab: TabData = {
      id: generateId(),
      title: "Untitled",
      content: "",
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (id === activeTabId) {
          const newIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[newIdx].id);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const renameTab = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    setTabs((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, title: trimmed || "Untitled" } : t
      )
    );
    setEditingTabId(null);
  }, []);

  /* ── Clipboard-captured listener ─────────────────── */
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    void listen<ClipboardPayload>("clipboard-captured", (event) => {
      const payload = event.payload;
      setCapturedCount((n) => n + 1);

      const activeEditor = editorsMapRef.current.get(activeTabId);
      if (!activeEditor) return;

      if (payload.type === "text") {
        activeEditor
          .chain()
          .focus("end")
          .insertContent(payload.data)
          .setHorizontalRule()
          .run();
      } else {
        const src = payload.data.startsWith("data:image")
          ? payload.data
          : convertFileSrc(payload.data);
        activeEditor
          .chain()
          .focus("end")
          .setImage({ src })
          .setHorizontalRule()
          .run();
      }

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
  }, [activeTabId]);

  const toggleDark = useCallback(() => setDark((d) => !d), [setDark]);

  const activeEditor = editorsMapRef.current.get(activeTabId);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 transition-colors duration-300 dark:bg-gray-950">
      {/* ── Header: Logo + Tabs + Controls ─────────── */}
      <header className="flex shrink-0 items-stretch border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {/* Logo */}
        <div className="drag-region flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-gray-800">
          <img
            src={dark ? logoDark : logoWhite}
            alt="SnapNote"
            className="h-6 w-auto object-contain"
          />
          <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white select-none">
            SnapNote
          </span>
        </div>

        {/* Tab Strip */}
        <div className="no-drag flex flex-1 items-end overflow-x-auto px-1 pt-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group relative flex cursor-pointer items-center gap-1 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-medium transition-all select-none mr-0.5 min-w-[80px] max-w-[160px] ${
                  isActive
                    ? "border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white z-10"
                    : "border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                }`}
              >
                {editingTabId === tab.id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    defaultValue={tab.title}
                    className="w-full bg-transparent text-xs outline-none"
                    onBlur={(e) => renameTab(tab.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        renameTab(tab.id, e.currentTarget.value);
                      if (e.key === "Escape") setEditingTabId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="truncate"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingTabId(tab.id);
                    }}
                  >
                    {tab.title}
                  </span>
                )}

                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={`ml-auto shrink-0 rounded p-0.5 transition ${
                      isActive
                        ? "text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-300 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            title="New tab"
            onClick={addTab}
            className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-t-lg text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Right controls */}
        <div className="no-drag flex items-center gap-0.5 px-2">
          {capturedCount > 0 && (
            <div className="mr-1 flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
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
          active={activeEditor?.isActive("bold")}
          onClick={() => activeEditor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          active={activeEditor?.isActive("italic")}
          onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Underline"
          active={activeEditor?.isActive("underline")}
          onClick={() =>
            activeEditor?.chain().focus().toggleUnderline().run()
          }
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Strikethrough"
          active={activeEditor?.isActive("strike")}
          onClick={() => activeEditor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Highlight"
          active={activeEditor?.isActive("highlight")}
          onClick={() =>
            activeEditor?.chain().focus().toggleHighlight().run()
          }
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          title="Heading 1"
          active={activeEditor?.isActive("heading", { level: 1 })}
          onClick={() =>
            activeEditor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Heading 2"
          active={activeEditor?.isActive("heading", { level: 2 })}
          onClick={() =>
            activeEditor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Heading 3"
          active={activeEditor?.isActive("heading", { level: 3 })}
          onClick={() =>
            activeEditor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          title="Bullet List"
          active={activeEditor?.isActive("bulletList")}
          onClick={() =>
            activeEditor?.chain().focus().toggleBulletList().run()
          }
        >
          <List className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Ordered List"
          active={activeEditor?.isActive("orderedList")}
          onClick={() =>
            activeEditor?.chain().focus().toggleOrderedList().run()
          }
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Task List"
          active={activeEditor?.isActive("taskList")}
          onClick={() =>
            activeEditor?.chain().focus().toggleTaskList().run()
          }
        >
          <ListTodo className="h-4 w-4" />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          title="Blockquote"
          active={activeEditor?.isActive("blockquote")}
          onClick={() =>
            activeEditor?.chain().focus().toggleBlockquote().run()
          }
        >
          <Quote className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Inline Code"
          active={activeEditor?.isActive("code")}
          onClick={() => activeEditor?.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Horizontal Rule"
          onClick={() =>
            activeEditor?.chain().focus().setHorizontalRule().run()
          }
        >
          <Minus className="h-4 w-4" />
        </ToolbarBtn>

        <div className="flex-1" />

        <ToolbarBtn
          title="Undo"
          onClick={() => activeEditor?.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Redo"
          onClick={() => activeEditor?.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarBtn>
      </div>

      {/* ── Editor area (one per tab, only active visible) ── */}
      <div
        ref={editorWrapRef}
        className="flex-1 overflow-y-auto bg-white transition-colors duration-300 dark:bg-gray-900"
      >
        {tabs.map((tab) => (
          <TabEditor
            key={tab.id}
            tabId={tab.id}
            initialContent={tab.content}
            isActive={tab.id === activeTabId}
            onContentChange={handleContentChange}
            editorRef={handleEditorRef}
          />
        ))}
      </div>

      {/* ── Status Bar ──────────────────────────────── */}
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50 px-3 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-500">
        <span>
          {mod}+Alt+C capture &nbsp;·&nbsp; {mod}+Alt+O show &nbsp;·&nbsp;
          Double-click tab to rename
        </span>
        <span>
          {activeEditor?.getText().length ?? 0} chars
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
