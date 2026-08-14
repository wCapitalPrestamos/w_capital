import { AppSidebar } from "@/components/app-sidebar";
import { requireProfile } from "@/lib/auth";
import { todayHermosillo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const today = todayHermosillo();

  // Contadores del sidebar + cobranza de hoy
  const [unreadRes, leadsRes, appsRes, dueRes, paidRes] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed")
      .gt("unread_count", 0),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .in("stage", ["new", "contacted", "interested", "applying"]),
    supabase
      .from("loan_applications")
      .select("id", { count: "exact", head: true })
      .in("status", ["docs_pending", "under_review", "approved"]),
    supabase
      .from("installments")
      .select("total_due, status")
      .eq("due_date", today),
    supabase.from("payments").select("amount").eq("paid_on", today),
  ]);

  const due = dueRes.data ?? [];
  const counts = {
    inbox: unreadRes.count ?? 0,
    leads: leadsRes.count ?? 0,
    apps: appsRes.count ?? 0,
  };
  const todayStats = {
    collected: (paidRes.data ?? []).reduce((a, p) => a + Number(p.amount), 0),
    expected: due.reduce((a, i) => a + Number(i.total_due), 0),
    paidCount: due.filter((i) => i.status === "paid").length,
    dueCount: due.length,
  };

  return (
    <div suppressHydrationWarning className="flex min-h-screen flex-1 text-[14px]">
      <AppSidebar profile={profile} counts={counts} today={todayStats} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
