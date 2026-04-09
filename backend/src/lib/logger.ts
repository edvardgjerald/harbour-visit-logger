import pino from "pino";
import { config } from "../config.js";

/**
 * Application-wide Pino logger instance.
 * Uses `pino-pretty` for human-readable output in development,
 * and structured JSON in production.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    config.nodeEnv !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});
