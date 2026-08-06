"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ---------- Types ----------
type InventoryRow = {
  _id: string;
  productId: string;
  type: "RAW" | "PRINTED";
  designCode: string | null;
  designUrl: string | null;
  quantity: number;
  minThreshold: number;
  isActive: boolean;
  barcodes?: string[];
  totalBarcodes?: number;
  availableBarcodes?: number;
  usedBarcodes?: number;
};

type Product = {
  id: string;
  name: string;
  categoryName: string;
  rawQuantity: number;
  printedQuantity: number;
  minThreshold: number;
};

type SupplierInfo = {
  supplierName: string;
  notes: string;
  purchaseOrderId: string;
  status: "CREATED" | "PARTIAL" | "VERIFIED";
};

type LowStockItem = {
  _id: string;
  productId: string;
  productName: string;
  designCode: string;
  designName: string;
  mode: string;
  quantity: number;
  minThreshold: number;
  deficit: number;
};

type Props = {
  products: Product[];
  inventoriesByProduct: Record<string, InventoryRow[]>;
  supplierByProduct: Record<string, SupplierInfo>;
  lowStockItems?: LowStockItem[];
};

// ---------- Helper: badge for inventory type ----------
function TypeBadge({ type }: { type: "RAW" | "PRINTED" }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
        type === "RAW"
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-100 text-emerald-800"
      }`}
    >
      {type}
    </span>
  );
}

// ---------- Main component ----------
export default function InventoryList({
  products,
  inventoriesByProduct,
  supplierByProduct,
  lowStockItems = [],
}: Props) {
  // ----- Filter states -----
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "RAW" | "PRINTED">("ALL");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // ----- Threshold editing states -----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // ----- Modal state -----
  const [modalImage, setModalImage] = useState<string | null>(null);

  // ----- Derived: distinct categories -----
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.categoryName).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  // ----- Filtered & sorted products -----
  const filteredProducts = useMemo(() => {
    let result = products;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((product) => {
        const rows = inventoriesByProduct[product.id] || [];
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesDesign = rows.some((row) =>
          row.designCode?.toLowerCase().includes(q)
        );
        return matchesName || matchesDesign;
      });
    }

    if (categoryFilter) {
      result = result.filter((p) => p.categoryName === categoryFilter);
    }

    if (typeFilter !== "ALL" || showLowStockOnly) {
      result = result.filter((product) => {
        const rows = inventoriesByProduct[product.id] || [];

        if (typeFilter !== "ALL") {
          const hasType = rows.some((row) => row.type === typeFilter);
          if (!hasType) return false;
        }

        if (showLowStockOnly) {
          const belowThreshold = rows.some(
            (row) => row.quantity <= row.minThreshold && row.minThreshold > 0
          );
          if (!belowThreshold) return false;
        }

        return true;
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [
    products,
    search,
    categoryFilter,
    typeFilter,
    showLowStockOnly,
    inventoriesByProduct,
  ]);

  // ----- Threshold editing handlers -----
  const startEdit = (row: InventoryRow) => {
    setEditingId(row._id);
    setEditValue(String(row.minThreshold ?? 0));
    setError(null);
    setSuccessId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setError(null);
  };

  const saveThreshold = async (rowId: string) => {
    const parsed = Number(editValue);
    if (isNaN(parsed) || parsed < 0) {
      setError("Must be a non-negative number");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/inventory/threshold/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minThreshold: parsed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update threshold");
      }

      setSuccessId(rowId);
      setEditingId(null);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
      if (successId) setTimeout(() => setSuccessId(null), 2000);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowId: string
  ) => {
    if (e.key === "Enter") saveThreshold(rowId);
    if (e.key === "Escape") cancelEdit();
  };

  // ----- Render -----
  return (
    <div className="space-y-4">
      {/* ---------- FILTER BAR ---------- */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        {/* Search */}
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-slate-500">
            Search
          </label>
          <input
            type="text"
            placeholder="Product name or design code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Category */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">
            Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">
            Inventory type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All types</option>
            <option value="RAW">RAW only</option>
            <option value="PRINTED">PRINTED only</option>
          </select>
        </div>

        {/* Low stock toggle + dedicated page button */}
        <div className="flex items-center gap-2 self-end pb-2">
          <input
            id="low-stock"
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label
            htmlFor="low-stock"
            className="text-xs text-slate-600 cursor-pointer"
          >
            Below threshold only
          </label>

          <Link
            href="/dashboard/inventory/low-stock"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100"
          >
            ⚠️ Low Stock
          </Link>
        </div>

        {/* Clear filters */}
        <button
          onClick={() => {
            setSearch("");
            setCategoryFilter("");
            setTypeFilter("ALL");
            setShowLowStockOnly(false);
          }}
          className="self-end rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
        >
          Clear filters
        </button>
      </div>

      {/* ---------- PRODUCT LIST ---------- */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">
            No products match your filters.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
              setTypeFilter("ALL");
              setShowLowStockOnly(false);
            }}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        filteredProducts.map((product) => {
          const rows = inventoriesByProduct[product.id] || [];

          const rawQuantity = rows
            .filter((row) => row.type === "RAW")
            .reduce((sum, row) => sum + Number(row.quantity || 0), 0);

          const printedQuantity = rows
            .filter((row) => row.type === "PRINTED")
            .reduce((sum, row) => sum + Number(row.quantity || 0), 0);

          const barcodeByDesign = new Map<
            string,
            { total: number; available: number; used: number }
          >();

          rows.forEach((row) => {
            if (!row.designCode || barcodeByDesign.has(row.designCode)) return;
            barcodeByDesign.set(row.designCode, {
              total: Number(row.totalBarcodes || 0),
              available: Number(row.availableBarcodes || 0),
              used: Number(row.usedBarcodes || 0),
            });
          });

          const totalBarcodes = Array.from(barcodeByDesign.values()).reduce(
            (sum, item) => sum + item.total,
            0
          );
          const remainingToLabel = Array.from(barcodeByDesign.values()).reduce(
            (sum, item) => sum + item.available,
            0
          );
          const usedBarcodes = Array.from(barcodeByDesign.values()).reduce(
            (sum, item) => sum + item.used,
            0
          );

          const supplier = supplierByProduct[product.id];

          return (
            <section
              key={product.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              {/* Header */}
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-800">
                      {product.name}
                    </h2>
                    {product.categoryName && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {product.categoryName}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    ID: {product.id}
                  </p>

                  {supplier && (
                    <p className="mt-1 text-xs text-slate-500">
                      Supplier: {supplier.supplierName || "-"}
                      {supplier.status && (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px]">
                          {supplier.status}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <Link
                  href={`/dashboard/barcodes/${product.id}`}
                  className="shrink-0 text-xs font-medium text-blue-700 hover:underline"
                >
                  Manage barcodes →
                </Link>
              </div>

              {/* Summary cards */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-500">RAW</p>
                  <p className="mt-1 font-semibold">{rawQuantity}</p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-500">PRINTED</p>
                  <p className="mt-1 font-semibold">{printedQuantity}</p>
                </div>

                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-[11px] text-blue-700">
                    Remaining to label
                  </p>
                  <p className="mt-1 font-semibold text-blue-800">
                    {remainingToLabel}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-500">Total barcodes</p>
                  <p className="mt-1 font-semibold">{totalBarcodes}</p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-500">Used barcodes</p>
                  <p className="mt-1 font-semibold">{usedBarcodes}</p>
                </div>
              </div>

              {/* Table */}
              {rows.length === 0 ? (
                <p className="mt-4 text-xs text-slate-400">
                  No inventory records yet for this product.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      {/* No whitespace between <tr> and <th> – inline all to avoid hydration error */}
                      <tr><th className="p-2">Image</th><th className="p-2">Type</th><th className="p-2">Design</th><th className="p-2">Qty</th><th className="p-2">Available</th><th className="p-2">Used</th><th className="p-2">Min threshold</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const isLow =
                          row.minThreshold > 0 &&
                          row.quantity <= row.minThreshold;

                        return (
                          // Inline <tr> and <td> elements to avoid whitespace nodes
                          <tr
                            key={row._id}
                            className={`border-b border-slate-100 ${isLow ? "bg-red-50" : ""}`}
                          >
                            <td className="p-2">
                              {row.designUrl ? (
                                <img
                                  src={row.designUrl}
                                  alt={row.designCode || "Design"}
                                  className="h-8 w-8 rounded object-cover border border-slate-200 cursor-pointer hover:opacity-80"
                                  onClick={() => setModalImage(row.designUrl)}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="p-2"><TypeBadge type={row.type} /></td>
                            <td className="p-2 font-mono text-[11px]">{row.designCode || "-"}</td>
                            <td className="p-2">{row.quantity}</td>
                            <td className="p-2">{row.availableBarcodes ?? 0}</td>
                            <td className="p-2">{row.usedBarcodes ?? 0}</td>
                            <td className="p-2">
                              {editingId === row._id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, row._id)}
                                    onBlur={() => saveThreshold(row._id)}
                                    className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    min="0"
                                    step="1"
                                    autoFocus
                                    disabled={saving}
                                  />
                                  <button
                                    onClick={cancelEdit}
                                    className="text-slate-400 hover:text-slate-600"
                                    title="Cancel"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEdit(row)}
                                  className={`group flex items-center gap-1 rounded px-1 -mx-1 hover:bg-slate-100 ${
                                    isLow ? "text-red-700 font-semibold" : ""
                                  }`}
                                  title="Click to edit threshold"
                                >
                                  <span>{row.minThreshold}</span>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 text-slate-300 group-hover:text-slate-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                    />
                                  </svg>
                                </button>
                              )}
                              {successId === row._id && (
                                <span className="ml-1 text-green-600 text-xs">✓</span>
                              )}
                              {error && editingId === row._id && (
                                <span className="ml-1 text-red-600 text-xs">{error}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}

      {/* ---------- IMAGE MODAL ---------- */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setModalImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] rounded-lg bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow hover:bg-slate-100"
              onClick={() => setModalImage(null)}
            >
              ✕
            </button>
            <img
              src={modalImage}
              alt="Design preview"
              className="max-h-[85vh] max-w-full rounded object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}