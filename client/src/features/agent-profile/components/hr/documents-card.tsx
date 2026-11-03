import { useState } from "react";
import { hrApi, type DocumentEntry, type EmployeeDetail } from "@/features/hr";
import { HomeCard } from "@/features/agent-overview";
import { CARD_BUTTON, CardHead, StatusPill } from "@/features/admin-dashboard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDeleteHrDocument } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { documentStatusView } from "../../lib/documents-expiry";
import { EmptyBlock, TD, TH } from "../shared/profile-bits";
import { UploadDocumentDialog } from "./upload-document-dialog";

const LINK = "font-semibold text-social-orange-text hover:underline";

function openHref(userId: string, d: DocumentEntry): string | null {
  if (d.s3Key) return hrApi.documentDownloadUrl(userId, d.id);
  return d.url ?? null;
}

export function DocumentsCard({ userId, employee, todayKey, className }: { userId: string; employee: EmployeeDetail; todayKey: string; className?: string }) {
  const { toast } = useToast();
  const remove = useDeleteHrDocument();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<DocumentEntry | null>(null);
  const docs = employee.documents;

  const confirmDelete = () => {
    const d = deleting;
    if (!d) return;
    setDeleting(null);
    remove.mutate(
      { userId, docId: d.id },
      { onError: (err: Error) => toast({ title: "Could not delete", description: err.message, variant: "destructive" }) },
    );
  };

  return (
    <HomeCard className={className} testId="hr-documents-card">
      <CardHead
        id="documents-title"
        title="Agreement and documents"
        right={
          <button type="button" className={CARD_BUTTON} onClick={() => setUploading(true)} data-testid="button-hr-upload">
            Upload document
          </button>
        }
      />
      {docs.length === 0 ? (
        <EmptyBlock title="No documents yet">Contracts, agreements and certificates you upload will be listed here.</EmptyBlock>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse" data-testid="table-hr-documents">
            <caption className="sr-only">Agreement and documents with status and dates</caption>
            <thead>
              <tr className="border-b border-social-border">
                <th scope="col" className={`${TH} text-left`}>
                  Document
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Status
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Date
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const s = documentStatusView(d, todayKey);
                const href = openHref(userId, d);
                return (
                  <tr key={d.id} data-testid={`row-hr-document-${d.id}`}>
                    <td className={TD}>
                      <b className="font-semibold">{d.name}</b>
                      <div className="text-[12px] text-social-muted">{d.category}</div>
                    </td>
                    <td className={TD}>
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    </td>
                    <td className={TD}>{s.date}</td>
                    <td className={`${TD} whitespace-nowrap text-right`}>
                      {href && (
                        <a href={href} target="_blank" rel="noreferrer" className={LINK}>
                          Open
                        </a>
                      )}
                      <button type="button" className={`${LINK} ml-3`} onClick={() => setDeleting(d)} disabled={remove.isPending}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <AlertDialog open={!!deleting} onOpenChange={(open) => (open ? undefined : setDeleting(null))}>
        <AlertDialogContent data-testid="dialog-delete-document">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>"{deleting?.name}" will be removed from the HR record. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UploadDocumentDialog open={uploading} userId={userId} onClose={() => setUploading(false)} />
    </HomeCard>
  );
}
