import { config } from "dotenv";
import { z } from "zod";
config();

const Env = z.object({
    MXR_KEY_PATH: z.string().min(1),
    MXR_ORG_ID: z.string().min(1),
    API: z.url().min(1),
    PORT: z.coerce.number().default(5174),
    REALTIME_WS_PATH: z.string().default("/ws"),
    MAX_UPLOAD_GB: z.coerce.number().default(20),
})

export const env = Env.parse(process.env);
