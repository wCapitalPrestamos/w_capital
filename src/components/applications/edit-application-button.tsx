"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateApplicationDetails } from "@/actions/applications";
import { ApplicationFormFields } from "@/components/applications/application-form-fields";
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
import type { BorrowerType, CollateralType, LoanApplication } from "@/lib/types";

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? n : null;
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

// Editar datos de la solicitud (monto, si al final era para negocio,
// garantía, aval…) en un pop-up — mismo look que "Nueva solicitud".
export function EditApplicationButton({ application: app }: { application: LoanApplication }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [borrowerType, setBorrowerType] = useState<BorrowerType>(app.borrower_type ?? "personal");
  const [collateral, setCollateral] = useState<CollateralType>(
    app.collateral_type ?? "property",
  );
  const [amount, setAmount] = useState(String(app.requested_amount ?? ""));
  const [weeks, setWeeks] = useState(String(app.term_weeks ?? ""));
  const [hasAval, setHasAval] = useState<"yes" | "no">(app.has_aval ? "yes" : "no");

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateApplicationDetails(app.id, {
        requested_amount: numberOrNull(formData.get("requested_amount")),
        term_weeks: numberOrNull(formData.get("term_weeks")),
        purpose: textOrNull(formData.get("purpose")),
        borrower_type: borrowerType,
        business_name:
          borrowerType === "business" ? textOrNull(formData.get("business_name")) : null,
        collateral_type: collateral,
        collateral_description: textOrNull(formData.get("collateral_description")),
        has_aval: hasAval === "yes",
        aval_name: hasAval === "yes" ? textOrNull(formData.get("aval_name")) : null,
        aval_phone: hasAval === "yes" ? textOrNull(formData.get("aval_phone")) : null,
      });
      if (result.ok) {
        toast.success("Solicitud actualizada.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo guardar.");
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        title="Editar solicitud"
        aria-label="Editar solicitud"
      >
        <Pencil className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogEyebrow>Originación</DialogEyebrow>
            <DialogTitle>Editar solicitud</DialogTitle>
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
                defaultBusinessName={app.business_name ?? ""}
                defaultPurpose={app.purpose ?? ""}
                defaultCollateralDescription={app.collateral_description ?? ""}
              />
              <div className="grid gap-[7px]">
                <Label className="text-[12.5px] font-semibold">¿Tiene aval?</Label>
                <ChipOptions
                  options={[
                    { value: "no", label: "No" },
                    { value: "yes", label: "Sí" },
                  ]}
                  value={hasAval}
                  onChange={setHasAval}
                />
              </div>
              {hasAval === "yes" && (
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="grid gap-[7px]">
                    <Label htmlFor="aval_name" className="text-[12.5px] font-semibold">
                      Nombre del aval
                    </Label>
                    <Input id="aval_name" name="aval_name" defaultValue={app.aval_name ?? ""} />
                  </div>
                  <div className="grid gap-[7px]">
                    <Label htmlFor="aval_phone" className="text-[12.5px] font-semibold">
                      Teléfono del aval
                    </Label>
                    <Input
                      id="aval_phone"
                      name="aval_phone"
                      defaultValue={app.aval_phone ?? ""}
                    />
                  </div>
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
