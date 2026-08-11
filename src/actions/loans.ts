"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { allocatePayment, type AllocatableInstallment } from "@/lib/loans/allocate-payment";
import { buildSchedule } from "@/lib/loans/amortization";
import { todayHermosillo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Installment, LoanApplication, PaymentMethod } from "@/lib/types";

// Desembolso: calcula el calendario en TS y lo persiste atómicamente vía RPC
export async function disburseLoan(
  applicationId: string,
  input: { disbursed_at: string; first_payment_date: string },
): Promise<{ ok: boolean; loanId?: string; error?: string }> {
  const profile = await requireProfile();
  if (!["admin", "analyst"].includes(profile.role)) {
    return { ok: false, error: "Solo análisis o administración pueden desembolsar." };
  }

  const supabase = await createClient();

  const { data: app } = await supabase
    .from("loan_applications")
    .select("*")
    .eq("id", applicationId)
    .single<LoanApplication>();

  if (!app) return { ok: false, error: "Solicitud no encontrada." };
  if (app.status !== "approved") {
    return { ok: false, error: "La solicitud debe estar aprobada." };
  }
  if (!app.approved_amount || !app.approved_term_weeks) {
    return { ok: false, error: "Faltan monto o plazo aprobados." };
  }

  let schedule;
  try {
    schedule = buildSchedule({
      principal: Number(app.approved_amount),
      weeklyRate: Number(app.weekly_rate),
      termWeeks: app.approved_term_weeks,
      firstPaymentDate: input.first_payment_date,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de cálculo." };
  }

  const { data: loanId, error } = await supabase.rpc("create_loan_with_schedule", {
    p_application_id: applicationId,
    p_principal: Number(app.approved_amount),
    p_weekly_rate: Number(app.weekly_rate),
    p_term_weeks: app.approved_term_weeks,
    p_weekly_payment: schedule.weeklyPayment,
    p_disbursed_at: input.disbursed_at,
    p_first_payment_date: input.first_payment_date,
    p_installments: schedule.rows,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/solicitudes");
  revalidatePath(`/solicitudes/${applicationId}`);
  revalidatePath("/prestamos");
  return { ok: true, loanId: loanId as string };
}

export interface AllocationPreview {
  installment_number: number;
  installment_id: string;
  interest_amount: number;
  principal_amount: number;
}

// Vista previa de cómo se repartiría un pago (sin persistir nada)
export async function previewPaymentAllocation(
  loanId: string,
  amount: number,
): Promise<{ ok: boolean; preview?: AllocationPreview[]; leftover?: number; error?: string }> {
  await requireProfile();
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Monto inválido." };
  }

  const supabase = await createClient();
  const { data: installments } = await supabase
    .from("installments")
    .select("*")
    .eq("loan_id", loanId)
    .order("number");

  if (!installments?.length) return { ok: false, error: "Préstamo sin calendario." };

  const { allocations, leftover } = allocatePayment(
    installments as AllocatableInstallment[],
    amount,
  );

  const byId = new Map((installments as Installment[]).map((i) => [i.id, i]));
  return {
    ok: true,
    leftover,
    preview: allocations.map((a) => ({
      installment_id: a.installment_id,
      installment_number: byId.get(a.installment_id)?.number ?? 0,
      interest_amount: a.interest_amount,
      principal_amount: a.principal_amount,
    })),
  };
}

export async function recordPayment(
  loanId: string,
  input: {
    amount: number;
    paid_on?: string;
    method: PaymentMethod;
    reference?: string;
    note?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  await requireProfile();

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Monto inválido." };
  }

  const supabase = await createClient();

  const { data: installments } = await supabase
    .from("installments")
    .select("*")
    .eq("loan_id", loanId)
    .order("number");

  if (!installments?.length) return { ok: false, error: "Préstamo sin calendario." };

  const { allocations, leftover } = allocatePayment(
    installments as AllocatableInstallment[],
    input.amount,
  );

  if (leftover > 0) {
    return {
      ok: false,
      error: `El pago excede la deuda restante por $${leftover.toFixed(2)}. Ajusta el monto.`,
    };
  }

  const { error } = await supabase.rpc("record_payment", {
    p_loan_id: loanId,
    p_amount: input.amount,
    p_paid_on: input.paid_on ?? todayHermosillo(),
    p_method: input.method,
    p_reference: input.reference ?? null,
    p_note: input.note ?? null,
    p_allocations: allocations,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/prestamos");
  revalidatePath(`/prestamos/${loanId}`);
  return { ok: true };
}
