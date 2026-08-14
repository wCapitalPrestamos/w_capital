import { notFound } from "next/navigation";
import { ContextRail } from "@/components/inbox/context-rail";
import { Thread } from "@/components/inbox/thread";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Contact,
  Conversation,
  LoanApplication,
  Message,
  Profile,
} from "@/lib/types";

export default async function ConversationPage({
  params,
}: PageProps<"/inbox/[conversationId]">) {
  const { conversationId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*, contact:contacts(*)")
    .eq("id", conversationId)
    .maybeSingle<Conversation & { contact: Contact }>();

  if (!conversation) notFound();

  const contactId = conversation.contact.id;

  const [{ data: messages }, { data: profiles }, { data: application }, { data: loans }] =
    await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase.from("profiles").select("id, full_name, role"),
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

  let docsCount = 0;
  let docsPending = 0;
  if (application) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, review_status")
      .eq("application_id", application.id);
    docsCount = docs?.length ?? 0;
    docsPending = (docs ?? []).filter((d) => d.review_status === "pending").length;
  }

  const allProfiles = (profiles ?? []) as Pick<Profile, "id" | "full_name" | "role">[];
  const profileNames = Object.fromEntries(
    allProfiles.map((p) => [p.id, p.full_name]),
  );
  const assignableProfiles = allProfiles.filter(
    (p) => p.role === "advisor" || p.role === "admin",
  );

  return (
    <>
      <Thread
        key={conversationId}
        conversation={conversation}
        contact={conversation.contact}
        initialMessages={(messages ?? []) as Message[]}
        profile={profile}
        profileNames={profileNames}
        assignableProfiles={assignableProfiles}
      />
      <ContextRail
        contact={conversation.contact}
        application={application ?? null}
        docsCount={docsCount}
        docsPending={docsPending}
        loans={loans ?? []}
      />
    </>
  );
}
