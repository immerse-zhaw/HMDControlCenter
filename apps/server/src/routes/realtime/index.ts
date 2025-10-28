import { Router } from "express";
import { clientsRouter } from "./clients.js";


export const realtimeRouter = Router();


realtimeRouter.use("/clients", clientsRouter);