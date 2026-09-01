import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: llega un clic de botón del menú "Info" (Requisitos/Tasa/Cómo
// solicitar) en el interceptor de mensajes. Busca si hay una ejecución en
// pausa esperando esa respuesta para este contacto y, si la hay, devuelve la
// resume URL para que n8n la despierte. Si no hay ninguna (clic tardío, ya
// expiró o ya se resolvió), devuelve found:false y n8n deja pasar el
// mensaje al flujo normal de clasificación.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  selection: z.enum(["requisitos", "tasa", "solicitar"]),
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
    .select("id, pending_resume_url, pending_resume_expires_at, pending_resume_kind")
    .eq(idColumn, body.external_thread_id)
    .maybeSingle();

  const hasPending =
    contact?.pending_resume_kind === "info_menu" &&
    !!contact.pending_resume_url &&
    !!contact.pending_resume_expires_at &&
    new Date(contact.pending_resume_expires_at).getTime() > Date.now();

  if (!contact || !hasPending) {
    return Response.json({ ok: true, found: false });
  }

  const resumeUrl = contact.pending_resume_url;

  const { error } = await db
    .from("contacts")
    .update({
      pending_resume_url: null,
      pending_resume_expires_at: null,
      pending_resume_kind: null,
    })
    .eq("id", contact.id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, found: true, resume_url: resumeUrl });
}
