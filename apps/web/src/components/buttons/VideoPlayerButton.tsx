import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import VideoPlayer from "../player/VideoPlayer";

type Projection =
  | "NONE"
  | "180" | "180_MONO" | "180_LR"
  | "360" | "360_LR" | "360_TB"
  | "Cube" | "EAC" | "EAC_LR";

export interface VideoPlayerButtonProps {
  src: string;
  initialProjection?: Projection;
  width?: number;
  height?: number;
  portalContainer?: Element | null;
  buttonLabel?: string;
}

const VideoPlayerButton: React.FC<VideoPlayerButtonProps> = ({
  src,
  initialProjection = "NONE",
  width = 720,
  height = 405,
  portalContainer,
  buttonLabel = "▶",
}) => {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const container = useMemo(
    () => portalContainer ?? (typeof document !== "undefined" ? document.body : null),
    [portalContainer]
  );

  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {buttonLabel}
      </button>

      {open && container && createPortal(
        <div
          ref={overlayRef}
          role="presentation"
          onMouseDown={(e) => {
            // close only if the backdrop itself is clicked
            if (e.target === overlayRef.current) onClose();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()} // keep clicks inside from closing
            style={{
              background: "#0b0b0b",
              borderRadius: 6,
              boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
              width,
              maxWidth: "95vw",
            }}
          >
            <div style={{ width: "100%", height, background: "#000" }}>
              <VideoPlayer
                src={src}
                width={width}
                height={height}
                initialProjection={initialProjection}
              />
            </div>
          </div>
        </div>,
        container
      )}
    </>
  );
};

export default VideoPlayerButton;
