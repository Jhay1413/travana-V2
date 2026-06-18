import { motion } from "framer-motion";
import { Building2, MapPin, Phone, Mail, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BranchSummary } from "@/features/organization/api/branch-overview.api";

export function BranchProfileStrip({ branch }: { branch: BranchSummary }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card
        className="glass ringed grain rounded-2xl p-4"
        data-testid="branch-profile-strip"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold leading-none" data-testid="text-branch-name">
                  {branch.name}
                </h2>
                {branch.code ? (
                  <span className="text-xs text-muted-foreground">· {branch.code}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {branch.address ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {branch.address}
                  </span>
                ) : null}
                {branch.phone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {branch.phone}
                  </span>
                ) : null}
                {branch.email ? (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {branch.email}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {branch.memberCount}{" "}
                  {branch.memberCount === 1 ? "member" : "members"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {branch.isDefault ? (
              <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
                Default
              </Badge>
            ) : null}
            <Badge
              className={
                branch.isActive
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10"
                  : "border-zinc-500/25 bg-zinc-500/10 text-zinc-700 hover:bg-zinc-500/10"
              }
            >
              {branch.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
