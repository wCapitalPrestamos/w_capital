"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { moveLead } from "@/actions/leads";
import { BoardCardMeta, BoardColumn, boardCardClass } from "@/components/board";
import { BoardZoom } from "@/components/board-zoom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Chip, type ChipTone } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { leadStageLabels, sourceChannelLabels } from "@/lib/labels";
import type { Lead, LeadStage, SourceChannel } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LeadWithContact = Lead & {
  contact: {
    id: string;
    full_name: string;
    phone: string | null;
    source_channel: SourceChannel;
  } | null;
};

const STAGES: { stage: LeadStage; tone: ChipTone; dot: string }[] = [
  { stage: "new", tone: "info", dot: "#F75B32" },
  { stage: "contacted", tone: "neutral", dot: "#8A9096" },
  { stage: "interested", tone: "warn", dot: "#B87400" },
  { stage: "applying", tone: "ok", dot: "#1F8A53" },
  { stage: "discarded", tone: "neutral", dot: "#B4B8BC" },
];

export function LeadsKanban({ initialLeads }: { initialLeads: LeadWithContact[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const newStage = String(over.id) as LeadStage;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    const previous = leads;
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)),
    );

    moveLead(leadId, newStage).then((result) => {
      if (!result.ok) {
        setLeads(previous);
        toast.error(result.error ?? "No se pudo mover el lead.");
      }
    });
  };

  const handleDiscard = (leadId: string, reason: string) => {
    const previous = leads;
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: "discarded" } : l)),
    );

    moveLead(leadId, "discarded", reason || undefined).then((result) => {
      if (result.ok) {
        toast.success("Lead descartado.");
      } else {
        setLeads(previous);
        toast.error(result.error ?? "No se pudo descartar el lead.");
      }
    });
  };

  return (
    <DndContext id="leads-board" sensors={sensors} onDragEnd={handleDragEnd}>
      <BoardZoom>
        {STAGES.map(({ stage, tone, dot }) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            tone={tone}
            dot={dot}
            leads={leads.filter((l) => l.stage === stage)}
            onDiscard={handleDiscard}
          />
        ))}
      </BoardZoom>
    </DndContext>
  );
}

function KanbanColumn({
  stage,
  tone,
  dot,
  leads,
  onDiscard,
}: {
  stage: LeadStage;
  tone: ChipTone;
  dot: string;
  leads: LeadWithContact[];
  onDiscard: (leadId: string, reason: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const sum = leads.reduce((a, l) => a + (l.interest_amount ?? 0), 0);

  return (
    <div ref={setNodeRef}>
      <BoardColumn
        label={leadStageLabels[stage]}
        dotColor={dot}
        count={leads.length}
        sum={sum > 0 ? formatMoney(sum) : undefined}
        highlight={isOver}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} tone={tone} stage={stage} onDiscard={onDiscard} />
        ))}
      </BoardColumn>
    </div>
  );
}

function LeadCard({
  lead,
  tone,
  stage,
  onDiscard,
}: {
  lead: LeadWithContact;
  tone: ChipTone;
  stage: LeadStage;
  onDiscard: (leadId: string, reason: string) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const [discardOpen, setDiscardOpen] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const goToContact = () => {
    if (lead.contact?.id) router.push(`/clientes/${lead.contact.id}?from=leads`);
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDownCapture={(e) => {
        pointerStart.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        const start = pointerStart.current;
        const moved =
          !start ||
          Math.abs(e.clientX - start.x) > 5 ||
          Math.abs(e.clientY - start.y) > 5;
        if (!moved && !isDragging) goToContact();
      }}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      className={cn(
        boardCardClass,
        "touch-none cursor-pointer",
        isDragging && "z-50 opacity-90 shadow-lifted",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tracking-[.06em] uppercase text-ink-3">
          {lead.contact
            ? sourceChannelLabels[lead.contact.source_channel]
            : "Sin canal"}
        </span>
        <div className="flex items-center gap-1.5">
          <Chip tone={tone}>{leadStageLabels[stage]}</Chip>
          {stage !== "discarded" && (
            <button
              type="button"
              title="Descartar lead"
              aria-label="Descartar lead"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setDiscardOpen(true);
              }}
              className="shrink-0 rounded p-0.5 text-ink-3 hover:bg-line-2 hover:text-destructive"
            >
              <Ban className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {lead.contact?.id ? (
        <Link
          href={`/clientes/${lead.contact.id}?from=leads`}
          className="mt-2 block truncate text-[14.5px] font-semibold tracking-[-.01em] hover:text-brand"
        >
          {lead.contact.full_name || lead.contact.phone || "Sin nombre"}
        </Link>
      ) : (
        <p className="mt-2 truncate text-[14.5px] font-semibold tracking-[-.01em]">
          Sin nombre
        </p>
      )}
      <p className="mt-2.5 font-mono text-[15px] tracking-[-.02em]">
        {lead.interest_amount !== null
          ? formatMoney(lead.interest_amount)
          : "Monto por definir"}
      </p>
      <BoardCardMeta
        left="Interés declarado"
        right={formatRelativeTime(lead.updated_at)}
      />

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Descartar lead</DialogTitle>
          </DialogHeader>
          <form
            action={(formData) => {
              onDiscard(lead.id, String(formData.get("reason") ?? "").trim());
              setDiscardOpen(false);
            }}
            className="grid gap-4 px-7 py-[22px]"
          >
            <p className="text-sm text-muted-foreground">
              {lead.contact?.full_name || lead.contact?.phone || "Este lead"} ya no
              seguirá en el tablero activo. Se puede regresar después arrastrándolo
              desde la columna &quot;Descartado&quot;.
            </p>
            <div className="grid gap-2">
              <Label htmlFor={`discard-reason-${lead.id}`}>Motivo (opcional)</Label>
              <Textarea
                id={`discard-reason-${lead.id}`}
                name="reason"
                rows={2}
                placeholder="Ej. ya no contestó, ya no le interesa…"
              />
            </div>
            <Button type="submit" variant="outline">
              Confirmar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
