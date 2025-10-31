import React, { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
// Your patched plugin (keep this as-is in your project)
import "../../../vendor/videojs-vr";

// ---------- config ----------
const GEAR_SIZE_PX = 17;

// ---------- Projection types & labels ----------
type Projection =
  | "NONE"
  | "180" | "180_MONO" | "180_LR"
  | "360" | "360_LR" | "360_TB"
  | "Cube" | "EAC" | "EAC_LR";

const PROJ_LABELS: Record<Projection, string> = {
  NONE: "2D",
  "180": "180",
  "180_MONO": "180",
  "180_LR": "180 3D (SBS)",
  "360": "360",
  "360_LR": "360 3D (SBS)",
  "360_TB": "360 3D (TB)",
  "Cube": "Cubemap",
  "EAC": "EAC",
  "EAC_LR": "EAC 3D (SBS)",
};

// ---------- One-time style injection (SSR-safe) ----------
if (typeof document !== "undefined") {
  const STYLE_ID = "vjs-projection-gear-size-style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .video-js .vjs-control-bar .vjs-projection-menu-button.vjs-icon-cog::before {
        font-size: ${GEAR_SIZE_PX}px;
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------- One-time registration of the gear menu (SSR-safe) ----------
if (typeof document !== "undefined" && !(videojs as any).getComponent("ProjectionMenuButton")) {
  const MenuButton = videojs.getComponent("MenuButton");
  const MenuItem = videojs.getComponent("MenuItem");

  class ProjectionMenuItem extends (MenuItem as any) {
    projection: Projection;
    constructor(player: videojs.Player, projection: Projection, selected: boolean) {
      super(player, { label: PROJ_LABELS[projection], selectable: true, selected });
      this.projection = projection;
    }
    handleClick() {
      // Clear sibling selections
      const cb: any = this.player().getChild("controlBar");
      const btn: any = cb?.getChild("ProjectionMenuButton");
      btn?.items?.forEach((i: any) => i.selected(false));
      this.selected(true);

      // Use Video.js event bus instead of DOM CustomEvent
      this.player().trigger("projection:select", { projection: this.projection });

      super.handleClick();
    }
  }

  class ProjectionMenuButton extends (MenuButton as any) {
    items!: ProjectionMenuItem[];
    current: Projection;

    constructor(player: videojs.Player, options: any = {}) {
      super(player, options);
      this.current = options.initialProjection || "NONE";
      this.controlText("Projection");
    }

    buildCSSClass() {
      const base = super.buildCSSClass?.() || "";
      return `vjs-projection-menu-button vjs-menu-button vjs-menu-button-popup vjs-control vjs-button vjs-icon-cog ${base}`;
    }

    createItems() {
      // Trim to your preferred set; add others if needed
      const projections: Projection[] = [
        "NONE", "180", "180_LR", "360", "360_LR", "360_TB", "Cube",
        // "EAC", "EAC_LR",
      ];
      this.items = projections.map(
        (p) => new ProjectionMenuItem(this.player(), p, p === this.current)
      );
      return this.items;
    }
  }

  (videojs as any).registerComponent("ProjectionMenuItem", ProjectionMenuItem);
  (videojs as any).registerComponent("ProjectionMenuButton", ProjectionMenuButton);
}

// ---------- React component ----------
interface VideoPlayerProps {
  src: string;
  width?: number;
  height?: number;
  initialProjection?: Projection;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  width = 640,
  height = 360,
  initialProjection = "NONE",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<videojs.Player | null>(null);
  const [projection, setProjection] = useState<Projection>(initialProjection);

  // (Re)build player whenever src or projection changes
  useEffect(() => {
    if (!containerRef.current) return;

    // Dispose old player
    if (playerRef.current) {
      try { playerRef.current.dispose(); } catch {}
      playerRef.current = null;
    }
    containerRef.current.innerHTML = "";

    const videoEl = document.createElement("video");
    videoEl.className = "video-js vjs-default-skin vjs-big-play-centered";
    videoEl.playsInline = true;
    videoEl.setAttribute("playsinline", "true");
    videoEl.crossOrigin = "anonymous";
    // ensure muted inline autoplay compatibility
    videoEl.muted = true;
    videoEl.setAttribute("muted", "");
    videoEl.style.width = "100%";
    videoEl.style.height = "100%";
    containerRef.current.appendChild(videoEl);

    // Init player
    const player = videojs(videoEl, {
      controls: true,
      preload: "auto",
      autoplay: true,        // request autoplay
      muted: true,           // required for most browsers
      width,
      height,
      sources: [
        { src, type: src.endsWith(".m3u8") ? "application/x-mpegURL" : "video/mp4" },
      ],
      controlBar: {
        children: [
          "playToggle",
          "currentTimeDisplay",
          "progressControl",
          "durationDisplay",
          "volumePanel",
          "ProjectionMenuButton",
          "fullscreenToggle",
        ],
      },
    }) as videojs.Player;

    playerRef.current = player;

    // Sync initial selection in the menu
    const cb: any = player.getChild("controlBar");
    const btn: any = cb?.getChild("ProjectionMenuButton");
    if (btn) {
      btn.current = projection;
      btn.items?.forEach((i: any) => i.selected(i.projection === projection));
    }

    // Init VR plugin with current projection (call once per instance)
    player.ready(() => {
      // force muted + attempt playback (gracefully ignore block)
      try { player.muted(true); } catch {}
      try { player.play()?.catch(() => {}); } catch {}

      const anyPlayer = player as any;
      if (typeof anyPlayer.vr === "function") {
        anyPlayer.vr({ projection, debug: false, forceCardboard: false });
      } else {
        console.error("videojs-vr not attached");
      }
    });

    // Listen for projection changes via Video.js event bus
    const onSelect = (_e: any, data: { projection?: Projection }) => {
      if (data?.projection) setProjection(data.projection);
    };
    player.on("projection:select", onSelect);

    // Cleanup
    return () => {
      player.off("projection:select", onSelect);
      try { player.dispose(); } catch {}
      playerRef.current = null;
    };
  }, [src, projection, width, height]);

  return (
    <div
      ref={containerRef}
      style={{ width, height, background: "#000", position: "relative" }}
    />
  );
};

export default VideoPlayer;