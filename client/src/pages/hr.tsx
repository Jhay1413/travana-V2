import { useRole } from "@/hooks/use-role";
import TravanaHR from "./hr/TravanaHR";
import { ShieldAlert } from "lucide-react";

export default function HrPage() {
  const { role, setRole } = useRole();
  const allowed = role === "Admin" || role === "Manager";

  return (
    <>
      {allowed ? (
        <div data-testid="page-hr">
          <TravanaHR />
        </div>
      ) : (
        <div className="p-12 flex flex-col items-center justify-center text-center" data-testid="hr-no-access">
          <ShieldAlert className="h-10 w-10 text-slate-400 mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">No access</h2>
          <p className="text-sm text-slate-500 mt-1">
            The HR section is available to Admin and Manager roles only.
          </p>
        </div>
      )}
    </>
  );
}
