import { todayHermosillo } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

// Cron diario (vercel.json): marca cuotas vencidas y préstamos en mora.
// Vercel manda Authorization: Bearer $CRON_SECRET automáticamente.

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const today = todayHermosillo();

  const { data: updated, error } = await db.rpc("mark_overdue", { p_today: today });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, date: today, installments_marked: updated });
}
