import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { TenantBanner } from "@/components/shared/TenantBanner";
import { Toaster } from "@/components/ui/toast";
import { CommandPalette } from "@/components/shared/CommandPalette";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 ml-60">
          <Header />
          <TenantBanner />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <Toaster />
        <CommandPalette />
      </div>
    </SessionProvider>
  );
}
