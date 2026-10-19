// Public surface of the admin dashboard feature.
export { AdminDashboard } from "./components/admin-dashboard";
export { CommissionChart } from "./components/commission-chart";
export type { ChartMonth, MonthKind } from "./lib/chart-model";
export { StatusPill } from "./components/shared/pills";
export type { PillTone } from "./components/shared/pills";
export { AdminProgress, CardHead, CardNote, CARD_BUTTON } from "./components/shared/bits";
export { gbp, gbp2, plural } from "./lib/money";
export { BENCHMARK_COMMISSION_RATE, rateBarPct, viewsSub } from "./lib/health-copy";
