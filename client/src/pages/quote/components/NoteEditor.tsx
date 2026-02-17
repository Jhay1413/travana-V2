/**
 * NoteEditor Component
 * Rich text editor for creating and editing notes with formatting toolbar
 */

import { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapLink from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  SmilePlus,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmojiPicker } from "./EmojiPicker";

interface NoteEditorProps {
  initialContent?: string;
  placeholder?: string;
  onSubmit: (html: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  compact?: boolean;
}

export function NoteEditor({
  initialContent,
  placeholder,
  onSubmit,
  onCancel,
  submitLabel,
  isLoading,
  compact,
}: NoteEditorProps) {
  const [showEmoji, setShowEmoji] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || "Write a note..." }),
      TiptapLink.configure({ openOnClick: false }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none outline-none",
          compact ? "min-h-[36px] p-1.5" : "min-h-[44px] p-2"
        ),
      },
    },
  });

  const handleSubmit = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    if (!html || html === "<p></p>") return;
    onSubmit(html);
    editor.commands.clearContent();
  }, [editor, onSubmit]);

  const insertEmoji = useCallback(
    (emoji: string) => {
      editor?.chain().focus().insertContent(emoji).run();
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-black/10 bg-white/80 overflow-hidden",
        compact && "rounded-lg"
      )}
    >
      <div className="flex items-center gap-px border-b border-black/5 bg-black/[0.02] px-1 py-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-5 w-5 p-0", editor.isActive("bold") && "bg-black/10")}
          data-testid="note-toolbar-bold"
        >
          <Bold className="h-2.5 w-2.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-5 w-5 p-0", editor.isActive("italic") && "bg-black/10")}
          data-testid="note-toolbar-italic"
        >
          <Italic className="h-2.5 w-2.5" />
        </Button>
        <div className="mx-px h-2.5 w-px bg-black/10" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("h-5 w-5 p-0", editor.isActive("bulletList") && "bg-black/10")}
          data-testid="note-toolbar-ul"
        >
          <List className="h-2.5 w-2.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("h-5 w-5 p-0", editor.isActive("orderedList") && "bg-black/10")}
          data-testid="note-toolbar-ol"
        >
          <ListOrdered className="h-2.5 w-2.5" />
        </Button>
        <div className="mx-px h-2.5 w-px bg-black/10" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt("Enter URL:");
            if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
          className={cn("h-5 w-5 p-0", editor.isActive("link") && "bg-black/10")}
          data-testid="note-toolbar-link"
        >
          <LinkIcon className="h-2.5 w-2.5" />
        </Button>
        <div className="mx-px h-2.5 w-px bg-black/10" />
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowEmoji(!showEmoji)}
            className="h-5 w-5 p-0"
            data-testid="note-toolbar-emoji"
          >
            <SmilePlus className="h-2.5 w-2.5" />
          </Button>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
        </div>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-5 w-5 p-0"
          data-testid="note-toolbar-undo"
        >
          <Undo className="h-2.5 w-2.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-5 w-5 p-0"
          data-testid="note-toolbar-redo"
        >
          <Redo className="h-2.5 w-2.5" />
        </Button>
      </div>
      <EditorContent
        editor={editor}
        className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:text-xs [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-black/35 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
      <div className="flex items-center justify-end gap-1.5 border-t border-black/5 bg-black/[0.01] px-1.5 py-1">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-6 rounded-md px-2 text-[10px]"
            data-testid="note-btn-cancel"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isLoading}
          className="h-6 rounded-md bg-[#3b82f6] px-2.5 text-[10px] text-white hover:bg-[#3b82f6]/90"
          data-testid="note-btn-submit"
        >
          {isLoading ? (
            <Spinner className="h-2.5 w-2.5" />
          ) : (
            <Send className="mr-1 h-2.5 w-2.5" />
          )}
          {submitLabel || "Post"}
        </Button>
      </div>
    </div>
  );
}
