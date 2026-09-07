"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export async function inviteUser(input: {
  email: string;
  full_name: string;
  role: Role;
}): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["admin"]);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.full_name, role: input.role },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/ajustes/usuarios");
  return { ok: true };
}

export async function updateUser(
  userId: string,
  input: { role?: Role; active?: boolean; full_name?: string },
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole(["admin"]);

  if (me.id === userId && input.active === false) {
    return { ok: false, error: "No puedes desactivar tu propia cuenta." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(input).eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/ajustes/usuarios");
  return { ok: true };
}
