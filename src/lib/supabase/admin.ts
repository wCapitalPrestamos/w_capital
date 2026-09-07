import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente service-role: IGNORA RLS. Solo para rutas /api/n8n/*, /api/portal/*,
// /api/cron/* y el rate limiting de login (src/lib/login-rate-limit.ts, tabla
// sin políticas propias). Nunca importar desde componentes.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
