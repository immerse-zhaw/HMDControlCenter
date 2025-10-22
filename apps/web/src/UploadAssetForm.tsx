import React, { useState } from 'react';

export function AssetUploadForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<'glb' | 'video'>('video');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr(null);
    setProgress(0);

    const fd = new FormData();
    fd.append('type', type);
    fd.append('file', file);

    // use XHR to get upload progress
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/assets/upload');
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) setProgress(Math.round(100 * evt.loaded / evt.total));
    };
    xhr.onerror = () => {
      setErr('Network error during upload');
      setBusy(false);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setFile(null);
        setProgress(0);
        setBusy(false);
        onDone(); // refresh list
      } else {
        setErr(`Upload failed: ${xhr.status} ${xhr.responseText}`);
        setBusy(false);
      }
    };
    xhr.send(fd);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <label>
        Type:{' '}
        <select value={type} onChange={e => setType(e.target.value as 'glb'|'video')}>
          <option value="video">Video</option>
          <option value="glb">GLB</option>
        </select>
      </label>
      <input
        type="file"
        accept={type === 'glb' ? '.glb,model/gltf-binary' : 'video/*'}
        onChange={e => setFile(e.target.files?.[0] ?? null)}
      />
      <button type="submit" disabled={!file || busy}>
        {busy ? `Uploading… ${progress}%` : 'Upload Asset'}
      </button>
      {err && <span style={{ color: 'crimson' }}>{err}</span>}
    </form>
  );
}
