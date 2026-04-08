import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Check, Tag, ArrowLeft } from "lucide-react";
import { usePortalAllTags, usePortalMyTags, useSavePortalTags } from "@/hooks/use-portal-api";

export default function PortalTagsPage() {
  const [, setLocation] = useLocation();
  const { data: allTags = [], isLoading: allLoading } = usePortalAllTags();
  const { data: myTags = [], isLoading: myLoading } = usePortalMyTags();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialised, setInitialised] = useState(false);
  const saveTags = useSavePortalTags();

  const isEditMode = myTags.length > 0;

  useEffect(() => {
    if (!myLoading && !initialised) {
      setSelected(new Set(myTags.map(t => t.id)));
      setInitialised(true);
    }
  }, [myTags, myLoading, initialised]);

  function toggleTag(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleContinue() {
    await saveTags.mutateAsync(Array.from(selected));
    setLocation("/portal");
  }

  const isLoading = allLoading || myLoading;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <div className="flex-1 px-5 pt-16 pb-8 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          {isEditMode && (
            <button
              onClick={() => setLocation("/portal")}
              className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-5">
            <Tag className="w-6 h-6 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isEditMode ? "Travel Interests" : "What are you into?"}
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            {isEditMode
              ? "Update your interests to get the most relevant deals."
              : "Pick your travel interests so we can show you the most relevant deals and recommendations."}
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap gap-2.5 mb-8"
          >
            {allTags.map((tag, i) => {
              const isSelected = selected.has(tag.id);
              return (
                <motion.button
                  key={tag.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * i, duration: 0.2 }}
                  onClick={() => toggleTag(tag.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium transition-all border ${
                    isSelected
                      ? "bg-purple-500/30 border-purple-400/60 text-purple-200"
                      : "bg-white/[0.05] border-white/[0.1] text-white/60 hover:border-white/20 hover:text-white/80"
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  {tag.name}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>

      <div className="px-5 pb-10 pt-4 border-t border-white/[0.06]">
        <p className="text-center text-xs text-white/30 mb-4">
          {selected.size === 0
            ? "Select at least one interest to continue"
            : `${selected.size} selected`}
        </p>
        <button
          onClick={handleContinue}
          disabled={selected.size === 0 || saveTags.isPending}
          className="w-full py-4 rounded-2xl font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-purple-500 hover:bg-purple-400 active:scale-[0.98] text-white"
        >
          {saveTags.isPending ? "Saving…" : isEditMode ? "Save Interests" : "Continue"}
        </button>
      </div>
    </div>
  );
}
