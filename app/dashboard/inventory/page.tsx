// app/dashboard/inventory/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import InventoryList from "./InventoryList";

type InventoryRow = {
  _id: string;
  productId: string;
  type: "RAW" | "PRINTED";
  designCode: string | null;
  quantity: number;
  minThreshold: number;
  isActive: boolean;
  barcodes?: string[];
};

type Product = {
  id: string;
  name: string;
  categoryName: string;
  rawQuantity: number;
  printedQuantity: number;
  minThreshold: number;
};

type SupplierInfo = {
  supplierName: string;
  notes: string;
  purchaseOrderId: string;
  status: "CREATED" | "PARTIAL" | "VERIFIED";
};

type SupplierByProduct = Record<string, SupplierInfo>;

export default async function InventoryIndexPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let products: Product[] = [];
  const inventoriesByProduct: Record<string, InventoryRow[]> = {};
  let supplierByProduct: SupplierByProduct = {};

  if (token) {
    try {
      // 1) High-level inventory numbers per product
      const productsRes = await fetch(
        "http://localhost:5000/api/dashboard/inventory-products",
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      if (productsRes.ok) {
        const data = await productsRes.json();
        if (Array.isArray(data)) {
          products = data as Product[];
        }
      }

      // 2) Detailed inventory with barcodes for each product
      await Promise.all(
        products.map(async (p) => {
          try {
            const invRes = await fetch(
              `http://localhost:5000/api/inventory/with-barcodes/${p.id}`,
              {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
              }
            );

            if (invRes.ok) {
              const invData = await invRes.json();
              inventoriesByProduct[p.id] = Array.isArray(invData.inventory)
                ? invData.inventory
                : [];
            } else {
              inventoriesByProduct[p.id] = [];
            }
          } catch {
            inventoriesByProduct[p.id] = [];
          }
        })
      );

      // 3) Latest supplier info per product
      const supRes = await fetch(
        "http://localhost:5000/api/dashboard/inventory-supplier",
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      if (supRes.ok) {
        const supData = await supRes.json();
        supplierByProduct = (supData as any).supplierByProduct || {};
      }
    } catch (err) {
      console.error("Load inventory index error", err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Inventory</h1>
          <p className="text-xs text-slate-500">
            All products with RAW &amp; PRINTED stock, supplier details, and barcodes.
          </p>
        </div>
        <Link
          href="/dashboard/purchase-orders"
          className="text-[11px] text-blue-700 hover:underline"
        >
          Go to Purchase Orders
        </Link>
      </div>

      <InventoryList
        products={products}
        inventoriesByProduct={inventoriesByProduct}
        supplierByProduct={supplierByProduct}
      />
    </div>
  );
}