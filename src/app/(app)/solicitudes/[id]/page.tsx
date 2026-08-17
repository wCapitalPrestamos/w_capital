import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApplicationActions } from "@/components/applications/application-actions";
import { ApplicationAssignments } from "@/components/applications/application-assignments";
import { DocumentsChecklist } from "@/components/applications/documents-checklist";
import { EditApplicationButton } from "@/components/applications/edit-application-button";
import { PageHeader } from "@/components/page-header";
import { ApplicationStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  applicationFolio,
  applicationStatusLabels,
  borrowerTypeLabels,
  collateralTypeLabels,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationStatusHistory,
  Contact,
  DocumentRow,
  Loan,
  LoanApplication,
  Profile,
} from "@/lib/types";

export default async function SolicitudDetailPage({
  params,
}: PageProps<"/solicitudes/[id]">) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("loan_applications")
    .select("*, contact:contacts(*)")
    .eq("id", id)
    .maybeSingle<LoanApplication & { contact: Contact }>();

  if (!app) notFound();

  const [{ data: documents }, { data: history }, { data: profiles }, { data: loan }] =
    await Promise.all([
      supabase
        .from("documents")
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("application_status_history")
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, role"),
      supabase.from("loans").select("id, folio").eq("application_id", id).maybeSingle(),
    ]);

  const allProfiles = (profiles ?? []) as Pick<Profile, "id" | "full_name" | "role">[];
  const profileNames = Object.fromEntries(
    allProfiles.map((p) => [p.id, p.full_name]),
  );
  const advisorOptions = allProfiles.filter(
    (p) => p.role === "advisor" || p.role === "admin",
  );
  const analystOptions = allProfiles.filter(
    (p) => p.role === "analyst" || p.role === "admin",
  );

  return (
    <>
      <PageHeader crumb="Originación" title={`Solicitud ${applicationFolio(app.folio)}`}>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/solicitudes"><ArrowLeft className="size-4" /> Pipeline</Link>}
        />
      </PageHeader>

      <div className="grid flex-1 gap-6 p-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-1">
                <CardTitle className="text-base">Resumen</CardTitle>
                <EditApplicationButton application={app} />
              </div>
              <ApplicationStatusBadge status={app.status} />
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Detail label="Cliente">
                <Link href={`/clientes/${app.contact.id}`} className="font-medium hover:underline">
                  {app.contact.full_name || app.contact.phone || "Sin nombre"}
                </Link>
              </Detail>
              <Detail label="Teléfono">{app.contact.phone ?? "—"}</Detail>
              <Detail label="Préstamo para">
                {app.borrower_type === "business"
                  ? `${borrowerTypeLabels.business}${app.business_name ? ` — ${app.business_name}` : ""}`
                  : borrowerTypeLabels.personal}
              </Detail>
              <Detail label="Monto solicitado">{formatMoney(app.requested_amount)}</Detail>
              <Detail label="Plazo solicitado">
                {app.term_weeks ? `${app.term_weeks} semanas` : "—"}
              </Detail>
              {app.status === "approved" || app.status === "disbursed" ? (
                <>
                  <Detail label="Monto aprobado">{formatMoney(app.approved_amount)}</Detail>
                  <Detail label="Plazo aprobado">
                    {app.approved_term_weeks ? `${app.approved_term_weeks} semanas` : "—"}
                  </Detail>
                </>
              ) : null}
              <Detail label="Tasa semanal">
                {(Number(app.weekly_rate) * 100).toFixed(2)}%
              </Detail>
              <Detail label="Destino">{app.purpose ?? "—"}</Detail>
              <Detail label="Garantía">
                {app.collateral_type ? collateralTypeLabels[app.collateral_type] : "—"}
                {app.collateral_description ? ` — ${app.collateral_description}` : ""}
              </Detail>
              {app.has_aval && (
                <Detail label="Aval">
                  {app.aval_name ?? "—"}
                  {app.aval_phone ? ` · ${app.aval_phone}` : ""}
                </Detail>
              )}
              <ApplicationAssignments
                applicationId={app.id}
                role={profile.role}
                advisorId={app.advisor_id}
                analystId={app.analyst_id}
                advisorOptions={advisorOptions}
                analystOptions={analystOptions}
                profileNames={profileNames}
              />
              {app.rejection_reason && (
                <Detail label="Motivo de rechazo">{app.rejection_reason}</Detail>
              )}
              {loan && (
                <Detail label="Préstamo">
                  <Link href={`/prestamos/${(loan as Loan).id}`} className="font-medium text-primary hover:underline">
                    Ver préstamo desembolsado →
                  </Link>
                </Detail>
              )}
            </CardContent>
          </Card>

          <DocumentsChecklist
            applicationId={app.id}
            hasAval={app.has_aval}
            documents={(documents ?? []) as DocumentRow[]}
          />
        </div>

        <div className="space-y-6">
          <ApplicationActions
            application={app}
            role={profile.role}
            hasLoan={Boolean(loan)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {((history ?? []) as ApplicationStatusHistory[]).map((h) => (
                <div key={h.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm">
                    {h.from_status
                      ? `${applicationStatusLabels[h.from_status]} → ${applicationStatusLabels[h.to_status]}`
                      : `Creada como ${applicationStatusLabels[h.to_status]}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(h.created_at)}
                    {h.changed_by ? ` · ${profileNames[h.changed_by] ?? ""}` : " · sistema"}
                  </p>
                  {h.note && <p className="mt-0.5 text-xs italic">{h.note}</p>}
                </div>
              ))}
              {(history ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin movimientos.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}
