import { z } from "zod";
import { validatePortalToken } from "@/lib/portal-tokens";
import { createAdminClient } from "@/lib/supabase/admin";

// Portal público → CRM: el cliente acepta la autorización de solicitud de
// crédito o la de consulta en Buró de Crédito. No son documentos — son
// checks que quedan registrados con su fecha/hora como evidencia.

const bodySchema = z.object({
  token: z.string().min(10),
  type: z.enum(["credit", "bureau"]),
});

const COLUMN_BY_TYPE = {
  credit: "credit_authorization_accepted_at",
  bureau: "bureau_authorization_accepted_at",
} as const;

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

  const column = COLUMN_BY_TYPE[parsed.data.type];
  const acceptedAt = new Date().toISOString();

  const { error } = await db
    .from("loan_applications")
    .update({ [column]: acceptedAt })
    .eq("id", validation.token.application_id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, accepted_at: acceptedAt });
}
