// Legacy (v1) import path. Re-exports the single shared pool so v1 and v2 code
// never run two competing connection pools against the database.
export { db, pool } from "../v2/config/database";
