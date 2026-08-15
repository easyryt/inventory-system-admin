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
  categoryId: Category | string;
  attributes: Record<string, string>;
  skuBase: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const API_URL = "http://localhost:5000/api";

const getErrorMessage = (data: unknown, fallback: string) => {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return fallback;
};

export default async function ProductDesignsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? "";

  let products: Product[] = [];
  let categories: Category[] = [];
  let loadError = "";

  if (token) {
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [productsResult, categoriesResult] = await Promise.allSettled([
        fetch(`${API_URL}/products`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${API_URL}/categories`, {
          headers,
          cache: "no-store",
        }),
      ]);

      if (productsResult.status === "fulfilled") {
        const response = productsResult.value;
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          loadError = getErrorMessage(data, "Could not load products.");
        } else if (Array.isArray(data)) {
          products = data;
        } else if (
          data &&
          typeof data === "object" &&
          "products" in data &&
          Array.isArray(data.products)
        ) {
          products = data.products;
        }
      } else {
        loadError = "Could not connect to the products server.";
      }

      if (categoriesResult.status === "fulfilled") {
        const response = categoriesResult.value;
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (!loadError) {
            loadError = getErrorMessage(data, "Could not load categories.");
          }
        } else if (Array.isArray(data)) {
          categories = data;
        } else if (
          data &&
          typeof data === "object" &&
          "categories" in data &&
          Array.isArray(data.categories)
        ) {
          categories = data.categories;
        }
      } else if (!loadError) {
        loadError = "Could not connect to the categories server.";
      }
    } catch {
      loadError = "Could not connect to the server.";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Product designs</h1>
        <p className="text-xs text-slate-500">
          Select a category, search for a product, then manage its designs.
        </p>
      </div>

      {!token && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          You must be logged in to manage product designs.
        </div>
      )}

      {loadError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <CreateDesignForm
        products={products}
        categories={categories}
        token={token}
      />
    </div>
  );
}