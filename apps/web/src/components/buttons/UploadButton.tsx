import { useRef, useState, useEffect } from "react";


export function UploadButton({
  label = "Upload",
  accept = "*/*",
  endpoint,
  fieldName,
  onDone,
  maxBytes, // optional override
}: {
  label?: string;
  accept?: string;
  endpoint: string;
  fieldName: string;
  onDone?: () => void;
  maxBytes?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const pickFile = () => fileRef.current?.click();

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    // client-side size guard (default ~ env.MAX_UPLOAD_GB, pass from page if needed)
    if (maxBytes && file.size > maxBytes) {
      setMessage(`File too large (${(file.size/1024/1024).toFixed(1)} MB)`);
      e.target.value = "";
      timer.current = window.setTimeout(() => setMessage(""), 5000);
      return;
    }

    setBusy(true);
    setMessage("Uploading…");
    try {
      const formData = new FormData();
      formData.append(fieldName, file);
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Upload failed with ${res.status}`);
      setMessage("Upload successful ✓");
      onDone?.();
    } catch (err: any) {
      setMessage(err?.message || "Upload failed");
    } finally {
      e.target.value = "";
      setBusy(false);
      timer.current = window.setTimeout(() => setMessage(""), 5000);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={pickFile} disabled={busy} aria-busy={busy}>
        {busy ? "Uploading…" : label}
      </button>
      <input ref={fileRef} type="file" style={{ display: "none" }} accept={accept} onChange={onPickFile} />
      {fileName && <small title={fileName}>{fileName}</small>}
      {message && <small aria-live="polite">{message}</small>}
    </span>
  );
}