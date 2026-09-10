"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { formatRelativeTime } from "@/lib/format";
import { notificationTypeLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 20;

// Campana de notificaciones del sidebar — un canal Realtime por usuario
// (mismo patrón que context-rail.tsx por contacto): cada quien solo ve sus
// propias filas de `notifications` (RLS ya lo garantiza; el filtro aquí solo
// evita pedir de más).
export function NotificationBell({
  profileId,
  initialNotifications,
}: {
  profileId: string;
  initialNotifications: Notification[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const now = useMinuteNow();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const refetch = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", profileId)
        .order("created_at", { ascending: false })
        .limit(MAX_SHOWN);
      if (!cancelled) setNotifications(data ?? []);
    };

    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${profileId}`,
        },
        () => refetch(),
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleSelect = (notification: Notification) => {
    if (!notification.read_at) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
      markNotificationRead(notification.id);
    }
    router.push(notification.link_path);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    markAllNotificationsRead();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-line-2 hover:text-ink"
            aria-label="Notificaciones"
          >
            <Bell className="size-[18px]" strokeWidth={1.7} />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 inline-flex size-[15px] items-center justify-center rounded-full bg-brand font-mono text-[9.5px] font-medium text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <DropdownMenuLabel className="p-0 text-[13px] font-semibold">
            Notificaciones
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11.5px] font-medium text-brand hover:underline"
            >
              Marcar todo leído
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[12.5px] text-ink-3">
              Sin notificaciones.
            </p>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleSelect(n)}
                className={cn(
                  "flex flex-col items-start gap-0.5 whitespace-normal rounded-none px-3.5 py-2.5",
                  !n.read_at && "bg-brand-soft/40",
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                    {notificationTypeLabels[n.type]}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-ink-3">
                    {formatRelativeTime(n.created_at, now)}
                  </span>
                </div>
                <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                <p className="text-[12px] leading-snug text-ink-2">{n.body}</p>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
