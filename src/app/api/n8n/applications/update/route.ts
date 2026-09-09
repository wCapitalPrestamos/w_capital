import { z } from "zod";
import { findContact } from "@/lib/conversations";
import { borrowerTypeLabels } from "@/lib/labels";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: aplica un cambio ya CONFIRMADO por el cliente (vía botón Sí/No,
// mismo patrón que la cancelación) sobre SU PROPIA solicitud activa — nunca
// crea ni busca por nada que no sea el channel/external_thread_id real del
// remitente, así que es imposible modificar la solicitud de alguien más.
//
// Solo permite cambiar el monto solicitado y si es personal/negocio — nada
// de folios, status ni otros campos internos.

const STALE_AFTER_MS = 30 * 24 * 3600_000;

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "messenger"]),
  external_thread_id: z.string().min(1),
  requested_amount: z.number().positive().nullable().optional(),
  is_business: z.boolean().nullable().optional(),
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
  if (body.requested_amount == null && body.is_business == null) {
    return Response.json({ ok: false, error: "nothing to update" }, { status: 400 });
  }

  const contact = await findContact(db, body.channel, body.external_thread_id);
  if (!contact) {
    return Response.json({ ok: false, error: "no_active_application" });
  }

  const { data: application } = await db
    .from("loan_applications")
    .select("id, updated_at")
    .eq("contact_id", contact.id)
    .in("status", ["draft", "docs_pending", "under_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isActive =
    application != null &&
    Date.now() - new Date(application.updated_at).getTime() < STALE_AFTER_MS;

  if (!isActive) {
    return Response.json({ ok: false, error: "no_active_application" });
  }

  const patch: Record<string, unknown> = {};
  if (body.requested_amount != null) patch.requested_amount = body.requested_amount;
  if (body.is_business != null) {
    patch.borrower_type = body.is_business ? "business" : "personal";
    if (!body.is_business) patch.business_name = null;
  }

  const { data: updated, error } = await db
    .from("loan_applications")
    .update(patch)
    .eq("id", application.id)
    .select("borrower_type, requested_amount")
    .single();

  if (error || !updated) {
    return Response.json({ ok: false, error: error?.message ?? "update failed" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    borrower_type_label: updated.borrower_type
      ? borrowerTypeLabels[updated.borrower_type as "personal" | "business"]
      : null,
    requested_amount_label: updated.requested_amount
      ? amountFormatter.format(updated.requested_amount)
      : null,
  });
}
