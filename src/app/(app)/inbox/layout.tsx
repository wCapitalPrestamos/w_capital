import { ConversationList } from "@/components/inbox/conversation-list";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Bandeja" };

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, contact:contacts(id, full_name, phone)")
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(100);

  return (
    <div
      suppressHydrationWarning
      className="fixed inset-y-0 right-0 left-0 z-10 flex flex-col overflow-hidden bg-background md:left-[var(--sidebar-inset)]"
    >
      <PageHeader crumb="Conversaciones" title="Bandeja" />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden animate-rise-in">
        <ConversationList
          initialConversations={conversations ?? []}
          profileId={profile.id}
        />
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
