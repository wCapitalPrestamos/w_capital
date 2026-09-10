import { ContextRail } from "@/components/inbox/context-rail";
import { createClient } from "@/lib/supabase/server";
import type { Contact, DocumentRow, LoanApplication } from "@/lib/types";

// Trae el contexto del cliente (solicitud, documentos, historial) por
// separado del hilo de mensajes, para que ese fetch no bloquee el render
// del hilo — se transmite (streaming) dentro de un <Suspense> en la página.
export async function ContextRailData({
  contactId,
  contact,
  conversationId,
}: {
  contactId: string;
  contact: Contact;
  conversationId: string;
}) {
  const supabase = await createClient();

  const [{ data: application }, { data: loans }] = await Promise.all([
    supabase
      .from("loan_applications")
      .select("*")
      .eq("contact_id", contactId)
      .in("status", ["docs_pending", "under_review", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<LoanApplication>(),
    supabase
      .from("v_loan_balances")
      .select("status, days_late, overdue_count")
      .eq("contact_id", contactId),
  ]);

  let documents: Pick<DocumentRow, "id" | "application_id" | "review_status">[] = [];
  if (application) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, application_id, review_status")
      .eq("application_id", application.id);
    documents = docs ?? [];
  }

  return (
    <ContextRail
      contactId={contactId}
      contact={contact}
      initialApplication={application ?? null}
      initialDocuments={documents}
      initialLoans={loans ?? []}
      conversationId={conversationId}
    />
  );
}
