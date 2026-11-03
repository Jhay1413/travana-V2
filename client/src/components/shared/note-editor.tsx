import { useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapLink from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, SmilePlus, Paperclip, X, FileText, Undo, Redo, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { NOTE_ATTACHMENT_ACCEPT, filterNoteAttachmentFiles, formatFileSize } from "@/lib/note-attachments";
import { EmojiPicker } from "./emoji-picker";

export function NoteEditor({
  initialContent,
  placeholder,
  onSubmit,
  onCancel,
  submitLabel,
  isLoading,
  compact,
  allowAttachments = false,
}: {
  initialContent?: string;
  placeholder?: string;
  /** `files` is only ever non-empty when `allowAttachments` is on; callers own uploading them once the note exists. */
  onSubmit: (html: string, files?: File[]) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  compact?: boolean;
  /**
   * Shows a paperclip button and file chips. Off by default: the editor is
   * shared (deal notes, replies, enquiry notes, ticket posts, client notes)
   * and only callers that upload the picked files after creating the note
   * should opt in — otherwise files would be picked and silently dropped.
   */
  allowAttachments?: boolean;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiTriggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || "Write a note..." }),
      TiptapLink.configure({ openOnClick: false }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        // `prose`/`prose-sm`/`max-w-none` are no-ops (typography plugin isn't
        // registered) — `[overflow-wrap:anywhere]` forces wrapping explicitly
        // so a long pasted/typed unbroken string doesn't overflow the editor
        // box (kept alone, not paired with `break-words`: both set
        // overflow-wrap and only one wins in the generated CSS). No
        // `whitespace-pre-wrap` here — Tiptap's Editor auto-injects a
        // <style> tag with `.ProseMirror { white-space: pre-wrap/break-spaces }`
        // (see injectCSS() in @tiptap/core), so this editable element already
        // gets it for free.
        class: cn(
          "prose prose-sm max-w-none outline-none [overflow-wrap:anywhere]",
          compact ? "min-h-[36px] p-1.5" : "min-h-[44px] p-2"
        ),
      },
    },
  });

  const handleSubmit = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    if (!html || html === "<p></p>") return;
    const files = allowAttachments ? pendingFiles : undefined;
    const result = onSubmit(html, files);
    if (result && typeof result.then === "function") {
      // Async caller (e.g. mutateAsync): keep the typed content until the
      // submission actually succeeds, so a failed create/edit doesn't lose it.
      result.then(
        () => {
          if (!editor.isDestroyed) editor.commands.clearContent();
          setPendingFiles([]);
        },
        () => {
          // Swallow — the caller is responsible for surfacing the error (toast).
        },
      );
      return;
    }
    editor.commands.clearContent();
    setPendingFiles([]);
  }, [editor, onSubmit, allowAttachments, pendingFiles]);

  const handleFilesPicked = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { accepted, rejected } = filterNoteAttachmentFiles(Array.from(event.target.files ?? []), pendingFiles.length);
    // Reset so picking the same file again after removing it still fires onChange.
    event.target.value = "";
    rejected.forEach((title) => toast({ title, variant: "destructive" }));
    if (accepted.length > 0) setPendingFiles((prev) => [...prev, ...accepted]);
  }, [pendingFiles.length, toast]);

  const insertEmoji = useCallback((emoji: string) => {
    editor?.chain().focus().insertContent(emoji).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-xl border border-black/10 bg-white/80 overflow-hidden", compact && "rounded-lg")}>
      <div className="flex items-center gap-px border-b border-black/5 bg-black/[0.02] px-1 py-0.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={cn("h-5 w-5 p-0", editor.isActive("bold") && "bg-black/10")} data-testid="note-toolbar-bold">
          <Bold className="h-2.5 w-2.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={cn("h-5 w-5 p-0", editor.isActive("italic") && "bg-black/10")} data-testid="note-toolbar-italic">
          <Italic className="h-2.5 w-2.5" />
        </Button>
        <div className="mx-px h-2.5 w-px bg-black/10" />
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn("h-5 w-5 p-0", editor.isActive("bulletList") && "bg-black/10")} data-testid="note-toolbar-ul">
          <List className="h-2.5 w-2.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn("h-5 w-5 p-0", editor.isActive("orderedList") && "bg-black/10")} data-testid="note-toolbar-ol">
          <ListOrdered className="h-2.5 w-2.5" />
        </Button>
        <div className="mx-px h-2.5 w-px bg-black/10" />
        <Button type="button" variant="ghost" size="sm" onClick={() => { const url = window.prompt("Enter URL:"); if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); }} className={cn("h-5 w-5 p-0", editor.isActive("link") && "bg-black/10")} data-testid="note-toolbar-link">
          <LinkIcon className="h-2.5 w-2.5" />
        </Button>
        <div className="mx-px h-2.5 w-px bg-black/10" />
        <div className="relative">
          <Button ref={emojiTriggerRef} type="button" variant="ghost" size="sm" onClick={() => setShowEmoji(!showEmoji)} className="h-5 w-5 p-0" data-testid="note-toolbar-emoji">
            <SmilePlus className="h-2.5 w-2.5" />
          </Button>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} triggerRef={emojiTriggerRef} />}
        </div>
        {allowAttachments && (
          <>
            <input ref={fileInputRef} type="file" multiple accept={NOTE_ATTACHMENT_ACCEPT} onChange={handleFilesPicked} className="hidden" data-testid="note-attachment-input" />
            <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="h-5 w-5 p-0" title="Attach files" data-testid="note-toolbar-attach">
              <Paperclip className="h-2.5 w-2.5" />
            </Button>
          </>
        )}
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="h-5 w-5 p-0" data-testid="note-toolbar-undo">
          <Undo className="h-2.5 w-2.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="h-5 w-5 p-0" data-testid="note-toolbar-redo">
          <Redo className="h-2.5 w-2.5" />
        </Button>
      </div>
      <EditorContent editor={editor} className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:text-xs [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-black/35 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none" />
      {allowAttachments && pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-black/5 px-1.5 py-1" data-testid="note-pending-attachments">
          {pendingFiles.map((file, index) => (
            <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-black/[0.02] px-1.5 py-0.5 text-[10px] text-black/70">
              <FileText className="h-2.5 w-2.5 shrink-0 text-black/40" />
              <span className="max-w-[140px] truncate">{file.name}</span>
              <span className="text-black/40">{formatFileSize(file.size)}</span>
              <button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`} className="text-black/30 hover:text-rose-600" data-testid={`note-pending-remove-${index}`}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-end gap-1.5 border-t border-black/5 bg-black/[0.01] px-1.5 py-1">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-6 rounded-md px-2 text-[10px]" data-testid="note-btn-cancel">
            Cancel
          </Button>
        )}
        <Button type="button" size="sm" onClick={handleSubmit} disabled={isLoading} className="h-6 rounded-md bg-[#3b82f6] px-2.5 text-[10px] text-white hover:bg-[#3b82f6]/90" data-testid="note-btn-submit">
          {isLoading ? <Spinner className="h-2.5 w-2.5" /> : <Send className="mr-1 h-2.5 w-2.5" />}
          {submitLabel || "Post"}
        </Button>
      </div>
    </div>
  );
}
