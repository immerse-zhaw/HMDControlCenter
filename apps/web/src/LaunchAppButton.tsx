import { useState } from "react";

export function LaunchAppButton({
    appId,
    label = "Play",
    launchParams,
    onDone,
}: {
    appId: string;
    label?: string;
    launchParams?: Record<string, unknown>;
    onDone?: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    async function onLaunch() {
        if (busy) return;
        setBusy(true); setMsg("Launching…");
        try {
            const r = await fetch("/api/managexr/launch-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ packageName: appId, launchParams }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
            setMsg("Launched ✓");
            onDone?.();
        } catch (e: any) {
            setMsg(e?.message || "Launch failed");
        } finally {
            setBusy(false);
            setTimeout(() => setMsg(""), 4000);
        }
    }
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <button onClick={onLaunch} disabled={busy}>
                {busy ? "Launching…" : label}
            </button>
            {msg && <small>{msg}</small>}
        </span>
    );

}

export function LaunchHomeButton({
    label = "Home",
    onDone,
}: {
    label?: string;
    onDone?: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    async function onLaunch() {
        if (busy) return;
        setBusy(true); setMsg("Launching…");
        try {
            const r = await fetch("/api/managexr/home-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
            setMsg("Launched ✓");
            onDone?.();
        } catch (e: any) {
            setMsg(e?.message || "Launch failed");
        } finally {
            setBusy(false);
            setTimeout(() => setMsg(""), 4000);
        }
    }

    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <button onClick={onLaunch} disabled={busy}>
                {busy ? "Going Home…" : label}
            </button>
            {msg && <small>{msg}</small>}
        </span>
    );

}
