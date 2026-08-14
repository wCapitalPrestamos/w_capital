"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReassignSelect({
  value,
  options,
  onAssign,
  placeholder = "Sin asignar",
  className,
}: {
  value: string | null;
  options: { id: string; full_name: string }[];
  onAssign: (profileId: string) => Promise<{ ok: boolean; error?: string }>;
  placeholder?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  const handleChange = (profileId: string | null) => {
    if (!profileId || profileId === value) return;
    startTransition(async () => {
      const result = await onAssign(profileId);
      if (!result.ok) toast.error(result.error ?? "No se pudo reasignar.");
    });
  };

  return (
    <Select
      value={value ?? undefined}
      onValueChange={handleChange}
      disabled={pending}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {(profileId: string) =>
            options.find((o) => o.id === profileId)?.full_name ?? profileId
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
