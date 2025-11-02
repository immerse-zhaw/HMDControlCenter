import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import VideoPlayer from "../player/VideoPlayer";

type Projection =
  | "NONE"
  | "180" | "180_MONO" | "180_LR"
  | "360" | "360_LR" | "360_TB"
  | "Cube" | "EAC" | "EAC_LR";

type TranscodeInfo = {
  status: "processing" | "ready" | "failed";
  updatedAt: number;
  variants?: { hls?: string; mp4?: string }; // type left intact; we will only use mp4
  error?: string;
};

type AssetMeta = {
  id: string;
  type: "video" | "glb";
  originalFilename: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  streamUrl: string;
  downloadUrl: string;
  transcode?: TranscodeInfo;
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
}

export interface VideoPlayerButtonProps {
  src?: string;
  assetId?: string;

  initialProjection?: Projection;
  width?: number;
  height?: number;
  portalContainer?: Element | null;
  buttonLabel?: string;
}

const VideoPlayerButton: React.FC<VideoPlayerButtonProps> = ({
  src,
  assetId,
  initialProjection = "NONE",
  width = 720,
  height = 405,
  portalContainer,
  buttonLabel = "▶",
}) => {
  const [open, setOpen] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src ?? null);
  const [status, setStatus] = useState<TranscodeInfo["status"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [mp4Src, setMp4Src] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);

  const container = useMemo(
    () => portalContainer ?? (typeof document !== "undefined" ? document.body : null),
    [portalContainer]
  );

  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (src) {
      setResolvedSrc(src);
      setBusy(false);
      setStatus(null);
      setError(null);
      setMp4Src(null);
      return;
    }
    if (!assetId) return;

    let cancelled = false;

    const schedule = (ms: number) => {
      const next = Math.min(ms || 1500, 8000);
      timer.current = window.setTimeout(() => poll(next), next) as any;
    };

    const poll = async (delayMs: number) => {
      try {
        const r = await fetch(`/api/storage/assets/${encodeURIComponent(assetId)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const a = (await r.json()) as AssetMeta;
        if (cancelled) return;

        const s = a.transcode?.status ?? null;
        setStatus(s);
        setError(a.transcode?.error || null);

        if (a.type !== "video") {
          setResolvedSrc(a.downloadUrl || a.streamUrl);
          setBusy(false);
          return;
        }

        if (s === "processing") {
          setBusy(true);
          setResolvedSrc(null);
          setMp4Src(null);
          schedule(delayMs * 1.5);
          return;
        }

        if (s === "failed") {
          setBusy(false);
          setResolvedSrc(a.streamUrl || null);
          setMp4Src(null);
          return;
        }

        // ready: only MP4 (no HLS)
        setBusy(false);
        const mp4 = a.transcode?.variants?.mp4 ?? null;
        setMp4Src(mp4);

        // Prefer MP4 on iOS, otherwise also MP4 (or fall back to original stream)
        const preferMp4 = isIOS();
        const chosen = preferMp4 ? (mp4 ?? a.streamUrl) : (mp4 ?? a.streamUrl);
        setResolvedSrc(chosen || null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load asset");
          schedule(delayMs * 1.5);
        }
      }
    };

    setBusy(true);
    poll(1200);

    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [src, assetId]);

  // With HLS removed, we don't need an error-capture HLS→MP4 fallback anymore.

  return (
    <>
      <button
        className="btn btn--icon"
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open video"
        disabled={!!assetId && busy}
        aria-busy={!!assetId && busy}
        title={assetId && busy ? "Preparing video…" : undefined}
      >
        {buttonLabel}
      </button>

      {open && container && createPortal(
        <div
          ref={overlayRef}
          role="presentation"
          onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "grid", placeItems: "center", padding: 16 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ background: "#0b0b0b", borderRadius: 6, boxShadow: "0 16px 48px rgba(0,0,0,0.35)", width, maxWidth: "95vw" }}
          >
            <div style={{ width: "100%", height, background: "#000", display: "grid", placeItems: "center" }}>
              {assetId && status === "processing" ? (
                <div style={{ color: "#e5e7eb", fontSize: 14, textAlign: "center" }}>
                  Preparing video… (transcoding)
                </div>
              ) : error && !resolvedSrc ? (
                <div style={{ color: "salmon", fontSize: 14, textAlign: "center", padding: 12 }}>
                  {error}
                </div>
              ) : (
                resolvedSrc && (
                  <VideoPlayer
                    src={resolvedSrc}
                    width={width}
                    height={height}
                    initialProjection={initialProjection}
                  />
                )
              )}
            </div>
          </div>
        </div>,
        container
      )}
    </>
  );
};

export default VideoPlayerButton;