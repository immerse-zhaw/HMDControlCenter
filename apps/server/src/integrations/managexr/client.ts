import { env } from "../../config/env.js";
import { loadManageXRKey, basicAuthHeader } from "../../config/managexrKey.js";


let authHeaderPromise: Promise<string> | null = null;
async function getAuthHeader(): Promise<string> {
    if (!authHeaderPromise) {
        authHeaderPromise = loadManageXRKey(env.MXR_KEY_PATH).then(basicAuthHeader);
    }
    return authHeaderPromise;
}


export async function manageXR<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", 
    path: string, 
    json?: unknown
): Promise<T> {
    const url = new URL(env.API_VERSION + path, env.API).toString();

    const headers: Record<string, string> = { Authorization: await getAuthHeader() };
    if (json !== undefined) headers["Content-Type"] = "application/json";

    const options: RequestInit = {
        method,
        headers,
        body: json !== undefined ? JSON.stringify(json) : undefined
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
              let detail = "";
              try { detail = await response.text(); } catch {}
              throw new Error(`MXR ${method} ${path} → ${response.status} ${response.statusText} :: ${detail}`);
        }
        const ct = response.headers.get("content-type") || "";
        return ct.includes("application/json") ? await response.json() as T : undefined as unknown as T;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`[managexr] ${msg}`);
    }
}