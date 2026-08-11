"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/types";

export async function moveLead(leadId: string, stage: LeadStage, discardReason?: string) {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({
      stage,
      discard_reason: stage === "discarded" ? (discardReason ?? null) : null,
    })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/leads");
  return { ok: true };
}

export async function createLead(input: {
  contact_id: string;
  interest_amount?: number;
  notes?: string;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("contact_id", input.contact_id)
    .neq("stage", "discarded")
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Este cliente ya tiene un lead activo en el kanban." };
  }

  const { error } = await supabase.from("leads").insert({
    contact_id: input.contact_id,
    interest_amount: input.interest_amount ?? null,
    notes: input.notes ?? null,
    assigned_to: profile.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/leads");
  return { ok: true };
}
