import { cookies } from "next/headers";
import InventoryList, { type InventoryProduct } from "./InventoryList";

const API = "https://inventory-system-24ly.onrender.com/api";

export default async function InventoryIndexPage() {
  const token = (await cookies()).get("token")?.value;
  let products: InventoryProduct[] = [];

  if (token) {
    try {
      const response = await fetch(`${API}/dashboard/inventory-products`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => []);

      products = Array.isArray(data)
        ? data
        : Array.isArray(data.products)
          ? data.products
          : [];
    } catch (error) {
      console.error("Load inventory models error:", error);
    }
  }

  return <InventoryList products={products} />;
}
