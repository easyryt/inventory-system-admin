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

type BackendProduct = {
  _id: string;
  name: string;
  skuBase?: string;
  categoryId?: {
    _id: string;
    name: string;
  };
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
  let supplierByProduct: SupplierByProduct = {};
  const inventoriesByProduct: Record<string, InventoryRow[]> = {};

  if (token) {
    try {
      // Get all active products.
      const productsRes = await fetch("https://inventory-system-ecew.onrender.com/api/products", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      let backendProducts: BackendProduct[] = [];

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        backendProducts = Array.isArray(productsData.products)
          ? productsData.products
          : [];
      }

      // Get RAW and PRINTED model/design inventory for every product.
      await Promise.all(
        backendProducts.map(async (product) => {
          try {
            const inventoryRes = await fetch(
              `https://inventory-system-ecew.onrender.com/api/inventory/design/${product._id}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
              }
            );

            const inventoryData = inventoryRes.ok
              ? await inventoryRes.json()
              : {};

            const rows: InventoryRow[] = Array.isArray(inventoryData.inventory)
              ? inventoryData.inventory
              : [];

            inventoriesByProduct[product._id] = rows;
          } catch {
            inventoriesByProduct[product._id] = [];
          }
        })
      );

      // Build display data from the actual inventory documents.
      products = backendProducts.map((product) => {
        const rows = inventoriesByProduct[product._id] || [];

        const rawQuantity = rows
          .filter((row) => row.type === "RAW")
          .reduce((sum, row) => sum + Number(row.quantity || 0), 0);

        const printedQuantity = rows
          .filter((row) => row.type === "PRINTED")
          .reduce((sum, row) => sum + Number(row.quantity || 0), 0);

        const minThreshold = rows.reduce(
          (sum, row) => sum + Number(row.minThreshold || 0),
          0
        );

        return {
          id: product._id,
          name: product.name,
          categoryName: product.categoryId?.name || "-",
          designUrl:product?.designUrl || null,
          rawQuantity,
          printedQuantity,
          minThreshold,
        };
      });

      // Supplier data remains optional.
      const supplierRes = await fetch(
        "https://inventory-system-ecew.onrender.com/api/dashboard/inventory-supplier",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (supplierRes.ok) {
        const supplierData = await supplierRes.json();
        supplierByProduct = supplierData.supplierByProduct || {};
      }
    } catch (err) {
      console.error("Load inventory page error:", err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Inventory</h1>
          <p className="text-xs text-slate-500">
            RAW and PRINTED stock grouped by product and model/design.
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