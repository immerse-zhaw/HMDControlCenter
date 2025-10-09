import express from "express";
import { env } from "./config/env.js";
import { listDevices, listApps, listFiles } from "./integrations/managexr/operations.js";
import { managexrUploads } from "./routes/managexr.uploads.js";
import { managexrApps } from "./routes/managexr.apps.js";
import { updateConfig } from "./integrations/managexr/deploy.js";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/devices", async (_req, res) => {
    try {
        const devices = await listDevices();
        res.json(devices);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        res.status(502).json({ error: msg });
    }
});

app.get("/api/apps", async (_req, res) => {
    try {
        const apps = await listApps();
        res.json(apps);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        res.status(502).json({ error: msg });
    }
});

app.get("/api/files", async (_req, res) => {
    try {
        const files = await listFiles();
        res.json(files);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        res.status(502).json({ error: msg });
    }
});

app.use("/api/managexr", managexrUploads);
app.use("/api/managexr", managexrApps);

app.use("/api/managexr", updateConfig);


app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
});