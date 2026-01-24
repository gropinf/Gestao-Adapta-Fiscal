import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeStorageDirectories } from "./fileStorage";
import { storage } from "./storage";
import { checkAllActiveMonitors } from "./emailMonitorService";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Inicializa os diretórios de storage
  log("Inicializando sistema de storage...");
  await initializeStorageDirectories();
  log("Sistema de storage inicializado ✅");

  const server = await registerRoutes(app);
  let isEmailMonitorRunning = false;

  const runEmailMonitorCycle = async () => {
    if (isEmailMonitorRunning) {
      log("[IMAP Monitor] Execução já em andamento, ignorando.");
      return;
    }

    isEmailMonitorRunning = true;
    try {
      const scheduleSettings = await storage.getEmailMonitorScheduleSettings();
      if (scheduleSettings && scheduleSettings.enabled === false) {
        log("[IMAP Monitor] Agendamento desativado. Execução ignorada.");
        return;
      }

      const admins = await storage.getUsersByRole("admin");
      const adminUserId = admins[0]?.id;
      if (!adminUserId) {
        log("[IMAP Monitor] Nenhum admin encontrado para executar monitoramento.");
        return;
      }

      const result = await checkAllActiveMonitors(adminUserId, "cron");
      const failures = result.results
        .filter((item) => !item.success || item.errors.length > 0)
        .map((item) => ({
          monitorId: item.monitorId,
          email: item.monitorEmail,
          success: item.success,
          message: item.message,
          errors: item.errors,
        }));
      await storage.logAction({
        userId: adminUserId,
        action: "email_monitor_schedule_run",
        details: JSON.stringify({
          totalMonitors: result.totalMonitors,
          executed: result.executed,
          skipped: result.skipped,
          successful: result.successful,
          failed: result.failed,
          failures,
        }),
      });
    } catch (error) {
      console.error("[IMAP Monitor] Erro na execução automática:", error);
      try {
        const admins = await storage.getUsersByRole("admin");
        const adminUserId = admins[0]?.id;
        if (adminUserId) {
          await storage.logAction({
            userId: adminUserId,
            action: "email_monitor_schedule_run",
            details: JSON.stringify({
              error: error instanceof Error ? error.message : "Erro desconhecido",
              stack: error instanceof Error ? error.stack : undefined,
            }),
          });
        }
      } catch (logError) {
        console.error("[IMAP Monitor] Falha ao registrar erro do agendamento:", logError);
      }
    } finally {
      isEmailMonitorRunning = false;
    }
  };

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";

    res.status(status).json({ message });
    if (err) {
      console.error("Unhandled server error:", err);
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    const intervalMinutes = Number(
      process.env.EMAIL_MONITOR_SCHEDULE_MINUTES ||
      process.env.EMAIL_MONITOR_INTERVAL_MINUTES ||
      5
    );
    const intervalMs = Math.max(intervalMinutes, 5) * 60 * 1000;
    log(`[IMAP Monitor] Agendado para executar a cada ${intervalMinutes} minutos.`);
    setTimeout(runEmailMonitorCycle, 60 * 1000);
    setInterval(runEmailMonitorCycle, intervalMs);
  });
})();
