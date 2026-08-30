import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

// Proxy de adjuntos de chat: firma la URL de Storage al momento de la
// petición y redirige. Así <img>/<audio>/<video>/<a> pueden apuntar a esta
// ruta de forma estable sin que la URL firmada expire mientras la pestaña
// del inbox sigue abierta (antes se firmaba una sola vez al montar el
// componente y quedaba muerta a los 10 min).

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  await requireProfile();
  const { messageId } = await params;

  const supabase = await createClient();
  const { data: message } = await supabase
    .from("messages")
    .select("media_storage_path")
    .eq("id", messageId)
    .single<Pick<Message, "media_storage_path">>();

  if (!message?.media_storage_path) {
    return new Response("Adjunto no encontrado.", { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("chat-media")
    .createSignedUrl(message.media_storage_path, 60);

  if (error || !data) {
    return new Response("No se pudo generar la liga del adjunto.", { status: 500 });
  }

  redirect(data.signedUrl);
}
