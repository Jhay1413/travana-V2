import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { HomeCard, HomeLink } from "@/features/agent-overview/components/home/home-ui";
import type { TourOperatorBreakdownRow } from "@/features/organization/api/organization-overview.api";
import { gbp, plural } from "../lib/money";
import { rankSuppliers, supplierBarWidth, supplierInitials, type SupplierMeasure } from "../lib/supplier-math";
import { CardHead, CardNote, InitialsTile, RankBar } from "./shared/bits";

export function SupplierLeagueCard({ rows, className }: { rows: TourOperatorBreakdownRow[]; className?: string }) {
  const [by, setBy] = useState<SupplierMeasure>("commission");
  const ranked = rankSuppliers(rows, by);
  const top = ranked.length > 0 ? ranked[0][by] : 0;

  return (
    <HomeCard className={`flex flex-col ${className ?? ""}`} testId="card-tour-operator-league">
      <CardHead
        id="supplier-league-title"
        title="Supplier league"
        right={
          <Segmented<SupplierMeasure>
            value={by}
            onChange={setBy}
            variant="black"
            label="Rank suppliers by"
            items={[
              { value: "commission", label: "Commission", testId: "segment-suppliers-commission" },
              { value: "bookings", label: "Bookings", testId: "segment-suppliers-bookings" },
            ]}
          />
        }
      />

      {ranked.length === 0 ? (
        <CardNote testId="suppliers-empty">No bookings this month.</CardNote>
      ) : (
        <ol>
          {ranked.map((r, i) => (
            <li
              key={r.id}
              className="flex items-center gap-3.5 border-t border-social-border py-3.5 first:border-t-0 first:pt-0.5 last:pb-0"
              data-testid={`row-tour-operator-${r.id}`}
            >
              <span className="w-[22px] shrink-0 text-center text-[13px] font-semibold text-social-muted xl:text-[14px]">{i + 1}</span>
              <InitialsTile text={supplierInitials(r.name)} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <b className="truncate text-[13px] font-semibold xl:text-[14px]">{r.name}</b>
                <RankBar pct={supplierBarWidth(r[by], top)} />
              </div>
              <div className="flex flex-col items-end">
                <b className="text-[13px] font-semibold tabular-nums xl:text-[14px]">
                  {by === "commission" ? gbp(r.commission) : plural(r.bookings, "booking")}
                </b>
                <span className="text-[12px] text-social-muted xl:text-[13px]">
                  {by === "commission" ? plural(r.bookings, "booking") : gbp(r.commission)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-auto pt-3">
        <HomeLink href="/agency/tour-operators" testId="link-see-all-suppliers">
          See all suppliers
        </HomeLink>
      </div>
    </HomeCard>
  );
}
