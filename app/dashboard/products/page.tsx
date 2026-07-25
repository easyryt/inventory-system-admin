// app/dashboard/products/page.tsx
import { cookies } from "next/headers";
import ProductTable from "./ProductTable";

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
};

export default async function ProductsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let categories: Category[] = [];
  let products: Product[] = [];

  if (token) {
    // Get categories
    const catRes = await fetch("http://localhost:5000/api/categories", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (catRes.ok) {
      const catData = await catRes.json();
      if (Array.isArray(catData)) categories = catData;
      else if (Array.isArray(catData.categories))
        categories = catData.categories;
    }

    // Get products
    const prodRes = await fetch("http://localhost:5000/api/products", {
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
        <h1 className="text-lg font-semibold">Products</h1>
        <p className="text-xs text-slate-500">
          Create products quickly using category-specific attributes.
        </p>
      </div>
      <ProductTable categories={categories} products={products} />
    </div>
  );
}