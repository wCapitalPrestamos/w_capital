import { z } from "zod";
import { getHandoffPauseHours } from "@/lib/conversations";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: el bot escala la conversación a un humano
// (pregunta fuera de alcance o el cliente pidió hablar con una asesora).

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  reason: z.enum(["out_of_scope", "client_requested", "other"]).default("out_of_scope"),
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
    .select("id, unread_count")
    .eq("channel", body.channel)
    .eq("external_thread_id", body.external_thread_id)
    .maybeSingle();

  if (!conversation) {
    return Response.json(
      { ok: false, error: "conversation not found" },
      { status: 404 },
    );
  }

  const pauseHours = await getHandoffPauseHours(db);
  const pausedUntil = new Date(Date.now() + pauseHours * 3600_000).toISOString();

  const { error } = await db
    .from("conversations")
    .update({
      status: "human",
      bot_paused_until: pausedUntil,
      // Asegura que la conversación resalte en la bandeja
      unread_count: Math.max(1, conversation.unread_count),
    })
    .eq("id", conversation.id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  await db.from("webhook_events").insert({
    source: "n8n:handoff",
    payload: raw ?? {},
    processed: true,
  });

  return Response.json({ ok: true, paused_until: pausedUntil });
}
