"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createUser, updateUser } from "@/actions/users";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabels } from "@/lib/labels";
import type { Profile, Role } from "@/lib/types";

export function UsersTable({ profiles, myId }: { profiles: Profile[]; myId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newRole, setNewRole] = useState<Role>("advisor");
  const [pending, startTransition] = useTransition();

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createUser({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
        full_name: String(formData.get("full_name") ?? "").trim(),
        role: newRole,
      });
      if (result.ok) {
        toast.success("Usuario creado.");
        setOpen(false);
        router.refresh();
      } else toast.error(result.error ?? "No se pudo crear el usuario.");
    });
  };

  const handleRole = (userId: string, role: Role) => {
    startTransition(async () => {
      const result = await updateUser(userId, { role });
      if (result.ok) {
        toast.success("Rol actualizado.");
        router.refresh();
      } else toast.error(result.error ?? "Error.");
    });
  };

  const handleActive = (userId: string, active: boolean) => {
    startTransition(async () => {
      const result = await updateUser(userId, { active });
      if (result.ok) {
        toast.success(active ? "Cuenta activada." : "Cuenta desactivada.");
        router.refresh();
      } else toast.error(result.error ?? "Error.");
    });
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo usuario
      </Button>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.full_name}
                  {p.id === myId && (
                    <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={p.role}
                    onValueChange={(v) => v && handleRole(p.id, v as Role)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(roleLabels) as Role[]).map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {p.active ? (
                    <Badge className="bg-success/15 text-success border-transparent">
                      Activa
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Desactivada</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant={p.active ? "outline" : "default"}
                    disabled={pending || p.id === myId}
                    onClick={() => handleActive(p.id, !p.active)}
                  >
                    {p.active ? "Desactivar" : "Activar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form action={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña temporal</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div className="grid gap-2">
              <Label>Rol</Label>
              <Select value={newRole} onValueChange={(v) => v && setNewRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as Role[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear usuario"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
