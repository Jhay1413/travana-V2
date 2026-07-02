import { useState } from "react";
import { useUploadAssets, useDeleteAsset } from "@/features/hub/api/use-training-admin-mutations";
import { useToast } from "@/hooks/use-toast";
import { ImageDropzone, LessonImageGrid } from "./training-image-picker";
import type { LessonWithAssets } from "@/features/hub/types/training.types";

interface LessonAssetManagerProps {
  lesson: LessonWithAssets;
  courseId: string;
}

/**
 * Graphics image management for an already-persisted lesson: uploads and
 * deletes happen immediately against the server (no local staging), since
 * the lesson id already exists.
 */
export function LessonAssetManager({ lesson, courseId }: LessonAssetManagerProps) {
  const uploadAssets = useUploadAssets();
  const deleteAsset = useDeleteAsset();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    try {
      await uploadAssets.mutateAsync({ lessonId: lesson.id, courseId, files });
      toast({ title: `${files.length} image(s) uploaded` });
    } catch {
      toast({ title: "Failed to upload images", variant: "destructive" });
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    setDeletingId(assetId);
    deleteAsset.mutate(
      { id: assetId, courseId },
      {
        onError: () => toast({ title: "Failed to delete image", variant: "destructive" }),
        onSettled: () => setDeletingId(null),
      },
    );
  };

  const sortedAssets = [...lesson.assets].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-2" data-testid="lesson-asset-manager">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Images</p>
        {sortedAssets.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{sortedAssets.length} image(s)</span>
        )}
      </div>

      {sortedAssets.length > 0 && (
        <LessonImageGrid
          items={sortedAssets.map((asset) => ({
            key: asset.id,
            url: asset.asset_url,
            onRemove: () => handleDeleteAsset(asset.id),
            removing: deletingId === asset.id,
            testId: `button-delete-asset-${asset.id}`,
          }))}
        />
      )}

      <ImageDropzone
        onFilesSelected={handleFilesSelected}
        busy={uploadAssets.isPending}
        label={sortedAssets.length > 0 ? "Add more images" : "Drag images here or click to upload"}
        testId="button-upload-lesson-assets"
      />
    </div>
  );
}
