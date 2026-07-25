// app/dashboard/printing-jobs/page.tsx
import { cookies } from "next/headers";
import PrintingJobPage from "./PrintingJobPage";
import PrintingJobsList from "./PrintingJobsList";

type Product = {
  _id: string;
  name: string;
  categoryId: {
    _id: string;
    name: string;
  };
  skuBase: string;
};

export default async function PrintingJobsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let products: Product[] = [];

  if (token) {
    try {
      const res = await fetch("http://localhost:5000/api/products", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          products = data.products;
        } else if (Array.isArray(data)) {
          products = data;
        }
      }
    } catch (err) {
      console.error("Fetch products for printing jobs failed", err);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Printing jobs</h1>
        <p className="text-xs text-slate-500">
          Create and manage printing jobs to convert RAW stock into printed designs.
        </p>
      </div>

      <PrintingJobPage products={products} />
      <PrintingJobsList />
    </div>
  );
}