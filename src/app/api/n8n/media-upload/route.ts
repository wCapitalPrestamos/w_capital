import { z } from "zod";
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

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

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

  const ext = EXT_BY_MIME[mime_type] ?? "bin";
  const path = `${channel}/${external_thread_id}/${external_message_id}.${ext}`;
  const buffer = Buffer.from(file_base64, "base64");

  const { error } = await db.storage.from("chat-media").upload(path, buffer, {
    contentType: mime_type,
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
