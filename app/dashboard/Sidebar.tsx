// app/dashboard/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type NavLink = {
  label: string;
  href: string;
  matchPrefix?: boolean;
};

const NAV_LINKS: NavLink[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Create User", href: "/dashboard/create-user" },
  { label: "Categories", href: "/dashboard/categories", matchPrefix: true },
  { label: "Products", href: "/dashboard/products", matchPrefix: true },
  { label: "Product Designs", href: "/dashboard/product-designs", matchPrefix: true },
  { label: "Inventory", href: "/dashboard/inventory", matchPrefix: true },
    { label: "Add Stocks", href: "/dashboard/printing-jobs", matchPrefix: true },
  { label: "Purchase Orders", href: "/dashboard/purchase-orders", matchPrefix: true },
  { label: "Today's Packed Items", href: "/dashboard/barcode-report", matchPrefix: true },
  { label: "ImageKit Images", href: "/dashboard/imagekit-images", matchPrefix: true },
];

function isActive(pathname: string, link: NavLink) {
  if (link.matchPrefix) {
    return pathname === link.href || pathname.startsWith(link.href + "/");
  }
  return pathname === link.href;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      await fetch("/api/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs font-semibold text-white">
          INV
        </span>
        <div className="ml-3">
          <p className="text-sm font-semibold">Inventory Admin</p>
          <p className="text-xs text-slate-500">Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-4 text-sm">
        {NAV_LINKS.map((link) => {
          const active = isActive(pathname, link);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "flex w-full items-center rounded-lg px-3 py-2 transition-colors",
                active
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true">↪</span>
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}
