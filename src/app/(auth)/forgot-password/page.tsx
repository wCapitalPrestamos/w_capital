import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Recuperar contraseña" };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
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
          ¿Olvidaste tu contraseña?
        </p>
        <h2 className="mt-1 font-serif text-[34px] leading-[1.1] font-normal tracking-[-.01em]">
          Recupérala aquí
        </h2>
        <p className="mt-2 text-[13.5px] text-ink-2">
          Escribe tu correo y te mandamos un link para definir una nueva.
        </p>

        <div className="mt-8">
          <ForgotPasswordForm />
        </div>

        <Link
          href="/login"
          className="mt-6 block text-center text-[12.5px] text-ink-2 hover:text-foreground"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </main>
  );
}
