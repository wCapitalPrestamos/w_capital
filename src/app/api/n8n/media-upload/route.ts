import { z } from "zod";
import { CHAT_MEDIA_EXT_BY_MIME } from "@/lib/chat-media";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: sube a Storage un archivo de chat (imagen/audio/video/documento)
// que n8n ya descargó de Meta, y actualiza el mensaje ya registrado (vía
// /api/n8n/inbound, que corre primero) con la ruta en Storage.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  external_message_id: z.string().min(1),
  mime_type: z.string().min(1),
  file_base64: z.string().min(1),
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

  const { channel, external_thread_id, external_message_id, mime_type, file_base64 } =
    parsed.data;

  // WhatsApp suele mandar el mime type de notas de voz con parámetros de
  // códec (p. ej. "audio/ogg; codecs=opus"). Sin normalizar, ni EXT_BY_MIME
  // ni el allow-list del bucket hacen match exacto y la subida se rechaza.
  const baseMimeType = mime_type.split(";")[0].trim();

  const ext = CHAT_MEDIA_EXT_BY_MIME[baseMimeType] ?? "bin";
  const path = `${channel}/${external_thread_id}/${external_message_id}.${ext}`;
  const buffer = Buffer.from(file_base64, "base64");

  const { error } = await db.storage.from("chat-media").upload(path, buffer, {
    contentType: baseMimeType,
    upsert: true,
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { error: updateError } = await db
    .from("messages")
    .update({ media_storage_path: path })
    .eq("external_message_id", external_message_id);

  if (updateError) {
    return Response.json(
      { ok: false, error: `subido pero no se pudo vincular al mensaje: ${updateError.message}` },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, path });
}
