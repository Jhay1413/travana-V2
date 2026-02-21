import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { QuoteWithJoins } from "./client-types";

type UploadFileState = {
  file: File | null;
  title: string;
  fileType: string;
  allocationType: string;
  allocationId: string;
};

export function UploadFileDialog({
  open,
  onOpenChange,
  clientName,
  quotes,
  uploadFile,
  setUploadFile,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  quotes: QuoteWithJoins[];
  uploadFile: UploadFileState;
  setUploadFile: (state: UploadFileState) => void;
  onUpload: () => void;
}) {
  const handleCancel = () => {
    onOpenChange(false);
    setUploadFile({ file: null, title: "", fileType: "", allocationType: "", allocationId: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Upload File</DialogTitle>
          <DialogDescription className="text-sm text-black/55">
            Upload a document and categorise it for {clientName}.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Select File</Label>
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setUploadFile({ ...uploadFile, file });
              }}
              className="h-10 rounded-xl border-black/10 bg-white/70"
              data-testid="input-upload-file"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Title</Label>
            <Input
              placeholder="e.g. Family Passport Scans"
              value={uploadFile.title}
              onChange={(e) => setUploadFile({ ...uploadFile, title: e.target.value })}
              className="h-10 rounded-xl border-black/10 bg-white/70"
              data-testid="input-upload-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">File Type</Label>
            <Select
              value={uploadFile.fileType}
              onValueChange={(v) => setUploadFile({ ...uploadFile, fileType: v })}
            >
              <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-file-type">
                <SelectValue placeholder="Select file type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Passport">Passport</SelectItem>
                <SelectItem value="Tickets">Tickets</SelectItem>
                <SelectItem value="Quote">Quote</SelectItem>
                <SelectItem value="Invoice">Invoice</SelectItem>
                <SelectItem value="Itinerary">Itinerary</SelectItem>
                <SelectItem value="Insurance">Insurance</SelectItem>
                <SelectItem value="Visa">Visa</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Allocate To</Label>
            <Select
              value={uploadFile.allocationType}
              onValueChange={(v) => setUploadFile({ ...uploadFile, allocationType: v, allocationId: "" })}
            >
              <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-allocation-type">
                <SelectValue placeholder="Select allocation..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Enquiry">Enquiry</SelectItem>
                <SelectItem value="Quote">Quote</SelectItem>
                <SelectItem value="Booking">Booking</SelectItem>
                <SelectItem value="None">None (Client level)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {uploadFile.allocationType === "Quote" && quotes.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Select Quote</Label>
              <Select
                value={uploadFile.allocationId}
                onValueChange={(v) => setUploadFile({ ...uploadFile, allocationId: v })}
              >
                <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-quote-allocation">
                  <SelectValue placeholder="Select quote..." />
                </SelectTrigger>
                <SelectContent>
                  {quotes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.title || q.quote_type || "Quote"} - {q.quote_status || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {uploadFile.allocationType === "Enquiry" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Select Enquiry</Label>
              <Select
                value={uploadFile.allocationId}
                onValueChange={(v) => setUploadFile({ ...uploadFile, allocationId: v })}
              >
                <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-enquiry-allocation">
                  <SelectValue placeholder="Select enquiry..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enquiry-1">Initial requirements</SelectItem>
                  <SelectItem value="enquiry-2">Budget alignment</SelectItem>
                  <SelectItem value="enquiry-3">Destination short-list</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {uploadFile.allocationType === "Booking" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Select Booking</Label>
              <Select
                value={uploadFile.allocationId}
                onValueChange={(v) => setUploadFile({ ...uploadFile, allocationId: v })}
              >
                <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-booking-allocation">
                  <SelectValue placeholder="Select booking..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="booking-1">Hotel confirmation</SelectItem>
                  <SelectItem value="booking-2">Transfers</SelectItem>
                  <SelectItem value="booking-3">Activities</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              className="rounded-2xl border-black/10 px-4"
              onClick={handleCancel}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              className="rounded-2xl bg-black px-4 text-white hover:bg-black/90"
              disabled={!uploadFile.file || !uploadFile.fileType}
              onClick={onUpload}
              data-testid="button-upload-file"
            >
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
