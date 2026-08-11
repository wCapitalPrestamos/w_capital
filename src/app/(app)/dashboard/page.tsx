import {
  CollectionBars,
  FunnelRows,
  Sparkline,
} from "@/components/dashboard/charts";
import { PageHeader } from "@/components/page-header";
import { Chip } from "@/components/status-badge";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

interface Portfolio {
  active_loans: number;
  total_outstanding: number;
  overdue_outstanding: number;
  par_percent: number;
}

const PAR_TARGET = 10;

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: portfolio }, { data: collection }, { data: funnel }] =
    await Promise.all([
      supabase.from("v_active_portfolio").select("*").single<Portfolio>(),
      supabase.from("v_weekly_collection").select("*"),
      supabase.from("v_funnel").select("*").single(),
    ]);

  const weeks = (collection ?? []).map((w) => ({
    label: String(w.week_start).slice(5),
    expected: Number(w.expected),
    collected: Number(w.collected),
  }));
  const lastWeeks = weeks.slice(-6);
  const thisWeek = weeks.at(-1);
  const prevWeek = weeks.at(-2);

  const par = Number(portfolio?.par_percent ?? 0);
  const parOver = par > PAR_TARGET;
  const collectedPct =
    thisWeek && thisWeek.expected > 0
      ? Math.round((thisWeek.collected / thisWeek.expected) * 100)
      : null;
  const delta =
    thisWeek && prevWeek && prevWeek.collected > 0
      ? ((thisWeek.collected - prevWeek.collected) / prevWeek.collected) * 100
      : null;

  return (
    <>
      <PageHeader crumb="Panorama" title="Dashboard" />
      <div className="flex flex-1 animate-rise-in flex-col gap-[22px] px-8 pt-7 pb-10">
        <div className="grid gap-[18px] xl:grid-cols-[1.35fr_1fr]">
          {/* Hero: cartera activa */}
          <section className="relative overflow-hidden rounded-[22px] border border-line-2 bg-surface p-[26px_28px] shadow-lifted">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11.5px] tracking-[.1em] uppercase text-ink-3">
                  Cartera activa
                </p>
                <p className="mt-2.5 font-serif text-[58px] leading-none tracking-[-.02em]">
                  {formatMoney(portfolio?.total_outstanding ?? 0)}
                </p>
                <p className="mt-3 text-[13.5px] text-ink-2">
                  {portfolio?.active_loans ?? 0} préstamos vivos · 1.97% semanal ·
                  sistema francés
                </p>
              </div>
              {delta !== null && (
                <Chip tone={delta >= 0 ? "ok" : "bad"} className="gap-1 px-[11px]">
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% cobranza vs
                  semana pasada
                </Chip>
              )}
            </div>
            <div className="mt-[22px]">
              <Sparkline points={lastWeeks.map((w) => w.collected)} />
            </div>
          </section>

          <div className="grid gap-[18px]">
            {/* PAR */}
            <section className="rounded-[22px] border border-line-2 bg-surface p-[22px_24px] shadow-card">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11.5px] tracking-[.1em] uppercase text-ink-3">
                  Cartera en riesgo · PAR
                </p>
                <Chip tone={parOver ? "bad" : "ok"}>
                  {parOver ? "Sobre el límite" : "En objetivo"}
                </Chip>
              </div>
              <div className="mt-3 flex items-baseline gap-2.5">
                <p
                  className={`font-serif text-[42px] leading-none ${parOver ? "text-bad" : ""}`}
                >
                  {par.toFixed(1)}%
                </p>
                <p className="text-[13px] text-ink-2">
                  {formatMoney(portfolio?.overdue_outstanding ?? 0)} en mora
                </p>
              </div>
              <div className="relative mt-4 h-2 overflow-visible rounded-full bg-line-2">
                <div
                  className="h-full origin-left animate-grow-row rounded-full bg-bad"
                  style={{ width: `${Math.min(100, par)}%` }}
                />
                <div
                  className="absolute -top-[3px] h-3.5 w-[1.5px] bg-ink-3"
                  style={{ left: `${PAR_TARGET}%` }}
                />
              </div>
              <p className="mt-2 text-[11.5px] text-ink-3">
                Objetivo interno: por debajo de {PAR_TARGET}%
              </p>
            </section>

            {/* Esperado / cobrado de la semana */}
            <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] border border-line-2 bg-line-2 shadow-card">
              <div className="min-w-0 bg-surface p-[20px_18px]">
                <p className="text-[11.5px] tracking-[.09em] uppercase text-ink-3">
                  Esperado
                </p>
                <p className="mt-2 font-mono text-[19px] font-medium tracking-[-.02em] whitespace-nowrap">
                  {formatMoney(thisWeek?.expected ?? 0)}
                </p>
                <p className="mt-1 text-[11.5px] text-ink-3">
                  Cuotas de esta semana
                </p>
              </div>
              <div className="min-w-0 bg-surface p-[20px_18px]">
                <p className="text-[11.5px] tracking-[.09em] uppercase text-ink-3">
                  Cobrado
                </p>
                <p className="mt-2 font-mono text-[19px] font-medium tracking-[-.02em] whitespace-nowrap text-brand">
                  {formatMoney(thisWeek?.collected ?? 0)}
                </p>
                <p className="mt-1 text-[11.5px] text-ink-3">
                  {collectedPct !== null
                    ? `${collectedPct}% de lo esperado`
                    : "Pagos registrados"}
                </p>
              </div>
            </section>
          </div>
        </div>

        <div className="grid gap-[18px] xl:grid-cols-[1.35fr_1fr]">
          {/* Cobranza semanal */}
          <section className="rounded-[22px] border border-line-2 bg-surface p-[24px_26px_20px] shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-normal">Cobranza semanal</h2>
            </div>
            <div className="mt-2">
              <CollectionBars data={lastWeeks} />
            </div>
          </section>

          {/* Embudo */}
          <section className="rounded-[22px] border border-line-2 bg-surface p-[24px_26px] shadow-card">
            <h2 className="mb-5 font-serif text-xl font-normal">
              Embudo de conversión
            </h2>
            <FunnelRows
              data={[
                { label: "Contactos", value: Number(funnel?.contacts ?? 0) },
                { label: "Leads", value: Number(funnel?.leads ?? 0) },
                { label: "Solicitudes", value: Number(funnel?.applications ?? 0) },
                { label: "Aprobadas", value: Number(funnel?.approved ?? 0) },
                { label: "Desembolsadas", value: Number(funnel?.disbursed ?? 0) },
              ]}
            />
          </section>
        </div>
      </div>
    </>
  );
}
