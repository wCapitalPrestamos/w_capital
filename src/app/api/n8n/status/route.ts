import { z } from "zod";
import { isValidN8nRequest, unauthorized } from "@/lib/n8n-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n → CRM: actualizaciones de estatus de entrega de Meta
// (sent → delivered → read, o failed con detalle).

const bodySchema = z.object({
  external_message_id: z.string().min(1),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  error_detail: z.string().optional(),
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

  // No degradar estatus (p. ej. read → delivered llega fuera de orden)
  const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

  const { data: message } = await db
    .from("messages")
    .select("id, status")
    .eq("external_message_id", body.external_message_id)
    .maybeSingle();

  if (!message) {
    return Response.json({ ok: true, ignored: true });
  }

  if ((rank[body.status] ?? 0) <= (rank[message.status] ?? 0)) {
    return Response.json({ ok: true, ignored: true });
  }

  await db
    .from("messages")
    .update({
      status: body.status,
      error_detail: body.error_detail ?? null,
    })
    .eq("id", message.id);

  return Response.json({ ok: true });
}
