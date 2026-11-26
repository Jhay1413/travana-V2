import type { RequestHandler } from "express";
import { isQuoteTokenPath, maskQuoteTokenPath } from "../utils/log-mask";

/**
 * The global API request log (one line per /api request: method, path, status, duration, and the first 500
 * characters of a JSON answer). A router that can return credentials or personal data marks the response with
 * `noResponseLog` (res.locals.skipResponseLog) and its body is never printed. Request bodies are never logged.
 */
export function createRequestLogger(write: (line: string) => void): RequestHandler {
  return (req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: unknown;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        // A quote share token is a credential: log it masked, and never log the quote body behind it.
        let logLine = `${req.method} ${maskQuoteTokenPath(path)} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse && res.locals.skipResponseLog !== true && !isQuoteTokenPath(path)) {
          const responseStr = JSON.stringify(capturedJsonResponse);
          logLine += ` :: ${responseStr.length > 500 ? responseStr.slice(0, 500) + "...[truncated]" : responseStr}`;
        }
        write(logLine);
      }
    });

    next();
  };
}
