import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientFileApi } from "@/api";
import { useToast } from "@/hooks/use-toast";

interface UploadFileForm {
  file: File | null;
  title: string;
  fileType: string;
  allocationType: string;
  allocationId: string;
}

const EMPTY_UPLOAD_FORM: UploadFileForm = {
  file: null,
  title: "",
  fileType: "",
  allocationType: "",
  allocationId: "",
};

/**
 * Owns the client-files query, the upload/delete mutations, and the upload
 * dialog form state.
 */
export function useClientFiles(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showUploadFileModal, setShowUploadFileModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<UploadFileForm>(EMPTY_UPLOAD_FORM);

  const { data: clientFilesData = [] } = useQuery({
    queryKey: ["client-files", clientId],
    queryFn: () => clientFileApi.getByClient(clientId),
    enabled: !!clientId,
  });

  const uploadFileMutation = useMutation({
    mutationFn: (params: {
      file: File;
      title?: string;
      category?: string;
      allocationType?: string;
      allocationId?: string;
    }) => clientFileApi.upload(clientId, params.file, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-files", clientId] });
      toast({ title: "File uploaded", description: "File saved successfully." });
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Could not upload file.", variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id: string) => clientFileApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-files", clientId] });
      toast({ title: "File deleted" });
    },
  });

  function handleUploadFile() {
    if (uploadFile.file) {
      uploadFileMutation.mutate({
        file: uploadFile.file,
        title: uploadFile.title || uploadFile.file.name,
        category: uploadFile.fileType,
        allocationType: uploadFile.allocationType || undefined,
        allocationId: uploadFile.allocationId || undefined,
      });
    }
    setShowUploadFileModal(false);
    setUploadFile(EMPTY_UPLOAD_FORM);
  }

  return {
    clientFilesData,
    showUploadFileModal,
    setShowUploadFileModal,
    uploadFile,
    setUploadFile,
    handleUploadFile,
    deleteFile: (id: string) => deleteFileMutation.mutate(id),
    uploadFileMutation,
    deleteFileMutation,
  };
}
