"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createContact } from "@/actions/contacts";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sourceChannelLabels } from "@/lib/labels";
import type { SourceChannel } from "@/lib/types";

const SOURCE_OPTIONS = (
  Object.entries(sourceChannelLabels) as [SourceChannel, string][]
).map(([value, label]) => ({ value, label }));

export function NewContactDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<SourceChannel>("walk_in");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await createContact({
        full_name: String(formData.get("full_name") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        source_channel: source,
      });
      if (result.ok && result.id) {
        toast.success("Cliente creado.");
        setOpen(false);
        router.push(`/clientes/${result.id}`);
      } else {
        toast.error(result.error ?? "No se pudo crear el cliente.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" /> Nuevo cliente
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogEyebrow>Directorio</DialogEyebrow>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit}>
          <DialogBody>
            <div className="grid gap-[7px]">
              <Label htmlFor="full_name" className="text-[12.5px] font-semibold">
                Nombre completo
              </Label>
              <Input
                id="full_name"
                name="full_name"
                placeholder="María Elena Rubio"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div className="grid gap-[7px]">
                <Label htmlFor="phone" className="text-[12.5px] font-semibold">
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+52 662…"
                  className="font-mono text-[13px]"
                />
              </div>
              <div className="grid gap-[7px]">
                <Label htmlFor="email" className="text-[12.5px] font-semibold">
                  Correo
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nombre@correo.com"
                />
              </div>
            </div>
            <div className="grid gap-[7px]">
              <Label className="text-[12.5px] font-semibold">Canal de origen</Label>
              <ChipOptions
                options={SOURCE_OPTIONS}
                value={source}
                onChange={setSource}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Creando…" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
