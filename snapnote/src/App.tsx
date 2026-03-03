import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

type ClipboardPayload = {
  type: "text" | "image";
  data: string;
};

const ToolbarButton = ({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className={`inline-flex h-9 w-9 items-center justify-center rounded-md border text-zinc-700 transition ${
      active
        ? "border-zinc-400 bg-white shadow-sm"
        : "border-zinc-200 bg-zinc-50 hover:bg-white"
    }`}
  >
    {children}
  </button>
);

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

const OCRImageNode = (props: NodeViewProps) => {
  const [isExtracting, setIsExtracting] = useState(false);

  const handleExtract = async () => {
    const currentSrc = String(props.node.attrs.src ?? "");
    if (!currentSrc || isExtracting) {
      return;
    }

    try {
      setIsExtracting(true);
      const base64Data = currentSrc.startsWith("data:image")
        ? currentSrc
        : await readUrlAsDataUrl(currentSrc);
      const extracted = await invoke<string>("extract_text_from_image", { base64_data: base64Data });
      const position = typeof props.getPos === "function" ? props.getPos() : null;

      if (typeof position === "number") {
        props.editor
          .chain()
          .focus()
          .insertContentAt(position + props.node.nodeSize, {
            type: "paragraph",
            content: [{ type: "text", text: extracted || "(No text detected)" }],
          })
          .run();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "OCR extraction failed.";
      props.editor.chain().focus().insertContent({ type: "paragraph", content: [{ type: "text", text: message }] }).run();
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <NodeViewWrapper className="image-node-block group relative my-4 block">
      <img
        src={String(props.node.attrs.src ?? "")}
        alt="Pasted"
        className="mx-auto max-h-[300px] max-w-full rounded-lg border border-zinc-200 object-contain"
      />
      <button
        type="button"
        onClick={handleExtract}
        className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
      >
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

function App() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        horizontalRule: {
          HTMLAttributes: {
            class: "editor-hr",
          },
        },
      }),
      OCRImage.configure({
        allowBase64: true,
      }),
    ],
    content: "<p>Start typing… Use CmdOrCtrl+Shift+S to auto-add clipboard content.</p>",
    editorProps: {
      attributes: {
        class: "ProseMirror tiptap-editor min-h-[calc(100vh-220px)] p-6 focus:outline-none",
      },
      handlePaste: (_view, event) => {
        const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith("image/"));
        if (!imageItem) {
          return false;
        }

        const imageFile = imageItem.getAsFile();
        if (!imageFile) {
          return false;
        }

        void readFileAsDataUrl(imageFile).then((dataUrl) => {
          editor?.chain().focus().setImage({ src: dataUrl }).run();
        });

        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    let unlisten: UnlistenFn | undefined;

    void listen<ClipboardPayload>("clipboard-captured", (event) => {
      const payload = event.payload;
      if (payload.type === "text") {
        editor
          .chain()
          .focus("end")
          .insertContent(payload.data)
          .setHorizontalRule()
          .run();
        return;
      }

      const src = payload.data.startsWith("data:image") ? payload.data : convertFileSrc(payload.data);
      editor
        .chain()
        .focus("end")
        .setImage({ src })
        .setHorizontalRule()
        .run();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      if (unlisten) {
        void unlisten();
      }
    };
  }, [editor]);

  return (
    <div className="min-h-screen w-full bg-zinc-100 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="tiptap-shell overflow-hidden rounded-xl shadow-md">
          <header className="sticky top-3 z-10 flex flex-wrap gap-2 rounded-t-xl border-b border-zinc-200 bg-gray-100 p-3">
            <ToolbarButton
              title="Bold"
              active={editor?.isActive("bold")}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                <path d="M8 5h6a4 4 0 0 1 0 8H8z" />
                <path d="M8 13h7a3 3 0 0 1 0 6H8z" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              title="Italic"
              active={editor?.isActive("italic")}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                <line x1="19" y1="5" x2="10" y2="5" />
                <line x1="14" y1="19" x2="5" y2="19" />
                <line x1="15" y1="5" x2="9" y2="19" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              title="Heading 1"
              active={editor?.isActive("heading", { level: 1 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                <line x1="4" y1="5" x2="4" y2="19" />
                <line x1="10" y1="5" x2="10" y2="19" />
                <line x1="4" y1="12" x2="10" y2="12" />
                <line x1="16" y1="8" x2="20" y2="8" />
                <line x1="18" y1="8" x2="18" y2="19" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              title="Heading 2"
              active={editor?.isActive("heading", { level: 2 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                <line x1="4" y1="5" x2="4" y2="19" />
                <line x1="10" y1="5" x2="10" y2="19" />
                <line x1="4" y1="12" x2="10" y2="12" />
                <path d="M15 11a3 3 0 0 1 6 0c0 2-1.5 3-3.5 4.5L15 18h6" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              title="Horizontal Rule"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </ToolbarButton>
          </header>

          <main className="rounded-b-xl border-x border-b border-zinc-200 bg-white">
            <EditorContent editor={editor} />
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
