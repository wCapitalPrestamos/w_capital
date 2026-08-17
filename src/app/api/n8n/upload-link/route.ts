import { z } from "zod";
import { findOrCreateContact } from "@/lib/conversations";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUploadToken } from "@/lib/upload-tokens";

// n8n → CRM: el bot pide una liga del portal de documentos para un hilo.
// Si el contacto no existe se crea (el bot puede pedir la liga antes de
// reportar el mensaje entrante). Si no tiene solicitud abierta, se crea una.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  // El cliente puede haber dado estos datos de una vez en el mismo mensaje;
  // si no, se quedan en null y el portal / el equipo los completa después.
  name: z.string().trim().min(1).nullish(),
  requested_amount: z.number().positive().nullish(),
  is_business: z.boolean().nullish(),
  business_name: z.string().trim().min(1).nullish(),
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

  const contact = await findOrCreateContact(
    db,
    body.channel,
    body.external_thread_id,
    body.name ?? undefined,
  );

  // Solicitud abierta más reciente, o una nueva en docs_pending
  const { data: existing } = await db
    .from("loan_applications")
    .select("id, requested_amount")
    .eq("contact_id", contact.id)
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let applicationId = existing?.id;
  const isNewApplication = !applicationId;

  if (!applicationId) {
    const { data: created, error } = await db
      .from("loan_applications")
      .insert({
        contact_id: contact.id,
        status: "docs_pending",
        requested_amount: body.requested_amount ?? null,
        borrower_type: body.is_business ? "business" : "personal",
        business_name: body.is_business ? (body.business_name ?? null) : null,
      })
      .select("id")
      .single();
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    applicationId = created.id;
  } else {
    // El cliente puede haber dado estos datos en un mensaje posterior al que
    // creó la solicitud (p. ej. respondiendo "es para mi negocio" a la
    // pregunta del bot) — antes se perdían porque solo se guardaban al crear.
    const patch: Record<string, unknown> = {};
    if (body.requested_amount != null && existing.requested_amount == null) {
      patch.requested_amount = body.requested_amount;
    }
    if (body.is_business != null) {
      patch.borrower_type = body.is_business ? "business" : "personal";
      patch.business_name = body.is_business ? (body.business_name ?? null) : null;
    }
    if (Object.keys(patch).length > 0) {
      await db.from("loan_applications").update(patch).eq("id", applicationId);
    }
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
    is_new: isNewApplication,
    url: `${base}/subir/${rawToken}`,
  });
}
