import { Router } from "express";
import { listClients, getClient } from "../../realtime/clientRegistry.js";
import { WebSocket } from "ws";


export const clientsRouter = Router();


clientsRouter.get("/listClients", (req, res) => {
    res.json({ devices: listClients() });
});


clientsRouter.post("/:deviceId/command", (req, res) => {
  const { deviceId } = req.params;
  const client = getClient(deviceId);
  if (!client || client.ws.readyState !== WebSocket.OPEN) {
    return res.status(404).json({ ok: false, error: "Device not connected" });
  }
  if (req.body == null) {
    return res.status(400).json({ ok: false, error: "Missing command body" });
  }
  try {
    client.ws.send(JSON.stringify(req.body));
    return res.status(204).end();
  } catch (err: any) {
    return res.status(502).json({ ok: false, error: err?.message ?? "Send failed" });
  }
});