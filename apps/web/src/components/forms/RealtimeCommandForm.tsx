import { useState } from "react";

type Props = {
  deviceId: string;
  defaultType?: "playVideo" | "openGlb" | "raw";
  style?: React.CSSProperties;
};

/**
 * Small form to send a realtime command to a device.
 * Posts to /api/realtime/:id/command with a JSON body.
 */
export function RealtimeCommandForm({ deviceId, defaultType = "playVideo", style }: Props) {
  const [type, setType] = useState<"playVideo" | "pauseVideo" | "resumeVideo" | "stopVideo" | "openGlb" | "closeGlb" | "raw">(defaultType);
  const [input, setInput] = useState("");

  async function send(cmd: unknown) {
    const res = await fetch(`/api/realtime/${encodeURIComponent(deviceId)}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!res.ok) {
      throw new Error(`Command failed: ${res.status} ${await res.text()}`);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (type === "playVideo") {
        const url = input.trim();
        if (!url) throw new Error("Enter a video URL.");
        await send({ type: "video.play", url, projection: "360", stereo: "mono", startTime: 0 });
      } else if (type === "pauseVideo") {
        await send({ type: "video.pause" });
      } else if (type === "resumeVideo") {
        await send({ type: "video.resume" });
      } else if (type === "stopVideo") {
        await send({ type: "video.stop" });
      } else if (type === "openGlb") {
        const url = input.trim();
        if (!url) throw new Error("Enter a GLB URL.");
        await send({ type: "model.load", url});
      } else if (type === "closeGlb") {
        await send({ type: "model.close" });
      } else {
        // raw JSON passthrough
        const json = JSON.parse(input);
        await send(json);
      }
      // optional: clear input on success
      // setInput("");
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, alignItems: "center", ...(style || {}) }}>
      <select value={type} onChange={e => setType(e.target.value as any)}>
        <option value="playVideo">Play Video</option>
        <option value="pauseVideo">Pause Video</option>
        <option value="resumeVideo">Resume Video</option>
        <option value="stopVideo">Stop Video</option>
        <option value="openGlb">Open GLB</option>
        <option value="closeGlb">Close GLB</option>
        <option value="raw">Raw JSON</option>
      </select>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={
          type === "raw"
            ? `{"type":"playVideo","url":"https://…"}`
            : type === "playVideo"
            ? "https://…/file.mp4"
            : "https://…/file.glb"
        }
        style={{ width: 360 }}
      />
      <button type="submit">Send</button>
    </form>
  );
}
