import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuoteTagsCardProps {
  tags: string[];
  newTag: string;
  setNewTag: (value: string) => void;
  showTagSuggestions: boolean;
  setShowTagSuggestions: (open: boolean) => void;
  tagInputRef: React.RefObject<HTMLInputElement | null>;
  tagSuggestionsRef: React.RefObject<HTMLDivElement | null>;
  allTags: string[];
  removeTag: (tag: string) => void;
  addTag: (text: string) => void;
  addTagFromSuggestion: (tag: string) => void;
}

export function QuoteTagsCard({
  tags,
  newTag,
  setNewTag,
  showTagSuggestions,
  setShowTagSuggestions,
  tagInputRef,
  tagSuggestionsRef,
  allTags,
  removeTag,
  addTag,
  addTagFromSuggestion,
}: QuoteTagsCardProps) {
  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-white/60 p-2.5" data-testid="card-quote-tags-inline">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold" data-testid="text-tags-title-inline">Tags</div>
        <Tag className="h-3 w-3 text-black/35" aria-hidden />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" data-testid="list-tags-inline">
        {tags.map((t) => (
          <span
            key={t}
            className="group inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-black/70"
            data-testid={`pill-tag-inline-${t}`}
          >
            {t}
            <button
              type="button"
              className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-black/35 transition hover:bg-black/[0.06] hover:text-black/60"
              data-testid={`button-remove-tag-inline-${t}`}
              onClick={() => removeTag(t)}
            >
              <X className="h-2.5 w-2.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <div className="relative mt-2 flex items-center gap-1.5" data-testid="row-add-tag-inline">
        <div className="relative flex-1">
          <Input
            ref={tagInputRef}
            placeholder="Add tag…"
            className="h-7 rounded-xl border-black/10 bg-white/70 text-[10px]"
            data-testid="input-add-tag-inline"
            value={newTag}
            onChange={(e) => {
              setNewTag(e.target.value);
              setShowTagSuggestions(true);
            }}
            onFocus={() => {
              setShowTagSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTag.trim()) {
                e.preventDefault();
                addTag(newTag);
              }
              if (e.key === "Escape") setShowTagSuggestions(false);
            }}
          />
          {showTagSuggestions && (() => {
            const filtered = allTags.filter(
              (t) => (!newTag.trim() || t.toLowerCase().includes(newTag.trim().toLowerCase())) && !tags.includes(t),
            );
            if (filtered.length === 0) return null;
            return (
              <div
                ref={tagSuggestionsRef}
                className="absolute left-0 top-full z-50 mt-1 max-h-32 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg"
                data-testid="list-tag-suggestions"
              >
                {filtered.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="w-full px-2.5 py-1.5 text-left text-[11px] text-black/70 transition hover:bg-black/[0.04]"
                    data-testid={`button-tag-suggestion-${t}`}
                    onClick={() => addTagFromSuggestion(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
        <Button
          size="sm"
          className="h-7 rounded-xl bg-[#3b82f6] px-2.5 text-[10px] text-white hover:bg-[#3b82f6]/90"
          data-testid="button-add-tag-inline"
          disabled={!newTag.trim()}
          onClick={() => {
            if (!newTag.trim()) return;
            addTag(newTag);
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
