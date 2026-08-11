import { z } from "zod";
import { validatePortalToken } from "@/lib/portal-tokens";
import { createAdminClient } from "@/lib/supabase/admin";

// Portal público → CRM: prepara una URL firmada para subir un documento.
// El archivo va del navegador directo a Storage (nunca pasa por Vercel).

const bodySchema = z.object({
  token: z.string().min(10),
  doc_type: z.enum([
    "credit_application", "bureau_authorization", "ine", "proof_of_address",
    "proof_of_income", "bank_statement", "collateral", "aval_ine", "other",
  ]),
  file_name: z.string().min(1).max(200),
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

  const { file_name, doc_type } = parsed.data;
  const ext = file_name.includes(".") ? file_name.split(".").pop() : "bin";
  const path = `applications/${validation.token.application_id}/${doc_type}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await db.storage
    .from("documents")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return Response.json({ ok: false, error: "storage_error" }, { status: 500 });
  }

  return Response.json({ ok: true, path: data.path, upload_token: data.token });
}
