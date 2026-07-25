// app/dashboard/page.tsx
import { cookies } from "next/headers";
import InventoryTable from "./InventoryTable";

type InventoryProduct = {
  id: string;
  name: string;
  categoryName: string;
  rawQuantity: number;
  printedQuantity: number;
  minThreshold: number;
};

function getStatus(raw: number, minThreshold: number) {
  if (raw <= 0) return "Out of stock";
  if (raw < minThreshold) return "Low RAW";
  return "Healthy";
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let products: InventoryProduct[] = [];

  if (token) {
    const res = await fetch(
      "http://localhost:5000/api/dashboard/inventory-products",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (res.ok) {
      products = await res.json();
    }
  }

  // Precompute status on the server
  const productsWithStatus = products.map((p) => ({
    ...p,
    status: getStatus(p.rawQuantity, p.minThreshold),
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total products</p>
          <p className="mt-2 text-2xl font-semibold">{products.length}</p>
        </div>
      </section>

      <InventoryTable products={productsWithStatus} />
    </div>
  );
}