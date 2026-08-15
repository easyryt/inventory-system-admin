// app/dashboard/categories/page.tsx
import { cookies } from "next/headers";
import CategoryTable from "./CategoryTable";

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

export default async function CategoriesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let categories: Category[] = [];

  if (token) {
    const res = await fetch("https://inventory-system-ecew.onrender.com/api/categories", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        categories = data;
      } else if (Array.isArray((data as any).categories)) {
        categories = (data as any).categories;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Categories</h1>
        <p className="text-xs text-slate-500">
          Define product categories and their dynamic meta fields.
        </p>
      </div>
      <CategoryTable categories={categories} />
    </div>
  );
}