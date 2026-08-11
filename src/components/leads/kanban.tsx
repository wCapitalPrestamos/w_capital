"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { moveLead } from "@/actions/leads";
import { BoardCardMeta, BoardColumn, boardCardClass } from "@/components/board";
import { BoardZoom } from "@/components/board-zoom";
import { Chip, type ChipTone } from "@/components/status-badge";
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
}: {
  stage: LeadStage;
  tone: ChipTone;
  dot: string;
  leads: LeadWithContact[];
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
          <LeadCard key={lead.id} lead={lead} tone={tone} stage={stage} />
        ))}
      </BoardColumn>
    </div>
  );
}

function LeadCard({
  lead,
  tone,
  stage,
}: {
  lead: LeadWithContact;
  tone: ChipTone;
  stage: LeadStage;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      className={cn(
        boardCardClass,
        "touch-none",
        isDragging && "z-50 opacity-90 shadow-lifted",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tracking-[.06em] uppercase text-ink-3">
          {lead.contact
            ? sourceChannelLabels[lead.contact.source_channel]
            : "Sin canal"}
        </span>
        <Chip tone={tone}>{leadStageLabels[stage]}</Chip>
      </div>
      <Link
        href={`/clientes/${lead.contact?.id ?? ""}`}
        className="mt-2 block truncate text-[14.5px] font-semibold tracking-[-.01em] hover:text-brand"
      >
        {lead.contact?.full_name || lead.contact?.phone || "Sin nombre"}
      </Link>
      <p className="mt-2.5 font-mono text-[15px] tracking-[-.02em]">
        {lead.interest_amount !== null
          ? formatMoney(lead.interest_amount)
          : "Monto por definir"}
      </p>
      <BoardCardMeta
        left="Interés declarado"
        right={formatRelativeTime(lead.updated_at)}
      />
    </div>
  );
}
