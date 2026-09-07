import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_IDENTIFIER = 5;
const MAX_ATTEMPTS_PER_IP = 20;
const CLEANUP_MAX_AGE_HOURS = 24;

// Cuenta intentos fallidos recientes por correo y por IP para decidir si se
// bloquea el intento actual. Dos límites porque un límite por IP demasiado
// estricto bloquearía oficinas compartiendo IP, y uno solo por correo no
// frena a alguien probando muchos correos distintos desde la misma IP.
export async function isLoginRateLimited(
  identifier: string,
  ip: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const [byIdentifier, byIp] = await Promise.all([
    admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier)
      .eq("success", false)
      .gte("created_at", since),
    admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("success", false)
      .gte("created_at", since),
  ]);

  return (
    (byIdentifier.count ?? 0) >= MAX_ATTEMPTS_PER_IDENTIFIER ||
    (byIp.count ?? 0) >= MAX_ATTEMPTS_PER_IP
  );
}

export async function recordLoginAttempt(
  identifier: string,
  ip: string,
  success: boolean,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("login_attempts").insert({ identifier, ip, success });

  // Barrido simple: la tabla es de bajo volumen (CRM interno, pocos
  // empleados), así que borrar en cada intento es suficiente para que no
  // crezca sin límite.
  const cutoff = new Date(
    Date.now() - CLEANUP_MAX_AGE_HOURS * 3600_000,
  ).toISOString();
  await admin.from("login_attempts").delete().lt("created_at", cutoff);
}
