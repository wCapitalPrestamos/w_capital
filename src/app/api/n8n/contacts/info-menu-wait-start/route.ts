import { z } from "zod";
import { findOrCreateContact } from "@/lib/conversations";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: justo antes de pausar el flujo en un nodo Wait (esperando que
// el cliente toque uno de los botones del menú "Info": Requisitos / Tasa /
// Cómo solicitar), guarda la resume URL de esa ejecución. Vive en `contacts`
// (no en loan_applications) porque puede no existir ninguna solicitud aún.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
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
  const contact = await findOrCreateContact(db, body.channel, body.external_thread_id);

  const { error } = await db
    .from("contacts")
    .update({
      pending_resume_url: body.resume_url,
      pending_resume_expires_at: body.expires_at,
      pending_resume_kind: "info_menu",
    })
    .eq("id", contact.id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
