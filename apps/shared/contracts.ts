export type Device = {
    id: string;
    name: string;
    model: string;
    online: boolean;
    charging: boolean | null;
    batteryLevel: number | null;
    leftControllerBatteryLevel: number | null;
    rightControllerBatteryLevel: number | null;
}

export type App = {
    id: string;
    name: string;
    description: string | null;
}

export type File = {
    id: string;
    name: string;
    size: number;
    md5: string;
    url: string;
    description: string;
    path: string;
}