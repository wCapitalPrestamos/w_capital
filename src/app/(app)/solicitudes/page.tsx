import Link from "next/link";
import { Store } from "lucide-react";
import { BoardCardMeta, BoardColumn, ClickableCard, boardCardClass } from "@/components/board";
import { BoardZoom } from "@/components/board-zoom";
import { PageHeader } from "@/components/page-header";
import { ApplicationStatusBadge } from "@/components/status-badge";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import {
  applicationFolio,
  applicationStatusLabels,
  borrowerTypeLabels,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus, LoanApplication } from "@/lib/types";

export const metadata = { title: "Solicitudes" };

type AppWithContact = LoanApplication & {
  contact: { id: string; full_name: string; phone: string | null } | null;
};

const COLUMNS: { status: ApplicationStatus; dot: string }[] = [
  { status: "docs_pending", dot: "#B87400" },
  { status: "under_review", dot: "#F75B32" },
  { status: "approved", dot: "#1F8A53" },
  { status: "disbursed", dot: "#2E7DB2" },
  { status: "rejected", dot: "#D93A2B" },
  { status: "cancelled", dot: "#B4B8BC" },
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
      <PageHeader crumb="Originación" title="Solicitudes" />
      <div className="min-w-0 flex-1 animate-rise-in overflow-x-auto px-8 pt-6 pb-10">
        <BoardZoom>
          {COLUMNS.map(({ status, dot }) => {
            const columnApps = apps.filter((a) => a.status === status);
            const sum = columnApps.reduce(
              (a, app) => a + Number(app.approved_amount ?? app.requested_amount ?? 0),
              0,
            );
            return (
              <BoardColumn
                key={status}
                label={applicationStatusLabels[status]}
                dotColor={dot}
                count={columnApps.length}
                sum={sum > 0 ? formatMoney(sum) : undefined}
                width={300}
              >
                {columnApps.map((app) => {
                  const amount = app.approved_amount ?? app.requested_amount;
                  const weeks = app.approved_term_weeks ?? app.term_weeks;
                  return (
                    <ClickableCard
                      key={app.id}
                      href={`/solicitudes/${app.id}`}
                      className={boardCardClass}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-ink-3">
                          {applicationFolio(app.folio)}
                        </span>
                        <ApplicationStatusBadge status={app.status} />
                      </div>
                      {app.contact ? (
                        <Link
                          href={`/clientes/${app.contact.id}`}
                          className="mt-2 block truncate text-[14.5px] font-semibold tracking-[-.01em] hover:text-brand hover:underline"
                        >
                          {app.contact.full_name || app.contact.phone || "Sin nombre"}
                        </Link>
                      ) : (
                        <p className="mt-2 truncate text-[14.5px] font-semibold tracking-[-.01em]">
                          Sin nombre
                        </p>
                      )}
                      <p className="mt-2.5 font-mono text-[15px] tracking-[-.02em]">
                        {amount ? formatMoney(amount) : "Monto por definir"}
                        {weeks ? ` · ${weeks} sem` : ""}
                      </p>
                      <BoardCardMeta
                        left={
                          app.borrower_type === "business" ? (
                            <span className="inline-flex items-center gap-1">
                              <Store className="size-3 shrink-0" />
                              {app.business_name || borrowerTypeLabels.business}
                            </span>
                          ) : (
                            borrowerTypeLabels.personal
                          )
                        }
                        right={formatRelativeTime(app.updated_at)}
                      />
                    </ClickableCard>
                  );
                })}
              </BoardColumn>
            );
          })}
        </BoardZoom>
      </div>
    </>
  );
}
