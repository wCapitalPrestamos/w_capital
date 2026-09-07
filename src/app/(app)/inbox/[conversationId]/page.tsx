import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ContextRailData } from "@/components/inbox/context-rail-data";
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

  const contactId = conversation.contact.id;

  // Solo lo que el hilo necesita para renderizar de inmediato — el contexto
  // del cliente (solicitud, documentos, historial) se resuelve aparte y se
  // transmite en su propio <Suspense> más abajo, sin bloquear esto.
  const [{ data: messages }, { data: profiles }, { data: attentionEvents }] =
    await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase.from("profiles").select("id, full_name, role"),
      supabase
        .from("conversation_attention_events")
        .select("message_id")
        .eq("conversation_id", conversationId)
        .is("resolved_at", null)
        .not("message_id", "is", null),
    ]);

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
        initialAttentionMessageIds={(attentionEvents ?? [])
          .map((e) => e.message_id)
          .filter((id): id is string => id !== null)}
        profile={profile}
        profileNames={profileNames}
        assignableProfiles={assignableProfiles}
      />
      <Suspense fallback={<ContextRailSkeleton />}>
        <ContextRailData contactId={contactId} contact={conversation.contact} />
      </Suspense>
    </>
  );
}

function ContextRailSkeleton() {
  return (
    <aside className="hidden w-[272px] shrink-0 animate-pulse flex-col gap-3.5 overflow-y-auto border-l border-line-2 bg-surface-2 p-5 xl:flex">
      <div className="h-3 w-32 rounded bg-line-2" />
      <div className="h-24 rounded-2xl bg-line-2" />
      <div className="h-24 rounded-2xl bg-line-2" />
      <div className="h-24 rounded-2xl bg-line-2" />
    </aside>
  );
}
