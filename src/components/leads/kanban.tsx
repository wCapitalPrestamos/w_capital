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
import { ArrowRightLeft, Ban } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Chip, type ChipTone } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { useMinuteNow } from "@/hooks/use-minute-now";
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

export function LeadsKanban({
  initialLeads,
}: {
  initialLeads: LeadWithContact[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Compartido entre soltar una tarjeta arrastrada y elegir el estado desde
  // el selector de la tarjeta (móvil) — mismo update optimista en ambos casos.
  const handleMove = (leadId: string, newStage: LeadStage) => {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    handleMove(String(active.id), String(over.id) as LeadStage);
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
            onMove={handleMove}
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
  onMove,
}: {
  stage: LeadStage;
  tone: ChipTone;
  dot: string;
  leads: LeadWithContact[];
  onDiscard: (leadId: string, reason: string) => void;
  onMove: (leadId: string, newStage: LeadStage) => void;
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
          <LeadCard
            key={lead.id}
            lead={lead}
            tone={tone}
            stage={stage}
            onDiscard={onDiscard}
            onMove={onMove}
          />
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
  onMove,
}: {
  lead: LeadWithContact;
  tone: ChipTone;
  stage: LeadStage;
  onDiscard: (leadId: string, reason: string) => void;
  onMove: (leadId: string, newStage: LeadStage) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: lead.id,
    });
  const [discardOpen, setDiscardOpen] = useState(false);
  const now = useMinuteNow();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const goToContact = () => {
    if (lead.contact?.id)
      router.push(`/clientes/${lead.contact.id}?from=leads`);
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
        <div className="flex items-center gap-3.5 md:gap-1.5">
          <Chip tone={tone}>{leadStageLabels[stage]}</Chip>
          {/* Mover de estado sin arrastrar — en una columna larga, arrastrar
              en móvil es incómodo. Oculto en escritorio, donde ya se usa
              drag. Objetivo táctil grande (~40px) y bien separado del botón
              de descartar, para no picar uno por accidente en vez del otro
              — en desktop este botón ni se muestra, así que no afecta la
              densidad ahí. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  title="Mover a otro estado"
                  aria-label="Mover a otro estado"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="shrink-0 rounded p-2.5 text-ink-3 hover:bg-line-2 hover:text-brand md:hidden"
                />
              }
            >
              <ArrowRightLeft className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STAGES.filter((s) => s.stage !== stage).map((s) => (
                <DropdownMenuItem
                  key={s.stage}
                  onClick={() => {
                    if (s.stage === "discarded") setDiscardOpen(true);
                    else onMove(lead.id, s.stage);
                  }}
                >
                  {leadStageLabels[s.stage]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
              className="shrink-0 rounded p-2.5 text-ink-3 hover:bg-line-2 hover:text-destructive md:p-0.5"
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
        right={formatRelativeTime(lead.updated_at, now)}
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
              {lead.contact?.full_name || lead.contact?.phone || "Este lead"} ya
              no seguirá en el tablero activo. Se puede regresar después
              arrastrándolo desde la columna &quot;Descartado&quot;.
            </p>
            <div className="grid gap-2">
              <Label htmlFor={`discard-reason-${lead.id}`}>
                Motivo (opcional)
              </Label>
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
