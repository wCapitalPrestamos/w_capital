import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: registro de la respuesta que el bot ya envió,
// para que el hilo completo sea visible en la bandeja.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  external_message_id: z.string().optional(),
  text: z.string().min(1),
  timestamp: z.string().optional(),
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
    .select("id")
    .eq("channel", body.channel)
    .eq("external_thread_id", body.external_thread_id)
    .maybeSingle();

  if (!conversation) {
    return Response.json(
      { ok: false, error: "conversation not found" },
      { status: 404 },
    );
  }

  const { error } = await db.from("messages").insert({
    conversation_id: conversation.id,
    direction: "outbound",
    sender_type: "bot",
    message_type: "text",
    body: body.text,
    external_message_id: body.external_message_id ?? `bot.${crypto.randomUUID()}`,
    status: "sent",
    sent_at: body.timestamp ?? new Date().toISOString(),
  });

  if (error && error.code !== "23505") {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
