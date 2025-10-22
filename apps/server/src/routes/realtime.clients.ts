import { Router } from "express";
import { listClients, getClient } from "../realtime/clientRegistry.js";

export const clients = Router();

clients.get("/", (req, res) => {
    res.json({ devices: listClients() });
});

clients.post("/:deviceId/command", (req, res) => {
    const { deviceId } = req.params;
    const client = getClient(deviceId);
    if (!client || client.ws.readyState !== client.ws.OPEN) {
        return res.status(404).json({ ok: false, error: "Device not connected" });
    }
    client.ws.send(JSON.stringify(req.body));
    res.json({ ok: true });
});