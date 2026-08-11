import { notFound } from "next/navigation";
import { Thread } from "@/components/inbox/thread";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Conversation, Message, Profile } from "@/lib/types";

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

  const [{ data: messages }, { data: profiles }] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const profileNames = Object.fromEntries(
    ((profiles ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  return (
    <Thread
      key={conversationId}
      conversation={conversation}
      contact={conversation.contact}
      initialMessages={(messages ?? []) as Message[]}
      profile={profile}
      profileNames={profileNames}
    />
  );
}
