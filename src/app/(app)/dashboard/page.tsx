import {
  ChannelChart,
  CollectionChart,
  DisbursedChart,
  FunnelChart,
} from "@/components/dashboard/charts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

interface Portfolio {
  active_loans: number;
  total_outstanding: number;
  overdue_outstanding: number;
  par_percent: number;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: portfolio },
    { data: disbursed },
    { data: collection },
    { data: funnel },
    { data: channels },
  ] = await Promise.all([
    supabase.from("v_active_portfolio").select("*").single<Portfolio>(),
    supabase.from("v_disbursed_monthly").select("*"),
    supabase.from("v_weekly_collection").select("*"),
    supabase.from("v_funnel").select("*").single(),
    supabase.from("v_channel_breakdown").select("*"),
  ]);

  const thisWeek = (collection ?? []).at(-1);

  return (
    <>
      <PageHeader title="Dashboard" description="Salud de la cartera y del embudo" />
      <div className="flex-1 space-y-6 p-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Cartera activa"
            value={formatMoney(portfolio?.total_outstanding ?? 0)}
            hint={`${portfolio?.active_loans ?? 0} préstamos vivos`}
          />
          <KpiCard
            label="Cartera en riesgo (PAR)"
            value={`${Number(portfolio?.par_percent ?? 0).toFixed(1)}%`}
            hint={`${formatMoney(portfolio?.overdue_outstanding ?? 0)} en mora`}
            alert={Number(portfolio?.par_percent ?? 0) > 10}
          />
          <KpiCard
            label="Esperado esta semana"
            value={formatMoney(Number(thisWeek?.expected ?? 0))}
            hint="Suma de cuotas que vencen"
          />
          <KpiCard
            label="Cobrado esta semana"
            value={formatMoney(Number(thisWeek?.collected ?? 0))}
            hint="Pagos registrados"
          />
        </div>

        {/* Gráficas */}
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Cobranza semanal · esperado vs cobrado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CollectionChart
                data={(collection ?? []).map((w) => ({
                  week: String(w.week_start).slice(5),
                  esperado: Number(w.expected),
                  cobrado: Number(w.collected),
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desembolsos por mes</CardTitle>
            </CardHeader>
            <CardContent>
              <DisbursedChart
                data={(disbursed ?? []).map((m) => ({
                  month: String(m.month).slice(0, 7),
                  monto: Number(m.total_disbursed),
                  prestamos: Number(m.loans_count),
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Embudo de conversión</CardTitle>
            </CardHeader>
            <CardContent>
              <FunnelChart
                data={[
                  { etapa: "Contactos", total: Number(funnel?.contacts ?? 0) },
                  { etapa: "Leads", total: Number(funnel?.leads ?? 0) },
                  { etapa: "Solicitudes", total: Number(funnel?.applications ?? 0) },
                  { etapa: "Aprobadas", total: Number(funnel?.approved ?? 0) },
                  { etapa: "Desembolsadas", total: Number(funnel?.disbursed ?? 0) },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contactos por canal</CardTitle>
            </CardHeader>
            <CardContent>
              <ChannelChart
                data={(channels ?? []).map((c) => ({
                  canal: c.source_channel as string,
                  total: Number(c.contacts),
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1 font-mono text-2xl font-semibold tracking-tight ${
            alert ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
