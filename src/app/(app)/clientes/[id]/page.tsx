import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, HandCoins, MessageSquare } from "lucide-react";
import { ContactEditForm } from "@/components/contacts/contact-edit-form";
import { CreateApplicationButton } from "@/components/applications/create-application-button";
import { CreateLeadButton } from "@/components/leads/create-lead-button";
import { ChannelIcon } from "@/components/inbox/channel-icon";
import { PageHeader } from "@/components/page-header";
import { ApplicationStatusBadge, LoanStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney, formatRelativeTime } from "@/lib/format";
import { applicationFolio, loanFolio, sourceChannelLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Conversation, Loan, LoanApplication } from "@/lib/types";

const BACK_TARGETS: Record<string, { href: string; label: string }> = {
  leads: { href: "/leads", label: "Leads" },
};

export default async function ClienteDetailPage({
  params,
  searchParams,
}: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const { from } = await searchParams;
  const back =
    (typeof from === "string" && BACK_TARGETS[from]) || {
      href: "/clientes",
      label: "Clientes",
    };
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle<Contact>();

  if (!contact) notFound();

  const [{ data: conversations }, { data: applications }, { data: loans }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", id)
        .order("last_message_at", { ascending: false }),
      supabase
        .from("loan_applications")
        .select("*")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("loans")
        .select("*")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <>
      <PageHeader crumb="Directorio" title={contact.full_name || "Sin nombre"}>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={back.href}><ArrowLeft className="size-4" /> {back.label}</Link>} />
        <CreateLeadButton contactId={contact.id} />
        <CreateApplicationButton contactId={contact.id} />
      </PageHeader>

      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 self-start">
          <CardHeader>
            <CardTitle className="text-base">Datos del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactEditForm contact={contact} />
            <p className="mt-4 text-xs text-muted-foreground">
              Canal de origen: {sourceChannelLabels[contact.source_channel]} · Registro:{" "}
              {formatDate(contact.created_at)}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="size-4" /> Conversaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(conversations ?? []).map((c: Conversation) => (
                <Link
                  key={c.id}
                  href={`/inbox/${c.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                >
                  <span className="flex items-center gap-2">
                    <ChannelIcon channel={c.channel} />
                    <span className="max-w-md truncate text-muted-foreground">
                      {c.last_preview || "…"}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(c.last_message_at)}
                  </span>
                </Link>
              ))}
              {(conversations ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin conversaciones.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" /> Solicitudes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(applications ?? []).map((a: LoanApplication) => (
                <Link
                  key={a.id}
                  href={`/solicitudes/${a.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                >
                  <span className="font-medium">{applicationFolio(a.folio)}</span>
                  <span className="text-muted-foreground">
                    {formatMoney(a.requested_amount)}
                  </span>
                  <ApplicationStatusBadge status={a.status} />
                </Link>
              ))}
              {(applications ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin solicitudes.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HandCoins className="size-4" /> Préstamos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(loans ?? []).map((l: Loan) => (
                <Link
                  key={l.id}
                  href={`/prestamos/${l.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                >
                  <span className="font-medium">{loanFolio(l.folio)}</span>
                  <span className="text-muted-foreground">{formatMoney(l.principal)}</span>
                  <LoanStatusBadge status={l.status} />
                </Link>
              ))}
              {(loans ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin préstamos.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
