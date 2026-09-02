import { z } from "zod";
import {
  applyBotAutoResume,
  findOrCreateContact,
  findOrCreateConversation,
} from "@/lib/conversations";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: mensaje entrante del cliente.
// La respuesta incluye bot_active: si es false, n8n NO debe contestar.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  external_message_id: z.string().min(1),
  contact: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  message: z.object({
    type: z
      .enum(["text", "image", "audio", "video", "document", "location", "sticker", "other"])
      .default("text"),
    // WhatsApp Cloud API limita mensajes de texto a 4096 caracteres; el
    // tope aquí evita guardar/mandar al LLM un body desproporcionado si
    // algún canal futuro no respeta ese límite. Mensajes de solo adjunto
    // (audio/imagen sin caption) llegan con text null desde n8n.
    text: z
      .string()
      .max(4096)
      .nullish()
      .transform((v) => v ?? ""),
    media_url: z.string().nullable().optional(),
    media_storage_path: z.string().nullable().optional(),
    timestamp: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  if (!isValidN8nRequest(request)) return unauthorized();

  const db = createAdminClient();
  const raw = await request.json().catch(() => null);

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    await db.from("webhook_events").insert({
      source: "n8n:inbound",
      payload: raw ?? {},
      processed: false,
      error: parsed.error.message,
    });
    return Response.json(
      { ok: false, error: "invalid payload", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;

  try {
    const contact = await findOrCreateContact(
      db,
      body.channel,
      body.external_thread_id,
      body.contact?.name,
      body.contact?.phone,
    );

    let conversation = await findOrCreateConversation(
      db,
      contact.id,
      body.channel,
      body.external_thread_id,
    );

    conversation = await applyBotAutoResume(db, conversation);

    // Último mensaje saliente (bot o asesor) antes de este — le da al
    // clasificador de IA contexto de un turno para interpretar respuestas
    // cortas ("sí", "no", "va") a su propia pregunta anterior.
    const { data: lastOutbound } = await db
      .from("messages")
      .select("body")
      .eq("conversation_id", conversation.id)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Insert idempotente: Meta reintenta webhooks y n8n puede duplicar
    const { error: insertError } = await db.from("messages").insert({
      conversation_id: conversation.id,
      direction: "inbound",
      sender_type: "client",
      message_type: body.message.type,
      body: body.message.text,
      media_url: body.message.media_url ?? null,
      media_storage_path: body.message.media_storage_path ?? null,
      external_message_id: body.external_message_id,
      status: "received",
      sent_at: body.message.timestamp ?? new Date().toISOString(),
    });

    const isDuplicate =
      insertError !== null && insertError.code === "23505"; // unique_violation
    if (insertError && !isDuplicate) {
      throw new Error(insertError.message);
    }

    await db.from("webhook_events").insert({
      source: "n8n:inbound",
      external_id: body.external_message_id,
      payload: raw ?? {},
      processed: true,
    });

    return Response.json({
      ok: true,
      conversation_id: conversation.id,
      duplicate: isDuplicate,
      bot_active: conversation.status === "bot",
      last_bot_message: lastOutbound?.body ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    await db.from("webhook_events").insert({
      source: "n8n:inbound",
      external_id: body.external_message_id,
      payload: raw ?? {},
      processed: false,
      error: message,
    });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
