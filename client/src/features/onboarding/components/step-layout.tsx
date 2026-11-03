import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { stepperFor, stepTarget } from "../lib/stepper";
import { useOnboarding } from "../state/onboarding-context";
import { Stepper } from "./stepper";

interface StepLayoutProps {
  title: string;
  subtitle?: ReactNode;
  /** Wide screens (tables) drop the tips panel and use more width. */
  wide?: boolean;
  tips?: { title: string; items: string[] };
  children: ReactNode;
}

/** Heading, stepper, content area and (optionally) the tips panel. Shared by every wizard step. */
export function StepLayout({ title, subtitle, wide, tips, children }: StepLayoutProps) {
  const { state, goto, headingRef } = useOnboarding();
  const { steps, current } = stepperFor(state.business.businessType, state.step);
  const multi = state.business.businessType === "multi";

  return (
    <div className="flex flex-col items-start gap-7 lg:flex-row">
      <div className={cn("w-full min-w-0 flex-1", wide ? "max-w-[1100px]" : "max-w-[880px]")}>
        <h1 ref={headingRef} tabIndex={-1} className="m-0 text-[24px] font-semibold outline-none">
          {title}
        </h1>
        {subtitle && <p className="mb-5 mt-1 text-[14px] text-social-muted">{subtitle}</p>}
        <div className={subtitle ? undefined : "mt-5"}>
          <Stepper
            steps={steps}
            current={current}
            onStepClick={(i) => {
              const target = stepTarget(multi, i);
              if (target) goto(target);
            }}
          />
        </div>
        {children}
      </div>
      {tips && (
        <aside
          aria-label="Tips"
          className="w-full flex-none rounded-2xl bg-social-navy p-5 text-white lg:mt-[68px] lg:w-[280px]"
        >
          <div className="mb-3 text-[14px] font-semibold">{tips.title}</div>
          <ul className="m-0 space-y-2.5 pl-4 text-[13px] leading-relaxed text-white/80">
            {tips.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
