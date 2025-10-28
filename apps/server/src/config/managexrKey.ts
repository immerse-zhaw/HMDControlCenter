import { promises } from "node:fs";
import { z } from "zod";


const Key = z.object({
    id: z.string().min(1),
    secret: z.string().min(1),
});

export type ManageXRKey = z.infer<typeof Key>;


let cachedKey: ManageXRKey | null = null;
export async function loadManageXRKey(path: string): Promise<ManageXRKey> {
    if (cachedKey) return cachedKey;

    let txt: string;
    try {
        txt = await promises.readFile(path, "utf-8");
    } catch (e: any) {
        throw new Error(`Failed to read ManageXR key file at ${path}: ${(e as Error).message}`);
    }

    let json: unknown;
    try {
        json = JSON.parse(txt);
    } catch (e: any) {
        throw new Error(`Failed to parse ManageXR key file at ${path} as JSON: ${(e as Error).message}`);
    }
    cachedKey = Key.parse(json);
    return cachedKey;
}


export function basicAuthHeader(key: ManageXRKey): string {
    const credentials = `${key.id}:${key.secret}`;
    const encodedCredentials = Buffer.from(credentials).toString("base64");
    return `Basic ${encodedCredentials}`;
}