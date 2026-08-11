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
  Settings,
  Users,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleLabels } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/inbox", label: "Bandeja", icon: MessageSquare },
  { href: "/leads", label: "Leads", icon: KanbanSquare },
  { href: "/solicitudes", label: "Solicitudes", icon: FileText },
  { href: "/prestamos", label: "Préstamos", icon: HandCoins },
  { href: "/clientes", label: "Clientes", icon: Users },
];

export function AppSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();

  const initials = profile.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-lg font-black italic text-primary-foreground">
          W
        </div>
        <div className="leading-tight">
          <p className="font-semibold">W Capital</p>
          <p className="text-[11px] text-muted-foreground">CRM</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="w-full justify-start gap-3 px-2">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                    {initials || "W"}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-left text-sm">
                  {profile.full_name}
                </span>
              </Button>
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
            <DropdownMenuItem onSelect={() => signOut()}>
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
