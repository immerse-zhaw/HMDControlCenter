import { manageXR } from "./client.js";
import type { Device, App, File} from "../../../../shared/contracts.js";
import path from "path";
import { execCli } from "./cli.js";

type MXRDevice = {
    id: string;
    name: string;
    manufacturer: string;
    model: string;
    online: boolean;
    batteryIsCharging: boolean;
    batteryLevel: number;
    controllerData: {
        controller0: { batteryLevel: number };
        controller1: { batteryLevel: number };
    };
}

type MXRApp = {
    packageName: string;
    title: string;
    description: string;
}

type MXRFile = {
    id: string;
    name: string;
    size: number;
    md5: string;
    url: string;
    description: string;
    libraryDirectoryPath: string;
}

export async function listDevices(): Promise<Device[]> {
    const raw = await manageXR<{ data?: MXRDevice[] }>("GET", "/v1/devices");
    const items: MXRDevice[] = Array.isArray(raw?.data) ? raw!.data! : [];

    return (items).map(d => ({
        id: d.id,
        name: d.name,
        model: d.manufacturer + " " + d.model,
        online: d.online,
        charging: d.batteryIsCharging,
        batteryLevel: d.batteryLevel,
        leftControllerBatteryLevel: d.controllerData?.controller0?.batteryLevel,
        rightControllerBatteryLevel: d.controllerData?.controller1?.batteryLevel,
    }));
}

export async function listApps(): Promise<App[]> {
    const raw = await manageXR<{ data?: MXRApp[] }>("GET", "/v1/apps");
    const items: MXRApp[] = Array.isArray(raw?.data) ? raw!.data! : [];

    return (items).map(a => ({
        id: a.packageName,
        name: a.title,
        description: a.description,
    }));
}

export async function listFiles(): Promise<File[]> {
    const raw = await manageXR<{ data?: MXRFile[] }>("GET", "/v1/files");
    const items: MXRFile[] = Array.isArray(raw?.data) ? raw!.data! : [];
    
    return (items).map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        md5: f.md5,
        url: f.url,
        description: f.description,
        path: f.libraryDirectoryPath,
    }));
}

export async function launchAppOnAllDevices(
  packageName: string,
  launchParams?: Record<string, unknown>
) {
  if (!packageName) throw new Error("packageName required");
  const devices = await listDevices();
  const deviceIds = devices.map(d => d.id);
  if (!deviceIds.length) throw new Error("No devices found");

  return manageXR("POST", "/v1/devices/batch-command", {
    action: "LAUNCH_APP",
    deviceIds,
    data: { packageName, ...(launchParams ? { launchParams } : {}) },
  });
}


export async function uploadApp(
    apkPath: string,
    options?: {
        title?: string,
        description?: string,
        version?: string,
    }
) {
    const abs = path.resolve(apkPath);
    const args = ["upload-app", abs];
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
    const abs = path.resolve(filePath);
    const args = ["upload-file", abs];
    if (options?.name) args.push("--name", options.name);
    if (options?.description) args.push("--description", options.description);
    return execCli(args);
}