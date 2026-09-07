import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export const metadata = { title: "Definir contraseña" };
export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Se llega aquí solo tras canjear el link de invitación/recuperación en
  // /auth/confirm, que ya deja una sesión activa. Sin sesión, no hay nada
  // que hacer aquí.
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-[380px] animate-rise-in">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-[14px] bg-linear-150 from-[#FF7A56] to-[#F04A1F] font-serif text-[26px] leading-none italic text-white shadow-[0_8px_20px_-8px_rgba(247,91,50,.75)]">
            W
          </div>
          <div className="leading-tight">
            <p className="font-semibold tracking-[-.01em]">W Capital</p>
            <p className="text-[11px] tracking-[.12em] uppercase text-ink-3">
              CRM · Préstamos
            </p>
          </div>
        </div>

        <p className="text-[11px] tracking-[.09em] uppercase text-ink-3">
          Bienvenido
        </p>
        <h2 className="mt-1 font-serif text-[34px] leading-[1.1] font-normal tracking-[-.01em]">
          Define tu contraseña
        </h2>
        <p className="mt-2 text-[13.5px] text-ink-2">
          Esta será tu contraseña para entrar al CRM de ahora en adelante.
        </p>

        <div className="mt-8">
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}
