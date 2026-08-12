"use client";

import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function ClickableRow({
  href,
  className,
  children,
  ...props
}: ComponentProps<typeof TableRow> & { href: string }) {
  const router = useRouter();

  return (
    <TableRow
      role="link"
      tabIndex={0}
      onClick={(e) => {
        // No robar el clic a links, botones u otros controles dentro de la fila.
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </TableRow>
  );
}
