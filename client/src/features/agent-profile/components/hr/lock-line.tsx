import { Lock } from "lucide-react";
import { lockPaySentence } from "../../lib/profile-tabs";

export function LockLine({ firstName, canSeePay }: { firstName: string; canSeePay: boolean }) {
  return (
    <p className="m-0 flex items-center gap-2.5 rounded-[10px] bg-status-draft-bg px-3.5 py-2.5 text-[13px] xl:text-[14px]" data-testid="hr-lock-line">
      <Lock className="h-4 w-4 shrink-0 text-social-navy" aria-hidden />
      <span>
        Only owners, admins and branch managers can see this section. {firstName} cannot. {lockPaySentence(canSeePay)}
      </span>
    </p>
  );
}
