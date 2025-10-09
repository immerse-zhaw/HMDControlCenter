import { useEffect, useState } from "react";
import type { Device, App, File } from "../../shared/contracts.js";
import { UploadButton } from "./UploadButton.js";
import { DeleteAppButton } from "./DeleteAppButton.js";
import { LaunchAppButton, LaunchHomeButton } from "./LaunchAppButton.js";


function statusIcon(d: Device) {
  return d.online === true ? "🟢 Online" : d.online === false ? "🔴 Offline" : "• Unknown";
}
function batteryText(d: Device) {
  if (d.batteryLevel == null) return "—";
  const base = `${d.batteryLevel}%`;
  return d.charging ? base + " ⚡︎" : base;
}

export default function App() {
  const [backend, setBackend] = useState("…");
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [apps, setApps] = useState<App[] | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [_updateConfig, setUpdateConfig] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then(r => setBackend(r.ok ? "🟢" : "🔴"))
      .catch(() => setBackend("🔴"));
  }, []);

  async function refreshData() {
    try {
      const [devRes, appRes, fileRes] = await Promise.all([
        fetch("/api/devices"),
        fetch("/api/apps"),
        fetch("/api/files"),
      ]);
      if (!devRes.ok) throw new Error(`Failed to fetch devices: ${devRes.status} ${await devRes.text()}`);
      if (!appRes.ok) throw new Error(`Failed to fetch apps: ${appRes.status} ${await appRes.text()}`);
      if (!fileRes.ok) throw new Error(`Failed to fetch files: ${fileRes.status} ${await fileRes.text()}`);

      const devData = (await devRes.json()) as Device[];
      const appData = (await appRes.json()) as App[];
      const fileData = (await fileRes.json()) as File[];

      setDevices(devData);
      setApps(appData);
      setFiles(fileData);
      setError(null);
    }
    catch (e) {
      console.error(e);
      setError((e as Error).message);
    }
  }
  
  useEffect(() => { void refreshData(); }, []);

  async function refreshAndUpdateConfig() {
    try {
      setUpdateConfig(true);
      const r = await fetch("/api/managexr/updateConfig", { method: "POST" });
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
        <LaunchHomeButton/>
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
                      <LaunchAppButton appId={a.id} launchParams={{ test:"test" }} />
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
      </section>

      {/* Files */}
      <section style={{ marginTop: 16, marginBottom: 32 }}>
        <h2>Files</h2>
        <UploadButton
          label="Upload File"
          accept="*/*"                       // change if you want to restrict
          endpoint="/api/managexr/upload/file"
          fieldName="file"
          onDone={refreshAndUpdateConfig}
        />
        {!files ? (
          <p>Loading files…</p>
        ) : files.length === 0 ? (
          <p>No files.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Size</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id}>
                    <td style={td}><strong>{f.name ?? "—"}</strong></td>
                    <td style={td}>{f.size != null ? `${(f.size / (1024 * 1024)).toFixed(2)} MB` : "—"}</td>
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
