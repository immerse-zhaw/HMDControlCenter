import { promises } from "node:fs";
import z from "zod";

const Key = z.object({
    id: z.string().min(1),
    secret: z.string().min(1),
});

export type ManageXRKey = z.infer<typeof Key>;

export async function loadManageXRKey(path: string): Promise<ManageXRKey> {
    const fileContent = JSON.parse(await promises.readFile(path, "utf-8"));
    return Key.parse(fileContent);
}

export function basicAuthHeader(key: ManageXRKey): string {
    const credentials = `${key.id}:${key.secret}`;
    const encodedCredentials = Buffer.from(credentials).toString("base64");
    return `Basic ${encodedCredentials}`;
}