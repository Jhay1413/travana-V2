import { createContext, useContext } from "react";

/** The overlay's guarded close (ignores while saving, confirms when dirty). Null outside a FormOverlay. */
export const FormOverlayCloseContext = createContext<(() => void) | null>(null);

/** Use for Cancel / X buttons inside a FormOverlay so they get the same "Discard changes?" guard as Escape. */
export function useFormOverlayClose(): (() => void) | null {
  return useContext(FormOverlayCloseContext);
}
