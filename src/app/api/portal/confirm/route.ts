import { z } from "zod";
import { validatePortalToken } from "@/lib/portal-tokens";
import { createAdminClient } from "@/lib/supabase/admin";

// Portal público → CRM: registra el documento después de subirlo a Storage.

const bodySchema = z.object({
  token: z.string().min(10),
  doc_type: z.enum([
    "credit_application", "bureau_authorization", "ine", "proof_of_address",
    "proof_of_income", "bank_statement", "collateral", "aval_ine", "other",
  ]),
  path: z.string().min(1),
  file_name: z.string().min(1).max(200),
  mime_type: z.string().min(1).max(100),
  size_bytes: z.number().int().nonnegative(),
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

  const token = validation.token;
  const body = parsed.data;

  // El path debe pertenecer a la solicitud del token (evita registrar rutas ajenas)
  if (!body.path.startsWith(`applications/${token.application_id}/`)) {
    return Response.json({ ok: false, error: "path_mismatch" }, { status: 400 });
  }

  const { error } = await db.from("documents").insert({
    application_id: token.application_id,
    contact_id: token.contact_id,
    doc_type: body.doc_type,
    storage_path: body.path,
    file_name: body.file_name,
    mime_type: body.mime_type,
    size_bytes: body.size_bytes,
    uploaded_via: "portal",
    upload_token_id: token.id,
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  await db
    .from("upload_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", token.id);

  return Response.json({ ok: true });
}
