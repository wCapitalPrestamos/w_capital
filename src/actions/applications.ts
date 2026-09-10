"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { TRANSITIONS } from "@/lib/application-transitions";
import { formatMissing } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus, BorrowerType, CollateralType } from "@/lib/types";

export async function createApplication(input: {
  contact_id: string;
  lead_id?: string;
  requested_amount?: number;
  term_weeks?: number;
  purpose?: string;
  borrower_type?: BorrowerType;
  business_name?: string;
  collateral_type?: CollateralType;
  collateral_description?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const borrowerType = input.borrower_type ?? "personal";

  const { data, error } = await supabase
    .from("loan_applications")
    .insert({
      contact_id: input.contact_id,
      lead_id: input.lead_id ?? null,
      requested_amount: input.requested_amount ?? null,
      term_weeks: input.term_weeks ?? null,
      purpose: input.purpose ?? null,
      borrower_type: borrowerType,
      business_name: borrowerType === "business" ? (input.business_name ?? null) : null,
      collateral_type: input.collateral_type ?? null,
      collateral_description: input.collateral_description ?? null,
      status: "docs_pending",
      advisor_id: profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Si venía de un lead, muévelo a "En solicitud"
  if (input.lead_id) {
    await supabase.from("leads").update({ stage: "applying" }).eq("id", input.lead_id);
  }

  revalidatePath("/solicitudes");
  return { ok: true, id: data.id };
}

export async function changeApplicationStatus(
  applicationId: string,
  to: ApplicationStatus,
  note?: string,
  extra?: {
    approved_amount?: number;
    approved_term_weeks?: number;
    rejection_reason?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("loan_applications")
    .select("id, status")
    .eq("id", applicationId)
    .single();

  if (!app) return { ok: false, error: "Solicitud no encontrada." };

  if (!TRANSITIONS[app.status as ApplicationStatus]?.includes(to)) {
    return { ok: false, error: `No se puede pasar de "${app.status}" a "${to}".` };
  }

  if (
    (to === "approved" || to === "rejected") &&
    !["admin", "analyst"].includes(profile.role)
  ) {
    return { ok: false, error: "Solo análisis o administración pueden aprobar o rechazar." };
  }

  if (to === "approved" && (!extra?.approved_amount || !extra?.approved_term_weeks)) {
    return { ok: false, error: "Indica monto y plazo aprobados." };
  }

  // Antes de mandarla a revisión, la Asesora debe tener capturados los
  // datos básicos y subidos los documentos mínimos — el Analista revisa y
  // aprueba cada documento después, pero no debe ni ver la solicitud hasta
  // que esto esté completo (misma fuente de verdad que dispara la
  // notificación de "documentación completa", ver 0022_application_requirements.sql).
  if (app.status === "docs_pending" && to === "under_review") {
    const { data: missing } = await supabase.rpc(
      "application_missing_requirements",
      { p_application_id: applicationId },
    );
    if (missing && (missing as string[]).length > 0) {
      return {
        ok: false,
        error: `Faltan datos/documentos antes de mandarla a revisión: ${formatMissing(missing as string[])}.`,
      };
    }
  }

  const patch: Record<string, unknown> = { status: to };
  if (to === "approved") {
    patch.approved_amount = extra!.approved_amount;
    patch.approved_term_weeks = extra!.approved_term_weeks;
    patch.analyst_id = profile.id;
  }
  if (to === "rejected") {
    patch.rejection_reason = extra?.rejection_reason ?? note ?? null;
    patch.analyst_id = profile.id;
  }

  const { error } = await supabase
    .from("loan_applications")
    .update(patch)
    .eq("id", applicationId);

  if (error) return { ok: false, error: error.message };

  // Nota adicional en el historial (el trigger ya registró el cambio)
  if (note) {
    await supabase.from("application_status_history").insert({
      application_id: applicationId,
      from_status: app.status,
      to_status: to,
      changed_by: profile.id,
      note,
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath(`/solicitudes/${applicationId}`);
  return { ok: true };
}

export async function updateApplicationDetails(
  applicationId: string,
  input: {
    requested_amount?: number | null;
    term_weeks?: number | null;
    purpose?: string | null;
    borrower_type?: BorrowerType;
    business_name?: string | null;
    collateral_type?: CollateralType | null;
    collateral_description?: string | null;
    has_aval?: boolean;
    aval_name?: string | null;
    aval_phone?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("loan_applications")
    .update(input)
    .eq("id", applicationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/solicitudes/${applicationId}`);
  return { ok: true };
}

export async function reassignApplication(
  applicationId: string,
  field: "advisor_id" | "analyst_id",
  profileId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    return { ok: false, error: "Solo administración puede reasignar." };
  }

  const supabase = await createClient();
  const { data: app, error } = await supabase
    .from("loan_applications")
    .update({ [field]: profileId })
    .eq("id", applicationId)
    .select("folio")
    .single();

  if (error) return { ok: false, error: error.message };

  if (profileId) {
    const folio = `SOL-${String(app.folio).padStart(6, "0")}`;
    await supabase.rpc("notify_profile", {
      p_recipient_id: profileId,
      p_type: "application_reassigned",
      p_title: "Solicitud reasignada",
      p_body: `${folio} te fue asignada como ${field === "advisor_id" ? "asesora" : "analista"}.`,
      p_entity_type: "application",
      p_entity_id: applicationId,
      p_link_path: `/solicitudes/${applicationId}`,
    });
  }

  revalidatePath(`/solicitudes/${applicationId}`);
  return { ok: true };
}
