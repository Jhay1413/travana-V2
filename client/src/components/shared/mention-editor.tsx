import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from "react";
import tippy, { type Instance as TippyInstance } from "tippy.js";

type MentionUser = { id: string; name: string; role: string };

interface MentionEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  users: MentionUser[];
}

const MentionList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  {
    items: MentionUser[];
    command: (item: { id: string; label: string }) => void;
  }
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.name });
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) =>
          (prev + props.items.length - 1) % props.items.length
        );
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % props.items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs text-slate-400">No results</p>
      </div>
    );
  }

  return (
    <div className="max-h-48 min-w-[220px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
      {props.items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => selectItem(index)}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
            index === selectedIndex
              ? "bg-blue-50 dark:bg-blue-900/30"
              : "hover:bg-slate-50 dark:hover:bg-slate-700"
          )}
          data-testid={`mention-option-${item.id}`}
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {item.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {item.name}
          </span>
          <span className="ml-auto text-[10px] text-slate-400">{item.role}</span>
        </button>
      ))}
    </div>
  );
});
MentionList.displayName = "MentionList";

function makeSuggestion(users: MentionUser[]) {
  return {
    items: ({ query }: { query: string }) => {
      return users
        .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8);
    },
    render: () => {
      let component: ReactRenderer<any> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },
        onUpdate(props: any) {
          component?.updateProps(props);
          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({ getReferenceClientRect: props.clientRect });
          }
        },
        onKeyDown(props: any) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

export function MentionEditor({
  content,
  onChange,
  placeholder = "Write something... Type @ to mention someone",
  className,
  users,
}: MentionEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
      Mention.configure({
        HTMLAttributes: {
          class:
            "mention inline rounded bg-blue-100 px-1 py-0.5 text-blue-700 font-semibold text-sm dark:bg-blue-900/40 dark:text-blue-300",
        },
        suggestion: makeSuggestion(users),
      }),
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (editor && users.length > 0) {
      editor.extensionManager.extensions.forEach((ext) => {
        if (ext.name === "mention") {
          (ext as any).options.suggestion.items = ({ query }: { query: string }) =>
            users
              .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8);
        }
      });
    }
  }, [editor, users]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  };

  return (
    <div
      className={cn(
        "border border-black/10 rounded-xl overflow-hidden bg-white dark:bg-slate-800 dark:border-slate-700",
        className
      )}
    >
      <div className="flex items-center gap-1 p-2 border-b border-black/10 bg-black/[0.02] dark:border-slate-700 dark:bg-slate-800/50">
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
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive("italic") && "bg-black/10"
          )}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-black/10 mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive("bulletList") && "bg-black/10"
          )}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive("orderedList") && "bg-black/10"
          )}
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
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 min-h-[100px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-black/40 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.mention]:inline [&_.mention]:rounded [&_.mention]:bg-blue-100 [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:text-blue-700 [&_.mention]:font-semibold [&_.mention]:text-sm dark:[&_.mention]:bg-blue-900/40 dark:[&_.mention]:text-blue-300"
        data-testid="editor-announcement-content"
      />
    </div>
  );
}
