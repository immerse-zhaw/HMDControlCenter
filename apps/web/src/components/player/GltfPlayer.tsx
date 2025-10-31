import React, { useEffect, useRef, useState } from "react";
import "@google/model-viewer";
import "../styles/gltfplayer.css";

export type GLTFPlayerProps = {
  src: string;
  width?: number;
  height?: number;

  // point clouds
  initialPointSize?: number;
  minPointSize?: number;
  maxPointSize?: number;
  pointSizeStep?: number;

  // model scale
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  scaleStep?: number;

  // interactions
  disableZoom?: boolean;
};

const GLTFPlayer: React.FC<GLTFPlayerProps> = ({
  src,
  width = 640,
  height = 360,

  // point size
  initialPointSize = 0.1,
  minPointSize = 0.05,
  maxPointSize = 2.0,
  pointSizeStep = 0.05,

  // scale
  initialScale = 1,
  minScale = 0.1,
  maxScale = 10,
  scaleStep = 0.1,

  // interactions
  disableZoom,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mvRef = useRef<any | null>(null);

  const [pointSize, setPointSize] = useState<number>(initialPointSize);
  const [scale, setScale] = useState<number>(initialScale);
  const [hasPoints, setHasPoints] = useState(false);

  // animations
  const [animations, setAnimations] = useState<string[]>([]);
  const [animationName, setAnimationName] = useState<string>("");

  function getThreeScene(el: any): any | null {
    try {
      if (el?.model?.scene?.isScene) return el.model.scene;
      const syms = Object.getOwnPropertySymbols(el) as symbol[];
      for (const s of syms) {
        const v = el[s];
        if (!v || typeof v !== "object") continue;
        if ((v as any).scene?.isScene) return (v as any).scene;
        if ((v as any).threeRenderer?.scene?.isScene) return (v as any).threeRenderer.scene;
        if ((v as any).renderer?.scene?.isScene) return (v as any).renderer.scene;
        for (const k of Object.keys(v)) {
          const sub = (v as any)[k];
          if (sub?.isScene) return sub;
          if (sub?.scene?.isScene) return sub.scene;
        }
      }
    } catch {}
    return null;
  }

  function applyPointSizing(el: any, size: number): boolean {
    const scene = getThreeScene(el);
    if (!scene) return false;
    let found = false;
    scene.traverse?.((obj: any) => {
      if (obj?.isPoints && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m?.isPointsMaterial) {
            m.size = size;
            m.sizeAttenuation = true;
            m.needsUpdate = true;
            found = true;
          }
        }
      }
    });
    try { el.updateFraming?.(); } catch {}
    return found;
  }

  function applyScale(el: any, s: number): boolean {
    try {
      // use the element's scale attribute (supported by <model-viewer>)
      el.scale = `${s} ${s} ${s}`;
      return true;
    } catch {
      return false;
    }
  }

  // mount / reload
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = "";

    const el = document.createElement("model-viewer");
    el.setAttribute("src", src);
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.display = "block";

    el.setAttribute("camera-controls", "");
    if (disableZoom) el.setAttribute("disable-zoom", "");

    host.appendChild(el);
    mvRef.current = el;

    const onLoad = () => {
      // list animations (array of names)
      try {
        const list: string[] = (el as any).availableAnimations ?? [];
        setAnimations(list);
        // set current animation state (if any is active)
        const active: string = (el as any).animationName ?? "";
        if (active) setAnimationName(active);
      } catch {}

      const found = applyPointSizing(el, pointSize);
      setHasPoints(found);
      applyScale(el, scale);
    };
    el.addEventListener("load", onLoad as EventListener);

    return () => {
      el.removeEventListener("load", onLoad as EventListener);
      if (el.parentElement) el.parentElement.removeChild(el);
      mvRef.current = null;
      setHasPoints(false);
      setAnimations([]);
      setAnimationName("");
    };
  }, [src, disableZoom]);

  // live updates
  useEffect(() => {
    const el = mvRef.current;
    if (!el) return;
    applyScale(el, scale);
  }, [scale]);

  useEffect(() => {
    const el = mvRef.current;
    if (!el) return;
    const found = applyPointSizing(el, pointSize);
    if (found && !hasPoints) setHasPoints(true);
  }, [pointSize]);

  // when animationName changes, set it on the element and play
  useEffect(() => {
    const el = mvRef.current as any;
    if (!el) return;
    // clear any previous name if empty
    if (!animationName) {
      el.removeAttribute?.("animation-name");
      el.pause?.();
      return;
    }
    try {
      el.setAttribute("animation-name", animationName);
      // start playback now
      el.play?.();
    } catch {}
  }, [animationName]);

  return (
    <div
      ref={containerRef}
      style={{ width, height, background: "#000", position: "relative", overflow: "hidden" }}
    >
      {/* where <model-viewer> mounts */}
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

      {/* controls */}
      <div
        className="gltf-slider"
        style={{
          position: "absolute",
          left: 8,
          bottom: 8,
          background: "rgba(0,0,0,0.55)",
          borderRadius: 6,
          padding: "6px 8px",
          display: "inline-flex",
          flexDirection: "column",
          gap: 6,
          color: "#fff",
          userSelect: "none",
          zIndex: 1,
        }}
      >
        {/* Scale */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="gltf-player-scale" style={{ opacity: 0.85, width: 64 }}>
            scale
          </label>
          <input
            id="gltf-player-scale"
            type="range"
            min={minScale}
            max={maxScale}
            step={scaleStep}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.currentTarget.value))}
          />
          <span style={{ width: 56, textAlign: "right", opacity: 0.85 }}>
            {scale.toFixed(2)}×
          </span>
        </div>

        {/* Point size (only for point clouds) */}
        {hasPoints && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="gltf-player-ptsz" style={{ opacity: 0.85, width: 64 }}>
              point size
            </label>
            <input
              id="gltf-player-ptsz"
              type="range"
              min={minPointSize}
              max={maxPointSize}
              step={pointSizeStep}
              value={pointSize}
              onChange={(e) => setPointSize(parseFloat(e.currentTarget.value))}
            />
            <span style={{ width: 56, textAlign: "right", opacity: 0.85 }}>
              {pointSize.toFixed(2)}
            </span>
          </div>
        )}

        {/* Animations (show only if present) */}
        {animations.length > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="gltf-player-anim" style={{ opacity: 0.85, width: 64 }}>
              animation
            </label>
            <select
              id="gltf-player-anim"
              value={animationName}
              onChange={(e) => setAnimationName(e.currentTarget.value)}
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 6,
                padding: "4px 8px",
                height: 28,
              }}
            >
              <option value="">(none)</option>
              {animations.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default GLTFPlayer;
