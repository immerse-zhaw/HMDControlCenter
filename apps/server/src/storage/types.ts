export interface ByteRange {
    start?: number;
    end?: number;
}

export interface StorageHeader {
    contentLength: number;
    contentType?: string;
}

export interface Storage {
    put(opts: {
        key: string;
        contentType: string;
        body: Buffer | NodeJS.ReadableStream;
        cacheControl?: string;
    }): Promise<{ key: string }>;
    getStream(key: string, range?: ByteRange): NodeJS.ReadableStream;
    head(key: string): Promise<StorageHeader | null>;
    exists(key: string): Promise<boolean>;
    delete(key: string): Promise<void>;
    deleteTree(prefix: string): Promise<void>;
}
