// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Inventory Admin",
  description: "Customizable inventory & print management dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}