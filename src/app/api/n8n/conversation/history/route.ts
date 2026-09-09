import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: ventana deslizante de memoria liviana — los últimos N mensajes
// (cliente + bot) de ESTA conversación, para que la IA pueda entender
// referencias a turnos anteriores (ej. "cámbialo a personal" después de
// haber hablado de una solicitud). Reutiliza la tabla "messages" que ya
// existe para el inbox del CRM (con índice en conversation_id, created_at)
// — no hay tabla ni purga nuevas: es la misma bitácora real, solo se lee
// una rebanada acotada, que ya es barata gracias al índice existente.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional(),
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
  const limit = body.limit ?? 8;

  const { data: conversation } = await db
    .from("conversations")
    .select("id")
    .eq("channel", body.channel)
    .eq("external_thread_id", body.external_thread_id)
    .maybeSingle();

  if (!conversation) {
    return Response.json({ ok: true, messages: [] });
  }

  const { data: rows } = await db
    .from("messages")
    .select("sender_type, body, message_type, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  const messages = (rows ?? [])
    .filter((r) => r.message_type === "text" && r.body.trim() !== "")
    .reverse()
    .map((r) => ({
      role: r.sender_type === "client" ? "cliente" : "asistente",
      text: r.body,
    }));

  return Response.json({ ok: true, messages });
}
