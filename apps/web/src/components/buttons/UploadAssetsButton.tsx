import { useRef, useState, useEffect } from "react";

type Props = {
  label?: string;
  onDone?: () => void;
  maxBytes?: number;
};

function humanMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function UploadAssetButton({
  accept,
  assetType, // "video" | "glb"
  label,
  onDone,
  maxBytes,
}: Props & { accept: string; assetType: "video" | "glb" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [hint, setHint] = useState<string>(""); // small note after upload
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const pick = () => inputRef.current?.click();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(null);
    setHint("");
    setFileName(f.name);

    if (maxBytes && f.size > maxBytes) {
      setErr(`File too large: ${humanMB(f.size)} MB`);
      e.target.value = "";
      timer.current = window.setTimeout(() => setErr(null), 5000);
      return;
    }

    setBusy(true);
    setProgress(0);

    const fd = new FormData();
    fd.append("type", assetType);
    fd.append("file", f);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/storage/assets/upload");
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) setProgress(Math.round((100 * evt.loaded) / evt.total));
    };
    xhr.onerror = () => {
      setErr("Network error during upload");
      setBusy(false);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setErr(null);
        setProgress(100);
        setBusy(false);
        setFileName("");
        if (inputRef.current) inputRef.current.value = "";
        // gentle hint for videos
        if (assetType === "video") {
          setHint("Uploaded. Preparing formats…");
          timer.current = window.setTimeout(() => setHint(""), 5000);
        }
        onDone?.();
      } else {
        setErr(`Upload failed: ${xhr.status} ${xhr.responseText || ""}`.trim());
        setBusy(false);
        timer.current = window.setTimeout(() => setErr(null), 5000);
      }
    };
    xhr.send(fd);
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button className="btn" type="button" onClick={pick} disabled={busy} aria-busy={busy}>
        {busy ? `Uploading… ${progress}%` : (label ?? "Upload")}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onPick}
        style={{ display: "none" }}
      />
      {fileName && <small title={fileName}>{fileName}</small>}
      {err && <small style={{ color: "crimson" }} role="status" aria-live="polite">{err}</small>}
      {!err && hint && <small style={{ color: "#9ca3af" }}>{hint}</small>}
    </span>
  );
}

export function UploadVideoButton(props: Props) {
  return (
    <UploadAssetButton
      {...props}
      assetType="video"
      accept="video/*"
      label={props.label ?? "Upload Video"}
    />
  );
}

export function UploadGlbButton(props: Props) {
  return (
    <UploadAssetButton
      {...props}
      assetType="glb"
      accept=".glb,model/gltf-binary"
      label={props.label ?? "Upload GLB"}
    />
  );
}
