import { z } from "zod";
import { applyBotAutoResume } from "@/lib/conversations";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: el bot marca la conversación para que un humano la revise.
//
// Este endpoint NUNCA pasa la conversación a "human" ni pausa el bot: solo
// registra un evento de atención y la resalta en la bandeja. El cambio a
// humano es decisión de una persona desde el CRM (tomar la conversación o
// responderla), y desde ahí se reanuda sola al vencer el timer.
//
// Se hace así a propósito: la IA no debe silenciar al bot por su cuenta. Si
// interpreta mal un mensaje, el cliente se quedaría sin respuesta hasta que
// alguien lo note. El `reason` solo se guarda en el evento de atención.
//
// Nota: una posible cancelación de solicitud NO se maneja aquí — eso requiere
// confirmación explícita del cliente (ver /api/n8n/applications/cancel), no
// una interpretación de la IA sobre este endpoint.

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
  // /api/n8n/inbound).
  const conversation = await applyBotAutoResume(db, conversationRow);

  // needs_human/open_attention_count los mantiene el trigger de
  // conversation_attention_events (ver insert más abajo) — así cada
  // llamada de handoff se acumula en vez de pisar la anterior. Aquí solo se
  // asegura que la conversación resalte en la bandeja.
  const { error } = await db
    .from("conversations")
    .update({ unread_count: Math.max(1, conversation.unread_count) })
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

  const { error: attentionError } = await db
    .from("conversation_attention_events")
    .insert({
      conversation_id: conversation.id,
      message_id: lastInbound?.id ?? null,
      reason: body.reason,
    });
  if (attentionError) {
    console.error("[handoff] no se pudo registrar el evento de atención", attentionError);
  }

  // Evento B: el bot marcó la conversación como que necesita atención humana
  // — sea porque el cliente lo pidió explícitamente o porque el mensaje
  // salió de lo que el bot sabe manejar (el caso más común en la práctica).
  // Avisa a quien tiene la conversación asignada, o a todas las Asesoras si
  // nadie la tiene tomada aún.
  //
  // Guarda anti-duplicado: si ya hay una notificación de este tipo sin leer
  // para esta conversación, no se manda otra — evita spamear la campana con
  // un aviso por cada mensaje fuera de alcance de una misma conversación.
  const { data: alreadyNotified } = await db
    .from("notifications")
    .select("id")
    .eq("entity_type", "conversation")
    .eq("entity_id", conversation.id)
    .eq("type", "chat_human_requested")
    .is("read_at", null)
    .maybeSingle();

  if (!alreadyNotified) {
    const notifyArgs = {
      p_type: "chat_human_requested",
      p_title:
        body.reason === "client_requested"
          ? "Piden hablar con un humano"
          : "Necesita atención humana",
      p_body:
        body.reason === "client_requested"
          ? "Un cliente pidió hablar con una persona en el chat."
          : "El bot no pudo resolver un mensaje del cliente en el chat.",
      p_entity_type: "conversation",
      p_entity_id: conversation.id,
      p_link_path: `/inbox/${conversation.id}`,
    };
    if (conversation.assigned_to) {
      await db.rpc("notify_profile", { p_recipient_id: conversation.assigned_to, ...notifyArgs });
    } else {
      await db.rpc("notify_role", { p_role: "advisor", ...notifyArgs });
    }
  }

  await db.from("webhook_events").insert({
    source: "n8n:handoff",
    payload: raw ?? {},
    processed: true,
  });

  return Response.json({ ok: true });
}
