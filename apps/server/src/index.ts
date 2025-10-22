import express from "express";
import { env } from "./config/env.js";
import { health } from "./routes/server.health.js";
import { assets } from "./routes/storage.assets.js";
import { managexrInfo } from "./routes/managexr.info.js";
import { managexrUploads } from "./routes/managexr.uploads.js";
import { managexrApps } from "./routes/managexr.apps.js";
import { managexrStream } from "./routes/managexr.stream.js";
import { managexrConfig } from "./routes/managexr.config.js";
import { clients } from "./routes/realtime.clients.js";
import { setupWebSocketServer } from "./realtime/websocket.js";

const app = express();
app.use(express.json());

app.use("/api/server", health);
app.use("/api/assets", assets);

app.use("/api/managexr", managexrInfo);
app.use("/api/managexr", managexrUploads);
app.use("/api/managexr", managexrApps);
app.use("/api/managexr", managexrStream);
app.use("/api/managexr", managexrConfig);

app.use("/api/realtime", clients);

const server = app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
});

setupWebSocketServer(server, env.REALTIME_WS_PATH);