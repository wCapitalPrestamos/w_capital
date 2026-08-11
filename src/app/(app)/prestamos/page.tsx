import Link from "next/link";
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

export const metadata = { title: "Préstamos" };

type BalanceWithContact = LoanBalance & {
  contact: { id: string; full_name: string; phone: string | null } | null;
};

export default async function PrestamosPage() {
  const supabase = await createClient();

  const { data: loans } = await supabase
    .from("v_loan_balances")
    .select("*, contact:contacts(id, full_name, phone)")
    .order("status", { ascending: true })
    .order("days_late", { ascending: false });

  const rows = (loans ?? []) as BalanceWithContact[];

  return (
    <>
      <PageHeader title="Préstamos" description="Cartera y cobranza semanal" />
      <div className="flex-1 p-6">
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Prestado</TableHead>
                <TableHead className="text-right">Saldo capital</TableHead>
                <TableHead className="text-right">Cuota semanal</TableHead>
                <TableHead>Mora</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Desembolso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.loan_id}>
                  <TableCell>
                    <Link
                      href={`/prestamos/${l.loan_id}`}
                      className="font-medium hover:underline"
                    >
                      {loanFolio(l.folio)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {l.contact ? (
                      <Link href={`/clientes/${l.contact.id}`} className="hover:underline">
                        {l.contact.full_name || l.contact.phone || "Sin nombre"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatMoney(l.principal)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatMoney(l.outstanding_principal)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
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
                  <TableCell className="text-muted-foreground">
                    {formatDate(l.disbursed_at)}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
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
