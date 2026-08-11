"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { createApplication } from "@/actions/applications";
import { PillOptions } from "@/components/option-chips";
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
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { collateralTypeLabels } from "@/lib/labels";
import type { BorrowerType, CollateralType } from "@/lib/types";

const WEEKLY_RATE = 0.0197;

const COLLATERAL_OPTIONS = (
  Object.entries(collateralTypeLabels) as [CollateralType, string][]
).map(([value, label]) => ({ value, label }));

export function CreateApplicationButton({
  contactId,
  leadId,
  triggerLabel = "Nueva solicitud",
  triggerVariant = "default",
  triggerClassName,
}: {
  contactId: string;
  leadId?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collateral, setCollateral] = useState<CollateralType>("property");
  const [borrowerType, setBorrowerType] = useState<BorrowerType>("personal");
  const [amount, setAmount] = useState("");
  const [weeks, setWeeks] = useState("");
  const [pending, startTransition] = useTransition();

  const amountN = Number(amount);
  const weeksN = Number(weeks);
  const estimate =
    Number.isFinite(amountN) && amountN > 0 && Number.isFinite(weeksN) && weeksN > 0
      ? Math.round(
          (amountN * WEEKLY_RATE) / (1 - Math.pow(1 + WEEKLY_RATE, -weeksN)),
        )
      : null;

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await createApplication({
        contact_id: contactId,
        lead_id: leadId,
        requested_amount:
          Number.isFinite(amountN) && amountN > 0 ? amountN : undefined,
        term_weeks: Number.isFinite(weeksN) && weeksN > 0 ? weeksN : undefined,
        purpose: String(formData.get("purpose") ?? "").trim() || undefined,
        borrower_type: borrowerType,
        business_name:
          String(formData.get("business_name") ?? "").trim() || undefined,
        collateral_type: collateral,
        collateral_description:
          String(formData.get("collateral_description") ?? "").trim() || undefined,
      });
      if (result.ok && result.id) {
        toast.success("Solicitud creada.");
        setOpen(false);
        router.push(`/solicitudes/${result.id}`);
      } else {
        toast.error(result.error ?? "No se pudo crear la solicitud.");
      }
    });
  };

  return (
    <>
      <Button
        variant={triggerVariant}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerVariant === "default" && <FilePlus2 className="size-4" />}
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogEyebrow>Originación</DialogEyebrow>
            <DialogTitle>Nueva solicitud de préstamo</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit}>
            <DialogBody>
              <div className="grid gap-[7px]">
                <Label className="text-[12.5px] font-semibold">
                  ¿Para quién es el préstamo?
                </Label>
                <PillOptions
                  options={[
                    {
                      value: "personal",
                      label: "Personal",
                      hint: "A nombre del contacto",
                    },
                    {
                      value: "business",
                      label: "Empresa / negocio",
                      hint: "Con nombre comercial",
                    },
                  ]}
                  value={borrowerType}
                  onChange={setBorrowerType}
                />
              </div>
              {borrowerType === "business" && (
                <div className="grid gap-[7px]">
                  <Label
                    htmlFor="business_name"
                    className="text-[12.5px] font-semibold"
                  >
                    Nombre de la empresa o negocio
                  </Label>
                  <Input
                    id="business_name"
                    name="business_name"
                    placeholder="Taquería La Norteña…"
                    required
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="grid gap-[7px]">
                  <Label
                    htmlFor="requested_amount"
                    className="text-[12.5px] font-semibold"
                  >
                    Monto solicitado (MXN)
                  </Label>
                  <Input
                    id="requested_amount"
                    name="requested_amount"
                    type="number"
                    min="1000"
                    step="500"
                    placeholder="10000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="font-mono text-[13px]"
                  />
                </div>
                <div className="grid gap-[7px]">
                  <Label htmlFor="term_weeks" className="text-[12.5px] font-semibold">
                    Plazo (semanas)
                  </Label>
                  <Input
                    id="term_weeks"
                    name="term_weeks"
                    type="number"
                    min="4"
                    max="104"
                    placeholder="26"
                    value={weeks}
                    onChange={(e) => setWeeks(e.target.value)}
                    className="font-mono text-[13px]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[14px] bg-brand-soft p-[13px_15px]">
                <p className="text-xs text-brand-ink">
                  Cuota semanal estimada · 1.97% semanal, sistema francés
                </p>
                <p className="font-mono text-base font-semibold text-brand-ink">
                  {estimate !== null ? formatMoney(estimate) : "—"}
                </p>
              </div>
              <div className="grid gap-[7px]">
                <Label htmlFor="purpose" className="text-[12.5px] font-semibold">
                  Destino del préstamo
                </Label>
                <Input id="purpose" name="purpose" placeholder="Capital de trabajo…" />
              </div>
              <div className="grid gap-[7px]">
                <Label className="text-[12.5px] font-semibold">Tipo de garantía</Label>
                <PillOptions
                  options={COLLATERAL_OPTIONS}
                  value={collateral}
                  onChange={setCollateral}
                />
              </div>
              <div className="grid gap-[7px]">
                <Label
                  htmlFor="collateral_description"
                  className="text-[12.5px] font-semibold"
                >
                  {collateral === "other"
                    ? "Especifica la garantía"
                    : "Descripción de la garantía"}
                </Label>
                <Textarea
                  id="collateral_description"
                  name="collateral_description"
                  rows={2}
                  required={collateral === "other"}
                  placeholder={
                    collateral === "other"
                      ? "¿Qué garantía ofrece el cliente?"
                      : "Casa en col. Pitic, escrituras a nombre del titular…"
                  }
                />
              </div>
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
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Creando…" : "Crear solicitud"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
