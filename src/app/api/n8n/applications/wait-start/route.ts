import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: justo antes de pausar el flujo en un nodo Wait (esperando que
// el cliente elija "Personal"/"Negocio" en el template interactivo), guarda
// la resume URL de esa ejecución para poder despertarla cuando llegue el clic.

const bodySchema = z.object({
  application_id: z.string().uuid(),
  resume_url: z.string().url(),
  expires_at: z.string().datetime({ offset: true }),
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

  const { error } = await db
    .from("loan_applications")
    .update({
      pending_resume_url: body.resume_url,
      pending_resume_expires_at: body.expires_at,
    })
    .eq("id", body.application_id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
