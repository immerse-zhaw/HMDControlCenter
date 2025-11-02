import express, { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { storage } from '../../storage/index.js';
import { env } from '../../config/env.js';

const MAX_FILE_SIZE = env.MAX_UPLOAD_GB * 1024 ** 3;

export const assetsRouter = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-+]/g, "_");
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
});

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
  transcode?: {
    status: 'processing' | 'ready' | 'failed';
    variants?: { hls?: string; mp4?: string }; // type left intact; we just don't set hls
    error?: string;
    updatedAt: number;
  };
};

const ASSET_INDEX_KEY = 'assets/index.json';

/* ----------------------- ffmpeg helpers ----------------------- */

function tmpFile(ext: string) {
  return path.join(os.tmpdir(), `upload-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext.replace(/^\./,'')}`);
}

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
  });
}

async function ffprobeInfo(file: string): Promise<{
  vcodec?: string; acodec?: string; pix_fmt?: string;
}> {
  const v = await new Promise<string>((resolve) => {
    const p = spawn('ffprobe', ['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,pix_fmt','-of','json',file]);
    let out = ''; p.stdout.on('data', d => out += d.toString());
    p.on('close', () => resolve(out));
  });
  let vcodec, pix_fmt;
  try { const j = JSON.parse(v||'{}'); const s = j.streams?.[0]||{}; vcodec = s.codec_name; pix_fmt = s.pix_fmt; } catch {}

  const a = await new Promise<string>((resolve) => {
    const p = spawn('ffprobe', ['-v','error','-select_streams','a:0','-show_entries','stream=codec_name','-of','json',file]);
    let out = ''; p.stdout.on('data', d => out += d.toString());
    p.on('close', () => resolve(out));
  });
  let acodec; try { const j = JSON.parse(a||'{}'); acodec = j.streams?.[0]?.codec_name; } catch {}
  return { vcodec, acodec, pix_fmt };
}

/**
 * Produce Safari-friendly MP4 without loading whole files into RAM.
 * Streams are used for uploads; no fs.readFile* on large files.
 */
async function processVideoVariantsFromPath(id: string, inputPath: string, mime: string) {
  const metaKey = `assets/${id}/meta.json`;
  try {
    const info = await ffprobeInfo(inputPath);
    const vOk = info.vcodec === 'h264' && (info.pix_fmt === 'yuv420p' || !info.pix_fmt);
    const aOk = info.acodec === 'aac';

    const shouldTranscodeVideo = !vOk;
    const shouldTranscodeAudio = !aOk;

    const mp4Out = tmpFile('mp4');

    // --- MP4 universal (kept) ---
    const mp4Args: string[] = ['-y','-i',inputPath];
    if (!shouldTranscodeVideo && !shouldTranscodeAudio) {
      mp4Args.push('-c','copy');
    } else {
      if (shouldTranscodeVideo) {
        mp4Args.push('-vf','format=yuv420p','-c:v','libx264','-profile:v','main','-level:v','4.0','-preset','veryfast','-crf','20');
      } else {
        mp4Args.push('-c:v','copy');
      }
      if (shouldTranscodeAudio) {
        mp4Args.push('-c:a','aac','-b:a','128k','-ac','2','-ar','48000');
      } else {
        mp4Args.push('-c:a','copy');
      }
    }
    mp4Args.push('-movflags','+faststart', mp4Out);
    await run('ffmpeg', mp4Args);

    // Upload MP4 via stream
    await storage.put({
      key: `assets/${id}/mp4/universal.mp4`,
      contentType: 'video/mp4',
      body: fs.createReadStream(mp4Out),
    });

    const meta = await readJson<AssetMeta | null>(metaKey, null);
    if (meta) {
      meta.transcode = {
        status: 'ready',
        variants: {
          mp4: `/api/storage/assets/${id}/mp4/universal.mp4`,
          // hls intentionally omitted
        },
        updatedAt: Date.now(),
      };
      await writeJson(metaKey, meta);
    }

    // Cleanup temp outputs
    try { fs.unlinkSync(mp4Out); } catch {}
  } catch (e: any) {
    const meta = await readJson<AssetMeta | null>(metaKey, null);
    if (meta) {
      meta.transcode = { status: 'failed', error: String(e?.message || e), updatedAt: Date.now() };
      await writeJson(metaKey, meta);
    }
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
  }
}

/* ----------------------- routes ----------------------- */

assetsRouter.post('/upload', upload.single('file'), async (req, res) => {
  const type = req.body.type as 'glb' | 'video' | undefined;
  if (!req.file || !type) return res.status(400).json({ error: 'file + type required' });

  const { originalname, mimetype, path: tmpPath, size } = req.file as any;
  try {
    if (type === 'glb' && !/\.glb$/i.test(originalname)) return res.status(415).json({ error: 'GLB required' });
    if (type === 'video' && !/^video\//.test(mimetype) && !/quicktime|x-m4v/i.test(mimetype)) {
      return res.status(415).json({ error: 'Video file required' });
    }

    const id = crypto.randomUUID();
    const fileKey = `assets/${id}/file`;
    const metaKey = `assets/${id}/meta.json`;

    const hash = crypto.createHash('sha256');
    await new Promise<void>((resolve, reject) => {
      const rs = fs.createReadStream(tmpPath);
      rs.on('data', (chunk) => hash.update(chunk));
      rs.on('error', reject);
      rs.on('end', resolve);
    });

    await storage.put({
      key: fileKey,
      contentType: mimetype,
      body: fs.createReadStream(tmpPath),
    });

    const sha256 = hash.digest('hex');
    const meta: AssetMeta = {
      id, type,
      originalFilename: originalname,
      mime: mimetype,
      sizeBytes: size,
      sha256,
      ...(type === 'video' ? { transcode: { status: 'processing', updatedAt: Date.now() } } : {})
    };

    await writeJson(metaKey, meta);

    const index = await readJson<Record<string, Omit<AssetMeta, 'sha256'>>>(ASSET_INDEX_KEY, {});
    index[id] = { id, type, originalFilename: originalname, mime: mimetype, sizeBytes: size };
    await writeJson(ASSET_INDEX_KEY, index);

    // Kick off MP4 transcoding only
    if (type === 'video') {
      const transcodePath = tmpFile(path.extname(originalname) || 'bin');
      fs.copyFileSync(tmpPath, transcodePath);
      processVideoVariantsFromPath(id, transcodePath, mimetype).catch(() => {});
    }

    res.json({
      ...meta,
      streamUrl: `/api/storage/assets/${id}/stream`,
      downloadUrl: `/api/storage/assets/${id}/download`,
      // hlsUrl removed
      universalMp4Url: `/api/storage/assets/${id}/mp4/universal.mp4`,
    });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

assetsRouter.get('/listAssets', async (_req, res) => {
  const index = await readJson<Record<string, any>>(ASSET_INDEX_KEY, {});
  const items = await Promise.all(Object.values(index).map(async (a: any) => {
    const meta = await readJson<AssetMeta | null>(`assets/${a.id}/meta.json`, null);
    return {
      ...a,
      streamUrl: `/api/storage/assets/${a.id}/stream`,
      downloadUrl: `/api/storage/assets/${a.id}/download`,
      transcode: meta?.transcode
    };
  }));
  res.json(items);
});

assetsRouter.get('/:id', async (req, res) => {
  const meta = await readJson<AssetMeta | null>(`assets/${req.params.id}/meta.json`, null);
  if (!meta) return res.sendStatus(404);
  res.json({
    ...meta,
    streamUrl: `/api/storage/assets/${meta.id}/stream`,
    downloadUrl: `/api/storage/assets/${meta.id}/download`,
    transcode: meta.transcode
  });
});

/* ---- HEAD for quick size/mime ---- */
assetsRouter.head('/:id/download', async (req, res) => {
  const id = req.params.id;
  const meta = await readJson<AssetMeta | null>(`assets/${id}/meta.json`, null);
  if (!meta) return res.sendStatus(404);
  const fileKey = `assets/${id}/file`;
  if (!(await storage.exists(fileKey))) return res.sendStatus(404);

  const head = await storage.head(fileKey);
  const total = head?.contentLength ?? meta.sizeBytes;
  const isGlb = meta.type === 'glb';
  const contentType = isGlb ? 'model/gltf-binary' : (meta.mime || head?.contentType || 'application/octet-stream');

  res.setHeader('Content-Type', String(contentType));
  if (total) res.setHeader('Content-Length', String(total));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Encoding', 'identity');
  return res.status(200).end();
});

/* ---- Full download with Content-Length ---- */
assetsRouter.get('/:id/download', async (req, res) => {
  const id = req.params.id;
  const meta = await readJson<AssetMeta | null>(`assets/${id}/meta.json`, null);
  if (!meta) return res.sendStatus(404);
  const fileKey = `assets/${id}/file`;
  if (!(await storage.exists(fileKey))) return res.sendStatus(404);

  const head = await storage.head(fileKey);
  const total = head?.contentLength ?? meta.sizeBytes;
  const isGlb = meta.type === 'glb';
  const contentType = isGlb ? 'model/gltf-binary' : (meta.mime || head?.contentType || 'application/octet-stream');
  const filename = meta.originalFilename || (isGlb ? `${id}.glb` : id);

  res.setHeader('Content-Type', String(contentType));
  if (total) res.setHeader('Content-Length', String(total));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Encoding', 'identity');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  storage.getStream(fileKey).pipe(res);
});

/* ---- Range streaming (video & large files) ---- */
assetsRouter.get('/:id/stream', async (req, res) => {
  const id = req.params.id;
  const meta = await readJson<AssetMeta | null>(`assets/${id}/meta.json`, null);
  if (!meta) return res.sendStatus(404);

  const fileKey = `assets/${id}/file`;
  if (!(await storage.exists(fileKey))) return res.sendStatus(404);

  const head = await storage.head(fileKey);
  const total = head?.contentLength ?? meta.sizeBytes;

  const contentType = meta.mime || head?.contentType || 'application/octet-stream';
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', String(contentType));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Encoding', 'identity');

  const range = req.headers.range;
  if (!range) {
    if (total) res.setHeader('Content-Length', String(total));
    return storage.getStream(fileKey).pipe(res);
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(range as string);
  if (!m) {
    res.setHeader('Content-Range', `bytes */${total || '*'}`);
    return res.sendStatus(416);
  }
  const start = m[1] ? parseInt(m[1], 10) : 0;
  const end = m[2] ? parseInt(m[2], 10) : ((total ?? 1) - 1);
  if (total && (start >= total || end >= total || start > end)) {
    res.setHeader('Content-Range', `bytes */${total}`);
    return res.sendStatus(416);
  }

  const size = end - start + 1;
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${total ?? '*'}`);
  res.setHeader('Content-Length', String(size));
  storage.getStream(fileKey, { start, end }).pipe(res);
});

/* ---- Serve universal MP4 (when available) ---- */
assetsRouter.get('/:id/mp4/universal.mp4', async (req, res) => {
  const { id } = req.params as any;
  const key = `assets/${id}/mp4/universal.mp4`;
  if (!(await storage.exists(key))) return res.sendStatus(404);

  const head = await storage.head(key);
  const total = head?.contentLength ?? undefined;

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Encoding', 'identity');

  const range = req.headers.range;
  if (!range) {
    if (total) res.setHeader('Content-Length', String(total));
    const rs = storage.getStream(key);
    rs.on('error', () => { if (!res.headersSent) res.sendStatus(500); else res.destroy(); });
    return rs.pipe(res);
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(String(range));
  if (!m) {
    res.setHeader('Content-Range', `bytes */${total ?? '*'}`);
    return res.sendStatus(416);
  }

  const start = m[1] ? parseInt(m[1], 10) : 0;
  const end = m[2] ? parseInt(m[2], 10) : ((total ?? 1) - 1);

  if (total && (start >= total || end >= total || start > end)) {
    res.setHeader('Content-Range', `bytes */${total}`);
    return res.sendStatus(416);
  }

  const size = end - start + 1;
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${total ?? '*'}`);
  res.setHeader('Content-Length', String(size));

  const rs = storage.getStream(key, { start, end });
  rs.on('error', () => { if (!res.headersSent) res.sendStatus(500); else res.destroy(); });
  rs.pipe(res);
});

/* ---- Delete asset ---- */
assetsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const base = `assets/${id}`;

  if (!(await storage.exists(`${base}/meta.json`))) return res.sendStatus(404);

  await storage.deleteTree(base);

  try {
    const index = await readJson<Record<string, any>>(ASSET_INDEX_KEY, {});
    delete index[id];
    await writeJson(ASSET_INDEX_KEY, index);
  } catch { /* ignore index write errors */ }

  res.sendStatus(204);
});