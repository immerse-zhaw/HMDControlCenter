import express, { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { storage } from '../../storage/index.js';
import { env } from '../../config/env.js';


const MAX_FILE_SIZE = env.MAX_UPLOAD_GB * 1024**3;


export const assetsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });


async function readJson<T>(key: string, fallback: T): Promise<T> {
  const exists = await storage.exists(key);
  if (!exists) return fallback;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    storage.getStream(key).on('data', (c) => chunks.push(c))
      .on('end', () => resolve())
      .on('error', reject);
  });
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T; }
  catch { return fallback; }
}


async function writeJson(key: string, data: any) {
  const body = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
  await storage.put({ key, contentType: 'application/json', body });
}


type AssetMeta = {
  id: string;
  type: 'glb' | 'video';
  originalFilename: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
};


type Job = {
  id: string;
  deviceId: string;
  assetId: string;
  action: 'download' | 'delete';
  status: 'queued' | 'in_progress' | 'done' | 'failed';
  progress: number;
};


const ASSET_INDEX_KEY = 'assets/index.json';
const JOBS_INDEX_KEY  = 'jobs/index.json';


assetsRouter.post('/upload', upload.single('file'), async (req, res) => {
  const type = req.body.type as 'glb' | 'video' | undefined;
  if (!req.file || !type) return res.status(400).json({ error: 'file + type required' });

  const { originalname, mimetype, buffer } = req.file;
  if (type === 'glb' && !/\.glb$/i.test(originalname)) return res.status(415).json({ error: 'GLB required' });
  if (type === 'video' && !/^video\//.test(mimetype)) return res.status(415).json({ error: 'Video file required' });

  const id = crypto.randomUUID();
  const fileKey = `assets/${id}/file`;
  const metaKey = `assets/${id}/meta.json`;

  await storage.put({ key: fileKey, contentType: mimetype, body: buffer });

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const meta: AssetMeta = {
    id, type,
    originalFilename: originalname,
    mime: mimetype,
    sizeBytes: buffer.length,
    sha256,
  };

  await writeJson(metaKey, meta);

  const index = await readJson<Record<string, Omit<AssetMeta, 'sha256'>>> (ASSET_INDEX_KEY, {});
  index[id] = { id, type, originalFilename: originalname, mime: mimetype, sizeBytes: buffer.length };
  await writeJson(ASSET_INDEX_KEY, index);

  res.json({ ...meta, streamUrl: `/api/storage/assets/${id}/stream`, downloadUrl: `/api/storage/assets/${id}/download` });
});


assetsRouter.get('/listAssets', async (_req, res) => {
  const index = await readJson<Record<string, any>>(ASSET_INDEX_KEY, {});
  const list = Object.values(index).map((a: any) => ({
    ...a,
    streamUrl: `/api/storage/assets/${a.id}/stream`,
    downloadUrl: `/api/storage/assets/${a.id}/download`,
  }));
  res.json(list);
});


assetsRouter.get('/:id', async (req, res) => {
  const meta = await readJson<AssetMeta | null>(`assets/${req.params.id}/meta.json`, null);
  if (!meta) return res.sendStatus(404);
  res.json({ ...meta, streamUrl: `/api/storage/assets/${meta.id}/stream`, downloadUrl: `/api/storage/assets/${meta.id}/download` });
});


assetsRouter.get('/:id/download', async (req, res) => {
  const id = req.params.id;
  const meta = await readJson<AssetMeta | null>(`assets/${id}/meta.json`, null);
  if (!meta) return res.sendStatus(404);
  const fileKey = `assets/${id}/file`;
  const exists = await storage.exists(fileKey);
  if (!exists) return res.sendStatus(404);

  res.setHeader('Content-Type', meta.mime || 'application/octet-stream');
  storage.getStream(fileKey).pipe(res);
});


assetsRouter.get('/:id/stream', async (req, res) => {
  const id = req.params.id;
  const meta = await readJson<AssetMeta | null>(`assets/${id}/meta.json`, null);
  if (!meta) return res.sendStatus(404);

  const fileKey = `assets/${id}/file`;
  const exists = await storage.exists(fileKey);
  if (!exists) return res.sendStatus(404);

  const head = await storage.head(fileKey);
  const total = head.contentLength;

  const contentType = meta.mime || head.contentType || 'application/octet-stream';
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', String(contentType));

  const range = req.headers.range;
  if (!range) {
    res.setHeader('Content-Length', String(total));
    return storage.getStream(fileKey).pipe(res);
  }

  const [s, e] = range.replace('bytes=', '').split('-');
  const start = parseInt(s, 10);
  const end = e ? parseInt(e, 10) : total - 1;
  const size = end - start + 1;

  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
  res.setHeader('Content-Length', String(size));
  storage.getStream(fileKey, { start, end }).pipe(res);
});


assetsRouter.post('/devices/:deviceId/jobs', express.json(), async (req, res) => {
  const { deviceId } = req.params;
  const { assetId, action } = req.body as { assetId: string; action: 'download' | 'delete' };

  const jobs = await readJson<Job[]>(JOBS_INDEX_KEY, []);
  const job: Job = { id: crypto.randomUUID(), deviceId, assetId, action, status: 'queued', progress: 0 };
  jobs.push(job);
  await writeJson(JOBS_INDEX_KEY, jobs);

  res.json(job);
});


assetsRouter.get('/devices/:deviceId/jobs/next', async (req, res) => {
  const { deviceId } = req.params;
  const jobs = await readJson<Job[]>(JOBS_INDEX_KEY, []);
  const job = jobs.find(j => j.deviceId === deviceId && j.status === 'queued');
  if (!job) return res.json({ job: null });

  const meta = await readJson<AssetMeta | null>(`assets/${job.assetId}/meta.json`, null);
  if (!meta) return res.json({ job: null });

  const downloadUrl = meta.type === 'video'
    ? `/api/storage/assets/${meta.id}/stream`
    : `/api/storage/assets/${meta.id}/download`;

  res.json({
    job: {
      id: job.id,
      action: job.action,
      asset: {
        id: meta.id,
        type: meta.type,
        filename: meta.originalFilename,
        size: meta.sizeBytes,
        sha256: meta.sha256,
        downloadUrl
      }
    }
  });
});


assetsRouter.post('/devices/:deviceId/jobs/:jobId/progress', express.json(), async (req, res) => {
  const { jobId } = req.params;
  const { progress } = req.body as { progress: number };
  const jobs = await readJson<Job[]>(JOBS_INDEX_KEY, []);
  const j = jobs.find(x => x.id === jobId);
  if (j) { j.status = 'in_progress'; j.progress = Number(progress || 0); await writeJson(JOBS_INDEX_KEY, jobs); }
  res.json({ ok: true });
});


assetsRouter.post('/devices/:deviceId/jobs/:jobId/complete', express.json(), async (req, res) => {
  const { jobId } = req.params;
  const { success } = req.body as { success: boolean };
  const jobs = await readJson<Job[]>(JOBS_INDEX_KEY, []);
  const j = jobs.find(x => x.id === jobId);
  if (j) { j.status = success ? 'done' : 'failed'; j.progress = 100; await writeJson(JOBS_INDEX_KEY, jobs); }
  res.json({ ok: true });
});