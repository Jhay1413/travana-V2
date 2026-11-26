import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { DestinationContent, DestinationSection } from "../../lib/quote-destination";
import { toRoman } from "../../lib/quote-format";
import { SplitHeading } from "../brand";

function Facts({ facts }: { facts: Array<{ label: string; value: string }> }) {
  if (facts.length === 0) return null;
  return (
    <dl className="flex flex-col gap-[18px]">
      {facts.map((f) => (
        <div key={f.label} className="flex flex-col gap-1">
          <dt className="portal-caps-label">{f.label}</dt>
          <dd className="portal-serif text-[19px] leading-snug text-primary">{f.value}</dd>
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
                <span className="portal-serif text-[21px] leading-tight text-primary">{t.name}</span>
                {t.tag && <span className="whitespace-nowrap text-[11px] uppercase tracking-[0.18em] portal-text-amber-ink">{t.tag}</span>}
              </div>
              {t.line && <p className="text-[15px] leading-relaxed text-muted-foreground">{t.line}</p>}
              {t.details.map((d) => (
                <p key={d} className="text-[15px] leading-relaxed text-muted-foreground">
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
export function QuoteDestination({ content, askLabel, onAsk }: { content: DestinationContent; askLabel: string; onAsk: () => void }) {
  const [open, setOpen] = useState<string[]>([content.sections[0]?.id ?? ""]);
  return (
    <section aria-labelledby="destination" className="bg-secondary px-7 pb-16 pt-[72px]" data-testid="quote-destination">
      <div className="mx-auto max-w-3xl">
        <p className="portal-eyebrow mb-3.5">The destination</p>
        <SplitHeading id="destination" lead={content.tagline ? `${content.name},` : content.name} italic={content.tagline || undefined} className="mb-[30px]" />
        <Accordion.Root type="multiple" value={open} onValueChange={setOpen} className="border-b border-[hsl(var(--portal-line))]">
          {content.sections.map((section, i) => (
            <Accordion.Item key={section.id} value={section.id} className="border-t border-[hsl(var(--portal-line))]" data-testid={`destination-${section.id}`}>
              <Accordion.Header className="m-0">
                <Accordion.Trigger className="group flex min-h-[72px] w-full items-start gap-4 py-5 text-left">
                  <span className="portal-serif w-8 flex-none text-[20px] portal-text-amber-ink" aria-hidden>
                    {toRoman(i + 1)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="portal-serif text-[23px] font-medium leading-tight text-primary">{section.title}</span>
                    <span className="text-[15px] text-muted-foreground">{section.sub}</span>
                  </span>
                  <ChevronDown className="mt-1.5 size-5 flex-none text-primary transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.5} aria-hidden />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="pb-6 pl-12">
                <SectionBody section={section} />
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
        <p className="portal-serif mt-[26px] text-[19px] italic leading-snug text-primary">Like the sound of something? Just ask.</p>
        <button
          type="button"
          onClick={onAsk}
          className="mt-[18px] inline-flex min-h-[52px] w-full items-center justify-center border border-primary px-8 text-xs font-medium uppercase tracking-[0.24em] text-primary hover:bg-primary hover:text-primary-foreground"
          data-testid="button-ask-add"
        >
          {askLabel}
        </button>
      </div>
    </section>
  );
}
