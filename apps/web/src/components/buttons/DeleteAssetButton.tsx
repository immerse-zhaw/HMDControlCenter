import React, { useState } from "react";

type DeleteProps = {
  assetId: string;
  label?: string;
  confirmText?: string;
  onDeleted?: () => void;
};

export const DeleteAssetButton: React.FC<DeleteProps> = ({
  assetId,
  label = "Delete",
  confirmText = "Delete this asset permanently?",
  onDeleted,
}) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doDelete = async () => {
    if (!assetId) return;
    const ok = window.confirm(confirmText);
    if (!ok) return;

    try {
      setBusy(true);
      setErr(null);
      const r = await fetch(`/api/storage/assets/${encodeURIComponent(assetId)}`, {
        method: "DELETE",
      });
      if (r.status === 204 || r.status === 200) {
        onDeleted?.();
      } else if (r.status === 404) {
        setErr("Asset not found (maybe already deleted).");
        onDeleted?.(); // optional: still refresh
      } else {
        const txt = await r.text();
        throw new Error(`HTTP ${r.status} ${txt}`);
      }
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button className="btn btn--danger" type="button" onClick={doDelete} disabled={busy} aria-busy={busy}>
        {busy ? "Deleting…" : label}
      </button>
      {err && <small style={{ color: "crimson" }} role="status" aria-live="polite">{err}</small>}
    </span>
  );
};
