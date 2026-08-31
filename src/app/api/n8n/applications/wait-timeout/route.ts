import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: el nodo Wait llegó a su límite de 24h sin que el cliente
// eligiera Personal/Negocio. No se toca el status (se queda en
// docs_pending) — sólo se limpia el resume pendiente (ya no sirve, esa
// ejecución terminó) y se registra la inactividad para que el equipo la vea.

const bodySchema = z.object({
  application_id: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!isValidN8nRequest(request)) return unauthorized();

  const db = createAdminClient();
  const raw = await request.json().catch(() => null);

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid payload", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;

  const { data: application } = await db
    .from("loan_applications")
    .select("id, status")
    .eq("id", body.application_id)
    .maybeSingle();

  if (!application) {
    return Response.json({ ok: true, found: false });
  }

  await db
    .from("loan_applications")
    .update({ pending_resume_url: null, pending_resume_expires_at: null })
    .eq("id", application.id);

  await db.from("application_status_history").insert({
    application_id: application.id,
    from_status: application.status,
    to_status: application.status,
    note: "Sin respuesta al tipo de préstamo (Personal/Negocio) tras 24h de espera.",
  });

  return Response.json({ ok: true, found: true });
}
