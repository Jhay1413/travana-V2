import { useCallback, useState } from "react";

/**
 * Open/closed state that is uncontrolled by default and becomes controlled when
 * the parent passes `open`. `onOpenChange` fires in both modes, so a parent can
 * observe or drive a dialog that a menu owns.
 */
export function useControllableOpen(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
  initial = false,
): readonly [boolean, (next: boolean) => void] {
  const [inner, setInner] = useState(initial);
  const isControlled = open !== undefined;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInner(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );
  return [isControlled ? open : inner, setOpen] as const;
}
