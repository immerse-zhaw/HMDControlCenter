import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDeviceStream } from "@managexr/react-streaming";

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 9999 }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {children}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: 12 }}>
          <button className="btn btn--sm" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function StreamButton({ deviceId, label = "Stream" }: { deviceId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const r = await fetch("/api/managexr/stream/streamingToken", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.token) throw new Error(j?.error || `HTTP ${r.status}`);
        if (!cancelled) setToken(j.token);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to get token");
      }
    })();
    return () => { cancelled = true; setToken(null); };
  }, [open, deviceId]);

  return (
    <>
      <button className="btn btn--primary" type="button" onClick={() => setOpen(true)} title="Open device stream">
        {label}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          {!token && !err && <p style={{ color: "#fff", padding: 12 }}>Preparing stream…</p>}
          {err && <p style={{ color: "salmon", padding: 12 }}>{err}</p>}
          {token && <StreamPlayer deviceId={deviceId} token={token} />}
        </Modal>
      )}
    </>
  );
}

function StreamPlayer({ deviceId, token }: { deviceId: string; token: string }) {
  const { videoRef, status, retryStream } = useDeviceStream(deviceId, token, { endOtherStreamAutomatically: true });
  const retries = useRef(0);

  useEffect(() => {
    const s = String(status || "");
    if ((/^error_/i.test(s) || /ended|stopped/i.test(s)) && retries.current < 5) {
      const t = window.setTimeout(() => { retries.current += 1; retryStream(); }, 1200);
      return () => window.clearTimeout(t);
    }
    if (/connected/i.test(s)) retries.current = 0;
  }, [status, retryStream]);

  return (
    <div style={{ width: "min(92vw, calc(92vh * (16 / 9)))", aspectRatio: "16 / 9", background: "#000", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", background: "#000" }} />
    </div>
  );
}
