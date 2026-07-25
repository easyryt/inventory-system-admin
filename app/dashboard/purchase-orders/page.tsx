// app/dashboard/purchase-orders/page.tsx
import { cookies } from "next/headers";
import PurchaseOrderPage from "./PurchaseOrderPage";

type ProductForPo = {
  id: string;
  name: string;
  categoryName: string;
  rawQuantity: number;
};

export default async function PurchaseOrdersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let products: ProductForPo[] = [];

  if (token) {
    const res = await fetch(
      "https://inventory-system-ecew.onrender.com/api/dashboard/inventory-products",
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    if (res.ok) {
      products = await res.json();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Purchase Orders</h1>
        <p className="text-xs text-slate-500">
          Create and verify purchase orders in one place.
        </p>
      </div>
      <PurchaseOrderPage products={products} />
    </div>
  );
}