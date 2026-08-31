import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: guarda la transcripción (Whisper) de una nota de voz en el
// mensaje ya registrado (vía /api/n8n/inbound). Llamada aparte de
// /api/n8n/media-upload porque en el workflow no hay una conexión de grafo
// segura entre el nodo que sube el archivo y el que transcribe el audio.

const bodySchema = z.object({
  external_message_id: z.string().min(1),
  transcript: z.string().min(1),
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

  const { error } = await db
    .from("messages")
    .update({ body: parsed.data.transcript })
    .eq("external_message_id", parsed.data.external_message_id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
