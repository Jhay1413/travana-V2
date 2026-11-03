// Path import on purpose (the admin-dashboard index pulls in recharts, which node tests cannot load).
// Money and counting helpers shared with the Admin Dashboard so both pages format alike.
export { gbp, gbp2, plural } from "@/features/admin-dashboard/lib/money";
