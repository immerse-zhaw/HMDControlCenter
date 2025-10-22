import { Router } from "express";
import multer from "multer";
import os from "node:os";
import { promises as fs } from "node:fs";
import { uploadFile, uploadApp } from "../integrations/managexr/operations.js";
import path from "node:path";

const storageKeepExact = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    cb(null, path.basename(file.originalname));
  },
});

const upload = multer({ storage: storageKeepExact });
export const managexrUploads = Router();

const clean = async (path: string) => {
    if (!path) {
        return;
    }
    try {
        await fs.unlink(path);
    } catch {}
};

managexrUploads.post("/upload/app", upload.single("apk"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Missing apk file" });
    }
    try {
        const out = await uploadApp(req.file.path, {
            title: req.body?.title,
            description: req.body?.description,
            version: req.body?.version,
        });
        res.json({ ok: true, output: out });
    } catch (e : any) {
        res.status(502).json({ error: e?.message ?? "Upload failed" });
    } finally {
        await clean(req.file.path);
    }
});

managexrUploads.post("/upload/file", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Missing file" });
    }
    try {
        const out = await uploadFile(req.file.path, {
        });
        res.json({ ok: true, output: out });
    } catch (e : any) {
        res.status(502).json({ error: e?.message ?? "Upload failed" });
    } finally {
        await clean(req.file.path);
    }
});