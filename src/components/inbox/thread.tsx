"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Pause,
  Play,
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
  sendMessage,
  takeConversation,
} from "@/actions/inbox";
import { ChannelIcon } from "@/components/inbox/channel-icon";
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
  const router = useRouter();
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, startSending] = useTransition();
  const [closing, startClosing] = useTransition();
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    startClosing(async () => {
      await closeConversation(conversation.id);
      toast.success("Conversación cerrada.");
      router.push("/inbox");
    });
  };

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

  const name = contact.full_name || formatPhone(contact.phone) || "Sin nombre";
  const isBotStatus = conversation.status === "bot";
  const canReassign =
    profile.role === "admin" || conversation.assigned_to === profile.id;

  return (
    <div className="grid h-full min-h-0 min-w-0 flex-1 grid-rows-[auto_1fr_auto] overflow-hidden bg-background">
      {/* Encabezado */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3.5 gap-y-2 border-b border-line-2 bg-surface px-4 py-3.5 sm:px-6">
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
              tomada {formatRelativeTime(conversation.human_since)}
            </span>
          )}
          {conversation.needs_human && (
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-warn-soft px-[11px] text-[11.5px] font-semibold text-warn">
              <AlertCircle className="size-3.5" />
              Requiere atención
              {conversation.open_attention_count > 1 &&
                ` (${conversation.open_attention_count})`}
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
          {conversation.status !== "closed" && (
            <>
              <span className="mx-0.5 h-5 w-px shrink-0 bg-line-2" aria-hidden />
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
            Se archiva fuera de la bandeja activa. Si {name} vuelve a escribir, se
            reabre sola automáticamente.
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
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto scrollbar-hidden px-6 py-[22px]">
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
            El bot está activo en esta conversación. Dale &quot;Atender&quot; para tomarla y poder responder.
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

const PENDING_MEDIA_TIMEOUT_MS = 2 * 60_000;

function MessageBubble({
  message: m,
  profileNames,
}: {
  message: Message;
  profileNames: Record<string, string>;
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
        "flex min-w-0 w-full",
        isOutbound ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[74%] rounded-[18px] px-[15px] py-3 text-[13.5px] leading-[1.5] shadow-card",
          isOutbound
            ? "rounded-br-md bg-brand text-white"
            : "rounded-bl-md border border-line-2 bg-surface",
        )}
      >
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
}

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
        <AudioPlayer url={url} isOutbound={isOutbound} onError={() => setFailed(true)} />
        {m.body && (
          <p
            className={cn(
              "text-[12px] leading-[1.4]",
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
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex w-[210px] items-center gap-2.5">
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
          "flex size-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-all duration-150 ease-out hover:scale-105 hover:shadow-md active:scale-95",
          isOutbound ? "bg-white text-brand" : "bg-brand text-white",
          playing && (isOutbound ? "ring-4 ring-white/25" : "ring-4 ring-brand/20"),
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
        className={cn(
          "group/bar relative h-1.5 flex-1 cursor-pointer rounded-full transition-[height] duration-150 hover:h-2",
          isOutbound ? "bg-white/30" : "bg-line-2",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-150 ease-linear",
            isOutbound ? "bg-white" : "bg-brand",
          )}
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className={cn(
            "pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 shadow-sm transition-opacity duration-150 group-hover/bar:opacity-100",
            isOutbound ? "bg-white" : "bg-brand",
          )}
          style={{ left: `${progress * 100}%` }}
        />
      </div>
      <span
        className={cn(
          "shrink-0 font-mono text-[10.5px] tabular-nums",
          isOutbound ? "text-white/80" : "text-ink-3",
        )}
      >
        {formatAudioTime(playing || currentTime > 0 ? currentTime : duration)}
      </span>
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
