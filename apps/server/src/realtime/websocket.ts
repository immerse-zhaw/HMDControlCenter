import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { addClient, removeClient } from "./clientRegistry.js";

export function setupWebSocketServer(httpServer: Server, path: string) {
    const wss = new WebSocketServer({ server: httpServer, path });

    wss.on("connection", (ws: WebSocket, req) => {
        const origin = req.headers.origin;

        ws.send(JSON.stringify({ type: "welcome", serverTime: Date.now() }));

        let deviceId: string;

        ws.on("message", (message) => {
            let msg: any;
            try {
                msg = JSON.parse(message.toString());
            } catch {
                ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
                return;
            }

            switch (msg.type) {
                case "hello":
                    deviceId = msg.device?.androidId || `unknown-${Math.random().toString(36).slice(2)}`;
                    addClient({
                        id: deviceId,
                        model: msg.device?.model,
                        app: msg.app?.name,
                        version: msg.app?.version,
                        connectedAt: Date.now(),
                        ws,
                    });
                    console.log(`Device connected: ${deviceId} (${msg.device?.model})`);
                    ws.send(JSON.stringify({ type: "helloAck"}));
                    break;
                case "ping":
                    ws.send(JSON.stringify({ type: "pong"}));
                    break;
                default:
                    console.log("Unknown message type:", msg.type, msg.body);
                    break;
                }
        });
        
        ws.on("close", () => {
            if (deviceId) {
                removeClient(deviceId, ws);
                console.log(`Device disconnected: ${deviceId}`);
            }
        });
    });

    console.log("WebSocket listening on path:", path);
    return wss;
}