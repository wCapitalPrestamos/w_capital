"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { createApplication } from "@/actions/applications";
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
import { Textarea } from "@/components/ui/textarea";
import { borrowerTypeLabels } from "@/lib/labels";
import type { BorrowerType, CollateralType } from "@/lib/types";

export function CreateApplicationButton({
  contactId,
  leadId,
}: {
  contactId: string;
  leadId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collateral, setCollateral] = useState<CollateralType>("property");
  const [borrowerType, setBorrowerType] = useState<BorrowerType>("personal");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const amount = Number(formData.get("requested_amount"));
      const weeks = Number(formData.get("term_weeks"));
      const result = await createApplication({
        contact_id: contactId,
        lead_id: leadId,
        requested_amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
        term_weeks: Number.isFinite(weeks) && weeks > 0 ? weeks : undefined,
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
      <Button size="sm" onClick={() => setOpen(true)}>
        <FilePlus2 className="size-4" /> Nueva solicitud
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva solicitud de préstamo</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label>¿Para quién es el préstamo?</Label>
              <Select
                value={borrowerType}
                onValueChange={(v) => v && setBorrowerType(v as BorrowerType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">
                    {borrowerTypeLabels.personal} (a nombre del contacto)
                  </SelectItem>
                  <SelectItem value="business">{borrowerTypeLabels.business}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {borrowerType === "business" && (
              <div className="grid gap-2">
                <Label htmlFor="business_name">Nombre de la empresa o negocio</Label>
                <Input
                  id="business_name"
                  name="business_name"
                  placeholder="Taquería La Norteña…"
                  required
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="requested_amount">Monto solicitado (MXN)</Label>
                <Input
                  id="requested_amount"
                  name="requested_amount"
                  type="number"
                  min="1000"
                  step="500"
                  placeholder="10000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="term_weeks">Plazo (semanas)</Label>
                <Input
                  id="term_weeks"
                  name="term_weeks"
                  type="number"
                  min="4"
                  max="104"
                  placeholder="26"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purpose">Destino del préstamo</Label>
              <Input id="purpose" name="purpose" placeholder="Capital de trabajo…" />
            </div>
            <div className="grid gap-2">
              <Label>Tipo de garantía</Label>
              <Select
                value={collateral}
                onValueChange={(v) => v && setCollateral(v as CollateralType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Propiedad en Hermosillo</SelectItem>
                  <SelectItem value="car">Factura de automóvil (2010+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collateral_description">Descripción de la garantía</Label>
              <Textarea id="collateral_description" name="collateral_description" rows={2} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear solicitud"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
