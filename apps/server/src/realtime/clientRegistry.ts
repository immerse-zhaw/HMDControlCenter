import type { WebSocket } from "ws";
import { DeviceId, DeviceInfo } from "../../../shared/src/contracts.js";


const clients = new Map<DeviceId, DeviceInfo>();


export function addClient(info: DeviceInfo) {
    clients.set(info.id, info);
}


export function removeClient(deviceId: DeviceId, ws?: WebSocket) {
    const current = clients.get(deviceId);
    if (current && (!ws || current.ws === ws)) {
        clients.delete(deviceId);
    }
}


export function getClient(deviceId: DeviceId): DeviceInfo | undefined {
    return clients.get(deviceId);
}


export function listClients(): Omit<DeviceInfo, 'ws'>[] { 
    return Array.from(clients.values()).map(({ws, ...info}) => info);
}


export function forEachClient(callback: (info: DeviceInfo) => void) {
    clients.forEach(callback);
}