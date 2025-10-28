import { Router } from "express";
import { manageXR } from "../../integrations/managexr/client.js";
import { launchAppOnAllDevices } from "../../integrations/managexr/operations.js";
import { env } from "../../config/env.js";


export const appsRouter = Router();


appsRouter.delete("/:packageName", async (req, res) => {
  const pkg = req.params.packageName;
  if (!pkg) return res.status(400).json({ error: "Missing packageName" });

  try {
    await manageXR("DELETE", `/apps/${encodeURIComponent(pkg)}?type=managed`);
    res.json({ ok: true, packageName: pkg });
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? "Delete failed" });
  }
});


appsRouter.post("/launch-all", async (req, res) => {
  try {
    const { packageName, launchParams } = req.body ?? {};
    if (!packageName) return res.status(400).json({ error: "packageName required" });

    await launchAppOnAllDevices(packageName, launchParams);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? "launch-all failed" });
  }
});


appsRouter.post("/home-all", async (req, res) => {
  try {
    await launchAppOnAllDevices(env.MXR_HOME_APP_ID, {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? "home-all failed" });
  }
});