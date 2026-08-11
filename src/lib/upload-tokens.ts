import "server-only";
import { createHash, randomBytes } from "node:crypto";

// El token crudo solo vive en la URL que recibe el cliente;
// en la base solo guardamos su hash sha256.

export function generateUploadToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(24).toString("base64url");
  return { rawToken, tokenHash: hashUploadToken(rawToken) };
}

export function hashUploadToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
