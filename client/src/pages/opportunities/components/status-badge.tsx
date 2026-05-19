import { Badge } from "@/components/ui/badge";
import { formatStatus, statusBadgeClass } from "../helpers";

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 rounded-lg ${statusBadgeClass(status)}`}
    >
      {formatStatus(status)}
    </Badge>
  );
}
