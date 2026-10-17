import { Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { HomeCard } from "@/features/agent-overview/components/home/home-ui";
import { londonClock, londonDayMonth, nextBriefingText } from "../lib/dashboard-date";
import { BRIEFING_BULLETS, BRIEFING_TIMES, briefingGreeting, type BriefingTime } from "../lib/sample-briefing";
import { useBriefingSettings } from "../state/use-briefing-settings";
import { useNow } from "../state/use-now";
import { CARD_BUTTON, CardHead } from "./shared/bits";
import { SamplePill } from "./shared/pills";

/** SAMPLE content: prototype copy. Only the first name and the London date are real. */
export function BriefingCard({ className }: { className?: string }) {
  const { data: user } = useCurrentUser();
  const { toast } = useToast();
  const { time, setTime, email, setEmail } = useBriefingSettings();
  const now = useNow();
  const firstName = user?.firstName || user?.name?.split(/\s+/)[0] || "";
  const greeting = briefingGreeting(firstName, now);

  return (
    <HomeCard className={`flex flex-col ${className ?? ""}`} testId="card-luna-briefing">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-role-owner-bg text-role-owner-fg" aria-hidden>
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <CardHead
            id="luna-briefing-title"
            title="Luna's morning briefing"
            pill={<SamplePill />}
            sub={`${londonDayMonth(now)}, as at ${londonClock(now)}`}
          />
        </div>
      </div>

      <div className="mb-4 text-[13px] xl:text-[14px]" data-testid="briefing-body">
        <p className="mb-2.5 text-[14px] xl:text-[15px]">
          <b className="font-semibold">{greeting.bold}</b>
          {greeting.rest}
        </p>
        <ul className="flex flex-col gap-2.5">
          {BRIEFING_BULLETS.map((segments, i) => (
            <li key={i} className="relative pl-5 leading-relaxed">
              <span className="absolute left-1 top-[9px] h-[7px] w-[7px] rounded-full bg-social-navy" aria-hidden />
              {segments.map((s, j) =>
                s.bold ? (
                  <b key={j} className="font-semibold">
                    {s.text}
                  </b>
                ) : (
                  <span key={j}>{s.text}</span>
                ),
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-social-border pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="briefing-time" className="text-[12px] text-social-muted xl:text-[13px]">
            Send each weekday at
          </label>
          <Select value={time} onValueChange={(v) => setTime(v as BriefingTime)}>
            <SelectTrigger
              id="briefing-time"
              className="h-10 w-[110px] rounded-[10px] border-social-border bg-card px-3 text-[13px] shadow-none"
              data-testid="select-briefing-time"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BRIEFING_TIMES.map((t) => (
                <SelectItem key={t} value={t} className="text-[13px]">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label htmlFor="briefing-email" className="flex items-center gap-2 text-[12px] xl:text-[13px]">
            <Checkbox
              id="briefing-email"
              checked={email}
              onCheckedChange={(v) => setEmail(v === true)}
              data-testid="checkbox-briefing-email"
            />
            Email me a copy
          </label>
        </div>
        <span className="text-[12px] text-social-muted xl:text-[13px]" role="status" data-testid="text-next-briefing">
          {nextBriefingText(now, time, email)}
        </span>
        <div>
          <button
            type="button"
            className={CARD_BUTTON}
            data-testid="button-ask-luna"
            onClick={() => toast({ title: "Luna will be able to answer questions here soon." })}
          >
            Ask Luna a question
          </button>
        </div>
      </div>
    </HomeCard>
  );
}
