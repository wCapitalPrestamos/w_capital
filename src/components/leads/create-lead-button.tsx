"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { KanbanSquare } from "lucide-react";
import { toast } from "sonner";
import { createLead } from "@/actions/leads";
import { Button } from "@/components/ui/button";

// Registra al contacto como lead (etapa "Nuevo") desde su ficha
export function CreateLeadButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createLead({ contact_id: contactId });
      if (result.ok) {
        toast.success("Lead creado. Lo encuentras en el kanban de Leads.");
        router.push("/leads");
      } else {
        toast.error(result.error ?? "No se pudo crear el lead.");
      }
    });
  };

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      <KanbanSquare className="size-4" />
      {pending ? "Creando…" : "Crear lead"}
    </Button>
  );
}
