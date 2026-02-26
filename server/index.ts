import express, { type Request, Response, NextFunction } from "express";
import { serveStatic } from "./static";
import { createServer } from "http";
import routes from "./routes/index";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { errorHandler } from "./middlewares/error.middleware";
import { taskRepository } from "./repositories/task.repository";
import { checkStaleTickets } from "./services/ticket-notification.service";
import { pool } from "./config/database";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const responseStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${responseStr.length > 500 ? responseStr.slice(0, 500) + "...[truncated]" : responseStr}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await pool.query(`ALTER TABLE quote_table ADD COLUMN IF NOT EXISTS price_per_person NUMERIC(10,2) NOT NULL DEFAULT 0.00`);
    await pool.query(`ALTER TABLE booking_table ADD COLUMN IF NOT EXISTS price_per_person NUMERIC(10,2) NOT NULL DEFAULT 0.00`);
    log("Schema migration: price_per_person columns ensured");
  } catch (err) {
    console.error("Schema migration failed:", err);
  }

  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/api", routes);

  const path = await import("path");
  app.use("/avatars", express.static(path.default.join(process.cwd(), "public", "avatars")));

  app.use(errorHandler);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      setInterval(async () => {
        try {
          await taskRepository.checkAndNotifyDueTasks();
        } catch (err) {
          console.error("Task notification check failed:", err);
        }
        try {
          await checkStaleTickets();
        } catch (err) {
          console.error("Ticket notification check failed:", err);
        }
      }, 60_000);
    },
  );
})();
