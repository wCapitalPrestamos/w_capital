"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { inviteUser } from "@/actions/users";
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
import { roleLabels } from "@/lib/labels";
import type { Role } from "@/lib/types";

// Extraído de UsersTable para seguir el mismo patrón que el resto de la app
// (un componente por diálogo de creación: NewContactDialog, NewLeadDialog…).
export function NewUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("advisor");
  const [pending, startTransition] = useTransition();

  const handleInvite = (formData: FormData) => {
    startTransition(async () => {
      const result = await inviteUser({
        email: String(formData.get("email") ?? "").trim(),
        full_name: String(formData.get("full_name") ?? "").trim(),
        role,
      });
      if (result.ok) {
        toast.success("Invitación enviada por correo.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo enviar la invitación.");
      }
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Invitar usuario
      </Button>
      <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
          </DialogHeader>
          <form action={handleInvite} className="grid gap-4 px-7 py-[22px]">
            <p className="text-[13px] text-muted-foreground">
              Le llegará un correo con un link para que defina su propia
              contraseña.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar invitación"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
