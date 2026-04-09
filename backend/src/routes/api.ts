import { Router } from "express";
import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { HARBOUR_ZONES } from "@vessel/shared";
import { logger } from "../lib/logger.js";

/** Creates the Express router for REST API endpoints. */
export function createApiRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Health Check
  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // List Visits (paginated)
  router.get("/visits", async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(req.query.pageSize as string) || 20)
      );
      const skip = (page - 1) * pageSize;

      const [visits, total] = await Promise.all([
        prisma.harbourVisit.findMany({
          skip,
          take: pageSize,
          orderBy: { timestamp: "desc" },
        }),
        prisma.harbourVisit.count(),
      ]);

      res.json({
        visits: visits.map((v) => ({
          ...v,
          zoneName: HARBOUR_ZONES.find((z) => z.id === v.zoneId)?.name || v.zoneId,
          timestamp: v.timestamp.toISOString(),
        })),
        total,
        page,
        pageSize,
      });
    } catch (err) {
      logger.error({ err }, "Failed to fetch visits");
      res.status(500).json({ error: "Failed to fetch visits" });
    }
  });

  // List Hardcoded Zones
  router.get("/zones", (_req: Request, res: Response) => {
    res.json(HARBOUR_ZONES);
  });

  return router;
}
