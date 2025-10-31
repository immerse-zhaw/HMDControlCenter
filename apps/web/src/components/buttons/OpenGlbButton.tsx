import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GLTFPlayer from "../player/GltfPlayer";

export interface OpenGLBButtonProps {
  src: string;
  width?: number;
  height?: number;
  portalContainer?: Element | null;
  buttonLabel?: string;

  // Point-cloud control passthrough
  initialPointSize?: number;
  minPointSize?: number;
  maxPointSize?: number;
  pointSizeStep?: number;

  disableZoom?: boolean;
}

const OpenGLBButton: React.FC<OpenGLBButtonProps> = ({
  src,
  width = 720,
  height = 405,
  portalContainer,
  buttonLabel = "▶",

  disableZoom = true ,
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
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: "#0b0b0b",
              borderRadius: 6,
              boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
              width,
              maxWidth: "95vw",
            }}
          >
            <div style={{ width: "100%", height, background: "#000" }}>
              <GLTFPlayer
                src={src}
                width={width}
                height={height}
                disableZoom={disableZoom}
              />
            </div>
          </div>
        </div>,
        container
      )}
    </>
  );
};

export default OpenGLBButton;
