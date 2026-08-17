"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  HandCoins,
  KanbanSquare,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  X,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { useSidebar } from "@/components/sidebar-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/format";
import { roleLabels } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, countKey: null },
  { href: "/inbox", label: "Bandeja", icon: MessageSquare, countKey: "inbox" },
  { href: "/leads", label: "Leads", icon: KanbanSquare, countKey: "leads" },
  { href: "/solicitudes", label: "Solicitudes", icon: FileText, countKey: "apps" },
  { href: "/prestamos", label: "Préstamos", icon: HandCoins, countKey: null },
  { href: "/clientes", label: "Clientes", icon: Users, countKey: null },
] as const;

export interface SidebarCounts {
  inbox: number;
  leads: number;
  apps: number;
}

export interface SidebarToday {
  collected: number;
  expected: number;
  paidCount: number;
  dueCount: number;
}

export function AppSidebar({
  profile,
  counts,
  today,
}: {
  profile: Profile;
  counts: SidebarCounts;
  today: SidebarToday;
}) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  const initials = profile.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const progress =
    today.expected > 0
      ? Math.min(100, Math.round((today.collected / today.expected) * 100))
      : 0;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-[252px] shrink-0 flex-col gap-1.5 border-r border-line-2 bg-surface-2 px-3.5 py-5 transition-transform duration-200 md:sticky md:top-0 md:translate-x-0 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-[72px] md:px-2" : "md:w-[252px]",
        )}
      >
        <div className="flex items-center gap-[11px] px-2 pb-[18px]">
          <div className="flex size-[38px] shrink-0 items-center justify-center rounded-[13px] bg-linear-150 from-[#FF7A56] to-[#F04A1F] font-serif text-[23px] leading-none italic text-white shadow-[0_6px_16px_-6px_rgba(247,91,50,.75)]">
            W
          </div>
          <div className={cn("min-w-0 leading-tight", collapsed && "md:hidden")}>
            <p className="truncate font-semibold tracking-[-.01em]">W Capital</p>
            <p className="truncate text-[11px] tracking-[.09em] uppercase text-ink-3">
              CRM
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-line-2 md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="size-[18px]" strokeWidth={1.8} />
          </button>
        </div>

        <p
          className={cn(
            "mb-1 px-2.5 text-[10.5px] font-semibold tracking-[.1em] uppercase text-ink-3",
            collapsed && "md:hidden",
          )}
        >
          Operación
        </p>
        <nav className="flex flex-col gap-[3px]">
          {NAV.map(({ href, label, icon: Icon, countKey }) => {
            const active = pathname.startsWith(href);
            const count = countKey ? counts[countKey] : 0;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-[11px] rounded-[11px] border px-[11px] py-[9px] text-[13.5px] font-medium transition-[background,color,box-shadow] duration-150",
                  collapsed && "md:justify-center md:px-0",
                  active
                    ? "border-line-2 bg-surface text-ink shadow-card"
                    : "border-transparent text-ink-2 hover:bg-line-2 hover:text-ink",
                )}
              >
                <Icon className="size-[17px] shrink-0" strokeWidth={1.7} />
                <span className={cn("flex-1", collapsed && "md:hidden")}>
                  {label}
                </span>
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-[7px] py-px font-mono text-[11px]",
                      collapsed && "md:hidden",
                      active
                        ? "bg-brand-soft text-brand-ink"
                        : "bg-line-2 text-ink-3",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div
          className={cn(
            "rounded-[14px] border border-line-2 bg-surface p-[13px_14px] shadow-card",
            collapsed && "md:hidden",
          )}
        >
          <p className="text-[11px] tracking-[.08em] uppercase text-ink-3">
            Cobranza de hoy
          </p>
          <p className="mt-1.5 font-mono text-[19px] font-medium tracking-[-.02em]">
            {formatMoney(today.collected)}
          </p>
          <div className="mt-[9px] h-[5px] overflow-hidden rounded-full bg-line-2">
            <div
              className="h-full origin-left animate-grow-row rounded-full bg-brand"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[11.5px] text-ink-2">
            {today.dueCount > 0
              ? `${today.paidCount} de ${today.dueCount} cuotas registradas`
              : "Sin cuotas que venzan hoy"}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden items-center justify-center gap-2 rounded-xl px-2 py-2 text-[11.5px] font-medium text-ink-2 transition-colors hover:bg-line-2 md:flex"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-[16px] shrink-0" strokeWidth={1.7} />
          ) : (
            <>
              <PanelLeftClose className="size-[16px] shrink-0" strokeWidth={1.7} />
              <span>Colapsar</span>
            </>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className={cn(
                  "mt-1.5 flex w-full cursor-pointer items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-line-2",
                  collapsed && "md:justify-center",
                )}
              >
                <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11.5px] font-semibold text-brand-ink">
                  {initials || "W"}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 leading-[1.25]",
                    collapsed && "md:hidden",
                  )}
                >
                  <span className="block truncate text-[13px] font-medium">
                    {profile.full_name}
                  </span>
                  <span className="block text-[11px] text-ink-3">
                    {roleLabels[profile.role]}
                  </span>
                </span>
              </button>
            }
          />
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>
              <p>{profile.full_name}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {roleLabels[profile.role]}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {profile.role === "admin" && (
              <DropdownMenuItem
                render={
                  <Link href="/ajustes/usuarios">
                    <Settings className="size-4" />
                    Ajustes
                  </Link>
                }
              />
            )}
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>
    </>
  );
}
