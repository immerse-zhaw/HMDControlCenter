import { Router } from "express";
import { appsRouter } from "./apps.js";
import { configRouter } from "./config.js";
import { infoRouter } from "./info.js";
import { streamRouter } from "./stream.js";
import { uploadRouter } from "./upload.js";


export const managexrRouter = Router();


managexrRouter.use("/apps", appsRouter);
managexrRouter.use("/config", configRouter);
managexrRouter.use("/info", infoRouter);
managexrRouter.use("/stream", streamRouter);
managexrRouter.use("/upload", uploadRouter);