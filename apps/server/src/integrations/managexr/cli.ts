import { spawn } from "node:child_process";
import { env } from "process";

const CMD = env.MXR_CLI ?? "mxr-cli";
const pathToKey = env.MXR_KEY_PATH ?? "../../.secrets/key.json";

export async function execCli(args: string[]): Promise<string> {
    args.push("--api-key-file", pathToKey);
    console.log(`Executing: ${CMD} ${args.join(" ")}`);
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