import { listApps, listFiles } from "./operations.js";
import { Router } from "express";
import { env } from "process";
import { manageXR } from "./client.js";

const DEFAULT_CONFIG_ID = env.MXR_DEFAULT_CONFIG_ID;
export const updateConfig = Router();

async function patchConfig(body: any) {
    console.log("vrContent =", JSON.stringify(body, null, 2));

    const r = await manageXR<{ data: any}>("PATCH", `/v1/configurations/${DEFAULT_CONFIG_ID}`, body);
    return r.data;
}

updateConfig.post("/updateConfig", async (_req, res) => {
    try {
        const [apps, files] = await Promise.all([listApps(), listFiles()]);
        
        const vrContent = apps.map(a => ({ type: "app", id: { packageName: a.id, version: "latest" } }));
        const filesContent = files.map(f => ({id: f.id, deviceDirectoryPaths:["/"] }));
        await patchConfig({
            files: filesContent,
            vrContent,
        });
        res.json({ ok: true });
    } catch (e : any) {
        res.status(502).json({ error: e?.message ?? "Update failed" });
    }
});