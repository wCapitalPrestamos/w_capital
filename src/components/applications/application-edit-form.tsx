"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateApplicationDetails } from "@/actions/applications";
import { ChipOptions, PillOptions } from "@/components/option-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { collateralTypeLabels } from "@/lib/labels";
import type { BorrowerType, CollateralType, LoanApplication } from "@/lib/types";

const COLLATERAL_OPTIONS = (
  Object.entries(collateralTypeLabels) as [CollateralType, string][]
).map(([value, label]) => ({ value, label }));

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? n : null;
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

// Datos de la solicitud que pueden cambiar sobre la marcha (monto, si al
// final era para negocio, garantía, aval…) — separado de ApplicationActions,
// que solo mueve el status.
export function ApplicationEditForm({ application: app }: { application: LoanApplication }) {
  const [pending, startTransition] = useTransition();
  const [borrowerType, setBorrowerType] = useState<BorrowerType>(app.borrower_type);
  const [collateral, setCollateral] = useState<CollateralType>(
    app.collateral_type ?? "property",
  );
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
      if (result.ok) toast.success("Solicitud actualizada.");
      else toast.error(result.error ?? "No se pudo guardar.");
    });
  };

  return (
    <form action={handleSubmit} className="grid gap-4">
      <div className="grid gap-[7px]">
        <Label className="text-[12.5px] font-semibold">¿Para quién es el préstamo?</Label>
        <PillOptions
          options={[
            { value: "personal", label: "Personal", hint: "A nombre del contacto" },
            { value: "business", label: "Empresa / negocio", hint: "Con nombre comercial" },
          ]}
          value={borrowerType}
          onChange={setBorrowerType}
        />
      </div>
      {borrowerType === "business" && (
        <div className="grid gap-1.5">
          <Label htmlFor="business_name">Nombre de la empresa o negocio</Label>
          <Input
            id="business_name"
            name="business_name"
            defaultValue={app.business_name ?? ""}
            placeholder="Taquería La Norteña…"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="requested_amount">Monto solicitado (MXN)</Label>
          <Input
            id="requested_amount"
            name="requested_amount"
            type="number"
            min="1000"
            step="500"
            defaultValue={app.requested_amount ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="term_weeks">Plazo (semanas)</Label>
          <Input
            id="term_weeks"
            name="term_weeks"
            type="number"
            min="4"
            max="104"
            defaultValue={app.term_weeks ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="purpose">Destino del préstamo</Label>
        <Input id="purpose" name="purpose" defaultValue={app.purpose ?? ""} />
      </div>

      <div className="grid gap-[7px]">
        <Label className="text-[12.5px] font-semibold">Tipo de garantía</Label>
        <PillOptions options={COLLATERAL_OPTIONS} value={collateral} onChange={setCollateral} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="collateral_description">
          {collateral === "other" ? "Especifica la garantía" : "Descripción de la garantía"}
        </Label>
        <Textarea
          id="collateral_description"
          name="collateral_description"
          rows={2}
          defaultValue={app.collateral_description ?? ""}
        />
      </div>

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
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="aval_name">Nombre del aval</Label>
            <Input id="aval_name" name="aval_name" defaultValue={app.aval_name ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="aval_phone">Teléfono del aval</Label>
            <Input id="aval_phone" name="aval_phone" defaultValue={app.aval_phone ?? ""} />
          </div>
        </div>
      )}

      <Button type="submit" size="sm" disabled={pending} className="justify-self-start">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
