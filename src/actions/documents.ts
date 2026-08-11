"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateUploadToken } from "@/lib/upload-tokens";

export async function reviewDocument(
  documentId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from("documents")
    .update({
      review_status: decision,
      review_note: note ?? null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .select("application_id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/solicitudes/${doc.application_id}`);
  return { ok: true };
}

// URL firmada de lectura (60 s) para previsualizar un documento
export async function getDocumentUrl(
  documentId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireProfile();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (!doc) return { ok: false, error: "Documento no encontrado." };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60);

  if (error || !data) {
    return { ok: false, error: "No se pudo generar la liga (¿archivo inexistente?)." };
  }
  return { ok: true, url: data.signedUrl };
}

// Subida de documentos por el staff: URL firmada + confirmación (evita pasar
// archivos por el server action; el navegador sube directo a Storage)
export async function createStaffUploadUrl(
  applicationId: string,
  docType: string,
  fileName: string,
): Promise<{ ok: boolean; path?: string; token?: string; error?: string }> {
  await requireProfile();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("loan_applications")
    .select("id")
    .eq("id", applicationId)
    .single();
  if (!app) return { ok: false, error: "Solicitud no encontrada." };

  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const path = `applications/${applicationId}/${docType}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUploadUrl(path);

  if (error || !data) return { ok: false, error: "No se pudo preparar la subida." };
  return { ok: true, path: data.path, token: data.token };
}

export async function confirmStaffUpload(input: {
  applicationId: string;
  docType: string;
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ ok: boolean; error?: string }> {
  await requireProfile();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("loan_applications")
    .select("id, contact_id")
    .eq("id", input.applicationId)
    .single();
  if (!app) return { ok: false, error: "Solicitud no encontrada." };

  const { error } = await supabase.from("documents").insert({
    application_id: app.id,
    contact_id: app.contact_id,
    doc_type: input.docType,
    storage_path: input.path,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    uploaded_via: "staff",
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/solicitudes/${input.applicationId}`);
  return { ok: true };
}

// Genera una liga del portal de documentos para una solicitud
export async function createUploadLink(
  applicationId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("loan_applications")
    .select("id, contact_id")
    .eq("id", applicationId)
    .single();

  if (!app) return { ok: false, error: "Solicitud no encontrada." };

  const { rawToken, tokenHash } = generateUploadToken();

  const { error } = await supabase.from("upload_tokens").insert({
    token_hash: tokenHash,
    application_id: app.id,
    contact_id: app.contact_id,
    created_by: profile.id,
  });

  if (error) return { ok: false, error: error.message };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { ok: true, url: `${base}/subir/${rawToken}` };
}
