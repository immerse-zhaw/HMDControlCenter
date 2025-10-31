import { useEffect, useRef, useState } from "react";


export function DeleteAppButton({
  label = "Delete",
  appId,
  onDone,
}: { label?: string; appId: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  async function onDeleteApp() {
    if (busy || !appId) return;
    if (!confirm(`Delete ${appId}? This cannot be undone.`)) return;

    setBusy(true);
    setMessage("Deleting…");
    try {
      const r = await fetch(`/api/managexr/apps/${encodeURIComponent(appId)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Delete failed (${r.status})`);
      setMessage("Deleted ✓");
      onDone?.();
    } catch (e: any) {
      setMessage(e?.message || "Delete failed");
    } finally {
      setBusy(false);
      timer.current = window.setTimeout(() => setMessage(""), 4000);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={onDeleteApp} disabled={busy} aria-busy={busy}>
        {busy ? "Deleting…" : label}
      </button>
      {message && <small aria-live="polite">{message}</small>}
    </span>
  );
}
