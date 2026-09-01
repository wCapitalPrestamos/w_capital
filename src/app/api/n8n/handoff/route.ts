import { z } from "zod";
import { applyBotAutoResume, getHandoffPauseHours } from "@/lib/conversations";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: el bot marca la conversación para que un humano la revise.
//
// - "client_requested" / "other": el cliente pidió explícitamente hablar con
//   alguien → se pausa el bot (status: "human") hasta que una asesora lo
//   retome o pase el tiempo de auto-resume.
// - "out_of_scope": el bot no supo responder algo puntual, pero el cliente no
//   pidió un humano → solo se marca needs_human, el bot sigue contestando
//   todo lo demás con normalidad.

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

  const { data: conversationRow } = await db
    .from("conversations")
    .select("*")
    .eq("channel", body.channel)
    .eq("external_thread_id", body.external_thread_id)
    .maybeSingle();

  if (!conversationRow) {
    return Response.json(
      { ok: false, error: "conversation not found" },
      { status: 404 },
    );
  }

  // Si venía "closed"/paused-vencido, normaliza primero (mismo criterio que
  // /api/n8n/inbound) — el patch de abajo decide el estado final real.
  const conversation = await applyBotAutoResume(db, conversationRow);

  const shouldPause = body.reason !== "out_of_scope";

  const patch: Record<string, unknown> = {
    // needs_human/open_attention_count los mantiene el trigger de
    // conversation_attention_events (ver insert más abajo) — así cada
    // llamada de handoff se acumula en vez de pisar la anterior.
    // Asegura que la conversación resalte en la bandeja
    unread_count: Math.max(1, conversation.unread_count),
  };

  let pausedUntil: string | null = null;
  if (shouldPause) {
    const pauseHours = await getHandoffPauseHours(db);
    pausedUntil = new Date(Date.now() + pauseHours * 3600_000).toISOString();
    patch.status = "human";
    patch.bot_paused_until = pausedUntil;
    if (conversation.status !== "human") {
      patch.human_since = new Date().toISOString();
    }
  }

  const { error } = await db
    .from("conversations")
    .update(patch)
    .eq("id", conversation.id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Vincula el evento al mensaje entrante que lo disparó, si hay uno reciente.
  const { data: lastInbound } = await db
    .from("messages")
    .select("id")
    .eq("conversation_id", conversation.id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await db.from("conversation_attention_events").insert({
    conversation_id: conversation.id,
    message_id: lastInbound?.id ?? null,
    reason: body.reason,
  });

  await db.from("webhook_events").insert({
    source: "n8n:handoff",
    payload: raw ?? {},
    processed: true,
  });

  return Response.json({ ok: true, paused: shouldPause, paused_until: pausedUntil });
}
