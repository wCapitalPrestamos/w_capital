import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ClickableRow } from "@/components/contacts/clickable-row";
import { NewContactDialog } from "@/components/contacts/new-contact-dialog";
import { PageHeader } from "@/components/page-header";
import { Chip, type ChipTone } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { borrowerTypeLabels, sourceChannelLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Clientes" };

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "prestamo", label: "Con préstamo" },
  { key: "mora", label: "En mora" },
  { key: "prospectos", label: "Prospectos" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

interface ContactStatus {
  label: string;
  tone: ChipTone;
  hasLoan: boolean;
  inMora: boolean;
  isProspect: boolean;
  business: boolean;
}

export default async function ClientesPage({
  searchParams,
}: PageProps<"/clientes">) {
  const { q, f } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const filter: FilterKey = FILTERS.some((x) => x.key === f)
    ? (f as FilterKey)
    : "todos";

  const supabase = await createClient();
  let request = supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (query) {
    request = request.or(
      `full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`,
    );
  }

  const [{ data: contacts }, { count: total }, { data: balances }, { data: apps }] =
    await Promise.all([
      request,
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase
        .from("v_loan_balances")
        .select("contact_id, status, days_late, overdue_count"),
      supabase
        .from("loan_applications")
        .select("contact_id, status, borrower_type")
        .in("status", ["docs_pending", "under_review", "approved"]),
    ]);

  // Estado derivado por contacto: mora > préstamo activo > solicitud > prospecto
  const statusByContact = new Map<string, ContactStatus>();
  for (const c of contacts ?? []) {
    const myLoans = (balances ?? []).filter((b) => b.contact_id === c.id);
    const myApps = (apps ?? []).filter((a) => a.contact_id === c.id);
    const inMora = myLoans.some(
      (b) => b.status === "overdue" || Number(b.days_late) > 0,
    );
    const hasLoan = myLoans.some(
      (b) => b.status === "active" || b.status === "overdue",
    );
    const business = myApps.some((a) => a.borrower_type === "business");

    let label = "Prospecto";
    let tone: ChipTone = "neutral";
    if (inMora) [label, tone] = ["En mora", "bad"];
    else if (hasLoan) [label, tone] = ["Préstamo activo", "blue"];
    else if (myApps.some((a) => a.status === "approved"))
      [label, tone] = ["Aprobada", "ok"];
    else if (myApps.some((a) => a.status === "under_review"))
      [label, tone] = ["En análisis", "warn"];
    else if (myApps.length > 0) [label, tone] = ["Solicitud activa", "info"];

    statusByContact.set(c.id, {
      label,
      tone,
      hasLoan,
      inMora,
      isProspect: !hasLoan && myApps.length === 0,
      business,
    });
  }

  const visible = (contacts ?? []).filter((c: Contact) => {
    const s = statusByContact.get(c.id);
    if (!s) return true;
    if (filter === "prestamo") return s.hasLoan;
    if (filter === "mora") return s.inMora;
    if (filter === "prospectos") return s.isProspect;
    return true;
  });

  const hrefFor = (key: FilterKey) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (key !== "todos") params.set("f", key);
    const qs = params.toString();
    return `/clientes${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader crumb="Directorio" title="Clientes">
        <NewContactDialog />
      </PageHeader>
      <div className="flex flex-1 animate-rise-in flex-col gap-4 px-8 pt-6 pb-10">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(({ key, label }) => (
            <Link
              key={key}
              href={hrefFor(key)}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
                filter === key
                  ? "border-line-2 bg-surface text-ink shadow-card"
                  : "border-line-2 bg-transparent text-ink-2 hover:text-ink",
              )}
            >
              {label}
            </Link>
          ))}
          <span className="flex-1" />
          <span className="text-[12.5px] text-ink-3">
            {visible.length} de {total ?? visible.length} contactos
          </span>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-line-2 bg-surface shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Cliente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Registro</TableHead>
                <TableHead className="w-10 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c: Contact) => {
                const s = statusByContact.get(c.id);
                const initials =
                  (c.full_name || "?")
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase() || "?";
                return (
                  <ClickableRow key={c.id} href={`/clientes/${c.id}`} className="group">
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-brand-soft text-xs font-semibold text-brand-ink">
                          {initials}
                        </span>
                        <div className="leading-[1.3]">
                          <Link
                            href={`/clientes/${c.id}`}
                            className="font-semibold tracking-[-.01em] hover:text-brand"
                          >
                            {c.full_name || "Sin nombre"}
                          </Link>
                          <p className="text-[11.5px] text-ink-3">
                            {s?.business
                              ? borrowerTypeLabels.business
                              : borrowerTypeLabels.personal}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[13px] text-ink-2">
                      {c.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-ink-2">
                      {sourceChannelLabels[c.source_channel]}
                    </TableCell>
                    <TableCell>
                      {s && <Chip tone={s.tone}>{s.label}</Chip>}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-ink-3">
                      {formatDate(c.created_at)}
                    </TableCell>
                    <TableCell className="pr-5">
                      <ChevronRight className="size-4 text-ink-3 transition-colors group-hover:text-brand" />
                    </TableCell>
                  </ClickableRow>
                );
              })}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-ink-3">
                    {query
                      ? "Sin resultados para tu búsqueda."
                      : "Aún no hay clientes en este filtro."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
