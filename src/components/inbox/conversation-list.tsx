"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, Search } from "lucide-react";
import { ChannelIcon } from "@/components/inbox/channel-icon";
import { formatRelativeTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ConversationListItem = Conversation & {
  contact: { id: string; full_name: string; phone: string | null } | null;
};

const TABS = [
  { key: "all", label: "Todas" },
  { key: "mine", label: "Mías" },
  { key: "unassigned", label: "Sin asignar" },
] as const;

export function ConversationList({
  initialConversations,
  profileId,
}: {
  initialConversations: ConversationListItem[];
  profileId: string;
}) {
  const params = useParams<{ conversationId?: string }>();
  const [conversations, setConversations] = useState(initialConversations);
  const [tab, setTab] = useState<"all" | "mine" | "unassigned">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const supabase = createClient();

    const refreshOne = async (id: string) => {
      const { data } = await supabase
        .from("conversations")
        .select("*, contact:contacts(id, full_name, phone)")
        .eq("id", id)
        .single();
      if (!data) return;
      setConversations((prev) => {
        const rest = prev.filter((c) => c.id !== id);
        return [data as ConversationListItem, ...rest].sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime(),
        );
      });
    };

    const channel = supabase
      .channel("inbox-conversations")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        (payload) => refreshOne(payload.new.id as string),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        (payload) => refreshOne(payload.new.id as string),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = useMemo(() => {
    return conversations.filter((c) => {
      if (c.status === "closed") return false;
      if (tab === "mine" && c.assigned_to !== profileId) return false;
      if (tab === "unassigned" && c.assigned_to !== null) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = c.contact?.full_name?.toLowerCase() ?? "";
        const phone = c.contact?.phone ?? "";
        if (!name.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [conversations, tab, profileId, search]);

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-line-2 bg-surface xl:w-[326px]">
      <div className="flex flex-col gap-2.5 border-b border-line-2 p-4 pb-3.5">
        <div className="flex h-[34px] items-center gap-2 rounded-[10px] border border-line-2 bg-surface-2 px-[11px] text-ink-3">
          <Search className="size-[15px] shrink-0" strokeWidth={1.7} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono"
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <div className="flex gap-[3px] rounded-[11px] border border-line-2 bg-surface-2 p-[3px]">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "h-7 flex-1 cursor-pointer rounded-lg border text-xs font-medium transition-all",
                tab === key
                  ? "border-line-2 bg-surface text-ink shadow-card"
                  : "border-transparent bg-transparent text-ink-2 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-3">
            No hay conversaciones aquí.
          </p>
        )}
        {visible.map((c) => {
          const active = params?.conversationId === c.id;
          const name = c.contact?.full_name || c.contact?.phone || "Sin nombre";
          return (
            <Link
              key={c.id}
              href={`/inbox/${c.id}`}
              className={cn(
                "flex gap-3 border-b border-l-2 border-b-line-2 px-4 py-3.5 transition-colors",
                active
                  ? "border-l-brand bg-brand-soft"
                  : "border-l-transparent hover:bg-surface-2",
              )}
            >
              <div className="relative shrink-0">
                <span className="inline-flex size-10 items-center justify-center rounded-[14px] border border-line-2 bg-surface-2 text-sm font-semibold text-ink-2">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <span className="absolute -right-1 -bottom-1 inline-flex rounded-full bg-surface p-0.5">
                  <ChannelIcon channel={c.channel} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13.5px] font-semibold tracking-[-.01em]">
                    {name}
                  </p>
                  <span className="shrink-0 text-[11px] text-ink-3">
                    {formatRelativeTime(c.last_message_at)}
                  </span>
                </div>
                <div className="mt-[3px] flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-ink-2">
                    {c.last_preview || "…"}
                  </p>
                  {c.unread_count > 0 && (
                    <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand px-[5px] text-[10.5px] font-semibold text-white">
                      {c.unread_count > 9 ? "9+" : c.unread_count}
                    </span>
                  )}
                </div>
                <div className="mt-[7px] flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex h-[19px] items-center rounded-full px-2 text-[10.5px] font-semibold",
                      c.status === "bot"
                        ? "bg-line-2 text-ink-2"
                        : "bg-ok-soft text-ok",
                    )}
                  >
                    {c.status === "bot" ? "Bot" : "Humano"}
                  </span>
                  {c.needs_human && (
                    <span className="inline-flex h-[19px] items-center gap-1 rounded-full bg-warn-soft px-2 text-[10.5px] font-semibold text-warn">
                      <AlertCircle className="size-[11px]" strokeWidth={2} />
                      Requiere atención
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
