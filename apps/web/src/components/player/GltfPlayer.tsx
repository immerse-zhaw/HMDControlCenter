import React, { useEffect, useRef, useState } from "react";
import "@google/model-viewer";
import "../styles/gltfplayer.css";

export type GLTFPlayerProps = {
  src: string;
  width?: number;
  height?: number;
  initialPointSize?: number;
  minPointSize?: number;
  maxPointSize?: number;
  pointSizeStep?: number;
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  scaleStep?: number;
  disableZoom?: boolean;
  useNetworkProgress?: boolean;
  onScaleChange?: (s:number) => void;
  onAnimationSelect?: (a:string) => void;
  onPointSizeChange?: (s:number) => void;
};

const GLTFPlayer: React.FC<GLTFPlayerProps> = ({
  src,
  width = 640,
  height = 360,
  initialPointSize = 0.1,
  minPointSize = 0.05,
  maxPointSize = 2.0,
  pointSizeStep = 0.05,
  initialScale = 1,
  minScale = 0.1,
  maxScale = 10,
  scaleStep = 0.1,
  disableZoom,
  useNetworkProgress = true,
  onScaleChange,
  onAnimationSelect,
  onPointSizeChange
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mvRef = useRef<any | null>(null);

  const [pointSize, setPointSize] = useState(initialPointSize);
  const [scale, setScale] = useState(initialScale);
  const [hasPoints, setHasPoints] = useState(false);
  const [animations, setAnimations] = useState<string[]>([]);
  const [animationName, setAnimationName] = useState("");

  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setMonotonic = (pct: number) =>
    setProgress((p) => Math.max(0, Math.min(100, pct > p ? pct : p)));

  function getThreeScene(el: any): any | null {
    try {
      if (el?.model?.scene?.isScene) return el.model.scene;
      const syms = Object.getOwnPropertySymbols(el) as symbol[];
      for (const s of syms) {
        const v = (el as any)[s];
        if (!v || typeof v !== "object") continue;
        if (v.scene?.isScene) return v.scene;
        if (v.threeRenderer?.scene?.isScene) return v.threeRenderer.scene;
        if (v.renderer?.scene?.isScene) return v.renderer.scene;
        for (const k of Object.keys(v)) {
          const sub = (v as any)[k];
          if (sub?.isScene) return sub;
          if (sub?.scene?.isScene) return sub.scene;
        }
      }
    } catch { }
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
    onPointSizeChange?.(size);
    return found;
  }

  const applyScale = (el: any, s: number) => {
    try { 
      el.scale = `${s} ${s} ${s}`; 
      onScaleChange?.(s);
    } catch { }
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = "";
    setError(null);
    setProgress(0);
    setLoading(true);

    const el = document.createElement("model-viewer") as any;
    el.style.cssText = "width:100%;height:100%;display:block";
    el.setAttribute("camera-controls", "");
    if (disableZoom) el.setAttribute("disable-zoom", "");
    host.appendChild(el);
    mvRef.current = el;

    let revokeUrl: string | null = null;
    const abortCtrl = new AbortController();

    const onProgress = (e: Event) => {
      const frac = Number((e as any)?.detail?.totalProgress ?? 0);
      setMonotonic(Math.round(Math.max(0, Math.min(1, frac)) * 100));
    };
    const onLoad = () => {
      try {
        const list: string[] = (el as any).availableAnimations ?? [];
        setAnimations(list);
        const active: string = (el as any).animationName ?? "";
        if (active) 
        {
          setAnimationName(active);
        }
      } catch { }
      const found = applyPointSizing(el, pointSize);
      setHasPoints(found);
      applyScale(el, scale);
      setMonotonic(100);
      setTimeout(() => setLoading(false), 80);
    };
    const onError = (ev: Event) => {
      const msg = (ev as any)?.detail?.type || "Failed to load model";
      setError(String(msg));
      setLoading(false);
    };

    const attachElementSrc = (url: string) => {
      el.setAttribute("src", url);
      el.addEventListener("progress", onProgress as EventListener);
      el.addEventListener("load", onLoad as EventListener, { once: true });
      el.addEventListener("error", onError as EventListener, { once: true });
    };

    const canStream =
      useNetworkProgress &&
      typeof fetch === "function" &&
      (window as any).ReadableStream &&
      typeof Response !== "undefined";

    (async () => {
      if (!canStream) {
        attachElementSrc(src);
        return;
      }
      try {
        const res = await fetch(src, { signal: abortCtrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const total = Number(res.headers.get("content-length") || 0);

        if (!res.body || !total) {
          setMonotonic(5);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          revokeUrl = url;
          setMonotonic(98);
          attachElementSrc(url);
          return;
        }

        const reader = res.body.getReader();
        const chunks: BlobPart[] = [];
        let loaded = 0;
        setMonotonic(2);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const ab = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
            chunks.push(ab);
            loaded += value.byteLength;
            setMonotonic(Math.max(2, Math.min(95, Math.round((loaded / total) * 100))));
          }
        }

        const blob = new Blob(chunks, { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        revokeUrl = url;
        setMonotonic(98);
        attachElementSrc(url);
      } catch {
        if (!abortCtrl.signal.aborted) {
          setMonotonic(0);
          attachElementSrc(src);
        }
      }
    })();

    return () => {
      abortCtrl.abort();
      el.removeEventListener("progress", onProgress as EventListener);
      if (el.parentElement) el.parentElement.removeChild(el);
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
      mvRef.current = null;
      setHasPoints(false);
      setAnimations([]);
      setAnimationName("");
      setLoading(false);
    };
  }, [src, disableZoom, useNetworkProgress]);

  // live updates
  useEffect(() => { const el = mvRef.current; if (el) applyScale(el, scale); }, [scale]);
  useEffect(() => {
    const el = mvRef.current;
    if (!el) return;
    if (applyPointSizing(el, pointSize)) setHasPoints(true);
  }, [pointSize]);

  useEffect(() => {
    const el = mvRef.current as any;
    if (!el) return;
    if (!animationName) { el.removeAttribute?.("animation-name"); el.pause?.(); return; }
    try { el.setAttribute("animation-name", animationName); el.play?.(); } catch { }
  }, [animationName]);

  return (
    <div style={{ width, height, background: "#000", position: "relative", overflow: "hidden" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

      {(loading || error) && (
        <div className="gltf-progress" role="status" aria-live="polite">
          {!error ? (
            <div className="gltf-progress__panel">
              <div className="gltf-progress__bar">
                <div className="gltf-progress__fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="gltf-progress__panel">
              <div className="gltf-progress__error">{error}</div>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div
        className="gltf-slider"
        style={{
          position: "absolute", left: 8, bottom: 8,
          background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "6px 8px",
          display: "inline-flex", flexDirection: "column", gap: 6, color: "#fff", userSelect: "none", zIndex: 1
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="gltf-player-scale" style={{ opacity: .85, width: 64 }}>scale</label>
          <input id="gltf-player-scale" type="range" min={minScale} max={maxScale} step={scaleStep}
            value={scale} onChange={(e) => setScale(parseFloat(e.currentTarget.value))} />
          <span style={{ width: 56, textAlign: "right", opacity: .85 }}>{scale.toFixed(2)}×</span>
        </div>

        {hasPoints && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="gltf-player-ptsz" style={{ opacity: .85, width: 64 }}>point size</label>
            <input id="gltf-player-ptsz" type="range" min={minPointSize} max={maxPointSize} step={pointSizeStep}
              value={pointSize} onChange={(e) => setPointSize(parseFloat(e.currentTarget.value))} />
            <span style={{ width: 56, textAlign: "right", opacity: .85 }}>{pointSize.toFixed(2)}</span>
          </div>
        )}

        {animations.length > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="gltf-player-anim" style={{ opacity: .85, width: 64 }}>animation</label>
            <select id="gltf-player-anim" value={animationName}
              onChange={(e) => {setAnimationName(e.currentTarget.value); onAnimationSelect?.(e.currentTarget.value);}}
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "4px 8px", height: 28 }}>
              <option value="">(none)</option>
              {animations.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default GLTFPlayer;
