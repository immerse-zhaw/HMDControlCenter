import { Router } from "express";
import { listDevices, listApps, listFiles} from "../../integrations/managexr/operations.js";


export const infoRouter = Router();


infoRouter.get("/listDevices", async (req, res) => {
  try {
    const devices = await listDevices();
    res.json(devices);
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? "listDevices failed" });
  }
});


infoRouter.get("/listApps", async (req, res) => {
  try {
    const apps = await listApps();
    res.json(apps);
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? "listApps failed" });
  }
});


infoRouter.get("/listFiles", async (req, res) => {
  try {
    const files = await listFiles();
    res.json(files);
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? "listFiles failed" });
  }
});