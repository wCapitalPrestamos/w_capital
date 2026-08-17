import Link from "next/link";
import { ClickableRow } from "@/components/contacts/clickable-row";
import { PageHeader } from "@/components/page-header";
import { Semaphore } from "@/components/loans/semaphore";
import { LoanStatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { loanFolio } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { LoanBalance } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Préstamos" };

type BalanceWithContact = LoanBalance & {
  contact: { id: string; full_name: string; phone: string | null } | null;
};

interface Portfolio {
  active_loans: number;
  total_outstanding: number;
  overdue_outstanding: number;
  par_percent: number;
}

export default async function PrestamosPage() {
  const supabase = await createClient();

  const [{ data: loans }, { data: portfolio }] = await Promise.all([
    supabase
      .from("v_loan_balances")
      .select("*, contact:contacts(id, full_name, phone)")
      .order("status", { ascending: true })
      .order("days_late", { ascending: false }),
    supabase.from("v_active_portfolio").select("*").single<Portfolio>(),
  ]);

  const rows = (loans ?? []) as BalanceWithContact[];
  const weeklyExpected = rows
    .filter((l) => l.status === "active" || l.status === "overdue")
    .reduce((a, l) => a + Number(l.weekly_payment), 0);

  const stats = [
    {
      label: "Cartera activa",
      value: formatMoney(portfolio?.total_outstanding ?? 0),
    },
    { label: "Préstamos vivos", value: String(portfolio?.active_loans ?? 0) },
    { label: "Cuota semanal esperada", value: formatMoney(weeklyExpected) },
    {
      label: "En mora",
      value: formatMoney(portfolio?.overdue_outstanding ?? 0),
      alert: true,
    },
  ];

  return (
    <>
      <PageHeader crumb="Cartera" title="Préstamos" />
      <div className="flex flex-1 animate-rise-in flex-col gap-4 px-8 pt-6 pb-10">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-line-2 bg-line-2 shadow-card xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface p-[18px_20px]">
              <p className="text-[11px] tracking-[.09em] uppercase text-ink-3">
                {s.label}
              </p>
              <p
                className={cn(
                  "mt-[7px] font-mono text-[19px] font-medium tracking-[-.02em]",
                  s.alert && "text-bad",
                )}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[20px] border border-line-2 bg-surface shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Prestado</TableHead>
                <TableHead className="text-right">Saldo capital</TableHead>
                <TableHead className="text-right">Cuota semanal</TableHead>
                <TableHead>Mora</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="pr-5 text-right">Desembolso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <ClickableRow key={l.loan_id} href={`/prestamos/${l.loan_id}`}>
                  <TableCell className="pl-5 font-mono text-[12.5px]">
                    <Link
                      href={`/prestamos/${l.loan_id}`}
                      className="font-semibold hover:text-brand"
                    >
                      {loanFolio(l.folio)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {l.contact ? (
                      <Link
                        href={`/clientes/${l.contact.id}`}
                        className="font-medium hover:text-brand"
                      >
                        {l.contact.full_name || l.contact.phone || "Sin nombre"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[13px] text-ink-2">
                    {formatMoney(l.principal)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[13px]">
                    {formatMoney(l.outstanding_principal)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[13px]">
                    {formatMoney(l.weekly_payment)}
                  </TableCell>
                  <TableCell>
                    <Semaphore
                      daysLate={l.days_late}
                      overdueCount={l.overdue_count}
                      withLabel
                    />
                  </TableCell>
                  <TableCell>
                    <LoanStatusBadge status={l.status} />
                  </TableCell>
                  <TableCell className="pr-5 text-right text-[13px] text-ink-3">
                    {formatDate(l.disbursed_at)}
                  </TableCell>
                </ClickableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-ink-3">
                    Aún no hay préstamos desembolsados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
