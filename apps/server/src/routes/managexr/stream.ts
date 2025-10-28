import { Router } from "express";
import { manageXR } from "../../integrations/managexr/client.js";


export const streamRouter = Router();


streamRouter.post("/streamingToken", async (req, res) => {
  try {
    const { deviceId } = req.body ?? {};
    if (!deviceId) return res.status(400).json({ error: "deviceId required" });

    const out = await manageXR<{ token: string }>(
      "POST",
      "/devices/generate-streaming-sdk-token",
      { deviceIds: [deviceId] }
    );

    res.json({ token: out.token });
  } catch (e: any) {
    console.error("Failed to create stream token", e);
    res.status(502).json({ error: e?.message ?? "failed to create stream token" });
  }
});