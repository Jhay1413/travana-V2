import { Link } from "wouter";
import { StatusPill } from "@/features/admin-dashboard";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { buildPills } from "../../lib/pills";
import { HUB_HREF, MESSAGE_HREF, targetHref } from "../../lib/profile-tabs";
import { startedLine } from "../../lib/tenure";
import type { AgentProfileHeader } from "../../types";
import { ProfileFacts } from "./profile-facts";

const BTN =
  "inline-flex h-9 items-center justify-center rounded-[10px] px-4 text-[12px] font-semibold transition xl:text-[13px]";
const BTN_PRIMARY = `${BTN} bg-social-orange text-admin-on-accent hover:bg-social-orange/90`;
const BTN_PLAIN = `${BTN} border border-social-border bg-card text-foreground hover:bg-muted`;

export function ProfileCard({ header, todayKey, hasTarget }: { header: AgentProfileHeader; todayKey: string; hasTarget: boolean | null }) {
  const { user, viewer } = header;
  const pills = buildPills(header);
  return (
    <section
      className="flex flex-col gap-6 rounded-2xl border border-social-border bg-card p-4 min-[1101px]:flex-row min-[1101px]:items-start min-[1101px]:gap-7 xl:p-[22px]"
      aria-labelledby="agent-profile-name"
      data-testid="agent-profile-card"
    >
      <div className="h-[132px] w-[132px] shrink-0 overflow-hidden rounded-full" data-testid="agent-profile-photo">
        {user.image ? (
          <img src={user.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <PersonAvatar name={user.name} size={132} className="h-[132px] w-[132px]" />
        )}
      </div>
      <div className="flex min-w-0 grow flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-semibold leading-tight xl:text-[28px]" id="agent-profile-name" data-testid="text-agent-profile-name">
                {user.name}
              </h1>
              <StatusPill tone="info">{pills.role}</StatusPill>
              {pills.branches.map((b) => (
                <StatusPill key={b} tone="plain">
                  {b}
                </StatusPill>
              ))}
              <StatusPill tone="good">{pills.engagement}</StatusPill>
            </div>
            <p className="mt-1 text-[13px] text-social-muted xl:text-[14px]" data-testid="text-agent-profile-started">
              {startedLine(header.startedAt, todayKey, header.organisationName)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={targetHref(viewer.isAdmin, header.isHomeworker)} className={BTN_PRIMARY} data-testid="link-agent-profile-target">
              {hasTarget === null ? "Targets" : hasTarget ? "Edit target" : "Set target"}
            </Link>
            <Link href={MESSAGE_HREF} className={BTN_PLAIN} data-testid="link-agent-profile-message">
              Message {user.firstName}
            </Link>
            <Link href={HUB_HREF} className={BTN_PLAIN} data-testid="link-agent-profile-hub">
              Open in The Hub
            </Link>
          </div>
        </div>
        <ProfileFacts header={header} />
      </div>
    </section>
  );
}
