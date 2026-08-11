"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createLead } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogEyebrow,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [query, setQuery] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts.slice(0, 30);
    return contacts
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) || (c.phone ?? "").includes(q),
      )
      .slice(0, 30);
  }, [contacts, query]);

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
        setQuery("");
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo crear el lead.");
      }
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo lead
      </Button>
      <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
        <DialogContent>
          <DialogHeader>
            <DialogEyebrow>Prospección</DialogEyebrow>
            <DialogTitle>Nuevo lead</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit}>
            <DialogBody>
              <div>
                <Label htmlFor="nl_q" className="mb-[7px] text-[12.5px] font-semibold">
                  Cliente
                </Label>
                <div className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 text-ink-3">
                  <Search className="size-[15px] shrink-0" strokeWidth={1.7} />
                  <input
                    id="nl_q"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nombre o teléfono…"
                    className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
                <div className="mt-[9px] max-h-[186px] overflow-y-auto rounded-xl border border-line-2 bg-surface">
                  {matches.map((c) => {
                    const selected = contactId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setContactId(c.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 border-b border-line-2 px-[13px] py-2.5 text-left transition-colors last:border-b-0",
                          selected ? "bg-brand-soft" : "hover:bg-surface-2",
                        )}
                      >
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-brand-soft text-[11px] font-semibold text-brand-ink">
                          {(c.full_name || "?")
                            .split(" ")
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {c.full_name || "Sin nombre"}
                        </span>
                        {c.phone && (
                          <span className="shrink-0 font-mono text-[11.5px] text-ink-3">
                            {c.phone}
                          </span>
                        )}
                        <Check
                          className={cn(
                            "size-3.5 shrink-0 text-brand",
                            selected ? "visible" : "invisible",
                          )}
                        />
                      </button>
                    );
                  })}
                  {matches.length === 0 && (
                    <p className="p-[18px] text-center text-[12.5px] text-ink-3">
                      Sin resultados.
                    </p>
                  )}
                </div>
                <p className="mt-2 text-[11.5px] text-ink-3">
                  ¿No existe todavía? Créalo primero en Clientes → Nuevo cliente.
                </p>
              </div>
              <div className="grid gap-[7px]">
                <Label
                  htmlFor="interest_amount"
                  className="text-[12.5px] font-semibold"
                >
                  Monto de interés (MXN, opcional)
                </Label>
                <Input
                  id="interest_amount"
                  name="interest_amount"
                  type="number"
                  min="1000"
                  step="500"
                  placeholder="15000"
                  className="font-mono text-[13px]"
                />
              </div>
              <div className="grid gap-[7px]">
                <Label htmlFor="notes" className="text-[12.5px] font-semibold">
                  Notas
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  placeholder="Pidió informes por WhatsApp, quiere 60 mil con garantía de casa…"
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
              <Button type="submit" size="lg" disabled={pending || !contactId}>
                {pending ? "Creando…" : "Crear lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
