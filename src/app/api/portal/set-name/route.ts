import { z } from "zod";
import { validatePortalToken } from "@/lib/portal-tokens";
import { createAdminClient } from "@/lib/supabase/admin";

// Portal público → CRM: el cliente captura su nombre antes de subir documentos.

const bodySchema = z.object({
  token: z.string().min(10),
  full_name: z.string().trim().min(2).max(200),
});

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  const db = createAdminClient();
  const validation = await validatePortalToken(db, parsed.data.token);
  if (!validation.valid) {
    return Response.json(
      { ok: false, error: "token_invalid", reason: validation.reason },
      { status: 401 },
    );
  }

  const { error } = await db
    .from("contacts")
    .update({ full_name: parsed.data.full_name })
    .eq("id", validation.token.contact_id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
