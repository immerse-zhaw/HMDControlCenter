import { Router } from "express";

export const health = Router();

health.get("/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});