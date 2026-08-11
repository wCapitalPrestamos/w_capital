"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateContact } from "@/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Contact } from "@/lib/types";

export function ContactEditForm({ contact }: { contact: Contact }) {
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateContact(contact.id, {
        full_name: String(formData.get("full_name") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim() || null,
        email: String(formData.get("email") ?? "").trim() || null,
        address: String(formData.get("address") ?? "").trim() || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
      });
      if (result.ok) toast.success("Cliente actualizado.");
      else toast.error(result.error ?? "No se pudo guardar.");
    });
  };

  return (
    <form action={handleSubmit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="full_name">Nombre</Label>
        <Input id="full_name" name="full_name" defaultValue={contact.full_name} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" name="phone" defaultValue={contact.phone ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" defaultValue={contact.email ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="address">Domicilio</Label>
        <Input id="address" name="address" defaultValue={contact.address ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={contact.notes ?? ""} />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
