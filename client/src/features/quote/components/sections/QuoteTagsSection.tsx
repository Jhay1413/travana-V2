import { useState, useEffect, useRef } from "react";
import { requestErrorMessage, requestErrorStatus } from "@/lib/request-error";
import { useFormContext } from "react-hook-form";
import { X, Pencil, Trash2, Check } from "lucide-react";
import { FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTags } from "@/features/tag/api/use-tag-queries";
import { useUpdateTag, useDeleteTag, useDetachQuoteTag } from "@/features/tag/api/use-tag-mutations";
import { useRoles } from "@/hooks/use-role";
import type { OrgRole } from "@/types/auth/auth.types";
import { fmInputClass } from "@/features/quote/components/fm-classes";
import { useToast } from "@/hooks/use-toast";
import type { QuoteFormValues } from "@/features/quote/types";

/** The server's error message for a failed tag request, or the fallback. */
function tagErrorMessage(error: unknown): string {
  return requestErrorMessage(error, "Please try again.");
}

/** A known tag entity (id + name) — ids are needed for rename/delete. */
type KnownTag = { id: string; name: string };

const TAG_ADMIN_ROLES: OrgRole[] = ["org_admin", "platform_admin"];

export function QuoteTagsSection({
  quoteId,
}: {
  /** Set when editing a saved quote: removing a saved tag then detaches it from this quote straight away. */
  quoteId?: string;
} = {}) {
  const { control, formState } = useFormContext<QuoteFormValues>();
  // Tags are global, so only admins may rename or delete one; everyone can remove a tag from their own quote.
  const { hasAnyRole } = useRoles();
  const canManageTags = hasAnyRole(TAG_ADMIN_ROLES);
  const detachTag = useDetachQuoteTag();
  const savedTagNames: string[] = (formState.defaultValues?.tags as string[] | undefined) ?? [];
  const { data: allTagsData = [] } = useTags();
  const allTags: KnownTag[] = allTagsData.map((t) => ({ id: t.id, name: t.name }));
  const allTagNames: string[] = allTags.map((t) => t.name);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Per-tag inline edit / delete-confirm state (keyed by tag id).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { toast } = useToast();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startEditing = (tag: KnownTag) => {
    setPendingDeleteId(null);
    setEditingId(tag.id);
    setEditingValue(tag.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue("");
  };

  return (
    <FormField
      control={control}
      name="tags"
      render={({ field }) => {
        const selected: string[] = field.value ?? [];
        const toggle = (name: string) => {
          if (selected.includes(name)) {
            field.onChange(selected.filter((t) => t !== name));
          } else {
            field.onChange([...selected, name]);
          }
        };
        const addTag = (name: string) => {
          const trimmed = name.trim();
          if (!trimmed || selected.includes(trimmed)) return;
          field.onChange([...selected, trimmed]);
          setInputValue("");
          setShowSuggestions(false);
        };
        const filtered = allTagNames.filter(
          (t) =>
            (!inputValue.trim() || t.toLowerCase().includes(inputValue.trim().toLowerCase())) &&
            !selected.includes(t),
        );

        // Rename the tag ENTITY (global). Keep it attached to this quote under
        // the new name if it was selected, so the change is seamless in-form.
        const commitRename = async (tag: KnownTag) => {
          const newName = editingValue.trim();
          if (!newName || newName === tag.name) {
            cancelEditing();
            return;
          }
          if (allTagNames.some((n) => n.toLowerCase() === newName.toLowerCase())) {
            toast({ title: "Tag already exists", description: `“${newName}” is already a tag.`, variant: "destructive" });
            return;
          }
          try {
            await updateTag.mutateAsync({ id: tag.id, name: newName });
            if (selected.includes(tag.name)) {
              field.onChange(selected.map((t) => (t === tag.name ? newName : t)));
            }
            cancelEditing();
          } catch (e: unknown) {
            toast({
              title: "Couldn't rename tag",
              description: tagErrorMessage(e),
              variant: "destructive",
            });
          }
        };

        // Remove a tag from THIS quote only; the tag and other quotes' links to it are untouched. A tag that
        // is already saved on the quote is detached on the server straight away; a freshly picked one just
        // leaves the form.
        const removeFromQuote = async (tag: KnownTag) => {
          const deselect = () => field.onChange(selected.filter((t) => t !== tag.name));
          if (!quoteId || !savedTagNames.includes(tag.name)) {
            deselect();
            return;
          }
          try {
            await detachTag.mutateAsync({ quoteId, tagId: tag.id });
            deselect();
          } catch (e: unknown) {
            if (requestErrorStatus(e) === 404) {
              deselect(); // already off this quote (e.g. re-added then removed again)
              return;
            }
            toast({
              title: "Couldn't remove tag",
              description: tagErrorMessage(e),
              variant: "destructive",
            });
          }
        };

        // Delete the tag ENTITY globally (admin only; cascades off every quote/client/booking).
        const confirmDelete = async (tag: KnownTag) => {
          try {
            await deleteTag.mutateAsync(tag.id);
            if (selected.includes(tag.name)) {
              field.onChange(selected.filter((t) => t !== tag.name));
            }
            setPendingDeleteId(null);
          } catch (e: unknown) {
            toast({
              title: "Couldn't delete tag",
              description: tagErrorMessage(e),
              variant: "destructive",
            });
          }
        };

        return (
          <FormItem>
            <div>
              {(allTags.length > 0 || selected.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {allTags.map((tag) => {
                    const isSelected = selected.includes(tag.name);
                    const isBusy =
                      (updateTag.isPending && editingId === tag.id) ||
                      (deleteTag.isPending && pendingDeleteId === tag.id);

                    // --- Inline rename state ---
                    if (editingId === tag.id) {
                      return (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-white px-1.5 py-0.5"
                        >
                          <Input
                            autoFocus
                            value={editingValue}
                            disabled={isBusy}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void commitRename(tag);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEditing();
                              }
                            }}
                            className="h-5 w-24 rounded-full border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void commitRename(tag)}
                            className="text-emerald-600 hover:text-emerald-700"
                            aria-label="Save tag name"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={cancelEditing}
                            className="text-black/40 hover:text-black/70"
                            aria-label="Cancel rename"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    }

                    // --- Inline delete-confirm state ---
                    if (pendingDeleteId === tag.id) {
                      return (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-700"
                        >
                          Delete “{tag.name}” everywhere?
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void confirmDelete(tag)}
                            className="text-red-600 hover:text-red-800"
                            aria-label="Confirm delete tag"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setPendingDeleteId(null)}
                            className="text-black/40 hover:text-black/70"
                            aria-label="Cancel delete"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    }

                    // --- Normal chip: toggle + edit + delete ---
                    return (
                      <span
                        key={tag.id}
                        className={`group inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? "border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]"
                            : "border-black/10 bg-white/70 text-black/50 hover:border-black/20 hover:text-black/70"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggle(tag.name)}
                          className="inline-flex items-center"
                        >
                          {isSelected && <span className="mr-1 text-blue-500">✓</span>}
                          {tag.name}
                        </button>
                        {isSelected && (
                          <button
                            type="button"
                            disabled={detachTag.isPending}
                            onClick={() => void removeFromQuote(tag)}
                            className="opacity-50 transition hover:opacity-100 hover:text-red-600"
                            aria-label={`Remove ${tag.name} from this quote`}
                            title="Remove from this quote"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                        {canManageTags && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditing(tag)}
                              className="opacity-50 transition hover:opacity-100 hover:text-blue-600"
                              aria-label={`Rename ${tag.name}`}
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                cancelEditing();
                                setPendingDeleteId(tag.id);
                              }}
                              className="opacity-50 transition hover:opacity-100 hover:text-red-600"
                              aria-label={`Delete ${tag.name} everywhere`}
                              title="Delete this tag for every agency"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </>
                        )}
                      </span>
                    );
                  })}

                  {/* Selected names not (yet) in the master list — new tags typed
                      this session; no entity to rename/delete, just detach. */}
                  {selected.filter((s) => !allTagNames.includes(s)).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggle(name)}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                    >
                      <span className="mr-1 text-blue-500">✓</span>
                      {name}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                </div>
              )}
              <div className="relative flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    placeholder="Add tag…"
                    className={fmInputClass}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(inputValue);
                      }
                      if (e.key === "Escape") setShowSuggestions(false);
                    }}
                  />
                  {showSuggestions && filtered.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute left-0 top-full z-50 mt-1 max-h-32 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg"
                    >
                      {filtered.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="w-full px-2.5 py-1.5 text-left text-[13px] text-[#1F2937] transition hover:bg-black/[0.04]"
                          onClick={() => addTag(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  type="button"
                  className="h-[42px] rounded-[10px] bg-[#F59E0B] px-4 text-[13px] font-semibold text-[#1F2937] hover:bg-[#E8900A]"
                  disabled={!inputValue.trim()}
                  onClick={() => addTag(inputValue)}
                >
                  Add
                </Button>
              </div>
            </div>
          </FormItem>
        );
      }}
    />
  );
}
