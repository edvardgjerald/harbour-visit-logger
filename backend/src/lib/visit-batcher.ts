import type { PrismaClient } from "@prisma/client";
import { config } from "../config.js";
import { logger } from "./logger.js";

interface PendingVisit {
  mmsi: number;
  vesselName: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  zoneId: string;
}

/**
 * Batches harbour visits and flushes to SQLite periodically
 * to prevent write-lock contention.
 */
export class VisitBatcher {
  private queue: PendingVisit[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private prisma: PrismaClient;
  private recentKeys = new Set<string>();
  private readonly DEDUP_WINDOW_MS = 60_000;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /** Starts the periodic flush timer. */
  start(): void {
    this.flushTimer = setInterval(
      () => this.flush(),
      config.visitBatcher.flushIntervalMs
    );
    logger.info(
      { intervalMs: config.visitBatcher.flushIntervalMs },
      "Visit batcher started"
    );
  }

  /** Stops the flush timer and flushes any remaining queued visits. */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  /**
   * Queues a visit for batch writing.
   * Visits from the same vessel+zone are deduplicated within a 60-second window.
   */
  add(visit: PendingVisit): void {
    const key = `${visit.mmsi}:${visit.zoneId}`;
    if (this.recentKeys.has(key)) return;

    this.recentKeys.add(key);
    setTimeout(() => this.recentKeys.delete(key), this.DEDUP_WINDOW_MS);

    this.queue.push(visit);
    if (this.queue.length >= config.visitBatcher.maxBatchSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, config.visitBatcher.maxBatchSize);
    logger.debug({ count: batch.length }, "Flushing visit batch");

    try {
      await this.prisma.$transaction(
        batch.map((b) =>
          this.prisma.harbourVisit.upsert({
            where: { mmsi_zoneId: { mmsi: b.mmsi, zoneId: b.zoneId } },
            update: {
              vesselName: b.vesselName,
              latitude: b.latitude,
              longitude: b.longitude,
              speed: b.speed,
              heading: b.heading,
            },
            create: {
              mmsi: b.mmsi,
              vesselName: b.vesselName,
              latitude: b.latitude,
              longitude: b.longitude,
              speed: b.speed,
              heading: b.heading,
              zoneId: b.zoneId,
            },
          })
        )
      );
      logger.debug({ count: batch.length }, "Visit batch written");
    } catch (err) {
      logger.error({ err, count: batch.length }, "Visit batch write failed — re-queuing");
      this.queue.unshift(...batch);
    }
  }
}
