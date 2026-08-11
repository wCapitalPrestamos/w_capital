"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SourceChannel } from "@/lib/types";

export async function createContact(input: {
  full_name: string;
  phone?: string;
  email?: string;
  address?: string;
  source_channel: SourceChannel;
  notes?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      full_name: input.full_name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      source_channel: input.source_channel,
      notes: input.notes || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  return { ok: true, id: data.id };
}

export async function updateContact(
  contactId: string,
  input: {
    full_name?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("contacts").update(input).eq("id", contactId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clientes/${contactId}`);
  revalidatePath("/clientes");
  return { ok: true };
}
