import { getChatStaleMinutes } from "@/lib/conversations";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Conversation } from "@/lib/types";

// Evento B: conversaciones tomadas por un humano que llevan X minutos sin
// respuesta desde el último mensaje del cliente. `last_message_at ===
// last_inbound_at` es la señal de "nadie contestó después" — si un agente ya
// respondió, last_message_at avanza más allá de last_inbound_at.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const staleMinutes = await getChatStaleMinutes(db);
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();

  const { data: candidates, error } = await db
    .from("conversations")
    .select("*")
    .eq("status", "human")
    .not("last_inbound_at", "is", null)
    .lt("last_inbound_at", cutoff)
    .returns<Conversation[]>();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const stale = (candidates ?? []).filter(
    (c) => c.last_inbound_at && c.last_message_at === c.last_inbound_at,
  );

  let notified = 0;
  for (const conversation of stale) {
    const { data: alreadyNotified } = await db
      .from("notifications")
      .select("id")
      .eq("entity_type", "conversation")
      .eq("entity_id", conversation.id)
      .eq("type", "chat_stale")
      .is("read_at", null)
      .maybeSingle();
    if (alreadyNotified) continue;

    const notifyArgs = {
      p_type: "chat_stale",
      p_title: "Chat sin respuesta",
      p_body: `Un cliente lleva más de ${staleMinutes} minutos sin respuesta.`,
      p_entity_type: "conversation",
      p_entity_id: conversation.id,
      p_link_path: `/inbox/${conversation.id}`,
    };
    if (conversation.assigned_to) {
      await db.rpc("notify_profile", { p_recipient_id: conversation.assigned_to, ...notifyArgs });
    } else {
      await db.rpc("notify_role", { p_role: "advisor", ...notifyArgs });
    }
    notified++;
  }

  return Response.json({ ok: true, checked: stale.length, notified });
}
