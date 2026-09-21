import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

export function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = "Write something...",
  className,
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  return (
    <div className={cn("border border-black/10 rounded-xl overflow-hidden bg-white", className)}>
      {editable && (
        <div className="flex items-center gap-1 p-2 border-b border-black/10 bg-black/[0.02]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-black/10")}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-black/10")}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-black/10 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-black/10")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-black/10")}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-black/10 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLink}
            className={cn("h-8 w-8 p-0", editor.isActive("link") && "bg-black/10")}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-black/10 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8 p-0"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 w-8 p-0"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      )}
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-3 min-h-[100px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-black/40 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
}

export function RichTextDisplay({ content, className }: { content: string; className?: string }) {
  // `prose`/`prose-sm`/`max-w-none` come from @tailwindcss/typography, which
  // isn't registered in this project's Tailwind build (no `@plugin` for it in
  // index.css) — so those classes are no-ops here and long unbroken strings
  // (URLs, pasted text with no spaces) don't wrap and overflow past this
  // element's box, visually overlapping whatever sits next to/after it.
  // `[overflow-wrap:anywhere]` forces the break (kept alone — pairing it with
  // `break-words` sets the same CSS property twice with no dedupe, and
  // whichever wins loses the min-content shrinking this needs).
  // `whitespace-pre-wrap` is kept: this component isn't only fed Tiptap HTML
  // (whose getHTML() has no inter-tag whitespace to worry about) — it also
  // renders literal plain-text content with real "\n\n" line breaks, e.g. the
  // Ask-AI note saved via server/v2/modules/ai-ask/ai-ask.service.ts:62-63
  // ("Q: ...\n\nA: ...", client-scoped, shown here through
  // client-notes-list.tsx). Without pre-wrap those breaks collapse to a
  // single space.
  return (
    <div
      className={cn("prose prose-sm max-w-none whitespace-pre-wrap [overflow-wrap:anywhere]", className)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
