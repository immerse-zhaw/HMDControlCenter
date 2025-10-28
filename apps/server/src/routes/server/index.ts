import { Router } from "express";


export const serverRouter = Router();


serverRouter.get("/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});