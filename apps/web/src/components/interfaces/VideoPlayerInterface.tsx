async function sendCommand(cmd: object) {
    await fetch("/api/realtime/clients/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cmd),
    }).catch(console.error);
}

export async function OpenVideo(path: string) {
    sendCommand({
        type: "video.play",
        url: path,
    });
    console.log("Open Video: ", path);
}

export async function CloseVideo() {
    sendCommand({
        type: "video.stop"
    })
    console.log("Close Video");
}

export async function PauseVideo() {
    sendCommand({
        type: "video.pause"
    })
    console.log("Pause Video");
}

export async function ResumeVideo() {
    sendCommand({
        type: "video.resume"
    })
    console.log("Resume Video");
}

export async function SeekVideo(t: number) {
    sendCommand({
        type: "video.seek",
        timeCode: t
    })
    console.log("Seek Video:" , t);
}

export async function ChangeProjection(projection: string) {
    const stereo =
        projection.includes("TB") ? "tb" :
            projection.includes("LR") ? "sbs" : "mono";
    const proj = projection.includes("180") ? "180" : "360";
    const mapping = projection === "Cube" ? "cubemap" : "equirectangular";

    sendCommand({
        type: "video.changeMapping",
        mapping,
        projection: proj,
        stereo,
    });
    console.log("Changed Video Mapping: " , projection);
}
