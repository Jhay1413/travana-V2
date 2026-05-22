import { motion } from "framer-motion";
import { Building2, Users, Briefcase, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrganizationSummary } from "@/api/endpoints/organization-overview.api";

export function OrgProfileStrip({ organization }: { organization: OrganizationSummary }) {
  const createdLabel = organization.createdAt
    ? new Date(organization.createdAt).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card
        className="glass ringed grain rounded-2xl p-4"
        data-testid="org-profile-strip"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 overflow-hidden">
              {organization.logoUrl ? (
                <img
                  src={organization.logoUrl}
                  alt={organization.name}
                  className="h-10 w-10 object-cover"
                />
              ) : (
                <Building2 className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold leading-none" data-testid="text-org-name">
                  {organization.name}
                </h2>
                <span className="text-xs text-muted-foreground">· {organization.slug}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {organization.branchCount} / {organization.branchLimit ?? "∞"}{" "}
                  {organization.branchCount === 1 ? "branch" : "branches"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {organization.memberCount}{" "}
                  {organization.memberCount === 1 ? "member" : "members"}
                  {" / "}{organization.seatLimit ?? "∞"} seats
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> {organization.clientCount.toLocaleString()}{" "}
                  {organization.clientCount === 1 ? "client" : "clients"}
                </span>
                {createdLabel ? <span>· Since {createdLabel}</span> : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {organization.plan ? (
              <Badge className="border-indigo-500/25 bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/10 capitalize">
                {organization.plan}
              </Badge>
            ) : null}
            <Badge
              className={
                organization.isActive
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10"
                  : "border-zinc-500/25 bg-zinc-500/10 text-zinc-700 hover:bg-zinc-500/10"
              }
            >
              {organization.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
