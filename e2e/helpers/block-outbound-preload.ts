/** `--import` entry: installs the outbound block, then proves it works by refusing a canary connection. */
import fs from "node:fs";
import path from "node:path";
import { installOutboundBlock, runCanary } from "./block-outbound";

const logFile = process.env.E2E_OUTBOUND_LOG;
const canaryFile = process.env.E2E_OUTBOUND_CANARY;
if (!logFile || !canaryFile) throw new Error("[e2e outbound block] E2E_OUTBOUND_LOG / E2E_OUTBOUND_CANARY are not set; refusing to start without the block");
installOutboundBlock({ logFile });
console.log("[e2e outbound block] active: only loopback connections are allowed");

// The result goes to its own file, never to the violation log, so a healthy canary is not a failure.
void runCanary().then((result) => {
  fs.mkdirSync(path.dirname(canaryFile), { recursive: true });
  fs.writeFileSync(canaryFile, JSON.stringify(result));
  console.log(`[e2e outbound block] canary ${result.refused ? "refused as expected" : "WAS NOT REFUSED"}`);
});
