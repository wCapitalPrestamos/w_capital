import { Suspense } from "react";
import { HandCoins, KanbanSquare, MessageSquare } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

// Forzado a dinámico para que reciba el nonce de CSP por request (ver src/proxy.ts)
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Bandeja omnicanal",
    description:
      "WhatsApp y Messenger en un solo lugar, con bot de primer contacto y traspaso a asesoras.",
  },
  {
    icon: KanbanSquare,
    title: "Originación clara",
    description:
      "Del lead a la solicitud y el desembolso, con expediente digital y aprobaciones por rol.",
  },
  {
    icon: HandCoins,
    title: "Cobranza semanal",
    description:
      "Calendario francés al 1.97% semanal, con mora, PAR y cartera siempre a la vista.",
  },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1">
      {/* Panel de marca */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-linear-150 from-[#FF7A56] to-[#F04A1F] p-12 text-white lg:flex xl:p-16">
        {/* Marca de agua decorativa */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-40 font-serif text-[560px] leading-none italic text-white/10 select-none"
        >
          W
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-32 size-[420px] rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-[14px] bg-white/15 font-serif text-[26px] leading-none italic shadow-[inset_0_1px_0_rgba(255,255,255,.25)] backdrop-blur-sm">
            W
          </div>
          <div className="leading-tight">
            <p className="text-[17px] font-semibold tracking-[-.01em]">W Capital</p>
            <p className="text-[11px] tracking-[.14em] uppercase text-white/70">
              CRM · Préstamos
            </p>
          </div>
        </div>

        <div className="relative max-w-[440px]">
          <h1 className="font-serif text-[44px] leading-[1.08] font-normal tracking-[-.01em] xl:text-[50px]">
            Toda la operación de préstamos, en un solo lugar.
          </h1>
          <ul className="mt-10 flex flex-col gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-white/15 backdrop-blur-sm">
                  <Icon className="size-[17px]" strokeWidth={1.7} />
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold tracking-[-.01em]">
                    {title}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-[1.5] text-white/80">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12.5px] text-white/70">
          Impulsemos el futuro · Hermosillo, Sonora
        </p>
      </aside>

      {/* Formulario */}
      <div className="flex min-w-0 flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-[380px] animate-rise-in">
          {/* Marca compacta en pantallas chicas */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
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
            Hola de nuevo
          </p>
          <h2 className="mt-1 font-serif text-[34px] leading-[1.1] font-normal tracking-[-.01em]">
            Inicia sesión
          </h2>
          <p className="mt-2 text-[13.5px] text-ink-2">
            Accede con tu cuenta del equipo.
          </p>

          <div className="mt-8">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
