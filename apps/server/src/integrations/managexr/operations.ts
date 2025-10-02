import { manageXR } from "./client.js";
import type { Device, App, File} from "../../../../shared/contracts.js";

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