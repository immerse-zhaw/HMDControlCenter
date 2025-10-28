import { useRef, useState } from "react";

export function UploadButton({
    label = "Upload",
    accept = "*/*",
    endpoint,
    fieldName,
    onDone,
}: {
    label?: string,
    accept?: string,
    endpoint: string,
    fieldName: string,
    onDone?: () => void,
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string>("");

    const pickFile = () => fileRef.current?.click();

    async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setBusy(true);
        setMessage("Uploading...");
        try {
            const formData = new FormData();
            formData.append(fieldName, file);
            const res = await fetch(endpoint, {
                method: "POST",
                body: formData,
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || `Upload failed with status ${res.status}`);
            setMessage("Upload successful");
            onDone?.();
        } catch (err : any) {
            setMessage(err?.message || "Upload failed");
        } finally {
            e.target.value = "";
            setBusy(false);
            setTimeout(() => setMessage(""), 5000);
        }
    }

    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <button onClick={pickFile} disabled={busy}>{busy ? "Uploading…" : label}</button>
            <input
                ref={fileRef}
                type="file"
                style={{ display: "none" }}
                accept={accept}
                onChange={onPickFile}
            />
            {message && <small>{message}</small>}
        </span>
    );
}