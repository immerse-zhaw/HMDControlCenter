import { spawn } from "node:child_process";
import { env } from "../../config/env.js";
import path from "node:path";

const CMD = process.env.MXR_CLI ?? "mxr-cli";

async function execCli(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(CMD, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
        let out = "", err = "";
        child.stdout.on("data", (data) => out += data.toString());
        child.stderr.on("data", (data) => err += data.toString());
        child.on("close", code => {
            if (code === 0) {
                resolve(out.trim());
            } else {
                reject(new Error(`${CMD} ${args.join(" ")}  → exit ${code}\n${(err || out).trim()}`));
            }
        });
    });
}

let checked = false;
export async function ensureCliAvailable() {
    if (checked) return;
    try {
        await execCli(["--version"]);
        checked = true;
    } catch (e) {
        throw new Error(
            `The ${CMD} command is not available. Please install the ManageXR CLI via: \n npm i -g @managexr/mxr-cli \n`
        );
    }
}

export async function getCliVersion(): Promise<string> {
    await ensureCliAvailable();
    const version = await execCli(["--version"]);
    return version;
}

export async function uploadApp(
    apkPath: string,
    options?: {
        title?: string,
        description?: string,
        version?: string,
    }
) {
    await ensureCliAvailable();
    const abs = path.resolve(apkPath);
    const args = ["upload-app", abs, "--api-key-file", env.MXR_KEY_PATH];
    if (options?.title) args.push("--title", options.title);
    if (options?.description) args.push("--description", options.description);
    if (options?.version) args.push("--version", options.version);
    return execCli(args);
}

export async function uploadFile(
    filePath: string,
    options?: {
        name?: string,
        description?: string,
    }
) {
    await ensureCliAvailable();
    const abs = path.resolve(filePath);
    const args = ["upload-file", abs, "--api-key-file", env.MXR_KEY_PATH];
    if (options?.name) args.push("--name", options.name);
    if (options?.description) args.push("--description", options.description);
    return execCli(args);
}