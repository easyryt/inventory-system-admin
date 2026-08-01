// app/dashboard/product-designs/page.tsx
import { cookies } from "next/headers";
import CreateDesignForm from "./CreateDesignForm";

type MetaField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
};

type Category = {
  _id: string;
  name: string;
  metaFields: MetaField[];
};

type Product = {
  _id: string;
  name: string;
  categoryId: Category;
  attributes: Record<string, string>;
  skuBase: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default async function ProductDesignsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let products: Product[] = [];

  if (token) {
    const prodRes = await fetch("https://inventory-system-ecew.onrender.com/api/products", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (prodRes.ok) {
      const prodData = await prodRes.json();
      if (Array.isArray(prodData.products)) {
        products = prodData.products;
      } else if (Array.isArray(prodData)) {
        products = prodData;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Product designs</h1>
        <p className="text-xs text-slate-500">
          Select a product and manage its designs (create, edit, delete).
        </p>
      </div>

      <CreateDesignForm products={products} token={token ?? ""} />
    </div>
  );
}