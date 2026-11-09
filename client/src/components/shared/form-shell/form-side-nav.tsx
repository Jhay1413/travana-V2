import type { ReactNode } from "react";
import { Check } from "lucide-react";

export interface FormNavItem {
  key: string;
  label: string;
  /** Shows a green tick. */
  done: boolean;
  /** Optional sections are labelled "optional" and are not counted. */
  optional?: boolean;
}

export interface FormSideNavProps {
  items: readonly FormNavItem[];
  /** Key of the section currently in view. */
  current: string;
  onJump: (key: string) => void;
  /** Pinned to the bottom, e.g. the profit card. */
  footer?: ReactNode;
}

/** Left section menu with done ticks, aria-current on the active item and a footer slot. */
export function FormSideNav({ items, current, onJump, footer }: FormSideNavProps) {
  return (
    <nav className="fm-q__nav" aria-label="Form sections">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-current={item.key === current ? "true" : undefined}
          onClick={() => onJump(item.key)}
          data-testid={`form-nav-${item.key}`}
        >
          <span className="fm-q__navlabel">
            {item.label}
            {item.optional ? <span className="fm-q__nav-opt">optional</span> : null}
          </span>
          <span className={`fm-q__tick ${item.done ? "fm-q__tick--done" : "fm-q__tick--todo"}`} role="img" aria-label={item.done ? "complete" : "incomplete"}>
            {item.done ? <Check size={12} color="#047857" strokeWidth={3} aria-hidden="true" /> : null}
          </span>
        </button>
      ))}
      {footer ? <div className="fm-q__profit">{footer}</div> : null}
    </nav>
  );
}
