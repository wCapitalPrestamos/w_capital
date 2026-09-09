import { z } from "zod";
import { findContact } from "@/lib/conversations";
import { borrowerTypeLabels, docTypeLabels } from "@/lib/labels";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUploadToken } from "@/lib/upload-tokens";
import type { BorrowerType, DocType } from "@/lib/types";

// Mismos documentos requeridos que src/app/subir/[token]/page.tsx — el aval
// solo aplica si la solicitud lo tiene marcado.
const BASE_REQUIRED: DocType[] = ["ine", "proof_of_address", "proof_of_income", "collateral"];

// Frase amigable para el cliente — nunca el status técnico interno (nunca
// "docs_pending" tal cual). Solo cubre los 3 valores que cuentan como
// "activa"; los demás (aprobada, rechazada, etc.) nunca llegan aquí.
const FRIENDLY_STATUS: Record<"draft" | "docs_pending" | "under_review", string> = {
  draft: "apenas la está completando, aún faltan datos por terminar",
  docs_pending: "le faltan documentos por subir",
  under_review: "ya está en revisión por nuestro equipo",
};

// n8n → CRM: el cliente pregunta por SU solicitud (si tiene una abierta, o
// pide su link para subir documentos) sin haber expresado una intención
// nueva de solicitar — a diferencia de /api/n8n/upload-link, este endpoint
// NUNCA crea una solicitud, solo consulta si ya existe una activa.
//
// "Activa" usa el mismo criterio que resolve_active_application: status en
// (draft, docs_pending, under_review) y con actividad en los últimos 30
// días — una solicitud abandonada hace tiempo no cuenta como activa aquí,
// aunque tampoco se cancela por una simple consulta (eso sigue pasando solo
// si el cliente de verdad reinicia el flujo de solicitud).
//
// La respuesta nunca expone folio, id, status ni ningún detalle interno —
// solo si hay una activa y, si la hay, un link nuevo para subir documentos.

const STALE_AFTER_MS = 30 * 24 * 3600_000;

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Hermosillo",
});

const amountFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
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

  const contact = await findContact(db, body.channel, body.external_thread_id);
  if (!contact) {
    return Response.json({ ok: true, has_active: false });
  }

  const { data: application } = await db
    .from("loan_applications")
    .select("id, status, created_at, updated_at, borrower_type, requested_amount, has_aval")
    .eq("contact_id", contact.id)
    .in("status", ["draft", "docs_pending", "under_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isActive =
    application != null &&
    Date.now() - new Date(application.updated_at).getTime() < STALE_AFTER_MS;

  if (!isActive) {
    return Response.json({ ok: true, has_active: false });
  }

  const { rawToken, tokenHash } = generateUploadToken();
  const { error: tokenError } = await db.from("upload_tokens").insert({
    token_hash: tokenHash,
    application_id: application.id,
    contact_id: contact.id,
  });

  if (tokenError) {
    return Response.json({ ok: false, error: tokenError.message }, { status: 500 });
  }

  const { data: uploaded } = await db
    .from("documents")
    .select("doc_type")
    .eq("application_id", application.id);

  const requiredDocs = application.has_aval ? [...BASE_REQUIRED, "aval_ine" as DocType] : BASE_REQUIRED;
  const uploadedTypes = new Set((uploaded ?? []).map((d) => d.doc_type));
  const missingDocuments = requiredDocs
    .filter((docType) => !uploadedTypes.has(docType))
    .map((docType) => docTypeLabels[docType]);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return Response.json({
    ok: true,
    has_active: true,
    url: `${base}/subir/${rawToken}`,
    created_at_label: dateFormatter.format(new Date(application.created_at)),
    status_label: FRIENDLY_STATUS[application.status as "draft" | "docs_pending" | "under_review"],
    borrower_type_label: application.borrower_type
      ? borrowerTypeLabels[application.borrower_type as BorrowerType]
      : null,
    requested_amount_label: application.requested_amount
      ? amountFormatter.format(application.requested_amount)
      : null,
    missing_documents: missingDocuments,
  });
}
