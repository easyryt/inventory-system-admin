import { cookies } from "next/headers";
import PurchaseOrderPage, {
  type ListPurchaseOrder,
  type ProductForPurchaseOrder,
} from "./PurchaseOrderPage";

const API = `${process.env.BACKEND_URL || "https://inventory-system-24ly.onrender.com"}/api`;

export default async function PurchaseOrdersPage() {
  const token = (await cookies()).get("token")?.value;
  let products: ProductForPurchaseOrder[] = [];
  let purchaseOrders: ListPurchaseOrder[] = [];

  if (token) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [productsResponse, ordersResponse] = await Promise.all([
        fetch(`${API}/dashboard/inventory-products`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${API}/purchase-orders`, {
          headers,
          cache: "no-store",
        }),
      ]);

      const productsData = productsResponse.ok
        ? await productsResponse.json().catch(() => [])
        : [];
      const ordersData = ordersResponse.ok
        ? await ordersResponse.json().catch(() => ({}))
        : {};

      products = Array.isArray(productsData) ? productsData : [];
      purchaseOrders = Array.isArray(ordersData.purchaseOrders)
        ? ordersData.purchaseOrders
        : [];
    } catch (error) {
      console.error("Load purchase orders page error:", error);
    }
  }

  return <PurchaseOrderPage products={products} initialPurchaseOrders={purchaseOrders} />;
}
