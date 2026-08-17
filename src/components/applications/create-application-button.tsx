"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { createApplication } from "@/actions/applications";
import { ApplicationFormFields } from "@/components/applications/application-form-fields";
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
import { formatMoney } from "@/lib/format";
import type { BorrowerType, CollateralType } from "@/lib/types";

const WEEKLY_RATE = 0.0197;

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
              <ApplicationFormFields
                borrowerType={borrowerType}
                onBorrowerTypeChange={setBorrowerType}
                collateral={collateral}
                onCollateralChange={setCollateral}
                amount={amount}
                onAmountChange={setAmount}
                weeks={weeks}
                onWeeksChange={setWeeks}
                requireBusinessName
                requireCollateralDescriptionForOther
                afterAmountWeeks={
                  <div className="flex items-center justify-between gap-3 rounded-[14px] bg-brand-soft p-[13px_15px]">
                    <p className="text-xs text-brand-ink">
                      Cuota semanal estimada · 1.97% semanal, sistema francés
                    </p>
                    <p className="font-mono text-base font-semibold text-brand-ink">
                      {estimate !== null ? formatMoney(estimate) : "—"}
                    </p>
                  </div>
                }
              />
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
