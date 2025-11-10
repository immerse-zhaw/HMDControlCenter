async function sendCommand(cmd: object) {
    await fetch("/api/realtime/clients/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cmd),
    }).catch(console.error);
}

export async function OpenModel(path: string) {
    sendCommand({
        type: "model.load",
        url: path,
    });
    console.log("Open model: ", path);
}

export async function CloseModel() {
    sendCommand({
        type: "model.close"
    })
    console.log("Close model");
}

export async function ChangePointSize(size: number) {
    sendCommand({
        type: "model.setPointSize",
        size: size

    })
    console.log("Changed point size to: ", size);
}

export async function ChangeScale(scale: number) {
    sendCommand({
        type: "model.setScale",
        scale: scale

    })
    console.log("Changed scale to: ", scale);
}

export async function PlayAnimation(name: string) {
    sendCommand({
        type: "model.playAnimation",
        name: name

    })
    console.log("Play animation: ", name);
}