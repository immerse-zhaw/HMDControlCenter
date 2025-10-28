import { config } from "dotenv";
import { z } from "zod";

config();

const Env = z.object({
    MXR_KEY_PATH: z.string().min(1),
    MXR_ORG_ID: z.string().min(1),
    MXR_DEFAULT_CONFIG_ID: z.string().min(1),
    MXR_CLI: z.string().min(1),
    MXR_HOME_APP_ID: z.string().min(1),
    API: z.url().min(1),
    API_VERSION: z.string().min(1),

    STORAGE_BACKEND : z.enum(["s3", "local"]).default("local"),
    LOCAL_STORAGE_ROOT: z.string().min(1),
    MAX_UPLOAD_GB: z.coerce.number().default(20),
    
    REALTIME_WS_PATH: z.string().min(1),
    PORT: z.coerce.number().default(5174),
})

export const env = Env.parse(process.env);