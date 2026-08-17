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
import { cn } from "@/lib/utils";

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
      value={value ?? ""}
      onValueChange={handleChange}
      disabled={pending}
    >
      <SelectTrigger className={cn("max-w-45", className)}>
        <SelectValue placeholder={placeholder} className="flex-none truncate">
          {(profileId: string | null) =>
            profileId
              ? (options.find((o) => o.id === profileId)?.full_name ?? profileId)
              : placeholder
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
