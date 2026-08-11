"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-[7px]">
        <Label htmlFor="email" className="text-[12.5px] font-semibold">
          Correo
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@wcapital.mx"
          autoComplete="email"
          required
        />
      </div>
      <div className="grid gap-[7px]">
        <Label htmlFor="password" className="text-[12.5px] font-semibold">
          Contraseña
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>
      {state?.error && (
        <p className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-[12.5px] text-bad">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
