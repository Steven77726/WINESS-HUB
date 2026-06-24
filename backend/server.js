import "dotenv/config";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPushStore } from "./store.js";

const config = loadConfig();
webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const store = createPushStore(supabase);
const app = createApp({ store, webpushClient: webpush, corsOrigins: config.corsOrigins });
const server = app.listen(config.port, "0.0.0.0", () => console.log(`Winess Hub Push :${config.port}`));

process.on("SIGTERM", () => server.close(() => process.exit(0)));
