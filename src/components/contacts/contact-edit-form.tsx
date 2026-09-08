"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateContact } from "@/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Contact } from "@/lib/types";

export function ContactEditForm({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingNoContactar, startNoContactarTransition] = useTransition();

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

  const handleToggleNoContactar = () => {
    startNoContactarTransition(async () => {
      const result = await updateContact(contact.id, {
        no_contactar: !contact.no_contactar,
      });
      if (result.ok) {
        toast.success(
          contact.no_contactar
            ? "Se reanudan los envíos automáticos a este contacto."
            : "Este contacto ya no recibirá recordatorios ni envíos automáticos.",
        );
        router.refresh();
      } else toast.error(result.error ?? "No se pudo guardar.");
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

      <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-line-2 px-3 py-2.5">
        <div>
          <p className="text-[13px] font-medium">No contactar</p>
          <p className="text-[12px] text-muted-foreground">
            Excluye a este contacto de recordatorios y envíos automáticos.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={contact.no_contactar ? "default" : "outline"}
          disabled={pendingNoContactar}
          onClick={handleToggleNoContactar}
        >
          {pendingNoContactar
            ? "Guardando…"
            : contact.no_contactar
              ? "Activado"
              : "Desactivado"}
        </Button>
      </div>
    </form>
  );
}
