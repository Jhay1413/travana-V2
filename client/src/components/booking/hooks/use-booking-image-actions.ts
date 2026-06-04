import { useRef } from "react";
import {
  useDeleteBookingImage,
  useSetPrimaryBookingImage,
  useUploadBookingImages,
} from "@/hooks/mutations/use-booking-image-mutations";
import { useToast } from "@/hooks/use-toast";

/**
 * Bundles the three booking-image mutations (set primary, upload, delete) plus
 * the hidden file-input ref used by the upload button. Mirrors
 * useQuoteImageActions so the booking details view behaves like the quote one.
 */
export function useBookingImageActions(bookingId: string) {
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const setPrimaryImageMutation = useSetPrimaryBookingImage();
  const uploadImagesMutation = useUploadBookingImages();
  const deleteImageMutation = useDeleteBookingImage();

  function setPrimary(imageId: string) {
    setPrimaryImageMutation.mutate(
      { bookingId, imageId },
      {
        onSuccess: () => toast({ title: "Main image updated" }),
        onError: () => toast({ title: "Failed to set main image", variant: "destructive" }),
      },
    );
  }

  function removeImage(imageId: string) {
    deleteImageMutation.mutate(
      { bookingId, imageId },
      {
        onSuccess: () => toast({ title: "Image removed" }),
        onError: () => toast({ title: "Failed to remove image", variant: "destructive" }),
      },
    );
  }

  function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    uploadImagesMutation.mutate(
      { bookingId, files },
      {
        onSuccess: () => {
          toast({ title: `${files.length} image${files.length > 1 ? "s" : ""} uploaded` });
          if (imageInputRef.current) imageInputRef.current.value = "";
        },
        onError: () => {
          toast({ title: "Failed to upload images", variant: "destructive" });
          if (imageInputRef.current) imageInputRef.current.value = "";
        },
      },
    );
  }

  function openFilePicker() {
    imageInputRef.current?.click();
  }

  return {
    imageInputRef,
    setPrimaryImageMutation,
    uploadImagesMutation,
    deleteImageMutation,
    setPrimary,
    removeImage,
    uploadFiles,
    openFilePicker,
  };
}
