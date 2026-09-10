"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CreateApplicationButton } from "@/components/applications/create-application-button";
import { ApplicationStatusBadge, Chip } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatMoney } from "@/lib/format";
import { applicationFolio } from "@/lib/labels";
import type { Contact, DocumentRow, LoanApplication, LoanBalance } from "@/lib/types";

type DocumentSummary = Pick<DocumentRow, "id" | "application_id" | "review_status">;
type LoanBalanceSummary = Pick<LoanBalance, "status" | "days_late" | "overdue_count">;

// Rail derecho del inbox: contexto del cliente de la conversación activa.
// Se mantiene en vivo con Realtime — antes se renderizaba una sola vez en el
// servidor y se quedaba desactualizado hasta navegar a otra conversación y
// volver (ej. llegaba un documento nuevo o se registraba un pago mientras el
// asesor tenía el hilo abierto, y el panel no se enteraba).
export function ContextRail({
  contactId,
  contact,
  initialApplication,
  initialDocuments,
  initialLoans,
  conversationId,
}: {
  contactId: string;
  contact: Contact;
  initialApplication: LoanApplication | null;
  initialDocuments: DocumentSummary[];
  initialLoans: LoanBalanceSummary[];
  conversationId: string;
}) {
  const [application, setApplication] = useState(initialApplication);
  const [documents, setDocuments] = useState(initialDocuments);
  const [loans, setLoans] = useState(initialLoans);
  const applicationIdRef = useRef(application?.id ?? null);

  useEffect(() => {
    applicationIdRef.current = application?.id ?? null;
  }, [application?.id]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const refetchApplication = async () => {
      const { data } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("contact_id", contactId)
        .in("status", ["docs_pending", "under_review", "approved"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<LoanApplication>();
      if (cancelled) return;
      setApplication(data ?? null);
      return data ?? null;
    };

    const refetchDocuments = async (applicationId: string | null) => {
      if (!applicationId) {
        if (!cancelled) setDocuments([]);
        return;
      }
      const { data } = await supabase
        .from("documents")
        .select("id, application_id, review_status")
        .eq("application_id", applicationId);
      if (!cancelled) setDocuments(data ?? []);
    };

    const refetchLoans = async () => {
      const { data } = await supabase
        .from("v_loan_balances")
        .select("status, days_late, overdue_count")
        .eq("contact_id", contactId);
      if (!cancelled) setLoans(data ?? []);
    };

    // Reconcilia todo el panel cuando se pierde algún evento (canal caído,
    // pestaña en segundo plano, etc.) — mismo criterio que el hilo y la
    // bandeja.
    const resyncAll = async () => {
      const app = await refetchApplication();
      await Promise.all([refetchDocuments(app?.id ?? null), refetchLoans()]);
    };

    const channel = supabase
      .channel(`context-rail-${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loan_applications",
          filter: `contact_id=eq.${contactId}`,
        },
        () => refetchApplication().then((app) => refetchDocuments(app?.id ?? null)),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `contact_id=eq.${contactId}`,
        },
        // El filtro ya acota por cliente; se vuelve a pedir por application_id
        // igual, para no mezclar documentos de una solicitud vieja/cancelada
        // con la que se muestra ahora.
        () => refetchDocuments(applicationIdRef.current),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loans",
          filter: `contact_id=eq.${contactId}`,
        },
        // record_payment y mark_overdue siempre tocan la fila de loans
        // afectada, así que esto también cubre pagos y vencimientos sin
        // tener que suscribirse a payments/installments (que no tienen
        // contact_id propio para filtrar).
        () => refetchLoans(),
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") resyncAll();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [contactId]);

  const docsCount = documents.length;
  const docsPending = documents.filter((d) => d.review_status === "pending").length;
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
        href={
          application
            ? `/solicitudes/${application.id}?from=inbox&conversationId=${conversationId}`
            : undefined
        }
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
  href,
}: {
  label: string;
  chip: React.ReactNode;
  value: React.ReactNode;
  hint: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-[11.5px] tracking-[.06em] uppercase text-ink-3">
          {label}
        </p>
        {chip}
      </div>
      <p className="mt-2 text-[13px] font-medium leading-[1.35]">{value}</p>
      <p className="mt-[5px] text-[11.5px] text-ink-2">{hint}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-line-2 bg-surface p-[14px_15px] shadow-card transition-colors hover:border-brand hover:bg-brand-soft"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-line-2 bg-surface p-[14px_15px] shadow-card">
      {content}
    </div>
  );
}
