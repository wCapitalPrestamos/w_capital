import { requireProfile } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-screen flex-1">
      <AppSidebar profile={profile} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
