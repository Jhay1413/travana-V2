import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  onTemplate: () => void;
  disabled?: boolean;
}

/** "Have a list already?": drop or pick a .csv, or download the template. */
export function UploadDropzone({ onFile, onTemplate, disabled }: UploadDropzoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border-[1.5px] border-dashed border-ticket-dashed px-4 py-3.5",
        drag && "border-social-orange bg-ticket-amber-bg/40",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files?.[0];
        if (file && !disabled) onFile(file);
      }}
      data-testid="upload-dropzone"
    >
      <div className="min-w-0 flex-[1_1_280px]">
        <div className="text-[14px] font-semibold">Have a list already?</div>
        <div className="text-[12px] text-social-muted">
          Upload a .csv file with first name, last name, email, role and branch, or drag and drop it here. In Excel, use Save As and pick CSV.
        </div>
      </div>
      <div className="flex flex-none items-center gap-4">
        <button type="button" onClick={onTemplate} className="text-[13px] font-semibold text-social-orange-text hover:underline" data-testid="button-download-template">
          Download template
        </button>
        <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={() => input.current?.click()} disabled={disabled} data-testid="button-upload-csv">
          <Upload className="h-4 w-4" />
          Upload spreadsheet
        </Button>
        <input
          ref={input}
          type="file"
          hidden
          accept=".csv,.tsv,.txt,text/csv"
          aria-label="Upload a spreadsheet of people"
          data-testid="invite-upload"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </div>
    </div>
  );
}
