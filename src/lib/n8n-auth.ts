import "server-only";
import { timingSafeEqual } from "node:crypto";

// Autenticación de las rutas /api/n8n/*: header x-crm-secret compartido con n8n
export function isValidN8nRequest(request: Request): boolean {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  const header = request.headers.get("x-crm-secret");
  if (!secret || !header) return false;

  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
