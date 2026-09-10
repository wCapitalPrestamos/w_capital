"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  Pause,
  Play,
  Reply,
  Send,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  closeConversation,
  markConversationRead,
  reassignConversation,
  resolveNeedsHuman,
  returnToBot,
  sendMediaMessage,
  sendMessage,
  takeConversation,
} from "@/actions/inbox";
import { ChannelIcon } from "@/components/inbox/channel-icon";
import { VoiceRecorderButton } from "@/components/inbox/voice-recorder-button";
import { ReassignSelect } from "@/components/reassign-select";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatPhone, formatRelativeTime } from "@/lib/format";
import { channelLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type { Contact, Conversation, Message, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const WINDOW_MS = 24 * 3600_000;

export function Thread({
  conversation: initialConversation,
  contact,
  initialMessages,
  initialAttentionMessageIds,
  profile,
  profileNames,
  assignableProfiles,
}: {
  conversation: Conversation;
  contact: Contact;
  initialMessages: Message[];
  initialAttentionMessageIds: string[];
  profile: Profile;
  profileNames: Record<string, string>;
  assignableProfiles: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [attentionMessageIds, setAttentionMessageIds] = useState(
    () => new Set(initialAttentionMessageIds),
  );
  const [draft, setDraft] = useState("");
  const [sending, startSending] = useTransition();
  const [attaching, startAttaching] = useTransition();
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [closing, startClosing] = useTransition();
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [takingOver, startTakeover] = useTransition();
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [attentionCursor, setAttentionCursor] = useState(0);

  const handleClose = () => {
    startClosing(async () => {
      await closeConversation(conversation.id);
      toast.success("Conversación cerrada.");
      router.push("/inbox");
    });
  };

  const handleTake = () => {
    startTakeover(async () => {
      try {
        await takeConversation(conversation.id);
        setConversation((c) => ({
          ...c,
          status: "human",
          assigned_to: profile.id,
          human_since: new Date().toISOString(),
        }));
      } catch {
        toast.error("No se pudo tomar la conversación.");
      }
    });
  };

  const handleReturnToBot = () => {
    startTakeover(async () => {
      try {
        await returnToBot(conversation.id);
        setConversation((c) => ({
          ...c,
          status: "bot",
          assigned_to: null,
          human_since: null,
          bot_paused_until: null,
        }));
      } catch {
        toast.error("No se pudo devolver al bot.");
      }
    });
  };

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleMessagesScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowJumpToBottom(distanceFromBottom > 200);
    },
    [],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
    markConversationRead(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Reconcilia el estado local con la base cuando se pierde algún evento
    // (canal caído, pestaña en segundo plano, etc.)
    const resync = async () => {
      const [
        { data: freshMessages },
        { data: freshConversation },
        { data: freshAttention },
      ] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true })
          .limit(500),
        supabase
          .from("conversations")
          .select("*")
          .eq("id", conversation.id)
          .single<Conversation>(),
        supabase
          .from("conversation_attention_events")
          .select("message_id")
          .eq("conversation_id", conversation.id)
          .is("resolved_at", null)
          .not("message_id", "is", null),
      ]);
      if (cancelled) return;
      if (freshMessages) {
        setMessages((prev) => {
          const pending = prev.filter((m) => m.id.startsWith("temp-"));
          return [...(freshMessages as Message[]), ...pending];
        });
      }
      if (freshConversation) {
        setConversation((c) => ({ ...c, ...freshConversation }));
      }
      if (freshAttention) {
        setAttentionMessageIds(
          new Set(freshAttention.map((e) => e.message_id as string)),
        );
      }
    };

    // El cliente de Supabase Realtime ya reconecta el socket y reintenta la
    // suscripción de cada canal solo; no hace falta (ni conviene) recrear el
    // canal a mano aquí.
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
            return [...withoutTemp, incoming].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            );
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_attention_events",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const event = payload.new as {
            message_id: string | null;
            resolved_at: string | null;
          };
          if (!event.message_id) return;
          setAttentionMessageIds((prev) => {
            const next = new Set(prev);
            if (payload.eventType === "INSERT") next.add(event.message_id!);
            else if (event.resolved_at) next.delete(event.message_id!);
            return next;
          });
        },
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resync();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [conversation.id, scrollToBottom]);

  const messagesById = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages],
  );

  const attentionOrder = useMemo(
    () =>
      messages.filter((m) => attentionMessageIds.has(m.id)).map((m) => m.id),
    [messages, attentionMessageIds],
  );

  const goToNextAttention = () => {
    if (attentionOrder.length === 0) return;
    const idx = attentionCursor % attentionOrder.length;
    messageRefs.current[attentionOrder[idx]]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setAttentionCursor(idx + 1);
  };

  // Referencias estables para que MessageBubble (memoizado) no vuelva a
  // renderizar las ~500 burbujas en cada cambio ajeno (ej. cada tecla del
  // compositor) solo porque el callback era una función nueva cada vez.
  const handleReply = useCallback((message: Message) => {
    setReplyTarget(message);
  }, []);

  const handleResolveAttention = useCallback(
    (messageId: string) => {
      setAttentionMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      setConversation((c) => {
        const nextCount = Math.max(c.open_attention_count - 1, 0);
        return {
          ...c,
          open_attention_count: nextCount,
          needs_human: nextCount > 0,
        };
      });
      resolveNeedsHuman(conversation.id, messageId);
    },
    [conversation.id],
  );

  const now = useMinuteNow();

  const lastInbound = conversation.last_inbound_at
    ? new Date(conversation.last_inbound_at).getTime()
    : null;
  const outsideWindow =
    now > 0 && (lastInbound === null || now - lastInbound > WINDOW_MS);

  const handleSend = () => {
    const body = draft.trim();
    if (!body || sending) return;

    const replyToId = replyTarget?.id;

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
      reply_to_message_id: replyToId ?? null,
    };
    setMessages((prev) => [...prev, temp]);
    setDraft("");
    setReplyTarget(null);
    setTimeout(scrollToBottom, 50);

    startSending(async () => {
      const result = await sendMessage(conversation.id, body, replyToId);
      if (!result.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== temp.id));
        setDraft(body);
        toast.error(result.error ?? "No se pudo enviar.");
      }
    });
  };

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || attaching || outsideWindow || conversation.status === "bot")
      return;

    const formData = new FormData();
    formData.append("file", file);
    if (replyTarget) formData.append("replyToMessageId", replyTarget.id);
    const toastId = toast.loading("Enviando adjunto…");

    startAttaching(async () => {
      const result = await sendMediaMessage(conversation.id, formData);
      toast.dismiss(toastId);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo enviar el adjunto.");
      } else {
        setReplyTarget(null);
        setTimeout(scrollToBottom, 50);
      }
    });
  };

  const handleSendRecording = (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    if (replyTarget) formData.append("replyToMessageId", replyTarget.id);
    const toastId = toast.loading("Enviando nota de voz…");

    startAttaching(async () => {
      const result = await sendMediaMessage(conversation.id, formData);
      toast.dismiss(toastId);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo enviar la nota de voz.");
      } else {
        setReplyTarget(null);
        setTimeout(scrollToBottom, 50);
      }
    });
  };

  const name = contact.full_name || formatPhone(contact.phone) || "Sin nombre";
  const isBotStatus = conversation.status === "bot";
  const canReassign =
    profile.role === "admin" || conversation.assigned_to === profile.id;

  return (
    <div className="grid h-full min-h-0 min-w-0 flex-1 grid-rows-[auto_1fr_auto] overflow-hidden bg-background">
      {/* Encabezado */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3.5 gap-y-2 border-b border-line-2 bg-surface px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/inbox"
            aria-label="Volver a la bandeja"
            className="-ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-line-2 md:hidden"
          >
            <ArrowLeft className="size-[18px]" strokeWidth={1.8} />
          </Link>
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
              {contact.phone ? ` · ${formatPhone(contact.phone)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
              tomada {formatRelativeTime(conversation.human_since, now)}
            </span>
          )}
          {isBotStatus ? (
            <Button size="sm" onClick={handleTake} disabled={takingOver}>
              Atender
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleReturnToBot}
              disabled={takingOver}
            >
              Devolver al bot
            </Button>
          )}
          {conversation.needs_human && (
            <>
              <span
                className="mx-0.5 h-5 w-px shrink-0 bg-line-2"
                aria-hidden
              />
              <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-warn-soft px-[11px] text-[11.5px] font-semibold text-warn">
                <AlertCircle className="size-3.5" />
                Requiere atención
                {conversation.open_attention_count > 1 &&
                  ` (${conversation.open_attention_count})`}
              </span>
              {attentionOrder.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-warn/40 text-warn hover:bg-warn-soft"
                  onClick={goToNextAttention}
                >
                  <ArrowRight className="size-3.5" />
                  Ir al pendiente
                  {attentionOrder.length > 1 &&
                    ` (${(attentionCursor % attentionOrder.length) + 1}/${attentionOrder.length})`}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="border-warn/40 text-warn hover:bg-warn-soft"
                onClick={() => {
                  setAttentionMessageIds(new Set());
                  setConversation((c) => ({
                    ...c,
                    open_attention_count: 0,
                    needs_human: false,
                  }));
                  resolveNeedsHuman(conversation.id);
                }}
              >
                <Check className="size-3.5" />
                Marcar todo resuelto
              </Button>
            </>
          )}
          {conversation.status !== "closed" && (
            <>
              <span
                className="mx-0.5 h-5 w-px shrink-0 bg-line-2"
                aria-hidden
              />
              <Button
                size="sm"
                variant="outline"
                className="text-ink-3 hover:text-destructive"
                onClick={() => setCloseConfirmOpen(true)}
                disabled={closing}
                title="Archiva la conversación fuera de la bandeja activa"
              >
                <Archive className="size-4" /> Cerrar
              </Button>
            </>
          )}
        </div>
      </header>

      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar esta conversación?</DialogTitle>
          </DialogHeader>
          <p className="px-7 py-7 text-sm text-muted-foreground">
            Se archiva fuera de la bandeja activa. Si {name} vuelve a escribir,
            se reabre sola automáticamente.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseConfirmOpen(false)}
              disabled={closing}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setCloseConfirmOpen(false);
                handleClose();
              }}
              disabled={closing}
            >
              {closing ? "Cerrando…" : "Sí, cerrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mensajes */}
      <div className="relative min-h-0 min-w-0">
        <div
          ref={messagesRef}
          onScroll={handleMessagesScroll}
          className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-y-auto scrollbar-hidden px-6 py-[22px]"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              ref={(el) => {
                messageRefs.current[m.id] = el;
              }}
            >
              <MessageBubble
                message={m}
                profileNames={profileNames}
                needsAttention={attentionMessageIds.has(m.id)}
                quotedMessage={
                  m.reply_to_message_id
                    ? (messagesById.get(m.reply_to_message_id) ?? null)
                    : null
                }
                onReply={handleReply}
                onResolveAttention={handleResolveAttention}
              />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {showJumpToBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Bajar hasta el final"
            className="absolute bottom-4 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-line-2 bg-surface text-ink-2 shadow-card transition-colors hover:text-ink"
          >
            <ChevronDown className="size-[18px]" />
          </button>
        )}
      </div>

      {/* Compositor */}
      <footer className="shrink-0 border-t border-line-2 bg-surface px-6 pt-3.5 pb-[18px]">
        {isBotStatus && (
          <div className="mb-[11px] flex items-center gap-2.5 rounded-xl bg-line-2 px-[13px] py-2.5 text-xs leading-[1.45] text-ink-2">
            <Bot className="size-[15px] shrink-0" />
            El bot está activo en esta conversación. Dale &quot;Atender&quot;
            para tomarla y poder responder.
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
        {replyTarget && (
          <div className="mb-[11px] flex items-center gap-2.5 rounded-xl border border-line-2 bg-surface-2 py-2 pl-3 pr-2">
            <Reply className="size-4 shrink-0 text-ink-3" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-ink-2">
                Respondiendo a{" "}
                {replyTarget.direction === "inbound" ? name : "tu mensaje"}
              </p>
              <p className="truncate text-[12px] text-ink-3">
                {messagePreviewText(replyTarget)}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setReplyTarget(null)}
              aria-label="Cancelar respuesta"
              className="size-7 shrink-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
        <div className="flex items-end gap-2.5">
          {!recordingVoice && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="hidden"
                onChange={handleAttach}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBotStatus || outsideWindow || attaching}
                aria-label="Adjuntar archivo"
                className="size-11 shrink-0 rounded-[14px]"
              >
                {attaching ? (
                  <Loader2 className="size-[17px] animate-spin" />
                ) : (
                  <Paperclip className="size-[17px]" />
                )}
              </Button>
            </>
          )}
          <VoiceRecorderButton
            disabled={isBotStatus || outsideWindow || attaching}
            onRecordingChange={setRecordingVoice}
            onSend={handleSendRecording}
          />
          {!recordingVoice && (
            <>
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
                disabled={
                  !draft.trim() || isBotStatus || outsideWindow || sending
                }
                aria-label="Enviar"
                className="size-11 rounded-[14px]"
              >
                <Send className="size-[17px]" />
              </Button>
            </>
          )}
        </div>
        <p className="mx-0.5 mt-[9px] text-[11px] text-ink-3">
          Enter envía · Shift + Enter salta de línea
        </p>
      </footer>
    </div>
  );
}

const PENDING_MEDIA_TIMEOUT_MS = 2 * 60_000;

const MessageBubble = memo(function MessageBubble({
  message: m,
  profileNames,
  needsAttention = false,
  quotedMessage = null,
  onReply,
  onResolveAttention,
}: {
  message: Message;
  profileNames: Record<string, string>;
  needsAttention?: boolean;
  quotedMessage?: Message | null;
  onReply?: (message: Message) => void;
  onResolveAttention?: (messageId: string) => void;
}) {
  const now = useMinuteNow();
  const isOutbound = m.direction === "outbound";
  const isBot = m.sender_type === "bot";

  const senderLabel = isBot
    ? "Bot"
    : m.sender_type === "agent"
      ? (m.sender_profile_id && profileNames[m.sender_profile_id]) || "Equipo"
      : null;

  return (
    <div
      className={cn(
        "group flex min-w-0 w-full items-start gap-1.5",
        isOutbound ? "justify-end" : "justify-start",
      )}
    >
      {!isOutbound && needsAttention && (
        <button
          type="button"
          onClick={() => onResolveAttention?.(m.id)}
          title="Marcar este mensaje como resuelto"
          aria-label="Marcar este mensaje como resuelto"
          className="mt-3 shrink-0 text-warn hover:text-warn/70"
        >
          <AlertCircle className="size-3.5" />
        </button>
      )}
      {onReply && !m.id.startsWith("temp-") && (
        <button
          type="button"
          onClick={() => onReply(m)}
          aria-label="Responder a este mensaje"
          className={cn(
            "mt-3 shrink-0 text-ink-3 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100",
            !isOutbound && "order-last",
          )}
        >
          <Reply className="size-3.5" />
        </button>
      )}
      <div
        className={cn(
          "max-w-[74%] rounded-[18px] px-[15px] py-3 text-[13.5px] leading-[1.5] shadow-card",
          isOutbound
            ? "rounded-br-md bg-brand text-white"
            : needsAttention
              ? "rounded-bl-md border border-warn/40 bg-warn-soft"
              : "rounded-bl-md border border-line-2 bg-surface",
        )}
      >
        {quotedMessage && (
          <p
            className={cn(
              "mb-1.5 truncate rounded-md border-l-2 px-2 py-1 text-[12px]",
              isOutbound
                ? "border-white/40 bg-white/10 text-white/80"
                : "border-line-2 bg-surface-2 text-ink-2",
            )}
          >
            {messagePreviewText(quotedMessage)}
          </p>
        )}
        {senderLabel && (
          <p
            className={cn(
              "mb-1 flex items-center gap-1 text-[11px] font-semibold",
              isOutbound ? "text-white/75" : "text-ink-3",
            )}
          >
            {isBot && <Bot className="size-3" />}
            {senderLabel}
          </p>
        )}
        {m.message_type === "text" || m.message_type === "template" ? (
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
        ) : m.message_type === "location" ? (
          <LocationContent body={m.body} />
        ) : m.media_storage_path ? (
          <MediaContent message={m} isOutbound={isOutbound} />
        ) : (
          <PendingMedia message={m} now={now} />
        )}
        <p
          className={cn(
            "mt-1.5 flex items-center justify-end gap-[5px] text-[10.5px]",
            isOutbound ? "text-white/70" : "text-ink-3",
          )}
        >
          {formatDateTime(m.sent_at ?? m.created_at)}
          {isOutbound && <StatusTick status={m.status} />}
        </p>
      </div>
    </div>
  );
});

function LocationContent({ body }: { body: string }) {
  const match = body.match(/https:\/\/www\.google\.com\/maps\?q=\S+/);
  if (!match) return <p className="whitespace-pre-wrap break-words">{body}</p>;
  return (
    <p className="whitespace-pre-wrap break-words">
      {body.slice(0, match.index)}
      <a
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Ver ubicación
      </a>
    </p>
  );
}

function PendingMedia({ message: m, now }: { message: Message; now: number }) {
  const sentAt = new Date(m.sent_at ?? m.created_at).getTime();
  const stale = now > 0 && now - sentAt > PENDING_MEDIA_TIMEOUT_MS;
  return (
    <p className={cn("italic", stale ? "opacity-80" : "opacity-60")}>
      {stale
        ? "No se pudo recibir este adjunto."
        : `Recibiendo ${mediaLabel(m.message_type).toLowerCase()}…`}
      {m.body ? ` ${m.body}` : ""}
    </p>
  );
}

function MediaContent({
  message: m,
  isOutbound,
}: {
  message: Message;
  isOutbound: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const url = `/api/media/${m.id}`;

  if (failed) {
    return (
      <p className="italic opacity-80">
        [{mediaLabel(m.message_type)}] No se pudo cargar el adjunto.
      </p>
    );
  }

  if (m.message_type === "image" || m.message_type === "sticker") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element -- ruta propia que redirige a una URL firmada fresca, no aplica next/image */}
        <img
          src={url}
          alt={mediaLabel(m.message_type)}
          className="block max-w-[260px] rounded-lg"
          onError={() => setFailed(true)}
        />
      </a>
    );
  }

  if (m.message_type === "audio") {
    return (
      <div className="flex flex-col gap-1.5">
        <AudioPlayer
          url={url}
          isOutbound={isOutbound}
          onError={() => setFailed(true)}
        />
        {m.body && (
          <p
            className={cn(
              "mt-2 w-[238px] break-words text-[12px] leading-[1.4]",
              isOutbound ? "text-white/90" : "text-ink-2",
            )}
          >
            {m.body}
          </p>
        )}
      </div>
    );
  }

  if (m.message_type === "video") {
    return (
      <video
        controls
        src={url}
        className="block max-w-[260px] rounded-lg"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 underline"
    >
      <FileText className="size-4 shrink-0" />
      {m.body || "Ver documento"}
    </a>
  );
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function makeWaveform(seedStr: string, count = 26): number[] {
  const seed = hashSeed(seedStr);
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const v =
      Math.abs(Math.sin(i * 12.9898 + seed * 0.0078233) * 43758.5453) % 1;
    bars.push(Math.round(4 + v * 18));
  }
  return bars;
}

const SPEEDS = [1, 1.5, 2] as const;

function AudioPlayer({
  url,
  isOutbound,
  onError,
}: {
  url: string;
  isOutbound: boolean;
  onError: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const bars = useState(() => makeWaveform(url))[0];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / rect.width),
    );
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
  };

  const ratio = duration > 0 ? currentTime / duration : 0;
  const filledCount = Math.round(ratio * bars.length);
  const playedColor = isOutbound ? "#ffffff" : "var(--brand)";
  const unplayedColor = isOutbound
    ? "rgba(255,255,255,.35)"
    : "rgba(35,37,39,.14)";

  return (
    <div className="flex w-[238px] items-center gap-2.5">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onError={onError}
        className="hidden"
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pausar" : "Reproducir"}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform duration-150 ease-out hover:scale-105 active:scale-95",
          isOutbound ? "bg-white text-brand" : "bg-brand text-white",
        )}
      >
        {playing ? (
          <Pause className="size-3.5 fill-current" />
        ) : (
          <Play className="ml-0.5 size-3.5 fill-current" />
        )}
      </button>
      <div
        onClick={seek}
        className="relative flex h-6 min-w-0 flex-1 cursor-pointer items-center gap-[2px] overflow-hidden"
      >
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-[3px] shrink-0 rounded-[2px] transition-colors duration-150"
            style={{
              height: h,
              background: i < filledCount ? playedColor : unplayedColor,
            }}
          />
        ))}
      </div>
      <span
        className={cn(
          "shrink-0 min-w-[30px] text-right font-mono text-[10.5px] tabular-nums",
          isOutbound ? "text-white/80" : "text-ink-3",
        )}
      >
        {formatAudioTime(playing || currentTime > 0 ? currentTime : duration)}
      </span>
      <button
        type="button"
        onClick={cycleSpeed}
        className={cn(
          "w-8 shrink-0 rounded-full py-[3px] text-center font-mono text-[10px] font-medium",
          isOutbound ? "bg-white/20 text-white" : "bg-line-2 text-ink-2",
        )}
      >
        {speed}×
      </button>
    </div>
  );
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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

// Vista previa en una línea de un mensaje (cita de respuesta, mensaje
// citado) — texto tal cual, o la etiqueta del tipo de adjunto.
function messagePreviewText(m: Message): string {
  return m.message_type === "text" || m.message_type === "template"
    ? m.body
    : mediaLabel(m.message_type);
}
