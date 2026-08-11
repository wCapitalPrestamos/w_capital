import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RecordPaymentDialog } from "@/components/loans/record-payment-dialog";
import { Semaphore } from "@/components/loans/semaphore";
import { PageHeader } from "@/components/page-header";
import { InstallmentStatusBadge, LoanStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { loanFolio, paymentMethodLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type {
  Contact,
  Installment,
  Loan,
  LoanBalance,
  Payment,
} from "@/lib/types";

export default async function PrestamoDetailPage({
  params,
}: PageProps<"/prestamos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: loan } = await supabase
    .from("loans")
    .select("*, contact:contacts(*)")
    .eq("id", id)
    .maybeSingle<Loan & { contact: Contact }>();

  if (!loan) notFound();

  const [{ data: balance }, { data: installments }, { data: payments }] =
    await Promise.all([
      supabase
        .from("v_loan_balances")
        .select("*")
        .eq("loan_id", id)
        .single<LoanBalance>(),
      supabase.from("installments").select("*").eq("loan_id", id).order("number"),
      supabase
        .from("payments")
        .select("*")
        .eq("loan_id", id)
        .order("paid_on", { ascending: false }),
    ]);

  const schedule = (installments ?? []) as Installment[];
  const paid = schedule.filter((i) => i.status === "paid").length;

  return (
    <>
      <PageHeader crumb="Cartera" title={`Préstamo ${loanFolio(loan.folio)}`}>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/prestamos"><ArrowLeft className="size-4" /> Cartera</Link>}
        />
        {loan.status !== "paid_off" && (
          <RecordPaymentDialog
            loanId={loan.id}
            summary={{
              name: loan.contact.full_name || loan.contact.phone || "Sin nombre",
              folio: loanFolio(loan.folio),
              weekly: Number(loan.weekly_payment),
            }}
          />
        )}
      </PageHeader>

      <div className="grid flex-1 gap-6 p-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Resumen</CardTitle>
              <LoanStatusBadge status={loan.status} />
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Info label="Cliente">
                <Link
                  href={`/clientes/${loan.contact.id}`}
                  className="font-medium hover:underline"
                >
                  {loan.contact.full_name || loan.contact.phone || "Sin nombre"}
                </Link>
              </Info>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Monto prestado">{formatMoney(loan.principal)}</Info>
                <Info label="Saldo de capital">
                  {formatMoney(balance?.outstanding_principal ?? loan.principal)}
                </Info>
                <Info label="Cuota semanal">{formatMoney(loan.weekly_payment)}</Info>
                <Info label="Tasa semanal">
                  {(Number(loan.weekly_rate) * 100).toFixed(2)}%
                </Info>
                <Info label="Plazo">{loan.term_weeks} semanas</Info>
                <Info label="Avance">
                  {paid} / {loan.term_weeks} cuotas
                </Info>
                <Info label="Desembolso">{formatDate(loan.disbursed_at)}</Info>
                <Info label="Primer pago">{formatDate(loan.first_payment_date)}</Info>
              </div>
              {balance && (
                <Info label="Mora">
                  <Semaphore
                    daysLate={balance.days_late}
                    overdueCount={balance.overdue_count}
                    withLabel
                  />
                  {balance.overdue_amount > 0 && (
                    <p className="mt-1 text-destructive">
                      Vencido: {formatMoney(balance.overdue_amount)}
                    </p>
                  )}
                </Info>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pagos registrados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {((payments ?? []) as Payment[]).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>
                    {formatDate(p.paid_on)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {paymentMethodLabels[p.method]}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </span>
                  </span>
                  <span className="font-mono font-medium">{formatMoney(p.amount)}</span>
                </div>
              ))}
              {(payments ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin pagos aún.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="self-start xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Calendario de pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead className="text-right">Interés</TableHead>
                  <TableHead className="text-right">Cuota</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-muted-foreground">{i.number}</TableCell>
                    <TableCell>{formatDate(i.due_date)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(i.principal_due)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(i.interest_due)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(i.total_due)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(i.paid_amount)}
                    </TableCell>
                    <TableCell>
                      <InstallmentStatusBadge status={i.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}
