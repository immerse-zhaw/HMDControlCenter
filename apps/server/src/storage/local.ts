import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { Storage, ByteRange, StorageHeader } from './types.js';
import { env } from '../config/env.js';

const ROOT = path.resolve(env.LOCAL_STORAGE_ROOT);

function safeJoin(root: string, key: string) {
  const p = path.resolve(root, key.replace(/^(\.\.(\/|\\|$))+/, "")); // strip leading ../
  if (!p.startsWith(root + path.sep) && p !== root) {
    throw new Error("Invalid storage key");
  }
  return p;
}

async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
}

async function pathExists(p: string) {
  try { await fsp.access(p); return true; } catch { return false; }
}

export const localStorage: Storage = {
  async put({ key, body /*, contentType, cacheControl */ }) {
    const absPath = safeJoin(ROOT, key);
    await ensureDir(path.dirname(absPath));

    const writeStream = fs.createWriteStream(absPath);
    const finished = new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    if (Buffer.isBuffer(body)) writeStream.end(body);
    else body.pipe(writeStream);

    await finished;
    return { key };
  },

  getStream(key: string, range?: ByteRange) {
    const absPath = safeJoin(ROOT, key);
    if (!range || (range.start == null && range.end == null)) {
      return fs.createReadStream(absPath);
    }
    const stats = fs.statSync(absPath);
    const start = range.start ?? 0;
    const end = range.end ?? (stats.size - 1);
    return fs.createReadStream(absPath, { start, end });
  },

  async head(key: string): Promise<StorageHeader | null> {
    const absPath = safeJoin(ROOT, key);
    try {
      const stats = await fsp.stat(absPath);
      return {
        contentLength: stats.size,
        contentType: 'application/octet-stream', // router prefers meta.mime anyway
      };
    } catch (e: any) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  },

  async exists(key: string): Promise<boolean> {
    const absPath = safeJoin(ROOT, key);
    return pathExists(absPath);
  },

  async delete(key: string): Promise<void> {
    const absPath = safeJoin(ROOT, key);
    try {
      const stats = await fsp.stat(absPath);
      if (stats.isDirectory()) {
        await fsp.rm(absPath, { recursive: true, force: true });
      } else {
        await fsp.unlink(absPath);
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  },

  async deleteTree(prefix: string): Promise<void> {
    const absPath = safeJoin(ROOT, prefix);
    try {
      await fsp.rm(absPath, { recursive: true, force: true });
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  },
};
