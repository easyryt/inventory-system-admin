// app/dashboard/InventoryTable.tsx
"use client";

import { useMemo, useState } from "react";

type ProductRow = {
  id: string;
  name: string;
  categoryName: string;
  rawQuantity: number;
  printedQuantity: number;
  minThreshold: number;
  status: "Healthy" | "Low RAW" | "Out of stock" | string;
};

type PrintedDesign = {
  designCode: string;
  quantity: number;
};

type InventoryTableProps = {
  products: ProductRow[];
};

export default function InventoryTable({ products }: InventoryTableProps) {
  // Search + filter state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Designs modal state
  const [openProduct, setOpenProduct] = useState<ProductRow | null>(null);
  const [designs, setDesigns] = useState<PrintedDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [error, setError] = useState("");

  // RAW edit modal state
  const [rawModalProduct, setRawModalProduct] = useState<ProductRow | null>(null);
  const [rawQuantity, setRawQuantity] = useState<string>("");
  const [rawThreshold, setRawThreshold] = useState<string>("");
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState("");
  const [rawSuccess, setRawSuccess] = useState("");

  // Unique category list for filter dropdown
  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.categoryName))).sort(),
    [products]
  );

  // Derived filtered list
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((p) => {
      const matchesSearch =
        term.length === 0 ||
        p.name.toLowerCase().includes(term) ||
        p.categoryName.toLowerCase().includes(term);

      const matchesCategory =
        categoryFilter === "all" || p.categoryName === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const closeDesignsModal = () => {
    setOpenProduct(null);
    setDesigns([]);
    setError("");
  };

  // RAW edit modal handlers
  const openRawModal = (product: ProductRow) => {
    setRawModalProduct(product);
    setRawQuantity(product.rawQuantity.toString());
    setRawThreshold(product.minThreshold.toString());
    setRawError("");
    setRawSuccess("");
  };

  const closeRawModal = () => {
    setRawModalProduct(null);
    setRawQuantity("");
    setRawThreshold("");
    setRawError("");
    setRawSuccess("");
  };

  const handleSaveRaw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawModalProduct) return;

    const quantityNum = Number(rawQuantity);
    const thresholdNum = Number(rawThreshold);

    if (Number.isNaN(quantityNum) || quantityNum < 0) {
      setRawError("Quantity must be 0 or more");
      return;
    }

    if (Number.isNaN(thresholdNum) || thresholdNum < 0) {
      setRawError("Minimum threshold must be 0 or more");
      return;
    }

    try {
      setRawLoading(true);
      setRawError("");
      setRawSuccess("");

      const res = await fetch("/api/inventory/raw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: rawModalProduct.id,
          quantity: quantityNum,
          minThreshold: thresholdNum,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRawError(data.message || "Failed to update RAW stock");
        setRawLoading(false);
        return;
      }

      setRawSuccess("RAW stock updated successfully");

      // Optimistic local update
      rawModalProduct.rawQuantity = quantityNum;
      rawModalProduct.minThreshold = thresholdNum;

      setRawLoading(false);
    } catch {
      setRawError("Something went wrong");
      setRawLoading(false);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        {/* Header + search/filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Product inventory</h2>
            <p className="text-xs text-slate-500">
              RAW stock + printed SKUs per model.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product or category..."
                className="w-full sm:w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
      
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Product
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Category
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  RAW qty
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Printed qty
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Status
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {p.categoryName}
                  </td>
                  <td className="px-3 py-2">{p.rawQuantity}</td>
                  <td className="px-3 py-2">{p.printedQuantity}</td>
                  <td className="px-3 py-2">
                    {p.status === "Healthy" && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-100">
                        Healthy
                      </span>
                    )}
                    {p.status === "Low RAW" && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 border border-amber-100">
                        Low RAW
                      </span>
                    )}
                    {p.status === "Out of stock" && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700 border border-red-100">
                        Out of stock
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={() => openRawModal(p)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] text-blue-700 hover:bg-blue-100"
                    >
                      Edit RAW
                    </button>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    No products match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Designs modal */}
      {openProduct && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">
                  Designs – {openProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Printed SKUs and quantities.
                </p>
              </div>
              <button
                onClick={closeDesignsModal}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {loadingDesigns && (
              <p className="text-xs text-slate-500">Loading designs…</p>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2">
                {error}
              </p>
            )}

            {!loadingDesigns && !error && designs.length === 0 && (
              <p className="text-xs text-slate-500">
                No printed designs yet for this product.
              </p>
            )}

            {!loadingDesigns && designs.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium text-slate-500">
                        Design code
                      </th>
                      <th className="px-2 py-1 text-left font-medium text-slate-500">
                        Printed qty
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {designs.map((d) => (
                      <tr key={d.designCode}>
                        <td className="px-2 py-1">{d.designCode}</td>
                        <td className="px-2 py-1">{d.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RAW edit modal */}
      {rawModalProduct && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">
                  Edit RAW stock – {rawModalProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Update RAW quantity and minimum threshold.
                </p>
              </div>
              <button
                onClick={closeRawModal}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveRaw} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  RAW quantity
                </label>
                <input
                  type="number"
                  min={0}
                  value={rawQuantity}
                  onChange={(e) => setRawQuantity(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Minimum threshold
                </label>
                <input
                  type="number"
                  min={0}
                  value={rawThreshold}
                  onChange={(e) => setRawThreshold(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>

              {rawError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {rawError}
                </p>
              )}
              {rawSuccess && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  {rawSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={rawLoading}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {rawLoading ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}