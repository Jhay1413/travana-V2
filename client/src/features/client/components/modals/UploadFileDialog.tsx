import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  bookingAllocationOptions,
  enquiryAllocationOptions,
  noAllocationsMessage,
  quoteAllocationOptions,
  type AllocationDeal,
  type AllocationOption,
} from "@/features/client/lib/upload-allocation";

type UploadFileState = {
  file: File | null;
  title: string;
  fileType: string;
  allocationType: string;
  allocationId: string;
};

/** The "Select Quote / Enquiry / Booking" list: the client's real deals, or a plain note when there are none. */
function AllocationSelect({
  kind,
  options,
  value,
  onChange,
  testId,
}: {
  kind: "Enquiry" | "Quote" | "Booking";
  options: AllocationOption[];
  value: string;
  onChange: (id: string) => void;
  testId: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-black/60">Select {kind}</Label>
      {options.length === 0 ? (
        <p className="text-sm text-black/55" data-testid={`${testId}-empty`}>
          {noAllocationsMessage(kind)}
        </p>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid={testId}>
            <SelectValue placeholder={`Select ${kind.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function UploadFileDialog({
  open,
  onOpenChange,
  clientName,
  quotes,
  enquiries,
  bookings,
  uploadFile,
  setUploadFile,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  quotes: ReadonlyArray<AllocationDeal>;
  /** The client's real enquiries and bookings, from the same transactions the page already loads. */
  enquiries: ReadonlyArray<AllocationDeal>;
  bookings: ReadonlyArray<AllocationDeal>;
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
            <p className="text-xs text-black/55">Linking a file shares it with the customer.</p>
          </div>

          {uploadFile.allocationType === "Quote" && (
            <AllocationSelect
              kind="Quote"
              options={quoteAllocationOptions(quotes)}
              value={uploadFile.allocationId}
              onChange={(v) => setUploadFile({ ...uploadFile, allocationId: v })}
              testId="select-quote-allocation"
            />
          )}

          {uploadFile.allocationType === "Enquiry" && (
            <AllocationSelect
              kind="Enquiry"
              options={enquiryAllocationOptions(enquiries)}
              value={uploadFile.allocationId}
              onChange={(v) => setUploadFile({ ...uploadFile, allocationId: v })}
              testId="select-enquiry-allocation"
            />
          )}

          {uploadFile.allocationType === "Booking" && (
            <AllocationSelect
              kind="Booking"
              options={bookingAllocationOptions(bookings)}
              value={uploadFile.allocationId}
              onChange={(v) => setUploadFile({ ...uploadFile, allocationId: v })}
              testId="select-booking-allocation"
            />
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
