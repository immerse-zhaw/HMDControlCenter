import fs from 'fs';
import {promises as fsp} from 'fs';
import path from 'path';
import { Storage, ByteRange, StorageHeader } from './types.js';

const ROOT = process.env.LOCAL_STORAGE_ROOT || './data';

async function ensureDir(dir: string) {
    await fsp.mkdir(dir, { recursive: true });
}

async function pathExists(p: string) {
    try {
        await fsp.access(p);
        return true;
    } catch {
        return false;
    }
}

export const localStorage: Storage = {
    async put({key, body}) {
        const absPath = path.join(ROOT, key);
        await ensureDir(path.dirname(absPath));

        const writeStream = fs.createWriteStream(absPath);
        const finished = new Promise<void>((resolve, reject) => {
            writeStream.on('finish', () => resolve());
            writeStream.on('error', reject);
        });
        
        if (Buffer.isBuffer(body)) {
            writeStream.end(body);
        } else {
            body.pipe(writeStream);
        }
        
        await finished;
        return { key };
    },

    getStream(key: string, range?: ByteRange) {
        const absPath = path.join(ROOT, key);
        if (!range || (range.start == null && range.end == null)) {
            return fs.createReadStream(absPath);
        }
        const stats = fs.statSync(absPath);
        const start = range.start ?? 0;
        const end = range.end ?? (stats.size - 1);
        return fs.createReadStream(absPath, { start, end });
    },
    
    async head(key: string): Promise<StorageHeader> {
        const absPath = path.join(ROOT, key);
        const stats = await fsp.stat(absPath);
        return {
            contentLength: stats.size,
            contentType: 'application/octet-stream',
        };
    },

    async exists(key: string): Promise<boolean> {
        const absPath = path.join(ROOT, key);
        return pathExists(absPath);
    },
};