"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  FileSearch,
  Link2,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { changeApplicationStatus } from "@/actions/applications";
import { createUploadLink } from "@/actions/documents";
import { disburseLoan } from "@/actions/loans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayLocalISO } from "@/lib/client-dates";
import type { LoanApplication, Role } from "@/lib/types";

export function ApplicationActions({
  application: app,
  role,
  hasLoan,
}: {
  application: LoanApplication;
  role: Role;
  hasLoan: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [disburseOpen, setDisburseOpen] = useState(false);

  const canDecide = role === "admin" || role === "analyst";

  const transition = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(okMsg);
        setApproveOpen(false);
        setRejectOpen(false);
        setDisburseOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Ocurrió un error.");
      }
    });
  };

  const handleUploadLink = () => {
    startTransition(async () => {
      const result = await createUploadLink(app.id);
      if (result.ok && result.url) {
        await navigator.clipboard.writeText(result.url).catch(() => {});
        toast.success("Liga copiada al portapapeles. Compártela con el cliente.", {
          description: result.url,
          duration: 8000,
        });
      } else {
        toast.error(result.error ?? "No se pudo generar la liga.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acciones</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {["draft", "docs_pending"].includes(app.status) && (
          <>
            <Button variant="outline" onClick={handleUploadLink} disabled={pending}>
              <Link2 className="size-4" /> Generar liga de documentos
            </Button>
            <Button
              onClick={() =>
                transition(
                  () => changeApplicationStatus(app.id, "under_review"),
                  "Enviada a análisis.",
                )
              }
              disabled={pending}
            >
              <FileSearch className="size-4" /> Enviar a análisis
            </Button>
          </>
        )}

        {app.status === "under_review" && (
          <>
            <Button
              onClick={() => setApproveOpen(true)}
              disabled={pending || !canDecide}
            >
              <CheckCircle2 className="size-4" /> Aprobar
            </Button>
            <Button
              variant="destructive"
              onClick={() => setRejectOpen(true)}
              disabled={pending || !canDecide}
            >
              <XCircle className="size-4" /> Rechazar
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                transition(
                  () => changeApplicationStatus(app.id, "docs_pending"),
                  "Regresada a documentos.",
                )
              }
              disabled={pending}
            >
              <Undo2 className="size-4" /> Regresar a documentos
            </Button>
            {!canDecide && (
              <p className="text-xs text-muted-foreground">
                Solo análisis o administración pueden aprobar o rechazar.
              </p>
            )}
          </>
        )}

        {app.status === "approved" && !hasLoan && (
          <Button onClick={() => setDisburseOpen(true)} disabled={pending || !canDecide}>
            <Banknote className="size-4" /> Registrar desembolso
          </Button>
        )}

        {app.status === "rejected" && canDecide && (
          <Button
            variant="outline"
            onClick={() =>
              transition(
                () => changeApplicationStatus(app.id, "under_review"),
                "Reabierta para análisis.",
              )
            }
            disabled={pending}
          >
            <Undo2 className="size-4" /> Reabrir análisis
          </Button>
        )}
      </CardContent>

      {/* Aprobar */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar solicitud</DialogTitle>
          </DialogHeader>
          <form
            action={(formData) =>
              transition(
                () =>
                  changeApplicationStatus(
                    app.id,
                    "approved",
                    String(formData.get("note") ?? "").trim() || undefined,
                    {
                      approved_amount: Number(formData.get("approved_amount")),
                      approved_term_weeks: Number(formData.get("approved_term_weeks")),
                    },
                  ),
                "Solicitud aprobada.",
              )
            }
            className="grid gap-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="approved_amount">Monto aprobado (MXN)</Label>
                <Input
                  id="approved_amount"
                  name="approved_amount"
                  type="number"
                  min="1000"
                  step="500"
                  defaultValue={app.requested_amount ?? undefined}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="approved_term_weeks">Plazo (semanas)</Label>
                <Input
                  id="approved_term_weeks"
                  name="approved_term_weeks"
                  type="number"
                  min="4"
                  max="104"
                  defaultValue={app.term_weeks ?? undefined}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Nota (opcional)</Label>
              <Textarea id="note" name="note" rows={2} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Aprobando…" : "Confirmar aprobación"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rechazar */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <form
            action={(formData) =>
              transition(
                () =>
                  changeApplicationStatus(app.id, "rejected", undefined, {
                    rejection_reason: String(formData.get("reason") ?? "").trim(),
                  }),
                "Solicitud rechazada.",
              )
            }
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo del rechazo</Label>
              <Textarea id="reason" name="reason" rows={3} required />
            </div>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Rechazando…" : "Confirmar rechazo"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Desembolso */}
      <Dialog open={disburseOpen} onOpenChange={setDisburseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar desembolso</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se generará el calendario de {app.approved_term_weeks} pagos semanales
            sobre el monto aprobado.
          </p>
          <form
            action={(formData) =>
              transition(
                () =>
                  disburseLoan(app.id, {
                    disbursed_at: String(formData.get("disbursed_at")),
                    first_payment_date: String(formData.get("first_payment_date")),
                  }),
                "Préstamo desembolsado. Calendario generado.",
              )
            }
            className="grid gap-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="disbursed_at">Fecha de desembolso</Label>
                <Input
                  id="disbursed_at"
                  name="disbursed_at"
                  type="date"
                  defaultValue={todayLocalISO()}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="first_payment_date">Primer pago</Label>
                <Input
                  id="first_payment_date"
                  name="first_payment_date"
                  type="date"
                  defaultValue={todayLocalISO(7)}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Generando…" : "Confirmar desembolso"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
