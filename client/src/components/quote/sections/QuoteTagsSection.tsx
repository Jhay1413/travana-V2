import { useState, useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { Tag, X } from "lucide-react";
import { FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTags } from "@/hooks/queries/use-tag-queries";
import { SectionHeader } from "@/components/quote/sections/SectionHeader";
import type { QuoteFormValues } from "@/types/quote";

export function QuoteTagsSection() {
  const { control } = useFormContext<QuoteFormValues>();
  const { data: allTagsData = [] } = useTags();
  const allTagNames: string[] = allTagsData.map((t: any) => t.name);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
        return (
          <FormItem>
            <div className="rounded-2xl border border-black/10 bg-white/60 p-3">
              <SectionHeader icon={Tag} title="Tags" />
              {(allTagNames.length > 0 || selected.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {allTagNames.map((name) => {
                    const isSelected = selected.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggle(name)}
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                            : "border-black/10 bg-white/70 text-black/50 hover:border-black/20 hover:text-black/70"
                        }`}
                      >
                        {isSelected && <span className="mr-1 text-blue-500">✓</span>}
                        {name}
                      </button>
                    );
                  })}
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
                    className="h-7 rounded-xl border-black/10 bg-white/70 text-[10px]"
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
                          className="w-full px-2.5 py-1.5 text-left text-[11px] text-black/70 transition hover:bg-black/[0.04]"
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
                  className="h-7 rounded-xl bg-[#3b82f6] px-2.5 text-[10px] text-white hover:bg-[#3b82f6]/90"
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
