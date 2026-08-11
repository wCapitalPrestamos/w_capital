"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, Search, User } from "lucide-react";
import { ChannelIcon } from "@/components/inbox/channel-icon";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ConversationListItem = Conversation & {
  contact: { id: string; full_name: string; phone: string | null } | null;
};

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
    <aside className="flex h-full w-80 shrink-0 flex-col border-r bg-card">
      <div className="border-b p-3">
        <h2 className="mb-2 px-1 text-lg font-semibold">Bandeja</h2>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono"
            className="pl-8"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Todas</TabsTrigger>
            <TabsTrigger value="mine" className="flex-1">Mías</TabsTrigger>
            <TabsTrigger value="unassigned" className="flex-1">Sin asignar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
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
                "flex items-start gap-3 border-b px-3 py-3 transition-colors hover:bg-accent/40",
                active && "bg-accent/60",
              )}
            >
              <div className="relative mt-0.5">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  {name.slice(0, 1).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
                  <ChannelIcon channel={c.channel} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelativeTime(c.last_message_at)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {c.last_preview || "…"}
                  </p>
                  {c.unread_count > 0 && (
                    <Badge className="size-5 shrink-0 justify-center rounded-full p-0 text-[10px]">
                      {c.unread_count > 9 ? "9+" : c.unread_count}
                    </Badge>
                  )}
                </div>
                <div className="mt-1">
                  {c.status === "bot" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      <Bot className="size-3" /> Bot
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                      <User className="size-3" /> Humano
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
