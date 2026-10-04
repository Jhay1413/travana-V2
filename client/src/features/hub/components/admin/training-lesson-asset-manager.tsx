import { useEffect, useRef, useState } from "react";
import { useUploadAssets, useDeleteAsset, useUpdateAsset } from "@/features/hub/api/use-training-admin-mutations";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
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
 * Description textarea for one persisted slide. Saves on blur when the text
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
  const valueRef = useRef(value);
  const lastSavedRef = useRef(serverCaption);

  useEffect(() => {
    const dirty = valueRef.current.trim() !== lastSavedRef.current;
    if (!dirty) {
      lastSavedRef.current = serverCaption;
      valueRef.current = serverCaption;
      setValue(serverCaption);
    }
  }, [serverCaption]);

  const save = () => {
    const next = valueRef.current.trim();
    if (next === lastSavedRef.current) return;
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
      <Textarea
        value={value}
        onChange={(e) => {
          valueRef.current = e.target.value;
          setValue(e.target.value);
          if (saveState === "saved") setSaveState("idle");
        }}
        onBlur={save}
        placeholder="Slide description (optional)"
        aria-label={`Slide ${index + 1} description`}
        rows={3}
        maxLength={2000}
        className="w-full text-sm"
        data-testid={`input-asset-caption-${asset.id}`}
      />
      <p
        className="h-4 text-[11px] text-slate-400 dark:text-slate-500"
        aria-live="polite"
        data-testid={`text-asset-caption-status-${asset.id}`}
      >
        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
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
