import express, { type Request, Response, NextFunction } from "express";
import { serveStatic } from "./static";
import { createServer } from "http";
import routes from "./routes/index";
import { setupAuth, registerAuthRoutes } from "./middlewares/auth";
import { errorHandler } from "./middlewares/error.middleware";
import { taskRepository } from "./modules/task/task.repository";
import { checkStaleTickets } from "./modules/ticket/ticket-notification.service";
import { runDaysBeforeDepartureSweep } from "./modules/sms/sms.cron";
import quotePublicRoutes from "./modules/quote/quote-public.routes";
import websitePublicRoutes from "./modules/website-public/website-public.routes";
import portalRoutes, { portalStaffRouter } from "./modules/portal/portal.routes";
import cron from "node-cron";

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
  app.use("/api/public/quote", quotePublicRoutes);
  app.use("/api/public/website", websitePublicRoutes);
  app.use("/api/portal", portalRoutes);

  // Facebook webhook & callback must be public (Facebook calls these directly)
  const { Router } = await import("express");
  const { facebookController } = await import("./modules/facebook/facebook.controller");
  const fbPublicRouter = Router();
  fbPublicRouter.get("/webhook", facebookController.verifyWebhook);
  fbPublicRouter.post("/webhook", facebookController.receiveWebhook);
  fbPublicRouter.get("/callback", facebookController.callback);
  app.use("/api/facebook", fbPublicRouter);

  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/api/portal", portalStaffRouter);

  app.use("/api", routes);

  const path = await import("path");
  app.use("/avatars", express.static(path.default.join(process.cwd(), "public", "avatars")));
  app.use("/uploads", express.static(path.default.join(process.cwd(), "public", "uploads")));
  app.use("/mockup-previews", express.static(path.default.join(process.cwd(), "public", "mockup-previews")));
  app.get(/^\/mockup-previews\/sandbox(\/.*)?$/, (_req, res) => {
    res.sendFile(path.default.join(process.cwd(), "public", "mockup-previews", "sandbox", "index.html"));
  });
  app.get("/privacy-policy", (_req, res) => res.sendFile(path.default.join(process.cwd(), "public", "privacy-policy.html")));
  app.get("/data-deletion", (_req, res) => res.sendFile(path.default.join(process.cwd(), "public", "privacy-policy.html")));

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

      // Every 30 minutes: check due tasks and stale tickets. Runs on a cron
      // schedule (not a 60s setInterval) so the DB can scale to zero when idle.
      cron.schedule("*/30 * * * *", async () => {
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
      });

      // 09:00 UTC daily: fire SMS templates with autoTrigger='days_before_departure'
      // for bookings whose travel_date matches today + triggerDaysBefore.
      cron.schedule("0 9 * * *", async () => {
        try {
          const summary = await runDaysBeforeDepartureSweep();
          log(`[sms.cron] days-before-departure: ${JSON.stringify(summary)}`);
        } catch (err) {
          console.error("Days-before-departure SMS cron failed:", err);
        }
      });
    },
  );
})();
