import { LeadsKanban } from "@/components/leads/kanban";
import {
  NewLeadDialog,
  type ContactOption,
} from "@/components/leads/new-lead-dialog";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const supabase = await createClient();

  const [{ data: leads }, { data: contacts }] = await Promise.all([
    supabase
      .from("leads")
      .select("*, contact:contacts(id, full_name, phone, source_channel)")
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase
      .from("contacts")
      .select("id, full_name, phone")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Arrastra las tarjetas para avanzar prospectos"
      >
        <NewLeadDialog contacts={(contacts ?? []) as ContactOption[]} />
      </PageHeader>
      <div className="min-w-0 flex-1 overflow-x-auto p-6">
        <LeadsKanban initialLeads={leads ?? []} />
      </div>
    </>
  );
}
