import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useDeviceStream } from "@managexr/react-streaming";

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "grid", placeItems: "center", zIndex: 9999
    }}>
      {children}
      <button
        onClick={onClose}
        style={{
          position: "fixed", top: 16, right: 16, zIndex: 10000,
          background: "rgba(0,0,0,0.6)", color: "#fff", border: 0, padding: "8px 12px", borderRadius: 8
        }}
      >
        Close
      </button>
    </div>,
    document.body
  );
}

export function StreamButton({
  deviceId,
  label = "Stream",
}: {
  deviceId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const r = await fetch("/api/managexr/streamingToken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        });
        const j = await r.json();
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
      <button onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          {!token && !err && <p style={{ color: "#fff" }}>Preparing stream…</p>}
          {err && <p style={{ color: "salmon" }}>{err}</p>}
          {token && <StreamPlayer deviceId={deviceId} token={token} />}
        </Modal>
      )}
    </>
  );
}

function StreamPlayer({ deviceId, token }: { deviceId: string; token: string }) {
  const { videoRef, status, retryStream } =
    useDeviceStream(deviceId, token, { endOtherStreamAutomatically: true });

  const retries = useRef(0);
  useEffect(() => {
    const s = String(status || "");
    if ((/^error_/i.test(s) || /ended|stopped/i.test(s)) && retries.current < 5) {
      const t = setTimeout(() => { retries.current += 1; retryStream(); }, 1200);
      return () => clearTimeout(t);
    }
    if (/connected/i.test(s)) retries.current = 0;
  }, [status, retryStream]);

  const frameStyle: React.CSSProperties = {
    width: "min(92vw, calc(92vh * (16 / 9)))",
    aspectRatio: "16 / 9",
    background: "#000",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
  };

  return (
    <div style={frameStyle}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        // fill the 16:9 frame exactly
        style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", background: "#000" }}
      />
    </div>
  );
}
