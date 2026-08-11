import { MessageSquare } from "lucide-react";

export default function InboxEmptyPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <MessageSquare className="size-10" strokeWidth={1.5} />
      <p className="text-sm">Selecciona una conversación</p>
    </div>
  );
}
