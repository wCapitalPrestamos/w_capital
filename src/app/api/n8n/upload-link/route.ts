import { z } from "zod";
import { findOrCreateContact } from "@/lib/conversations";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUploadToken } from "@/lib/upload-tokens";
import type { LoanApplication } from "@/lib/types";

interface ResolveActiveApplicationResult {
  application: LoanApplication;
  is_new: boolean;
}

// n8n → CRM: el bot pide una liga del portal de documentos para un hilo.
// Si el contacto no existe se crea (el bot puede pedir la liga antes de
// reportar el mensaje entrante). Si no tiene solicitud abierta, se crea una.

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  // El cliente puede haber dado estos datos de una vez en el mismo mensaje;
  // si no, se quedan en null y el portal / el equipo los completa después.
  name: z.string().trim().min(1).nullish(),
  // Tope de cordura: esto es lo que el cliente dijo en texto libre (el LLM
  // lo extrae sin validar), no un monto aprobado — nunca alimenta desembolso.
  requested_amount: z.number().positive().max(2_000_000).nullish(),
  is_business: z.boolean().nullish(),
  business_name: z.string().trim().min(1).nullish(),
});

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

  // Crea o reutiliza la solicitud abierta del contacto de forma atómica
  // (bloqueo a nivel de fila + advisory lock dentro de la RPC evita
  // duplicados si Meta reintenta el webhook o el cliente da doble tap).
  const { data: resolved, error: resolveError } = (await db
    .rpc("resolve_active_application", {
      p_contact_id: contact.id,
      p_borrower_type: body.is_business == null ? null : body.is_business ? "business" : "personal",
      p_requested_amount: body.requested_amount ?? null,
      p_business_name: body.business_name ?? null,
    })
    .single()) as { data: ResolveActiveApplicationResult | null; error: { message: string } | null };

  if (resolveError || !resolved) {
    return Response.json(
      { ok: false, error: resolveError?.message ?? "resolve failed" },
      { status: 500 },
    );
  }

  const applicationId = resolved.application.id;
  const isNewApplication = resolved.is_new;

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
    borrower_type: resolved.application.borrower_type,
  });
}
