import { useEffect, useState } from "react";
import type { Device, App, File, DeviceInfo } from "../../../shared/src/contracts.js";
import { UploadButton } from "../components/buttons/UploadButton.js";
import { DeleteAppButton } from "../components/buttons/DeleteAppButton.js";
import { LaunchAppButton, LaunchHomeButton } from "../components/buttons/LaunchAppButton.js";
import { StreamButton } from "../components/buttons/StreamButton.js";
import { UploadGlbButton, UploadVideoButton } from "../components/buttons/UploadAssetsButton.js";
import { RealtimeCommandForm } from "../components/forms/RealtimeCommandForm.js";
import VideoPlayerButton from "../components/buttons/VideoPlayerButton.js";
import OpenGlbButton from "../components/buttons/OpenGlbButton.js"
import { DeleteAssetButton } from "../components/buttons/DeleteAssetButton.js";
import { OpenVideo, CloseVideo, PauseVideo, ResumeVideo, SeekVideo, ChangeProjection } from "../components/interfaces/VideoPlayerInterface.js";
import { OpenModel, CloseModel, ChangePointSize, ChangeScale, PlayAnimation } from "../components/interfaces/GlbPlayerInterface.js";

type RealtimeDevice = Omit<DeviceInfo, "ws">;

type Asset = {
  id: string;
  type: "glb" | "video";
  originalFilename: string;
  mime: string;
  sizeBytes: number;
  streamUrl: string;    // /api/storage/assets/:id/stream
  downloadUrl: string;  // /api/storage/assets/:id/download
};

function statusIcon(d: Device) {
  return d.online === true ? "🟢 Online" : d.online === false ? "🔴 Offline" : "• Unknown";
}
function batteryText(d: Device) {
  if (d.batteryLevel == null) return "—";
  const base = `${d.batteryLevel}%`;
  return d.charging ? base + " ⚡︎" : base;
}
function formatMB(bytes: number | null | undefined) {
  if (bytes == null) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function fmtWhen(ms: number) {
  try {
    const d = new Date(ms);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  } catch {
    return "—";
  }
}

export default function App() {
  const [backend, setBackend] = useState("…");
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [apps, setApps] = useState<App[] | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [_updateConfig, setUpdateConfig] = useState(false);

  // Realtime devices (WebSocket-connected home apps)
  const [rtDevices, setRtDevices] = useState<RealtimeDevice[] | null>(null);

  useEffect(() => {
    fetch("/api/server/health")
      .then(r => setBackend(r.ok ? "🟢" : "🔴"))
      .catch(() => setBackend("🔴"));
  }, []);

  async function refreshData() {
    try {
      const [devRes, appRes, fileRes, assetRes, rtRes] = await Promise.all([
        fetch("/api/managexr/info/listDevices"),
        fetch("/api/managexr/info/listApps"),
        fetch("/api/managexr/info/listFiles"),
        fetch("/api/storage/assets/listAssets"),
        fetch("/api/realtime/clients/listClients"),
      ]);
      if (!devRes.ok) throw new Error(`Failed to fetch devices: ${devRes.status} ${await devRes.text()}`);
      if (!appRes.ok) throw new Error(`Failed to fetch apps: ${appRes.status} ${await appRes.text()}`);
      if (!fileRes.ok) throw new Error(`Failed to fetch files: ${fileRes.status} ${await fileRes.text()}`);
      if (!assetRes.ok) throw new Error(`Failed to fetch assets: ${assetRes.status} ${await assetRes.text()}`);
      if (!rtRes.ok) throw new Error(`Failed to fetch realtime devices: ${rtRes.status} ${await rtRes.text()}`);

      const devData = (await devRes.json()) as Device[];
      const appData = (await appRes.json()) as App[];
      const fileData = (await fileRes.json()) as File[];
      const assetData = (await assetRes.json()) as Asset[];

      const rtJson = await rtRes.json();
      const rtList: RealtimeDevice[] = Array.isArray(rtJson)
        ? rtJson
        : Array.isArray(rtJson?.devices)
          ? rtJson.devices
          : [];

      setDevices(devData);
      setApps(appData);
      setFiles(fileData);
      setAssets(assetData);
      setRtDevices(rtList);
      setError(null);
    } catch (e) {
      console.error(e);
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void refreshData();
  }, []);

  async function refreshAndUpdateConfig() {
    try {
      setUpdateConfig(true);
      const r = await fetch("/api/managexr/config/updateConfig", { method: "POST" });
      if (!r.ok) throw new Error(`Failed to update config: ${r.status} ${await r.text()}`);
      await refreshData();
    } catch (e) {
      console.error(e);
      setError((e as Error).message);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 4 }}>IMMERSE Control Center</h1>
      <p style={{ marginTop: 0 }}>Backend: {backend}</p>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      {/* Realtime (WebSocket) Devices */}
      <section style={{ marginTop: 16 }}>
        <h2>Realtime Devices</h2>
        {!rtDevices ? (
          <p>Loading realtime devices…</p>
        ) : rtDevices.length === 0 ? (
          <p>No realtime devices connected.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 840 }}>
              <thead>
                <tr>
                  <th style={th}>Device ID</th>
                  <th style={th}>Model</th>
                  <th style={th}>App</th>
                  <th style={th}>Version</th>
                  <th style={th}>Connected</th>
                  <th style={th}>Send Command</th>
                </tr>
              </thead>
              <tbody>
                {rtDevices.map(rd => (
                  <tr key={rd.id}>
                    <td style={td}><code>{rd.id}</code></td>
                    <td style={td}>{rd.model ?? "—"}</td>
                    <td style={td}>{rd.app ?? "—"}</td>
                    <td style={td}>{rd.version ?? "—"}</td>
                    <td style={td}>{fmtWhen(rd.connectedAt)}</td>
                    <td style={td}>
                      <RealtimeCommandForm deviceId={rd.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Devices */}
      <section style={{ marginTop: 16 }}>
        <h2>Devices</h2>
        {!devices ? (
          <p>Loading devices…</p>
        ) : devices.length === 0 ? (
          <p>No devices.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 840 }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Serial</th>
                  <th style={th}>Model</th>
                  <th style={th}>Status</th>
                  <th style={th}>Battery</th>
                  <th style={th}>Stream</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(d => (
                  <tr key={d.id}>
                    <td style={td}><strong>{d.name ?? "—"}</strong></td>
                    <td style={td}>{d.id ?? "—"}</td>
                    <td style={td}>{d.model ?? "—"}</td>
                    <td style={td}>{statusIcon(d)}</td>
                    <td style={td}>
                      {batteryText(d)}
                      {(d.leftControllerBatteryLevel != null || d.rightControllerBatteryLevel != null) && (
                        <div style={{ fontSize: "0.95em", color: "#555" }}>
                          {d.leftControllerBatteryLevel != null ? `Left: ${d.leftControllerBatteryLevel}%` : "—"}
                          {" | "}
                          {d.rightControllerBatteryLevel != null ? `Right: ${d.rightControllerBatteryLevel}%` : "—"}
                        </div>
                      )}
                    </td>
                    <td><StreamButton deviceId={d.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Apps */}
      <section style={{ marginTop: 16 }}>
        <h2>Apps</h2>
        <UploadButton
          label="Upload APK"
          accept=".apk,application/vnd.android.package-archive"
          endpoint="/api/managexr/upload/app"
          fieldName="apk"
          onDone={refreshAndUpdateConfig}
        />
        {!apps ? (
          <p>Loading apps…</p>
        ) : apps.length === 0 ? (
          <p>No apps.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Play</th>
                  <th style={th}>Delete</th>
                </tr>
              </thead>
              <tbody>
                {apps.map(a => (
                  <tr key={a.id}>
                    <td style={td}><strong>{a.name ?? "—"}</strong></td>
                    <td>
                      <LaunchAppButton appId={a.id}/>
                    </td>
                    <td>
                      <DeleteAppButton appId={a.id} onDone={refreshAndUpdateConfig} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <LaunchHomeButton />
      </section>

      {/* Assets (GLB + Video) */}
      <section style={{ marginTop: 16 }}>
        <h2>Assets</h2>
        <UploadVideoButton onDone={refreshData} maxBytes={20 * 1024**3} />
        <UploadGlbButton onDone={refreshData} maxBytes={1 * 1024**3} />

        {!assets ? (
          <p>Loading assets…</p>
        ) : assets.length === 0 ? (
          <p>No assets yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 840 }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Type</th>
                  <th style={th}>Size</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id}>
                    <td style={td}><strong>{a.originalFilename}</strong></td>
                    <td style={td}>{a.type.toUpperCase()}</td>
                    <td style={td}>{formatMB(a.sizeBytes)}</td>
                    <td style={td}>
                      {a.type === "video" &&
                        <VideoPlayerButton 
                          assetId={a.id} 
                          width={window.innerWidth * 0.75} 
                          height={(window.innerWidth * 0.75) * 9 / 16}
                          onOpen={() => OpenVideo(a.streamUrl)}
                          onClose={() => CloseVideo()}
                          onResume={() => ResumeVideo()}
                          onPause={() => PauseVideo()}
                          onSetTime={(t) => SeekVideo(t)}
                          onChangeProjection={(p) => ChangeProjection(p)}
                        />
                      }
                      {a.type === "glb" &&
                        <OpenGlbButton 
                          src={a.downloadUrl} 
                          width={window.innerWidth * 0.75} 
                          height={(window.innerWidth * 0.75) * 9 / 16} 
                          onOpen={() => OpenModel(a.downloadUrl)}
                          onClose={() => CloseModel()}
                          onAnimationSelect={(n) => PlayAnimation(n)}
                          onScaleChange={(s) => ChangeScale(s)}
                          onPointSizeChange={(s) => ChangePointSize(s)}
                        />
                      }
                      <DeleteAssetButton assetId={a.id} onDeleted={refreshData} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #ddd" };
const td: React.CSSProperties = { padding: "8px 12px", borderBottom: "1px solid #eee" };
