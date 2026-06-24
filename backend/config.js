const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT"
];

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key] || /colle_ici|ton-projet/.test(env[key]));
  if (missing.length) throw new Error(`Variables manquantes : ${missing.join(", ")}`);

  return {
    port: Number(env.PORT || 8787),
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    vapidPublicKey: env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY,
    vapidSubject: env.VAPID_SUBJECT,
    corsOrigins: (env.CORS_ORIGIN || "http://127.0.0.1:4177,https://steven77726.github.io")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
}
