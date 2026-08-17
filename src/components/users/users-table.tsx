"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateUser } from "@/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { NewUserDialog } from "@/components/users/new-user-dialog";
import { roleLabels } from "@/lib/labels";
import type { Profile, Role } from "@/lib/types";

export function UsersTable({ profiles, myId }: { profiles: Profile[]; myId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
      <NewUserDialog />

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
    </div>
  );
}
