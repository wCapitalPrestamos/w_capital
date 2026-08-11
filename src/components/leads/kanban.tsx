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
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { moveLead } from "@/actions/leads";
import { formatMoney } from "@/lib/format";
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

const STAGES: LeadStage[] = ["new", "contacted", "interested", "applying", "discarded"];

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
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex min-h-[60vh] gap-4">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={leads.filter((l) => l.stage === stage)}
          />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({ stage, leads }: { stage: LeadStage; leads: LeadWithContact[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
        isOver && "border-primary/50 bg-accent/50",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-sm font-semibold">{leadStageLabels[stage]}</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadWithContact }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm",
        isDragging && "z-50 opacity-90 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/clientes/${lead.contact?.id ?? ""}`}
          className="text-sm font-medium hover:underline"
        >
          {lead.contact?.full_name || lead.contact?.phone || "Sin nombre"}
        </Link>
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Arrastrar"
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      {lead.interest_amount !== null && (
        <p className="mt-1 text-sm text-muted-foreground">
          Interés: {formatMoney(lead.interest_amount)}
        </p>
      )}
      {lead.contact && (
        <p className="mt-1 text-xs text-muted-foreground">
          {sourceChannelLabels[lead.contact.source_channel]}
        </p>
      )}
    </div>
  );
}
