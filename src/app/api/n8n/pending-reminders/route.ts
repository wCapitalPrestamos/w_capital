import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUploadToken } from "@/lib/upload-tokens";

// n8n → CRM: junta solicitudes en docs_pending que llevan rato sin actividad,
// para mandar un único recordatorio. Marca reminder_sent_at al devolverlas
// para que no se repita aunque el workflow corra de nuevo.

const REMINDER_AFTER_HOURS = 24;

export async function POST(request: Request) {
  if (!isValidN8nRequest(request)) return unauthorized();

  const db = createAdminClient();
  const cutoff = new Date(Date.now() - REMINDER_AFTER_HOURS * 3600_000).toISOString();

  const { data: applications, error } = await db
    .from("loan_applications")
    .select("id, contact:contacts(id, full_name)")
    .eq("status", "docs_pending")
    .is("reminder_sent_at", null)
    .lt("created_at", cutoff);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!applications || applications.length === 0) {
    return Response.json({ ok: true, reminders: [] });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const reminders: {
    application_id: string;
    channel: "whatsapp" | "messenger";
    external_thread_id: string;
    contact_name: string;
    url: string;
  }[] = [];

  for (const app of applications) {
    const contact = app.contact as unknown as { id: string; full_name: string } | null;
    if (!contact) continue;

    const { data: conversation } = await db
      .from("conversations")
      .select("channel, external_thread_id")
      .eq("contact_id", contact.id)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversation) continue;

    // Liga nueva: el token original no es recuperable (solo guardamos su hash).
    const { rawToken, tokenHash } = generateUploadToken();
    const { error: tokenError } = await db.from("upload_tokens").insert({
      token_hash: tokenHash,
      application_id: app.id,
      contact_id: contact.id,
    });
    if (tokenError) continue;

    reminders.push({
      application_id: app.id,
      channel: conversation.channel as "whatsapp" | "messenger",
      external_thread_id: conversation.external_thread_id,
      contact_name: contact.full_name || "",
      url: `${base}/subir/${rawToken}`,
    });
  }

  // Se marca de una vez, antes de que n8n confirme el envío: preferimos
  // arriesgar un recordatorio perdido a mandarlo dos veces por un reintento.
  if (reminders.length > 0) {
    await db
      .from("loan_applications")
      .update({ reminder_sent_at: new Date().toISOString() })
      .in(
        "id",
        reminders.map((r) => r.application_id),
      );
  }

  return Response.json({ ok: true, reminders });
}
