// app/dashboard/printing-jobs/page.tsx

import { cookies } from "next/headers";
import PrintingJobPage from "./PrintingJobPage";
import PrintingJobsList from "./PrintingJobsList";

type Product = {
  _id: string;
  name: string;
  skuBase: string;
  categoryId: {
    _id: string;
    name: string;
  };
};

type Category = {
  _id: string;
  name: string;
};

export default async function PrintingJobsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let products: Product[] = [];
  let categories: Category[] = [];

  if (token) {
    // Fetch Products
    try {
      const res = await fetch(
        "https://inventory-system-ecew.onrender.com/api/products",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (res.ok) {
        const data = await res.json();

        if (Array.isArray(data.products)) {
          products = data.products;
        } else if (Array.isArray(data)) {
          products = data;
        }
      }
    } catch (err) {
      console.error("Fetch products failed:", err);
    }

    // Fetch Categories
    try {
      const res = await fetch(
        "https://inventory-system-ecew.onrender.com/api/categories",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (res.ok) {
        const data = await res.json();

        if (Array.isArray(data.categories)) {
          categories = data.categories;
        } else if (Array.isArray(data)) {
          categories = data;
        }
      }
    } catch (err) {
      console.error("Fetch categories failed:", err);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Add Stocks</h1>
        <p className="text-xs text-slate-500">
          Create and manage printing jobs to convert RAW stock into printed
          designs.
        </p>
      </div>

      <PrintingJobPage
        categories={categories}
        products={products}
      />

      <PrintingJobsList />
    </div>
  );
}