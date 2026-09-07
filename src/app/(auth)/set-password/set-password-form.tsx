"use client";

import { useActionState } from "react";
import { setPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState(setPassword, null);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-[7px]">
        <Label htmlFor="password" className="text-[12.5px] font-semibold">
          Nueva contraseña
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="grid gap-[7px]">
        <Label htmlFor="confirmPassword" className="text-[12.5px] font-semibold">
          Confirmar contraseña
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state?.error && (
        <p className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-[12.5px] text-bad">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
