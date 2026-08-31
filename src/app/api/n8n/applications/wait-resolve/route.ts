import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: llega un clic de botón (Personal/Negocio) en el interceptor de
// mensajes. Busca si hay una ejecución en pausa esperando esa respuesta para
// este contacto y, si la hay, guarda el tipo de préstamo y devuelve la
// resume URL para que n8n la despierte. Si no hay ninguna (clic tardío, ya
// expiró o ya se resolvió), devuelve found:false y n8n deja pasar el
// mensaje al flujo normal de clasificación.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  borrower_type: z.enum(["personal", "business"]),
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

  const { data: contact } = await db
    .from("contacts")
    .select("id")
    .eq(idColumn, body.external_thread_id)
    .maybeSingle();

  if (!contact) {
    return Response.json({ ok: true, found: false });
  }

  const { data: pending } = await db
    .from("loan_applications")
    .select("id, status, pending_resume_url")
    .eq("contact_id", contact.id)
    .not("pending_resume_url", "is", null)
    .gt("pending_resume_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pending) {
    return Response.json({ ok: true, found: false });
  }

  const resumeUrl = pending.pending_resume_url;

  const { error } = await db
    .from("loan_applications")
    .update({
      borrower_type: body.borrower_type,
      pending_resume_url: null,
      pending_resume_expires_at: null,
    })
    .eq("id", pending.id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  await db.from("application_status_history").insert({
    application_id: pending.id,
    from_status: pending.status,
    to_status: pending.status,
    note: `Tipo de préstamo confirmado vía botón interactivo (${body.channel}): ${body.borrower_type}.`,
  });

  return Response.json({ ok: true, found: true, resume_url: resumeUrl });
}
