import { Router } from "express";
import { assetsRouter } from "./assets.js";


export const storageRouter = Router();


storageRouter.use("/assets", assetsRouter);