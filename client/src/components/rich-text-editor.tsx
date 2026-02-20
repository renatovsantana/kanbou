import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Undo,
  Redo,
  Pilcrow,
} from "lucide-react";
import { useEffect } from "react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minimal?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Digite aqui...",
  editable = true,
  minimal = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content]);

  if (!editor) return null;

  const ToolBtn = ({
    active,
    onClick,
    children,
    title,
    testId,
  }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
    testId?: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-7 w-7 ${active ? "bg-muted" : ""}`}
      onClick={onClick}
      title={title}
      data-testid={testId}
    >
      {children}
    </Button>
  );

  const Separator = () => <div className="w-px h-5 bg-border mx-0.5" />;

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      {editable && (
        <div className="flex items-center gap-0.5 p-1.5 border-b bg-muted/30 flex-wrap">
          <ToolBtn
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Negrito"
            testId="button-bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Itálico"
            testId="button-italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Sublinhado"
            testId="button-underline"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Riscado"
            testId="button-strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("highlight")}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            title="Destaque"
            testId="button-highlight"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </ToolBtn>

          {!minimal && (
            <>
              <Separator />
              <ToolBtn
                active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Título"
                testId="button-heading"
              >
                <Heading2 className="w-3.5 h-3.5" />
              </ToolBtn>
              <ToolBtn
                active={editor.isActive("heading", { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title="Subtítulo"
                testId="button-heading3"
              >
                <Heading3 className="w-3.5 h-3.5" />
              </ToolBtn>
              <ToolBtn
                active={editor.isActive("paragraph")}
                onClick={() => editor.chain().focus().setParagraph().run()}
                title="Parágrafo"
                testId="button-paragraph"
              >
                <Pilcrow className="w-3.5 h-3.5" />
              </ToolBtn>
              <Separator />
              <ToolBtn
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Lista"
                testId="button-bullet-list"
              >
                <List className="w-3.5 h-3.5" />
              </ToolBtn>
              <ToolBtn
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Lista numerada"
                testId="button-ordered-list"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </ToolBtn>
              <ToolBtn
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Citação"
                testId="button-blockquote"
              >
                <Quote className="w-3.5 h-3.5" />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Linha horizontal"
                testId="button-horizontal-rule"
              >
                <Minus className="w-3.5 h-3.5" />
              </ToolBtn>
              <Separator />
              <ToolBtn
                active={editor.isActive({ textAlign: "left" })}
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                title="Alinhar à esquerda"
                testId="button-align-left"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </ToolBtn>
              <ToolBtn
                active={editor.isActive({ textAlign: "center" })}
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                title="Centralizar"
                testId="button-align-center"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </ToolBtn>
              <ToolBtn
                active={editor.isActive({ textAlign: "right" })}
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                title="Alinhar à direita"
                testId="button-align-right"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </ToolBtn>
              <Separator />
              <ToolBtn
                onClick={() => editor.chain().focus().undo().run()}
                title="Desfazer"
                testId="button-undo"
              >
                <Undo className="w-3.5 h-3.5" />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().redo().run()}
                title="Refazer"
                testId="button-redo"
              >
                <Redo className="w-3.5 h-3.5" />
              </ToolBtn>
            </>
          )}
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm dark:prose-invert max-w-none p-3 min-h-[80px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[60px] [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:pointer-events-none"
        data-testid="editor-content"
      />
    </div>
  );
}

export function RichTextDisplay({ content }: { content: string }) {
  if (!content || content === "<p></p>") return null;
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
