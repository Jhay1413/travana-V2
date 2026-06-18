import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <ShieldAlert className="h-12 w-12 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">403 — Access denied</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          You don't have permission to view this page. If you think this is a mistake, contact your
          administrator.
        </p>
      </div>
      <Button asChild data-testid="forbidden-go-home">
        <Link href="/">Go to dashboard</Link>
      </Button>
    </div>
  );
}
