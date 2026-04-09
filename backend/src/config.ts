/**
 * Validated environment configuration.
 * Loads variables from the root `.env` file and validates them with Zod.
 * The process exits immediately if any required variables are missing.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AISSTREAM_API_KEY: z
    .string()
    .min(1, "AISSTREAM_API_KEY is required and cannot be empty"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Fatal Error: Invalid environment variables.");
  console.error(parsedEnv.error.issues);
  process.exit(1);
}

const env = parsedEnv.data;

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  aisstream: {
    apiKey: env.AISSTREAM_API_KEY,
    url: "wss://stream.aisstream.io/v0/stream",
    boundingBox: [
      [
        [59.5, 10.3],
        [60.0, 10.8],
      ],
    ],
    reconnectBaseMs: 1000,
    reconnectMaxMs: 30000,
  },
  ws: {
    heartbeatIntervalMs: 30000,
    path: "/ws",
  },
  visitBatcher: {
    flushIntervalMs: 5000,
    maxBatchSize: 50,
  },
} as const;
