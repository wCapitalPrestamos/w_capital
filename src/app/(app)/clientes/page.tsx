import Link from "next/link";
import { NewContactDialog } from "@/components/contacts/new-contact-dialog";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { sourceChannelLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types";

export const metadata = { title: "Clientes" };

export default async function ClientesPage({
  searchParams,
}: PageProps<"/clientes">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

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

  const { data: contacts } = await request;

  return (
    <>
      <PageHeader title="Clientes" description="Contactos y prospectos">
        <NewContactDialog />
      </PageHeader>
      <div className="flex-1 space-y-4 p-6">
        <SearchInput placeholder="Buscar por nombre, teléfono o correo" />
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(contacts ?? []).map((c: Contact) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/clientes/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.full_name || "Sin nombre"}
                    </Link>
                  </TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{sourceChannelLabels[c.source_channel]}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(c.created_at)}
                  </TableCell>
                </TableRow>
              ))}
              {(contacts ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    {query ? "Sin resultados para tu búsqueda." : "Aún no hay clientes."}
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
