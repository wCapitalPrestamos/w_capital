import { PageHeader } from "@/components/page-header";
import { UsersTable } from "@/components/users/users-table";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const me = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");

  return (
    <>
      <PageHeader
        title="Usuarios del equipo"
        description="Cuentas con acceso al CRM"
      />
      <div className="flex-1 p-6">
        <UsersTable profiles={(profiles ?? []) as Profile[]} myId={me.id} />
      </div>
    </>
  );
}
