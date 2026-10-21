import { useEffect, useId, useState } from "react";
import { useCatalogueSearch } from "../api/use-tour-operators-manage";
import type { CatalogueRow } from "../types";
import { FIELD_INPUT } from "./classes";

function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

interface CatalogueNameInputProps {
  id: string;
  value: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
  /** Picking an operator from the catalogue fills its website and phone (still editable). */
  onPick: (row: CatalogueRow) => void;
  autoFocus?: boolean;
}

/** Name box that suggests operators already in the shared catalogue. */
export function CatalogueNameInput({ id, value, invalid, describedBy, onChange, onPick, autoFocus }: CatalogueNameInputProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = useDebounced(value, 250).trim().slice(0, 80);
  const { data } = useCatalogueSearch(query, open);
  const options = data ?? [];
  const shown = open && value.trim().length >= 2 && options.length > 0;

  function pick(row: CatalogueRow) {
    onPick(row);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="e.g. TUI"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const row = options[active];
            if (row) pick(row);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className={FIELD_INPUT}
        data-testid="input-operator-name"
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Operators already in the catalogue"
          className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full min-w-[220px] overflow-auto rounded-[10px] border border-social-border bg-card p-1 shadow-lg"
        >
          {options.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) so the input's blur does not close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-[8px] px-2.5 py-1.5 text-[13px] ${i === active ? "bg-muted" : ""}`}
            >
              <b className="font-semibold">{o.name}</b>
              {o.website || o.phone ? <span className="ml-2 text-[12px] text-social-muted">{[o.phone, o.website].filter(Boolean).join(" · ")}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
