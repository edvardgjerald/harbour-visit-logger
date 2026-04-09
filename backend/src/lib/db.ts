import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { logger } from "./logger.js";

let prisma: PrismaClient;

/**
 * Returns a singleton PrismaClient backed by better-sqlite3.
 * The client is lazily initialised on first call.
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    const adapter = new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL || "file:./prisma/dev.db",
    });
    prisma = new PrismaClient({ adapter });
    logger.info("Prisma client initialized with better-sqlite3 adapter");
  }
  return prisma;
}

/** Gracefully disconnects the Prisma client during shutdown. */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info("Prisma client disconnected");
  }
}
