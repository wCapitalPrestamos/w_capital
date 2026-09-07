import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: el cliente confirmó con un clic ("Sí, cancelar") que quiere
// cancelar su solicitud, tras la pregunta que le mandó el bot al detectar
// una posible declinación. Solo aquí se toca el status — nunca por la sola
// interpretación de la IA del mensaje original.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
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

  const { data: conversation } = await db
    .from("conversations")
    .select("id, contact_id")
    .eq("channel", body.channel)
    .eq("external_thread_id", body.external_thread_id)
    .maybeSingle();

  if (!conversation) {
    return Response.json({ ok: true, cancelled: 0 });
  }

  const { data: applications } = await db
    .from("loan_applications")
    .select("id")
    .eq("contact_id", conversation.contact_id)
    .eq("status", "docs_pending");

  if (!applications || applications.length === 0) {
    return Response.json({ ok: true, cancelled: 0 });
  }

  // El clic del botón no queda registrado como mensaje (igual que los demás
  // botones de este bot) — el mensaje de texto más reciente es el que
  // realmente disparó la pregunta de cancelación.
  const { data: lastMessage } = await db
    .from("messages")
    .select("body")
    .eq("conversation_id", conversation.id)
    .eq("direction", "inbound")
    .eq("message_type", "text")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const note = lastMessage?.body
    ? `Cliente canceló vía chatbot, tras confirmar con un clic — último mensaje: "${lastMessage.body}"`
    : "Cliente canceló vía chatbot, tras confirmar con un clic.";

  let cancelled = 0;
  for (const app of applications) {
    const { error } = await db
      .from("loan_applications")
      .update({ status: "cancelled" })
      .eq("id", app.id);
    if (error) {
      console.error("[applications/cancel] no se pudo cancelar", app.id, error);
      continue;
    }
    cancelled += 1;

    // handle_application_status_change ya insertó la fila de historial por el
    // cambio de status (sin nota) — se completa con el motivo aquí, en vez de
    // duplicar el registro con un segundo insert.
    const { data: historyRow } = await db
      .from("application_status_history")
      .select("id")
      .eq("application_id", app.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (historyRow) {
      await db
        .from("application_status_history")
        .update({ note })
        .eq("id", historyRow.id);
    }
  }

  return Response.json({ ok: true, cancelled });
}
