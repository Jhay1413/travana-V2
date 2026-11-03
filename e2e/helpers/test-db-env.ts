/**
 * Import this FIRST in any module that pulls in server/v2/config/database (it reads
 * DATABASE_URL when it is imported). Pins the connection to the disposable test
 * database, after the safety guard has approved it.
 */
import { TEST_DATABASE_URL } from "./env";
import { assertSafeDatabaseUrl } from "./safety-guard";

assertSafeDatabaseUrl(TEST_DATABASE_URL, "TEST_DATABASE_URL");
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NEON_DATABASE_URL = TEST_DATABASE_URL;

export {};
