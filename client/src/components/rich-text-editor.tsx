import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
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
  Smile,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface TextTemplate {
  id: number;
  name: string;
  content: string;
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minimal?: boolean;
  templates?: TextTemplate[];
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Digite aqui...",
  editable = true,
  minimal = false,
  templates,
}: RichTextEditorProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);

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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "underline text-foreground/80 hover:text-foreground" },
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEmojiSelect = useCallback((emoji: any) => {
    if (editor) {
      editor.chain().focus().insertContent(emoji.native).run();
    }
    setShowEmoji(false);
  }, [editor]);

  const handleTemplateInsert = useCallback((template: TextTemplate) => {
    if (editor) {
      editor.chain().focus().insertContent(template.content).run();
    }
    setShowTemplates(false);
  }, [editor]);

  const handleAddLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL do link:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

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
    <div className="border rounded-md overflow-visible bg-background relative">
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

          <Separator />

          <div className="relative" ref={emojiRef}>
            <ToolBtn
              onClick={() => { setShowEmoji(!showEmoji); setShowTemplates(false); }}
              title="Emojis"
              testId="button-emoji"
            >
              <Smile className="w-3.5 h-3.5" />
            </ToolBtn>
            {showEmoji && (
              <div className="absolute top-full left-0 z-[9999] mt-1 shadow-xl rounded-lg">
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="light"
                  locale="pt"
                  previewPosition="none"
                  skinTonePosition="search"
                  perLine={8}
                  maxFrequentRows={2}
                />
              </div>
            )}
          </div>

          {templates && templates.length > 0 && (
            <div className="relative" ref={templateRef}>
              <ToolBtn
                onClick={() => { setShowTemplates(!showTemplates); setShowEmoji(false); }}
                title="Inserir template de texto"
                testId="button-insert-template"
              >
                <FileText className="w-3.5 h-3.5" />
              </ToolBtn>
              {showTemplates && (
                <div className="absolute top-full left-0 z-[9999] mt-1 bg-popover border rounded-lg shadow-xl p-1 min-w-[200px] max-w-[300px] max-h-[250px] overflow-y-auto">
                  <p className="text-xs text-muted-foreground px-2 py-1 font-medium">Inserir template</p>
                  {templates.map(t => (
                    <button
                      key={t.id}
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors truncate"
                      onClick={() => handleTemplateInsert(t)}
                      title={t.content}
                      data-testid={`button-template-${t.id}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
              <ToolBtn
                active={editor.isActive("link")}
                onClick={handleAddLink}
                title="Inserir link"
                testId="button-link"
              >
                <LinkIcon className="w-3.5 h-3.5" />
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

interface TextareaWithExtrasProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  templates?: TextTemplate[];
  rows?: number;
  className?: string;
  testId?: string;
}

export function TextareaWithExtras({
  value,
  onChange,
  placeholder,
  templates,
  rows = 4,
  className = "",
  testId,
}: TextareaWithExtrasProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + text + value.substring(end);
    onChange(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }, 0);
  }, [value, onChange]);

  const handleEmojiSelect = useCallback((emoji: any) => {
    insertAtCursor(emoji.native);
    setShowEmoji(false);
  }, [insertAtCursor]);

  const handleTemplateInsert = useCallback((template: TextTemplate) => {
    insertAtCursor(template.content);
    setShowTemplates(false);
  }, [insertAtCursor]);

  return (
    <div className="relative">
      <div className="flex items-center gap-1 mb-1">
        <div className="relative" ref={emojiRef}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setShowEmoji(!showEmoji); setShowTemplates(false); }}
            title="Emojis"
            data-testid={`${testId}-emoji-btn`}
          >
            <Smile className="w-3.5 h-3.5" />
          </Button>
          {showEmoji && (
            <div className="absolute top-full left-0 z-[9999] mt-1 shadow-xl rounded-lg">
              <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="light"
                locale="pt"
                previewPosition="none"
                skinTonePosition="search"
                perLine={8}
                maxFrequentRows={2}
              />
            </div>
          )}
        </div>
        {templates && templates.length > 0 && (
          <div className="relative" ref={templateRef}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowTemplates(!showTemplates); setShowEmoji(false); }}
              title="Inserir template"
              data-testid={`${testId}-template-btn`}
            >
              <FileText className="w-3.5 h-3.5" />
            </Button>
            {showTemplates && (
              <div className="absolute top-full left-0 z-[9999] mt-1 bg-popover border rounded-lg shadow-xl p-1 min-w-[200px] max-w-[300px] max-h-[250px] overflow-y-auto">
                <p className="text-xs text-muted-foreground px-2 py-1 font-medium">Inserir template</p>
                {templates.map(t => (
                  <button
                    key={t.id}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors truncate"
                    onClick={() => handleTemplateInsert(t)}
                    title={t.content}
                    data-testid={`${testId}-template-${t.id}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y ${className}`}
        data-testid={testId}
      />
    </div>
  );
}
