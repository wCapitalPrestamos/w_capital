"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { getHandoffPauseHours } from "@/lib/conversations";
import {
  MetaSendError,
  sendMessengerText,
  sendWhatsAppText,
} from "@/lib/meta/send";
import { createClient } from "@/lib/supabase/server";
import type { Conversation, Message } from "@/lib/types";

export interface SendMessageResult {
  ok: boolean;
  error?: string;
  outside24h?: boolean;
}

export async function sendMessage(
  conversationId: string,
  text: string,
): Promise<SendMessageResult> {
  const profile = await requireProfile();
  const body = text.trim();
  if (!body) return { ok: false, error: "Mensaje vacío." };

  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single<Conversation>();

  if (!conversation) return { ok: false, error: "Conversación no encontrada." };

  try {
    const result =
      conversation.channel === "whatsapp"
        ? await sendWhatsAppText(conversation.external_thread_id, body)
        : await sendMessengerText(conversation.external_thread_id, body);

    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: "agent",
      sender_profile_id: profile.id,
      message_type: "text",
      body,
      external_message_id: result.externalMessageId,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    if (insertError) {
      return { ok: false, error: `El mensaje se envió pero no se registró: ${insertError.message}` };
    }

    // Al responder un humano, el bot se pausa y la conversación queda asignada
    const pauseHours = await getHandoffPauseHours(supabase);
    await supabase
      .from("conversations")
      .update({
        status: "human",
        bot_paused_until: new Date(Date.now() + pauseHours * 3600_000).toISOString(),
        human_since: conversation.status === "human" ? conversation.human_since : new Date().toISOString(),
        assigned_to: conversation.assigned_to ?? profile.id,
        unread_count: 0,
      })
      .eq("id", conversationId);

    return { ok: true };
  } catch (e) {
    if (e instanceof MetaSendError) {
      if (e.isOutside24hWindow) {
        return {
          ok: false,
          outside24h: true,
          error:
            conversation.channel === "whatsapp"
              ? "Han pasado más de 24 h desde el último mensaje del cliente. WhatsApp solo permite enviar plantillas aprobadas."
              : "Han pasado más de 24 h desde el último mensaje del cliente. Messenger ya no permite responder esta conversación.",
        };
      }
      return { ok: false, error: `Meta rechazó el envío: ${e.message}` };
    }
    return { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." };
  }
}

export async function markConversationRead(conversationId: string) {
  await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
}

export async function returnToBot(conversationId: string) {
  await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("conversations")
    .update({ status: "bot", bot_paused_until: null, human_since: null })
    .eq("id", conversationId);
  revalidatePath(`/inbox/${conversationId}`);
}

export async function takeConversation(conversationId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const pauseHours = await getHandoffPauseHours(supabase);
  await supabase
    .from("conversations")
    .update({
      status: "human",
      bot_paused_until: new Date(Date.now() + pauseHours * 3600_000).toISOString(),
      human_since: new Date().toISOString(),
      assigned_to: profile.id,
    })
    .eq("id", conversationId);
  revalidatePath(`/inbox/${conversationId}`);
}

export async function reassignConversation(
  conversationId: string,
  profileId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("assigned_to")
    .eq("id", conversationId)
    .single<Pick<Conversation, "assigned_to">>();

  if (!conversation) return { ok: false, error: "Conversación no encontrada." };

  const canReassign =
    profile.role === "admin" || conversation.assigned_to === profile.id;
  if (!canReassign) {
    return {
      ok: false,
      error: "Solo administración o quien la tiene asignada puede reasignarla.",
    };
  }

  const pauseHours = await getHandoffPauseHours(supabase);
  const { error } = await supabase
    .from("conversations")
    .update({
      assigned_to: profileId,
      status: "human",
      bot_paused_until: new Date(Date.now() + pauseHours * 3600_000).toISOString(),
    })
    .eq("id", conversationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/inbox/${conversationId}`);
  return { ok: true };
}

export async function resolveNeedsHuman(conversationId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Solo cierra los pendientes que existían al momento del clic — si llegó
  // uno nuevo mientras tanto, se queda abierto y el aviso no se pierde
  // (needs_human/open_attention_count se recalculan solos vía trigger).
  await supabase
    .from("conversation_attention_events")
    .update({ resolved_at: new Date().toISOString(), resolved_by: profile.id })
    .eq("conversation_id", conversationId)
    .is("resolved_at", null);
  revalidatePath(`/inbox/${conversationId}`);
}

export async function closeConversation(conversationId: string) {
  await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("conversations")
    .update({ status: "closed", bot_paused_until: null })
    .eq("id", conversationId);
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${conversationId}`);
}
