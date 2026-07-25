// app/dashboard/layout.tsx
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Sidebar from "./Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-slate-900">
      <Sidebar />

      <div className="md:pl-64">
        <header className="fixed top-0 right-0 z-50 h-16 w-full border-b border-slate-200 bg-white px-4 md:left-64 md:w-[calc(100%-16rem)] md:px-6">
          <div className="flex h-full items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Dashboard</h1>
              <p className="text-xs text-slate-500">
                Manage categories, products and inventory.
              </p>
            </div>
          </div>
        </header>

        <main className="pt-16">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}