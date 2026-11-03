import { useRef } from "react";
import { Link } from "wouter";
import { ChevronRight, Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";

interface PageHeadProps {
  root: { label: string; href: string };
  canWrite: boolean;
  exporting: boolean;
  uploading: boolean;
  onExport: () => void;
  onAdd: () => void;
  onFile: (file: File) => void;
}

/** Breadcrumb, title, and the Export / Upload / Add buttons. Read-only roles only get Export. */
export function PageHead({ root, canWrite, exporting, uploading, onExport, onAdd, onFile }: PageHeadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] text-social-muted xl:text-[14px]">
        <Link href={root.href} className="font-medium text-social-navy hover:underline">
          {root.label}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span aria-current="page" className="font-semibold text-foreground">
          Tour operators
        </span>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1">
          <h1 className="text-[22px] font-semibold leading-tight xl:text-2xl" data-testid="text-operators-title">
            Tour operators
          </h1>
          <p className="mt-1 text-[13px] text-social-muted xl:text-[14px]">Phone numbers, agent websites, logins and commission rates in one place.</p>
        </div>
        <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onExport} disabled={exporting} data-testid="button-export-operators">
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </Button>
        {canWrite && (
          <>
            <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-upload-operators">
              <Upload className="h-4 w-4" aria-hidden />
              Upload CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="sr-only"
              tabIndex={-1}
              aria-label="Upload a CSV file of tour operators"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onFile(file);
              }}
            />
            <Button type="button" className={PRIMARY_ACTION} onClick={onAdd} data-testid="button-add-operator">
              <Plus className="h-4 w-4" aria-hidden />
              Add tour operator
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
