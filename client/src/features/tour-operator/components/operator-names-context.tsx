import { createContext, useContext, useMemo, type ReactNode } from "react";
import { collectOperatorNames, type OperatorNames } from "../lib/operator-names";

const OperatorNamesContext = createContext<OperatorNames>({});

/** Supplies the saved record's operator names so a removed link still shows its real name. */
export function OperatorNamesProvider({ record, children }: { record: unknown; children: ReactNode }) {
  const names = useMemo(() => collectOperatorNames(record), [record]);
  return <OperatorNamesContext.Provider value={names}>{children}</OperatorNamesContext.Provider>;
}

export function useOperatorName(id: string | null | undefined): string | undefined {
  const names = useContext(OperatorNamesContext);
  return id ? names[id] : undefined;
}

export function useOperatorNames(): OperatorNames {
  return useContext(OperatorNamesContext);
}
