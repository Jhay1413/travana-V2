import { Plus, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";

interface TeamHeaderProps {
  onUpload: () => void;
  onAdd: () => void;
  onMatrix: () => void;
  uploadDisabled?: boolean;
}

/** Title + subtitle on the left; upload and Add user on the right. No box. */
export function TeamHeader({ onUpload, onAdd, onMatrix, uploadDisabled }: TeamHeaderProps) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-3">
      <div className="min-w-[240px] flex-1">
        <h1 className="text-[22px] font-semibold leading-[1.2] xl:text-[24px]" data-testid="team-title">
          Teams &amp; Roles
        </h1>
        <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]" data-testid="team-subtitle">
          Add, edit, suspend and remove the people in your organisation. Access follows each person&apos;s role.{" "}
          <button
            type="button"
            onClick={onMatrix}
            className="inline-flex items-center gap-1 font-semibold text-social-orange-text hover:underline"
            data-testid="button-role-matrix"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            What each role can do
          </button>
        </p>
      </div>
      <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onUpload} disabled={uploadDisabled} data-testid="button-upload-sheet">
        <Upload className="h-4 w-4" />
        Upload spreadsheet
      </Button>
      <Button type="button" className={PRIMARY_ACTION} onClick={onAdd} data-testid="button-add-user">
        <Plus className="h-4 w-4" />
        Add user
      </Button>
    </div>
  );
}
