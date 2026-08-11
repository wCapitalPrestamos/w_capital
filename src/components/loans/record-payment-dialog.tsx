"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { toast } from "sonner";
import {
  previewPaymentAllocation,
  recordPayment,
  type AllocationPreview,
} from "@/actions/loans";
import { ChipOptions } from "@/components/option-chips";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogEyebrow,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { todayLocalISO } from "@/lib/client-dates";
import type { PaymentMethod } from "@/lib/types";

export interface LoanSummary {
  name: string;
  folio: string;
  weekly: number;
}

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "deposit", label: "Depósito" },
];

export function RecordPaymentDialog({
  loanId,
  summary,
}: {
  loanId: string;
  summary?: LoanSummary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [preview, setPreview] = useState<AllocationPreview[] | null>(null);
  const [leftover, setLeftover] = useState(0);
  const [pending, startTransition] = useTransition();

  const refreshPreview = (value: string) => {
    setAmount(value);
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      setPreview(null);
      return;
    }
    startTransition(async () => {
      const result = await previewPaymentAllocation(loanId, n);
      if (result.ok) {
        setPreview(result.preview ?? []);
        setLeftover(result.leftover ?? 0);
      }
    });
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await recordPayment(loanId, {
        amount: Number(amount),
        paid_on: String(formData.get("paid_on")) || undefined,
        method,
        reference: String(formData.get("reference") ?? "").trim() || undefined,
      });
      if (result.ok) {
        toast.success("Pago registrado.");
        setOpen(false);
        setAmount("");
        setPreview(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo registrar el pago.");
      }
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Banknote className="size-4" /> Registrar pago
      </Button>
      <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogEyebrow>Cobranza</DialogEyebrow>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit}>
            <DialogBody>
              {summary && (
                <div className="flex items-center gap-3 rounded-[14px] border border-line-2 bg-surface-2 p-[13px_15px]">
                  <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-brand-soft text-xs font-semibold text-brand-ink">
                    {summary.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 leading-[1.3]">
                    <p className="truncate text-[13px] font-semibold">
                      {summary.name}
                    </p>
                    <p className="font-mono text-[11.5px] text-ink-3">
                      {summary.folio} · cuota semanal {formatMoney(summary.weekly)}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="grid gap-[7px]">
                  <Label htmlFor="amount" className="text-[12.5px] font-semibold">
                    Monto (MXN)
                  </Label>
                  <Input
                    id="amount"
                    value={amount}
                    onChange={(e) => refreshPreview(e.target.value)}
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    className="font-mono text-[13px]"
                  />
                </div>
                <div className="grid gap-[7px]">
                  <Label htmlFor="paid_on" className="text-[12.5px] font-semibold">
                    Fecha del pago
                  </Label>
                  <Input
                    id="paid_on"
                    name="paid_on"
                    type="date"
                    defaultValue={todayLocalISO()}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="grid content-start gap-[7px]">
                  <Label className="text-[12.5px] font-semibold">Método</Label>
                  <ChipOptions
                    options={METHOD_OPTIONS}
                    value={method}
                    onChange={setMethod}
                  />
                </div>
                <div className="grid content-start gap-[7px]">
                  <Label htmlFor="reference" className="text-[12.5px] font-semibold">
                    Referencia
                  </Label>
                  <Input id="reference" name="reference" placeholder="Opcional" />
                </div>
              </div>

              {preview && preview.length > 0 && (
                <div className="rounded-2xl border border-line-2 bg-surface-2 p-[15px_16px]">
                  <p className="mb-[11px] text-[11.5px] font-semibold tracking-[.06em] uppercase text-ink-3">
                    Así se aplicará el pago
                  </p>
                  <div className="flex flex-col gap-[9px]">
                    {preview.map((p) => (
                      <div
                        key={p.installment_id}
                        className="flex items-start justify-between gap-4"
                      >
                        <span className="text-[12.5px] whitespace-nowrap text-ink-2">
                          Cuota #{p.installment_number}
                        </span>
                        <span className="flex min-w-0 flex-col items-end gap-0.5">
                          <span className="font-mono text-[13px] font-medium whitespace-nowrap">
                            {formatMoney(p.interest_amount + p.principal_amount)}
                          </span>
                          <span className="font-mono text-[11px] whitespace-nowrap text-ink-3">
                            int {formatMoney(p.interest_amount)} · cap{" "}
                            {formatMoney(p.principal_amount)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {leftover > 0 && (
                    <p className="mt-3 border-t border-line-2 pt-[11px] text-[11.5px] text-bad">
                      Sobran {formatMoney(leftover)}: excede la deuda restante.
                    </p>
                  )}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={pending || !amount || Number(amount) <= 0 || leftover > 0}
              >
                {pending ? "Registrando…" : "Registrar pago"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
