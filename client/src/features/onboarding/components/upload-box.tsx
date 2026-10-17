import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, LINK_BUTTON } from "./styles";

interface UploadBoxProps {
  description: string;
  onFile: (file: File) => void;
  onDownloadTemplate: () => void;
  error?: string | null;
  busy?: boolean;
}

/** "Have a list already?": pick or drop a CSV file. */
export function UploadBox({ description, onFile, onDownloadTemplate, error, busy }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="mb-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={cn(
          "flex flex-col items-stretch justify-between gap-3 rounded-xl border-[1.5px] border-dashed px-4 py-3.5 transition-colors sm:flex-row sm:items-center sm:gap-4",
          dragging ? "border-social-orange bg-social-orange/10" : "border-social-border bg-social-page",
        )}
      >
        <div>
          <div className="text-[14px] font-semibold">Have a list already?</div>
          <div className="text-[12px] text-social-muted">{description}</div>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" className={LINK_BUTTON} onClick={onDownloadTemplate}>
            Download template
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-[10px] border-social-border bg-card text-[13px] font-semibold"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Reading file…" : "Upload spreadsheet"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept=".csv,.tsv,.txt,text/csv"
            aria-label="Upload spreadsheet"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onFile(file);
            }}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className={cn(ERROR_TEXT, "mt-2 text-[13px]")}>
          {error}
        </p>
      )}
    </div>
  );
}
