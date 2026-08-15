import { cookies } from "next/headers";
import Link from "next/link";
import InventoryDetail, {
  type InventoryDetailProduct,
  type InventoryRow,
} from "../InventoryDetail";

const API = "http://localhost:5000/api";

type BackendProduct = {
  _id: string;
  name: string;
  categoryId?: { name?: string };
};

type SupplierInfo = {
  supplierName: string;
  notes: string;
  purchaseOrderId: string;
  status: "CREATED" | "PARTIAL" | "VERIFIED";
};

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const token = (await cookies()).get("token")?.value;

  if (!token) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        You must sign in to view inventory.
      </div>
    );
  }

  let product: InventoryDetailProduct | null = null;
  let rows: InventoryRow[] = [];
  let supplier: SupplierInfo | undefined;

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [productResponse, inventoryResponse, supplierResponse] = await Promise.all([
      fetch(`${API}/products/${productId}`, { headers, cache: "no-store" }),
      fetch(`${API}/inventory/design/${productId}`, { headers, cache: "no-store" }),
      fetch(`${API}/dashboard/inventory-supplier`, { headers, cache: "no-store" }),
    ]);

    const productData = productResponse.ok
      ? await productResponse.json().catch(() => ({}))
      : {};
    const inventoryData = inventoryResponse.ok
      ? await inventoryResponse.json().catch(() => ({}))
      : {};
    const supplierData = supplierResponse.ok
      ? await supplierResponse.json().catch(() => ({}))
      : {};

    const backendProduct: BackendProduct | undefined = productData.product ?? productData;
    if (backendProduct?._id && backendProduct.name) {
      product = {
        id: backendProduct._id,
        name: backendProduct.name,
        categoryName: backendProduct.categoryId?.name || "",
      };
    }

    rows = Array.isArray(inventoryData.inventory) ? inventoryData.inventory : [];
    supplier = supplierData.supplierByProduct?.[productId];
  } catch (error) {
    console.error("Load inventory detail error:", error);
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/inventory"
          className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          ← All models
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h1 className="text-lg font-semibold text-slate-900">Model not found</h1>
          <p className="mt-1 text-sm text-slate-500">
            This model may have been deleted or you may not have permission to view it.
          </p>
        </div>
      </div>
    );
  }

  return <InventoryDetail product={product} rows={rows} supplier={supplier} />;
}
