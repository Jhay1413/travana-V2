import type { ReactNode } from "react";
import { Eyebrow } from "../brand";

/** A section heading: small tracked label, serif title with an italic second line, optional note at the right. */
export function SectionHead({ eyebrow, lead, italic, aside, id }: { eyebrow: string; lead: string; italic: string; aside?: ReactNode; id: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className="portal-serif max-w-full text-[34px] font-light leading-[1.08] text-primary [overflow-wrap:anywhere]">
          {lead}
          <br />
          <em className="italic">{italic}</em>
        </h2>
      </div>
      {aside && <div className="flex-none pb-1">{aside}</div>}
    </div>
  );
}

/** The quiet "nothing here yet" block inside a section. */
export function QuietEmpty({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <div className="border-y border-border py-8 text-center" data-testid={testId}>
      <p className="portal-serif text-[24px] leading-tight text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-[320px] text-[15px] text-muted-foreground">{children}</p>
    </div>
  );
}
