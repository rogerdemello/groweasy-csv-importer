/**
 * Express application factory. Kept free of `listen()` and of Next.js so it can
 * be imported directly in tests and composed by the custom server.
 */

import express, { type Express } from "express";
import { importRouter } from "./routes/import";

export function buildApp(): Express {
  const app = express();

  // CSV row payloads can be large; allow generous JSON bodies.
  app.use(express.json({ limit: "25mb" }));

  app.use("/api", importRouter);

  return app;
}
