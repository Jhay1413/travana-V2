import { useEffect, useRef, useState } from "react";
import { useUploadAssets, useDeleteAsset, useUpdateAsset, useReorderAssets } from "@/features/hub/api/use-training-admin-mutations";
import { useToast } from "@/hooks/use-toast";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { cn } from "@/lib/utils";
import { describeRichTextLength, getRichTextLengthStatus, normalizeRichText } from "@/features/hub/lib/rich-text";
import { ImageDropzone, LessonImageGrid } from "./training-image-picker";
import type { LessonWithAssets, TrainingLessonAsset } from "@/features/hub/types/training.types";

interface LessonAssetManagerProps {
  lesson: LessonWithAssets;
  courseId: string;
}

type SaveState = "idle" | "saving" | "saved";

interface AssetCaptionFieldProps {
  asset: TrainingLessonAsset;
  courseId: string;
  index: number;
}

/**
 * Rich-text description for one persisted slide. Saves on blur when the text
 * changed, and also on unmount (e.g. the dialog closes via Escape/overlay
 * before the field ever blurred). A refetched server value is adopted only
 * while the field has no unsaved edits, and a save never overwrites newer typing.
 */
function AssetCaptionField({ asset, courseId, index }: AssetCaptionFieldProps) {
  const updateAsset = useUpdateAsset();
  const { toast } = useToast();
  const serverCaption = asset.caption ?? "";
  const [value, setValue] = useState(serverCaption);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // The rich-text editor only reads `content` on mount, so remount it when a server value is adopted.
  const [editorKey, setEditorKey] = useState(0);
  const valueRef = useRef(value);
  const lastSavedRef = useRef(serverCaption);

  useEffect(() => {
    const dirty = valueRef.current.trim() !== lastSavedRef.current;
    if (!dirty) {
      if (serverCaption !== valueRef.current) setEditorKey((k) => k + 1);
      lastSavedRef.current = serverCaption;
      valueRef.current = serverCaption;
      setValue(serverCaption);
    }
  }, [serverCaption]);

  const lengthStatus = getRichTextLengthStatus(value);

  const save = () => {
    const next = valueRef.current.trim();
    if (next === lastSavedRef.current) return;
    // The server rejects over-limit captions; keep the edit in the editor and explain via the status line instead.
    if (getRichTextLengthStatus(next).overLimit) return;
    setSaveState("saving");
    updateAsset.mutate(
      { id: asset.id, courseId, caption: next || null },
      {
        onSuccess: () => {
          lastSavedRef.current = next;
          setSaveState("saved");
        },
        onError: () => {
          setSaveState("idle");
          toast({ title: "Failed to save slide description", variant: "destructive" });
        },
      },
    );
  };

  // Always call the latest save (fresh refs/closures) from the unmount cleanup.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => saveRef.current(), []);

  return (
    <div className="space-y-1">
      {/* Focus events bubble in React, so this blur fires when focus leaves the editor. */}
      <div
        onBlur={save}
        aria-label={`Slide ${index + 1} description`}
        data-testid={`input-asset-caption-${asset.id}`}
      >
        <RichTextEditor
          key={editorKey}
          content={value}
          onChange={(html) => {
            const next = normalizeRichText(html);
            valueRef.current = next;
            setValue(next);
            if (saveState === "saved") setSaveState("idle");
          }}
          placeholder="Slide description (optional)"
          className="w-full text-sm"
        />
      </div>
      <p
        className={cn(
          "min-h-4 text-[11px] text-slate-400 dark:text-slate-500",
          lengthStatus.overLimit
            ? "text-red-600 dark:text-red-400"
            : lengthStatus.nearLimit && "text-amber-600 dark:text-amber-400",
        )}
        aria-live="polite"
        data-testid={`text-asset-caption-status-${asset.id}`}
      >
        {lengthStatus.nearLimit
          ? describeRichTextLength(lengthStatus)
          : saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : ""}
      </p>
    </div>
  );
}

/**
 * Graphics image management for an already-persisted lesson: uploads,
 * deletes and description edits happen immediately against the server (no
 * local staging), since the lesson id already exists.
 */
export function LessonAssetManager({ lesson, courseId }: LessonAssetManagerProps) {
  const uploadAssets = useUploadAssets();
  const deleteAsset = useDeleteAsset();
  const reorderAssets = useReorderAssets();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    try {
      await uploadAssets.mutateAsync({ lessonId: lesson.id, courseId, files });
      toast({ title: `${files.length} slide(s) uploaded` });
    } catch {
      toast({ title: "Failed to upload slides", variant: "destructive" });
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    setDeletingId(assetId);
    deleteAsset.mutate(
      { id: assetId, courseId },
      {
        onError: () => toast({ title: "Failed to delete slide", variant: "destructive" }),
        onSettled: () => setDeletingId(null),
      },
    );
  };

  const sortedAssets = [...lesson.assets].sort((a, b) => a.position - b.position);

  const moveAsset = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sortedAssets.length) return;
    const reordered = [...sortedAssets];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    reorderAssets.mutate(
      { lessonId: lesson.id, courseId, order: reordered.map((asset, i) => ({ id: asset.id, position: i })) },
      { onError: () => toast({ title: "Failed to reorder slides", variant: "destructive" }) },
    );
  };

  return (
    <div className="space-y-2" data-testid="lesson-asset-manager">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Slides</p>
        {sortedAssets.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{sortedAssets.length} {sortedAssets.length === 1 ? "slide" : "slides"}</span>
        )}
      </div>

      {sortedAssets.length > 0 && (
        <LessonImageGrid
          items={sortedAssets.map((asset, index) => ({
            key: asset.id,
            label: `Slide ${index + 1}`,
            url: asset.asset_url,
            onRemove: () => handleDeleteAsset(asset.id),
            removing: deletingId === asset.id,
            onMoveUp: index > 0 ? () => moveAsset(index, -1) : undefined,
            onMoveDown: index < sortedAssets.length - 1 ? () => moveAsset(index, 1) : undefined,
            reordering: reorderAssets.isPending,
            testId: `button-delete-asset-${asset.id}`,
            footer: <AssetCaptionField asset={asset} courseId={courseId} index={index} />,
          }))}
        />
      )}

      <ImageDropzone
        onFilesSelected={handleFilesSelected}
        busy={uploadAssets.isPending}
        label={sortedAssets.length > 0 ? "Add more slides" : "Drag slides here or click to upload"}
        compact={sortedAssets.length > 0}
        testId="button-upload-lesson-assets"
      />
    </div>
  );
}
