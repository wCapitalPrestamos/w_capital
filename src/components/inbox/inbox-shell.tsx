"use client";

import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

// En escritorio la lista y la conversación siempre se ven lado a lado. En
// móvil no cabe encimar las dos — se muestra solo una según la ruta activa:
// /inbox (sin conversationId) => lista; /inbox/[id] => conversación. Se usa
// la URL como fuente de verdad en vez de estado propio porque ya es la
// forma en que estas dos vistas se distinguen.
export function InboxShell({
  list,
  children,
}: {
  list: React.ReactNode;
  children: React.ReactNode;
}) {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const hasConversation = Boolean(conversationId);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden animate-rise-in">
      <div
        className={cn(
          "w-full md:w-auto md:shrink-0",
          hasConversation ? "hidden md:flex" : "flex",
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-hidden",
          hasConversation ? "flex" : "hidden md:flex",
        )}
      >
        {children}
      </div>
    </div>
  );
}
