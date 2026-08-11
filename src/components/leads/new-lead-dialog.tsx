"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { createLead } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ContactOption {
  id: string;
  full_name: string;
  phone: string | null;
}

export function NewLeadDialog({ contacts }: { contacts: ContactOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = contacts.find((c) => c.id === contactId);

  const handleSubmit = (formData: FormData) => {
    if (!contactId) {
      toast.error("Selecciona el cliente del lead.");
      return;
    }
    startTransition(async () => {
      const amount = Number(formData.get("interest_amount"));
      const result = await createLead({
        contact_id: contactId,
        interest_amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
        notes: String(formData.get("notes") ?? "").trim() || undefined,
      });
      if (result.ok) {
        toast.success("Lead creado.");
        setOpen(false);
        setContactId(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo crear el lead.");
      }
    });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo lead
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo lead</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Cliente</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      role="combobox"
                      className="justify-between font-normal"
                    >
                      {selected
                        ? `${selected.full_name || "Sin nombre"}${selected.phone ? ` · ${selected.phone}` : ""}`
                        : "Buscar cliente…"}
                      <ChevronsUpDown className="size-4 opacity-50" />
                    </Button>
                  }
                />
                <PopoverContent className="w-80 p-0">
                  <Command>
                    <CommandInput placeholder="Nombre o teléfono…" />
                    <CommandList>
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.full_name} ${c.phone ?? ""}`}
                            onSelect={() => {
                              setContactId(c.id);
                              setPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "size-4",
                                contactId === c.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {c.full_name || "Sin nombre"}
                            {c.phone && (
                              <span className="text-muted-foreground">{c.phone}</span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                ¿No existe todavía? Créalo primero en Clientes → Nuevo cliente.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="interest_amount">Monto de interés (MXN, opcional)</Label>
              <Input
                id="interest_amount"
                name="interest_amount"
                type="number"
                min="1000"
                step="500"
                placeholder="15000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <Button type="submit" disabled={pending || !contactId}>
              {pending ? "Creando…" : "Crear lead"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
