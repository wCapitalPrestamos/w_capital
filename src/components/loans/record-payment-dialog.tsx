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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { todayLocalISO } from "@/lib/client-dates";
import type { PaymentMethod } from "@/lib/types";

export function RecordPaymentDialog({ loanId }: { loanId: string }) {
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
      <Button size="sm" onClick={() => setOpen(true)}>
        <Banknote className="size-4" /> Registrar pago
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="amount">Monto (MXN)</Label>
                <Input
                  id="amount"
                  value={amount}
                  onChange={(e) => refreshPreview(e.target.value)}
                  type="number"
                  min="1"
                  step="0.01"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paid_on">Fecha del pago</Label>
                <Input
                  id="paid_on"
                  name="paid_on"
                  type="date"
                  defaultValue={todayLocalISO()}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Método</Label>
                <Select
                  value={method}
                  onValueChange={(v) => v && setMethod(v as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="deposit">Depósito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reference">Referencia</Label>
                <Input id="reference" name="reference" placeholder="Opcional" />
              </div>
            </div>

            {preview && preview.length > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                <p className="mb-1.5 font-medium">Así se aplicará el pago:</p>
                {preview.map((p) => (
                  <p key={p.installment_id} className="flex justify-between">
                    <span>Cuota #{p.installment_number}</span>
                    <span className="font-mono">
                      {formatMoney(p.interest_amount + p.principal_amount)}
                      <span className="ml-1 text-muted-foreground">
                        (int {formatMoney(p.interest_amount)} · cap{" "}
                        {formatMoney(p.principal_amount)})
                      </span>
                    </span>
                  </p>
                ))}
                {leftover > 0 && (
                  <p className="mt-1.5 text-destructive">
                    Sobran {formatMoney(leftover)}: excede la deuda restante.
                  </p>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={pending || !amount || Number(amount) <= 0 || leftover > 0}
            >
              {pending ? "Registrando…" : "Registrar pago"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
