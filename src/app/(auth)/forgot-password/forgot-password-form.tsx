"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  if (state?.sent) {
    return (
      <p className="rounded-xl bg-ok-soft px-3.5 py-2.5 text-[12.5px] text-ok">
        Si el correo existe en nuestro sistema, se envió un link para
        restablecer la contraseña.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
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
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? "Enviando…" : "Enviar link"}
      </Button>
    </form>
  );
}
