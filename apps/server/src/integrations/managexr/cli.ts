import { spawn } from "node:child_process";
import { env } from "../../config/env.js";

export async function execCli(args: string[]): Promise<string> {
    args.push("--api-key-file", env.MXR_KEY_PATH);
    console.log(`Executing: ${env.MXR_CLI} ${args.join(" ")}`);
    return new Promise((resolve, reject) => {
        const child = spawn(env.MXR_CLI, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
        let out = "", err = "";
        child.stdout.on("data", (data) => out += data.toString());
        child.stderr.on("data", (data) => err += data.toString());
        child.on("close", code => {
            if (code === 0) {
                resolve(out.trim());
            } else {
                reject(new Error(`${env.MXR_CLI} ${args.join(" ")}  → exit ${code}\n${(err || out).trim()}`));
            }
        });
    });
}