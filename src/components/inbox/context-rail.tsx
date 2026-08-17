import { CreateApplicationButton } from "@/components/applications/create-application-button";
import { ApplicationStatusBadge, Chip } from "@/components/status-badge";
import { formatDate, formatMoney } from "@/lib/format";
import { applicationFolio } from "@/lib/labels";
import type { Contact, LoanApplication, LoanBalance } from "@/lib/types";

// Rail derecho del inbox: contexto del cliente de la conversación activa
export function ContextRail({
  contact,
  application,
  docsCount,
  docsPending,
  loans,
}: {
  contact: Contact;
  application: LoanApplication | null;
  docsCount: number;
  docsPending: number;
  loans: Pick<LoanBalance, "status" | "days_late" | "overdue_count">[];
}) {
  const activeLoans = loans.filter(
    (l) => l.status === "active" || l.status === "overdue",
  );
  const inMora = loans.some(
    (l) => l.status === "overdue" || Number(l.days_late) > 0,
  );

  return (
    <aside className="hidden w-[272px] shrink-0 flex-col gap-3.5 overflow-y-auto scrollbar-hidden border-l border-line-2 bg-surface-2 p-5 xl:flex">
      <p className="text-[10.5px] font-semibold tracking-[.1em] uppercase text-ink-3">
        Contexto del cliente
      </p>

      <RailCard
        label="Solicitud activa"
        chip={
          application ? <ApplicationStatusBadge status={application.status} /> : null
        }
        value={
          application ? (
            <span className="font-mono text-[15px] font-medium">
              {applicationFolio(application.folio)}
            </span>
          ) : (
            "Sin solicitud activa"
          )
        }
        hint={
          application
            ? `${formatMoney(application.approved_amount ?? application.requested_amount)}${
                application.term_weeks
                  ? ` · ${application.approved_term_weeks ?? application.term_weeks} semanas`
                  : ""
              }`
            : "Créala con el botón de abajo."
        }
      />

      {application && (
        <RailCard
          label="Expediente"
          chip={<Chip tone="neutral">{docsCount} recibidos</Chip>}
          value={
            docsPending > 0
              ? `${docsPending} por revisar`
              : docsCount > 0
                ? "Documentos revisados"
                : "Aún sin documentos"
          }
          hint="Gestión desde la solicitud."
        />
      )}

      <RailCard
        label="Historial"
        chip={
          loans.length > 0 ? (
            <Chip tone={inMora ? "bad" : "ok"}>
              {inMora ? "En mora" : "Sin mora"}
            </Chip>
          ) : null
        }
        value={
          loans.length > 0
            ? `${loans.length} préstamo${loans.length === 1 ? "" : "s"}${
                activeLoans.length > 0 ? ` · ${activeLoans.length} activo${activeLoans.length === 1 ? "" : "s"}` : ""
              }`
            : "Sin préstamos previos"
        }
        hint={`Cliente desde ${formatDate(contact.created_at)}`}
      />

      <CreateApplicationButton
        contactId={contact.id}
        triggerLabel="Crear solicitud"
        triggerVariant="outline"
        triggerClassName="h-[38px] w-full justify-center text-ink hover:text-brand"
      />
    </aside>
  );
}

function RailCard({
  label,
  chip,
  value,
  hint,
}: {
  label: string;
  chip: React.ReactNode;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-line-2 bg-surface p-[14px_15px] shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-[11.5px] tracking-[.06em] uppercase text-ink-3">
          {label}
        </p>
        {chip}
      </div>
      <p className="mt-2 text-[13px] font-medium leading-[1.35]">{value}</p>
      <p className="mt-[5px] text-[11.5px] text-ink-2">{hint}</p>
    </div>
  );
}
