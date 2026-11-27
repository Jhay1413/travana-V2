import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { DestinationContent, DestinationSection } from "../../lib/quote-destination";
import { toRoman } from "../../lib/quote-format";
import { PortalButton, SplitHeading } from "../brand";

function Facts({ facts }: { facts: Array<{ label: string; value: string }> }) {
  if (facts.length === 0) return null;
  return (
    <dl className="flex flex-col gap-[18px]">
      {facts.map((f) => (
        <div key={f.label} className="flex flex-col gap-1">
          <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{f.label}</dt>
          <dd className="portal-serif text-[19px] leading-[1.35] text-primary">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionBody({ section }: { section: DestinationSection }) {
  switch (section.id) {
    case "todo":
      return (
        <ol className="flex flex-col gap-[22px]">
          {section.things.map((t) => (
            <li key={t.name} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2.5">
                <span className="portal-serif min-w-0 text-[21px] leading-[1.2] text-primary [overflow-wrap:anywhere]">{t.name}</span>
                {t.tag && <span className="min-w-0 text-right text-[10px] uppercase tracking-[0.22em] portal-text-amber-ink [overflow-wrap:anywhere]">{t.tag}</span>}
              </div>
              {t.line && <p className="text-sm leading-[1.65] text-muted-foreground">{t.line}</p>}
              {t.details.map((d) => (
                <p key={d} className="text-sm leading-[1.65] text-muted-foreground">
                  {d}
                </p>
              ))}
            </li>
          ))}
        </ol>
      );
    case "know":
    case "getting":
      return (
        <div className="flex flex-col gap-4">
          <Facts facts={section.facts} />
          {section.note && <p className="text-[15px] leading-[1.7] text-foreground">{section.note}</p>}
        </div>
      );
    case "when":
      return (
        <div className="flex flex-col gap-4">
          <Facts facts={section.facts} />
          {section.reason && <p className="text-[15px] leading-[1.7] text-foreground">{section.reason}</p>}
          {section.months.length > 0 && (
            <div>
              <p className="portal-caps-label mb-2">Average high by month</p>
              <ul className="grid grid-cols-4 gap-x-4 gap-y-2 sm:grid-cols-6">
                {section.months.map((m) => (
                  <li key={m.month} className="flex flex-col">
                    <span className="portal-caps-label">{m.month}</span>
                    <span className="portal-serif text-[19px] text-primary">{Math.round(m.high)}°C</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
  }
}

/** "The destination": the guide as an accordion. Sections with nothing in them are not there at all. */
export function QuoteDestination({ content, agent, askLabel, onAsk }: { content: DestinationContent; agent: string; askLabel: string; onAsk: () => void }) {
  const who = agent === "your agent" ? "your agent" : agent;
  const [open, setOpen] = useState<string[]>([content.sections[0]?.id ?? ""]);
  return (
    <section aria-labelledby="destination" className="bg-secondary px-7 pb-16 pt-[72px]" data-testid="quote-destination">
      <div className="mx-auto max-w-3xl">
        <p className="portal-eyebrow mb-3.5">The destination</p>
        <SplitHeading id="destination" lead={content.tagline ? `${content.name},` : content.name} italic={content.tagline || undefined} className="mb-[30px]" />
        <Accordion.Root type="multiple" value={open} onValueChange={setOpen} className="border-b border-[#D9C7B1]">
          {content.sections.map((section, i) => (
            <Accordion.Item key={section.id} value={section.id} className="border-t border-[#D9C7B1]" data-testid={`destination-${section.id}`}>
              <Accordion.Header className="m-0">
                <Accordion.Trigger className="group flex min-h-20 w-full items-center gap-[18px] py-[18px] text-left">
                  <span className="portal-serif w-7 flex-none text-[20px] portal-text-amber-ink" aria-hidden>
                    {toRoman(i + 1)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 [overflow-wrap:anywhere]">
                    <span className="portal-serif text-[23px] font-medium leading-[1.2] text-primary">{section.title}</span>
                    <span className="text-[13px] font-light text-muted-foreground">{section.sub}</span>
                  </span>
                  <ChevronDown className="size-5 flex-none text-primary transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.5} aria-hidden />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="pb-[30px] pl-[46px]">
                <SectionBody section={section} />
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
        <p className="portal-serif mt-[26px] text-lg italic leading-[1.45] text-primary">Like the sound of something? Tell {who} and they can arrange it for you.</p>
        <PortalButton variant="outline" className="mt-[18px] w-full" onClick={onAsk} data-testid="button-ask-add">
          {askLabel}
        </PortalButton>
      </div>
    </section>
  );
}
