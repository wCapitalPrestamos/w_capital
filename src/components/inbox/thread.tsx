"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Send,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  markConversationRead,
  reassignConversation,
  resolveNeedsHuman,
  returnToBot,
  sendMessage,
  takeConversation,
} from "@/actions/inbox";
import { ChannelIcon } from "@/components/inbox/channel-icon";
import { ReassignSelect } from "@/components/reassign-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { channelLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type { Contact, Conversation, Message, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const WINDOW_MS = 24 * 3600_000;

// Reloj cuantizado a 30 s (0 en el servidor) — mantiene fresca la ventana de 24 h
function useMinuteNow(): number {
  return useSyncExternalStore(
    (onChange) => {
      const timer = setInterval(onChange, 30_000);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => 0,
  );
}

export function Thread({
  conversation: initialConversation,
  contact,
  initialMessages,
  profile,
  profileNames,
  assignableProfiles,
}: {
  conversation: Conversation;
  contact: Contact;
  initialMessages: Message[];
  profile: Profile;
  profileNames: Record<string, string>;
  assignableProfiles: { id: string; full_name: string }[];
}) {
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, startSending] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
    markConversationRead(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`thread-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // Reconcilia con el mensaje optimista del composer
            const withoutTemp = prev.filter(
              (m) =>
                !(
                  m.id.startsWith("temp-") &&
                  m.direction === "outbound" &&
                  m.body === incoming.body
                ),
            );
            return [...withoutTemp, incoming];
          });
          if (incoming.direction === "inbound") {
            setConversation((c) => ({
              ...c,
              last_inbound_at: incoming.sent_at ?? incoming.created_at,
            }));
            markConversationRead(conversation.id);
          }
          setTimeout(scrollToBottom, 50);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversation.id}`,
        },
        (payload) => {
          setConversation((c) => ({ ...c, ...(payload.new as Conversation) }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, scrollToBottom]);

  const now = useMinuteNow();

  const lastInbound = conversation.last_inbound_at
    ? new Date(conversation.last_inbound_at).getTime()
    : null;
  const outsideWindow =
    now > 0 && (lastInbound === null || now - lastInbound > WINDOW_MS);

  const handleSend = () => {
    const body = draft.trim();
    if (!body || sending) return;

    const temp: Message = {
      id: `temp-${crypto.randomUUID()}`,
      conversation_id: conversation.id,
      direction: "outbound",
      sender_type: "agent",
      sender_profile_id: profile.id,
      message_type: "text",
      body,
      media_url: null,
      media_storage_path: null,
      external_message_id: null,
      status: "queued",
      error_detail: null,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    setDraft("");
    setTimeout(scrollToBottom, 50);

    startSending(async () => {
      const result = await sendMessage(conversation.id, body);
      if (!result.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== temp.id));
        setDraft(body);
        toast.error(result.error ?? "No se pudo enviar.");
      }
    });
  };

  const name = contact.full_name || contact.phone || "Sin nombre";
  const isBotStatus = conversation.status === "bot";
  const canReassign =
    profile.role === "admin" || conversation.assigned_to === profile.id;

  return (
    <div className="grid h-full min-h-0 min-w-0 flex-1 grid-rows-[auto_1fr_auto] overflow-hidden bg-background">
      {/* Encabezado */}
      <header className="flex shrink-0 items-center justify-between gap-3.5 border-b border-line-2 bg-surface px-6 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-[13px] bg-brand-soft text-sm font-semibold text-brand-ink">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <Link
              href={`/clientes/${contact.id}`}
              className="block truncate text-[14.5px] font-semibold tracking-[-.01em] hover:text-brand"
            >
              {name}
            </Link>
            <p className="flex items-center gap-1.5 text-xs text-ink-2">
              <ChannelIcon channel={conversation.channel} />
              {channelLabels[conversation.channel]}
              {contact.phone ? ` · ${contact.phone}` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {isBotStatus ? (
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-line-2 px-[11px] text-[11.5px] font-semibold text-ink-2">
              <Bot className="size-3.5" /> Bot activo
            </span>
          ) : canReassign ? (
            <ReassignSelect
              value={conversation.assigned_to}
              options={assignableProfiles}
              placeholder="Reasignar"
              className="h-[26px] rounded-full border-transparent bg-ok-soft px-[11px] py-0 text-[11.5px] font-semibold text-ok data-placeholder:text-ok"
              onAssign={(profileId) =>
                reassignConversation(conversation.id, profileId)
              }
            />
          ) : (
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-ok-soft px-[11px] text-[11.5px] font-semibold text-ok">
              <User className="size-3.5" />
              {conversation.assigned_to
                ? (profileNames[conversation.assigned_to] ?? "Asignada")
                : "Humano"}
            </span>
          )}
          {!isBotStatus && conversation.human_since && (
            <span
              className={cn(
                "text-[11.5px] font-medium",
                now > 0 &&
                  now - new Date(conversation.human_since).getTime() > 3600_000
                  ? "text-warn"
                  : "text-ink-3",
              )}
            >
              tomada {formatRelativeTime(conversation.human_since)}
            </span>
          )}
          {conversation.needs_human && (
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-warn-soft px-[11px] text-[11.5px] font-semibold text-warn">
              <AlertCircle className="size-3.5" />
              Requiere atención
            </span>
          )}
          {isBotStatus ? (
            <Button size="sm" onClick={() => takeConversation(conversation.id)}>
              Atender
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => returnToBot(conversation.id)}
            >
              Devolver al bot
            </Button>
          )}
          {conversation.needs_human && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolveNeedsHuman(conversation.id)}
            >
              Marcar resuelto
            </Button>
          )}
        </div>
      </header>

      {/* Mensajes */}
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto scrollbar-hidden px-6 py-[22px]">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} profileNames={profileNames} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compositor */}
      <footer className="shrink-0 border-t border-line-2 bg-surface px-6 pt-3.5 pb-[18px]">
        {isBotStatus && (
          <div className="mb-[11px] flex items-center gap-2.5 rounded-xl bg-line-2 px-[13px] py-2.5 text-xs leading-[1.45] text-ink-2">
            <Bot className="size-[15px] shrink-0" />
            El bot está activo en esta conversación. Dale "Atender" para tomarla y poder responder.
          </div>
        )}
        {!isBotStatus && outsideWindow && (
          <div className="mb-[11px] flex items-center gap-2.5 rounded-xl bg-warn-soft px-[13px] py-2.5 text-xs leading-[1.45] text-warn">
            <Clock className="size-[15px] shrink-0" />
            {conversation.channel === "whatsapp"
              ? "Pasaron más de 24 h del último mensaje del cliente: solo se pueden enviar plantillas aprobadas de WhatsApp."
              : "Pasaron más de 24 h del último mensaje del cliente: Messenger ya no permite responder."}
          </div>
        )}
        <div className="flex items-end gap-2.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isBotStatus
                ? "El bot está contestando esta conversación"
                : outsideWindow
                  ? "Fuera de la ventana de 24 horas"
                  : `Responder a ${name}…`
            }
            disabled={isBotStatus || outsideWindow || sending}
            className="max-h-36 min-h-11 flex-1 resize-none rounded-[14px]"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!draft.trim() || isBotStatus || outsideWindow || sending}
            aria-label="Enviar"
            className="size-11 rounded-[14px]"
          >
            <Send className="size-[17px]" />
          </Button>
        </div>
        <p className="mx-0.5 mt-[9px] text-[11px] text-ink-3">
          Enter envía · Shift + Enter salta de línea
        </p>
      </footer>
    </div>
  );
}

function MessageBubble({
  message: m,
  profileNames,
}: {
  message: Message;
  profileNames: Record<string, string>;
}) {
  const isOutbound = m.direction === "outbound";
  const isBot = m.sender_type === "bot";

  const senderLabel = isBot
    ? "Bot"
    : m.sender_type === "agent"
      ? (m.sender_profile_id && profileNames[m.sender_profile_id]) || "Equipo"
      : null;

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[74%] rounded-[18px] px-[15px] py-3 text-[13.5px] leading-[1.5] shadow-card",
          isOutbound
            ? isBot
              ? "rounded-br-md border border-line-2 bg-surface-2 text-ink"
              : "rounded-br-md bg-brand text-white"
            : "rounded-bl-md border border-line-2 bg-surface",
        )}
      >
        {senderLabel && (
          <p
            className={cn(
              "mb-1 flex items-center gap-1 text-[11px] font-semibold",
              isOutbound && !isBot ? "text-white/75" : "text-ink-3",
            )}
          >
            {isBot && <Bot className="size-3" />}
            {senderLabel}
          </p>
        )}
        {m.message_type === "text" || m.message_type === "template" ? (
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
        ) : (
          <p className="italic opacity-80">
            [{mediaLabel(m.message_type)}]{m.body ? ` ${m.body}` : ""}
          </p>
        )}
        <p
          className={cn(
            "mt-1.5 flex items-center justify-end gap-[5px] text-[10.5px]",
            isOutbound && !isBot ? "text-white/70" : "text-ink-3",
          )}
        >
          {formatDateTime(m.sent_at ?? m.created_at)}
          {isOutbound && <StatusTick status={m.status} />}
        </p>
      </div>
    </div>
  );
}

function StatusTick({ status }: { status: Message["status"] }) {
  if (status === "queued") return <Clock className="size-3" />;
  if (status === "sent") return <Check className="size-3" />;
  if (status === "delivered") return <CheckCheck className="size-3" />;
  if (status === "read") return <CheckCheck className="size-3 text-sky-300" />;
  if (status === "failed") return <X className="size-3 text-bad" />;
  return null;
}

function mediaLabel(type: Message["message_type"]): string {
  const labels: Record<string, string> = {
    image: "Imagen",
    audio: "Audio",
    video: "Video",
    document: "Documento",
    location: "Ubicación",
    sticker: "Sticker",
    other: "Adjunto",
  };
  return labels[type] ?? "Adjunto";
}
