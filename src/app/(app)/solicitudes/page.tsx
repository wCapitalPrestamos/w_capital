import Link from "next/link";
import { Store } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ApplicationStatusBadge } from "@/components/status-badge";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { applicationFolio, applicationStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus, LoanApplication } from "@/lib/types";

export const metadata = { title: "Solicitudes" };

type AppWithContact = LoanApplication & {
  contact: { id: string; full_name: string; phone: string | null } | null;
};

const COLUMNS: ApplicationStatus[] = [
  "docs_pending",
  "under_review",
  "approved",
  "disbursed",
  "rejected",
];

export default async function SolicitudesPage() {
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from("loan_applications")
    .select("*, contact:contacts(id, full_name, phone)")
    .order("updated_at", { ascending: false })
    .limit(300);

  const apps = (applications ?? []) as AppWithContact[];

  return (
    <>
      <PageHeader
        title="Solicitudes"
        description="Pipeline de originación de préstamos"
      />
      <div className="min-w-0 flex-1 overflow-x-auto p-6">
        <div className="flex min-h-[60vh] gap-4">
          {COLUMNS.map((status) => {
            const columnApps = apps.filter((a) => a.status === status);
            return (
              <div
                key={status}
                className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40"
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <h3 className="text-sm font-semibold">
                    {applicationStatusLabels[status]}
                  </h3>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {columnApps.length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
                  {columnApps.map((app) => (
                    <Link
                      key={app.id}
                      href={`/solicitudes/${app.id}`}
                      className="rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {applicationFolio(app.folio)}
                        </span>
                        <ApplicationStatusBadge status={app.status} />
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        {app.contact?.full_name || app.contact?.phone || "Sin nombre"}
                      </p>
                      {app.borrower_type === "business" && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Store className="size-3 shrink-0" />
                          {app.business_name || "Negocio"}
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {formatMoney(app.approved_amount ?? app.requested_amount)}
                          {app.term_weeks ? ` · ${app.approved_term_weeks ?? app.term_weeks} sem` : ""}
                        </span>
                        <span>{formatRelativeTime(app.updated_at)}</span>
                      </div>
                    </Link>
                  ))}
                  {columnApps.length === 0 && (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      Vacío
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
