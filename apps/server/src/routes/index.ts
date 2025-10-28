import { Router } from "express";
import { serverRouter } from "./server/index.js";
import { storageRouter } from "./storage/index.js";
import { managexrRouter } from "./managexr/index.js";
import { realtimeRouter } from "./realtime/index.js";


export const apiRouter = Router();


apiRouter.use("/server", serverRouter);
apiRouter.use("/storage", storageRouter);
apiRouter.use("/managexr", managexrRouter);
apiRouter.use("/realtime", realtimeRouter);