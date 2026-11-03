import { useMemo, useRef, useState, type RefObject } from "react";
import { PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmojiInsertButton } from "@/components/shared/emoji-insert-button";
import { insertTextAtCaret } from "@/lib/contenteditable";
import { postToPlainText } from "./preview-text";

interface PostContentFormProps {
  /** The contentEditable node; owned by the dialog so it can read/seed its HTML. */
  postRef: RefObject<HTMLDivElement | null>;
  /** Called on every editor input (the dialog throttles the preview refresh). */
  onEditorInput: () => void;
  /** Current post body, used for the character counter and the replace-confirm check. */
  previewHtml: string;
  onRegenerate?: () => Promise<void>;
}

/** The "Write with Luna" action and the contentEditable post editor. */
export function PostContentForm({
  postRef,
  onEditorInput,
  previewHtml,
  onRegenerate,
}: PostContentFormProps) {
  const savedPostRange = useRef<Range | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const charCount = useMemo(() => postToPlainText(previewHtml).length, [previewHtml]);

  /**
   * Force plain-text paste into the Post Content editor.
   *
   * Without this, the browser's default paste injects the clipboard's full
   * rich-HTML payload (inline styles, images, tables from a webpage/Word)
   * verbatim into the contentEditable. Laying out that huge DOM subtree is
   * synchronous and freezes the whole page. We insert only the plain text,
   * which is what the post ultimately needs anyway.
   */
  const handlePostPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    insertTextAtCaret(e.currentTarget, text);
  };

  // Remember the caret while it is inside the editor so the emoji menu (which
  // takes focus away) can put it back before inserting.
  const rememberPostRange = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !postRef.current) return;
    const range = selection.getRangeAt(0);
    if (postRef.current.contains(range.commonAncestorContainer)) {
      savedPostRange.current = range.cloneRange();
    }
  };

  const handlePickPostEmoji = (emoji: string) => {
    if (!postRef.current) return;
    insertTextAtCaret(postRef.current, emoji, savedPostRange.current);
    rememberPostRange();
    onEditorInput();
  };

  const runRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  };

  const handleLunaClick = () => {
    if (charCount > 0) setConfirmOpen(true);
    else void runRegenerate();
  };

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <PenLine className="h-3.5 w-3.5" />
          Post content
          <span className="ml-auto text-[11px] font-normal tabular-nums text-slate-400" data-testid="text-char-count">
            {charCount} characters
          </span>
          {onRegenerate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLunaClick}
              disabled={regenerating}
              className="h-7 gap-1.5 border-purple-300 px-2.5 text-xs text-purple-700 hover:bg-purple-50 hover:text-purple-800"
              data-testid="button-write-with-luna"
            >
              {regenerating ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              Write with Luna
            </Button>
          )}
          <EmojiInsertButton onPick={handlePickPostEmoji} data-testid="button-emoji-post" />
        </div>
        <div
          ref={postRef}
          contentEditable
          suppressContentEditableWarning
          onPaste={handlePostPaste}
          onInput={onEditorInput}
          onKeyUp={rememberPostRange}
          onMouseUp={rememberPostRange}
          onBlur={rememberPostRange}
          className="min-h-[240px] max-h-[380px] overflow-y-auto rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] leading-[1.7] shadow-sm transition-shadow focus:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          data-testid="editor-post-content"
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the post text?</AlertDialogTitle>
            <AlertDialogDescription>
              Luna will write a new post and replace what is in the editor now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my text</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runRegenerate()}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
