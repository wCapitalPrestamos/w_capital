import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUploadToken } from "@/lib/upload-tokens";

// n8n → CRM: el bot pide una liga del portal de documentos para un hilo.
// Si el contacto no tiene solicitud abierta, se crea una en borrador.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
});

const OPEN_STATUSES = ["draft", "docs_pending", "under_review"];

export async function POST(request: Request) {
  if (!isValidN8nRequest(request)) return unauthorized();

  const db = createAdminClient();
  const raw = await request.json().catch(() => null);

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid payload", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const idColumn = body.channel === "whatsapp" ? "wa_id" : "messenger_psid";

  const { data: contact } = await db
    .from("contacts")
    .select("id")
    .eq(idColumn, body.external_thread_id)
    .maybeSingle();

  if (!contact) {
    return Response.json({ ok: false, error: "contact not found" }, { status: 404 });
  }

  // Solicitud abierta más reciente, o una nueva en docs_pending
  const { data: existing } = await db
    .from("loan_applications")
    .select("id")
    .eq("contact_id", contact.id)
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let applicationId = existing?.id;
  if (!applicationId) {
    const { data: created, error } = await db
      .from("loan_applications")
      .insert({ contact_id: contact.id, status: "docs_pending" })
      .select("id")
      .single();
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    applicationId = created.id;
  }

  const { rawToken, tokenHash } = generateUploadToken();
  const { error: tokenError } = await db.from("upload_tokens").insert({
    token_hash: tokenHash,
    application_id: applicationId,
    contact_id: contact.id,
  });

  if (tokenError) {
    return Response.json({ ok: false, error: tokenError.message }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return Response.json({
    ok: true,
    application_id: applicationId,
    url: `${base}/subir/${rawToken}`,
  });
}
