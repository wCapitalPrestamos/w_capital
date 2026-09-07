import { PageHeader } from "@/components/page-header";
import { UsersTable } from "@/components/users/users-table";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // auth.users no es consultable con el cliente de sesión (RLS no aplica al
  // schema auth) — solo el service-role puede leer si ya inició sesión, para
  // mostrar qué invitaciones siguen pendientes.
  const admin = createAdminClient();
  const pendingIds = new Set<string>();
  for (const p of profiles ?? []) {
    const { data } = await admin.auth.admin.getUserById(p.id);
    if (data.user && !data.user.last_sign_in_at) pendingIds.add(p.id);
  }

  return (
    <>
      <PageHeader crumb="Ajustes" title="Usuarios del equipo" />
      <div className="flex-1 p-6">
        <UsersTable
          profiles={(profiles ?? []) as Profile[]}
          myId={me.id}
          pendingIds={pendingIds}
        />
      </div>
    </>
  );
}
