"use client";

import { PillOptions } from "@/components/option-chips";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { collateralTypeLabels } from "@/lib/labels";
import type { BorrowerType, CollateralType } from "@/lib/types";

export const COLLATERAL_OPTIONS = (
  Object.entries(collateralTypeLabels) as [CollateralType, string][]
).map(([value, label]) => ({ value, label }));

// Campos compartidos entre "Nueva solicitud" y "Editar solicitud" — antes
// vivían duplicados (~90 líneas idénticas) en cada uno de esos dos diálogos.
export function ApplicationFormFields({
  borrowerType,
  onBorrowerTypeChange,
  collateral,
  onCollateralChange,
  amount,
  onAmountChange,
  weeks,
  onWeeksChange,
  defaultBusinessName = "",
  defaultPurpose = "",
  defaultCollateralDescription = "",
  requireBusinessName = false,
  requireCollateralDescriptionForOther = false,
  afterAmountWeeks,
}: {
  borrowerType: BorrowerType;
  onBorrowerTypeChange: (value: BorrowerType) => void;
  collateral: CollateralType;
  onCollateralChange: (value: CollateralType) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  weeks: string;
  onWeeksChange: (value: string) => void;
  defaultBusinessName?: string;
  defaultPurpose?: string;
  defaultCollateralDescription?: string;
  requireBusinessName?: boolean;
  requireCollateralDescriptionForOther?: boolean;
  /** Contenido opcional insertado justo después del monto/plazo (p. ej. la
   * cuota semanal estimada en "Nueva solicitud"). */
  afterAmountWeeks?: React.ReactNode;
}) {
  return (
    <>
      <div className="grid gap-[7px]">
        <Label className="text-[12.5px] font-semibold">¿Para quién es el préstamo?</Label>
        <PillOptions
          options={[
            { value: "personal", label: "Personal", hint: "A nombre del contacto" },
            { value: "business", label: "Empresa / negocio", hint: "Con nombre comercial" },
          ]}
          value={borrowerType}
          onChange={onBorrowerTypeChange}
        />
      </div>
      {borrowerType === "business" && (
        <div className="grid gap-[7px]">
          <Label htmlFor="business_name" className="text-[12.5px] font-semibold">
            Nombre de la empresa o negocio
          </Label>
          <Input
            id="business_name"
            name="business_name"
            defaultValue={defaultBusinessName}
            placeholder="Taquería La Norteña…"
            required={requireBusinessName}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="grid gap-[7px]">
          <Label htmlFor="requested_amount" className="text-[12.5px] font-semibold">
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
            onChange={(e) => onAmountChange(e.target.value)}
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
            onChange={(e) => onWeeksChange(e.target.value)}
            className="font-mono text-[13px]"
          />
        </div>
      </div>
      {afterAmountWeeks}
      <div className="grid gap-[7px]">
        <Label htmlFor="purpose" className="text-[12.5px] font-semibold">
          Destino del préstamo
        </Label>
        <Input
          id="purpose"
          name="purpose"
          defaultValue={defaultPurpose}
          placeholder="Capital de trabajo…"
        />
      </div>
      <div className="grid gap-[7px]">
        <Label className="text-[12.5px] font-semibold">Tipo de garantía</Label>
        <PillOptions
          options={COLLATERAL_OPTIONS}
          value={collateral}
          onChange={onCollateralChange}
        />
      </div>
      <div className="grid gap-[7px]">
        <Label htmlFor="collateral_description" className="text-[12.5px] font-semibold">
          {collateral === "other" ? "Especifica la garantía" : "Descripción de la garantía"}
        </Label>
        <Textarea
          id="collateral_description"
          name="collateral_description"
          rows={2}
          defaultValue={defaultCollateralDescription}
          required={requireCollateralDescriptionForOther && collateral === "other"}
          placeholder={
            collateral === "other"
              ? "¿Qué garantía ofrece el cliente?"
              : "Casa en col. Pitic, escrituras a nombre del titular…"
          }
        />
      </div>
    </>
  );
}
