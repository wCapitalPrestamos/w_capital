import { MessageSquare } from "lucide-react";

export default function InboxEmptyPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background text-ink-3">
      <span className="flex size-14 items-center justify-center rounded-[18px] border border-line-2 bg-surface shadow-card">
        <MessageSquare className="size-6" strokeWidth={1.5} />
      </span>
      <p className="text-sm">Selecciona una conversación</p>
    </div>
  );
}
