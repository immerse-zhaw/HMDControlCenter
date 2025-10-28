import express from "express";
import { env } from "./config/env.js";
import { setupWebSocketServer } from "./realtime/websocket.js";
import { apiRouter } from "./routes/index.js";


const app = express();
app.use(express.json());


app.use("/api", apiRouter);


const server = app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${env.PORT}`);
});


setupWebSocketServer(server, env.REALTIME_WS_PATH);