import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMessengerProfileName } from "@/lib/meta/send";
import type { Channel, Contact, Conversation } from "@/lib/types";

// Upserts de contacto y conversación por identidad externa (wa_id / PSID).
// Se usa desde las rutas /api/n8n/* con el cliente service-role.

export async function findOrCreateContact(
  db: SupabaseClient,
  channel: Channel,
  externalThreadId: string,
  name?: string,
  phone?: string,
): Promise<Contact> {
  const idColumn = channel === "whatsapp" ? "wa_id" : "messenger_psid";

  const { data: existing } = await db
    .from("contacts")
    .select("*")
    .eq(idColumn, externalThreadId)
    .maybeSingle();

  if (existing) {
    // Completa nombre/teléfono si aún no los teníamos
    let resolvedName = name;
    if (!resolvedName && !existing.full_name && channel === "messenger") {
      resolvedName = (await getMessengerProfileName(externalThreadId)) ?? undefined;
    }
    const patch: Record<string, string> = {};
    if (resolvedName && !existing.full_name) patch.full_name = resolvedName;
    if (phone && !existing.phone) patch.phone = phone;
    if (Object.keys(patch).length > 0) {
      await db.from("contacts").update(patch).eq("id", existing.id);
    }
    return { ...existing, ...patch } as Contact;
  }

  // Messenger no manda el nombre del cliente en el webhook (a diferencia de
  // WhatsApp) — se pide aparte con el token de la página al crear el contacto.
  let resolvedName = name;
  if (!resolvedName && channel === "messenger") {
    resolvedName = (await getMessengerProfileName(externalThreadId)) ?? undefined;
  }

  const { data: created, error } = await db
    .from("contacts")
    .insert({
      [idColumn]: externalThreadId,
      full_name: resolvedName ?? "",
      phone: phone ?? null,
      source_channel: channel,
    })
    .select("*")
    .single();

  if (error) throw new Error(`contact insert failed: ${error.message}`);
  return created as Contact;
}

export async function findOrCreateConversation(
  db: SupabaseClient,
  contactId: string,
  channel: Channel,
  externalThreadId: string,
): Promise<Conversation> {
  const { data: existing } = await db
    .from("conversations")
    .select("*")
    .eq("channel", channel)
    .eq("external_thread_id", externalThreadId)
    .maybeSingle();

  if (existing) return existing as Conversation;

  const { data: created, error } = await db
    .from("conversations")
    .insert({
      contact_id: contactId,
      channel,
      external_thread_id: externalThreadId,
    })
    .select("*")
    .single();

  if (error) throw new Error(`conversation insert failed: ${error.message}`);
  return created as Conversation;
}

// Aplica la reanudación automática del bot: si estaba en 'human' y el timer
// expiró, vuelve a 'bot'. Devuelve la conversación actualizada.
export async function applyBotAutoResume(
  db: SupabaseClient,
  conversation: Conversation,
): Promise<Conversation> {
  if (
    conversation.status === "human" &&
    conversation.bot_paused_until &&
    new Date(conversation.bot_paused_until).getTime() < Date.now()
  ) {
    const { data } = await db
      .from("conversations")
      .update({ status: "bot", bot_paused_until: null, human_since: null })
      .eq("id", conversation.id)
      .select("*")
      .single();
    if (data) return data as Conversation;
  }
  return conversation;
}

export async function getHandoffPauseHours(db: SupabaseClient): Promise<number> {
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "handoff_pause_hours")
    .maybeSingle();
  const hours = Number(data?.value);
  return Number.isFinite(hours) && hours > 0 ? hours : 4;
}
