import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashUploadToken } from "@/lib/upload-tokens";
import type { UploadToken } from "@/lib/types";

export type TokenValidation =
  | { valid: true; token: UploadToken }
  | { valid: false; reason: "not_found" | "expired" | "revoked" };

// Valida un token crudo del portal contra su hash en la base
export async function validatePortalToken(
  db: SupabaseClient,
  rawToken: string,
): Promise<TokenValidation> {
  const { data } = await db
    .from("upload_tokens")
    .select("*")
    .eq("token_hash", hashUploadToken(rawToken))
    .maybeSingle<UploadToken>();

  if (!data) return { valid: false, reason: "not_found" };
  if (data.revoked_at) return { valid: false, reason: "revoked" };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, token: data };
}
