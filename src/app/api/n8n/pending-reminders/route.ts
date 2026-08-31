import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUploadToken } from "@/lib/upload-tokens";

// n8n → CRM: junta solicitudes en docs_pending que llevan rato sin actividad,
// para mandar un recordatorio. Máximo 2 por solicitud (ver
// 0009_reminder_limit.sql): el primero a las 24h de creada, el segundo a las
// 48h del primero. Incrementa reminder_count al devolverlas para no repetir
// aunque el workflow corra de nuevo.

const REMINDER_AFTER_HOURS = 24;
const SECOND_REMINDER_AFTER_HOURS = 48;
const MAX_REMINDERS = 2;

export async function POST(request: Request) {
  if (!isValidN8nRequest(request)) return unauthorized();

  const db = createAdminClient();
  const now = Date.now();
  const firstCutoff = now - REMINDER_AFTER_HOURS * 3600_000;
  const secondCutoff = now - SECOND_REMINDER_AFTER_HOURS * 3600_000;

  const { data: applications, error } = await db
    .from("loan_applications")
    .select(
      "id, created_at, reminder_count, last_reminder_sent_at, contact:contacts(id, full_name)",
    )
    .eq("status", "docs_pending")
    .lt("reminder_count", MAX_REMINDERS);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const dueApplications = (applications ?? []).filter((app) => {
    if (app.reminder_count === 0) {
      return new Date(app.created_at).getTime() < firstCutoff;
    }
    return (
      app.last_reminder_sent_at !== null &&
      new Date(app.last_reminder_sent_at).getTime() < secondCutoff
    );
  });

  if (dueApplications.length === 0) {
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

  for (const app of dueApplications) {
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

    // Se marca de una vez, antes de que n8n confirme el envío: preferimos
    // arriesgar un recordatorio perdido a mandarlo dos veces por un reintento.
    const { error: reminderError } = await db
      .from("loan_applications")
      .update({
        reminder_count: app.reminder_count + 1,
        last_reminder_sent_at: new Date().toISOString(),
      })
      .eq("id", app.id);
    if (reminderError) continue;

    reminders.push({
      application_id: app.id,
      channel: conversation.channel as "whatsapp" | "messenger",
      external_thread_id: conversation.external_thread_id,
      contact_name: contact.full_name || "",
      url: `${base}/subir/${rawToken}`,
    });
  }

  return Response.json({ ok: true, reminders });
}
