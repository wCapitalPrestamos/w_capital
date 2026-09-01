import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: el nodo Wait del menú "Info" llegó a su límite de 24h sin que
// el cliente tocara ningún botón. Solo limpia el pendiente vencido — a
// diferencia de loan_applications, contacts no tiene tabla de historial
// donde registrar la inactividad.
//
// resume_url identifica DE QUÉ ejecución viene este timeout. Si el cliente
// escribió "Info" dos veces sin tocar el primer menú, hay una espera más
// nueva sobre el mismo contacto — este timeout (el de la primera) no debe
// pisarla, por eso solo limpia si pending_resume_url sigue siendo el mismo.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  resume_url: z.string().url(),
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
  const idColumn = body.channel === "whatsapp" ? "wa_id" : "messenger_psid";

  const { error } = await db
    .from("contacts")
    .update({
      pending_resume_url: null,
      pending_resume_expires_at: null,
      pending_resume_kind: null,
    })
    .eq(idColumn, body.external_thread_id)
    .eq("pending_resume_url", body.resume_url);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
