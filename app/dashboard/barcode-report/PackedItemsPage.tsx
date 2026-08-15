"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PackedItem = {
  barcodeId: string;
  barcode: string;
  status: "USED";
  packedAt: string;
  product: { id: string; name: string; skuBase?: string; categoryId?: string | null } | null;
  design: { id: string | null; name: string; mode: string | null; code: string; image: string | null };
};

type PackedResponse = {
  totalPacked: number;
  page: number;
  limit: number;
  totalPages: number;
  packedItems: PackedItem[];
};

type Product = {
  _id: string;
  name: string;
  skuBase?: string;
  categoryId?: { _id: string; name: string } | null;
};

type Design = {
  _id: string;
  productId: string;
  name: string;
  mode: string;
  designCode: string;
  designUrl?: string;
};

const API_BASE = "https://inventory-system-ecew.onrender.com/api";
const formatDateTime = (value: string) => new Date(value).toLocaleString();

export default function PackedItemsPage({ token }: { token: string }) {
  // Main data states
  const [items, setItems] = useState<PackedItem[]>([]);
  const [totalPacked, setTotalPacked] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"grid" | "table">("grid");

  // Filter states
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Product and design lists
  const [products, setProducts] = useState<Product[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedDesignCode, setSelectedDesignCode] = useState("");

  // Loading states for dropdowns
  const [productsLoading, setProductsLoading] = useState(true);
  const [designsLoading, setDesignsLoading] = useState(false);

  // Fetch products on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch(`${API_BASE}/products`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load products");
        const data = await res.json();
        setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (err) {
        console.error("Failed to load products:", err);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };
    loadProducts();
  }, [token]);

  // Fetch designs when selectedProductId changes
  useEffect(() => {
    if (!selectedProductId) {
      setDesigns([]);
      setSelectedDesignCode("");
      return;
    }
    const loadDesigns = async () => {
      setDesignsLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/product-designs/product/${selectedProductId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("Failed to load designs");
        const data = await res.json();
        setDesigns(Array.isArray(data.designs) ? data.designs : []);
        setSelectedDesignCode(""); // reset design selection
      } catch (err) {
        console.error("Failed to load designs:", err);
        setDesigns([]);
      } finally {
        setDesignsLoading(false);
      }
    };
    loadDesigns();
  }, [selectedProductId, token]);

  // Load packed items
  const loadPackedItems = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ page: String(nextPage), limit: "50" });
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (selectedProductId) params.set("productId", selectedProductId);
        if (selectedDesignCode) params.set("designCode", selectedDesignCode);

        const url = `${API_BASE}/barcodes/packed?${params.toString()}`;
        const response = await fetch(url, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          const msg =
            "message" in data && data.message
              ? data.message
              : "Could not load packed items.";
          throw new Error(msg);
        }

        const result = data as PackedResponse;
        setItems(Array.isArray(result.packedItems) ? result.packedItems : []);
        setTotalPacked(result.totalPacked || 0);
        setPage(result.page || nextPage);
        setTotalPages(Math.max(result.totalPages || 1, 1));
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Failed to load packed items."
        );
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [page, from, to, selectedProductId, selectedDesignCode, token]
  );

  // Initial load
  useEffect(() => {
    loadPackedItems(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => loadPackedItems(1);
  const clearFilters = () => {
    setFrom("");
    setTo("");
    setSelectedProductId("");
    setSelectedDesignCode("");
    setTimeout(() => loadPackedItems(1), 0);
  };

  const summary = useMemo(
    () => ({
      visible: items.length,
      products: new Set(items.map((item) => item.product?.id).filter(Boolean)).size,
      designs: new Set(items.map((item) => item.design.code)).size,
    }),
    [items]
  );

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Packed items</h1>
          <p className="text-xs text-slate-500">
            Every barcode marked as used, with product, design, image, and packed date.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-1">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`rounded px-3 py-1.5 text-xs ${view === "grid" ? "bg-slate-800 text-white" : "text-slate-600"}`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`rounded px-3 py-1.5 text-xs ${view === "table" ? "bg-slate-800 text-white" : "text-slate-600"}`}
          >
            Table
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] text-slate-600">
          Packed from
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs"
          />
        </label>
        <label className="text-[11px] text-slate-600">
          Packed to
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs"
          />
        </label>

        {/* Product dropdown */}
        <label className="text-[11px] text-slate-600">
          Product
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            disabled={productsLoading}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs disabled:opacity-50"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} {p.skuBase ? `(${p.skuBase})` : ""}
              </option>
            ))}
          </select>
        </label>

        {/* Design dropdown */}
        <label className="text-[11px] text-slate-600">
          Design
          <select
            value={selectedDesignCode}
            onChange={(e) => setSelectedDesignCode(e.target.value)}
            disabled={!selectedProductId || designsLoading}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs disabled:opacity-50"
          >
            <option value="">All Designs</option>
            {designs.map((d) => (
              <option key={d._id} value={d.designCode}>
                {d.name} ({d.designCode}) – {d.mode}
              </option>
            ))}
          </select>
        </label>

        {/* Action buttons */}
        <div className="flex gap-2 lg:col-span-4">
          <button onClick={applyFilters} disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
            Apply filters
          </button>
          <button onClick={clearFilters} disabled={loading} className="rounded border border-slate-300 px-4 py-2 text-xs text-slate-700">
            Clear
          </button>
          <button onClick={() => loadPackedItems(page)} disabled={loading} className="rounded border border-slate-300 px-4 py-2 text-xs text-slate-700">
            Refresh
          </button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-3 py-1">Total packed: {totalPacked}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">This page: {summary.visible}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">Products: {summary.products}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">Designs: {summary.designs}</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading packed items...</div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">No packed items match these filters.</div>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.barcodeId} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex gap-3 p-3">
                {item.design.image ? (
                  <img src={item.design.image} alt={item.design.name} className="h-24 w-20 rounded-lg border object-cover" />
                ) : (
                  <div className="grid h-24 w-20 place-items-center rounded-lg bg-slate-100 text-[10px] text-slate-400">No image</div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-slate-500">{item.product?.name || "Unknown product"}</p>
                  <h2 className="truncate text-sm font-semibold text-slate-900">{item.design.name}</h2>
                  <p className="mt-1 text-xs text-slate-600">Mode: {item.design.mode || "-"}</p>
                  <p className="font-mono text-[11px] text-slate-500">{item.design.code}</p>
                </div>
              </div>
              <div className="border-t bg-slate-50 px-3 py-2">
                <p className="break-all font-mono text-[11px] text-slate-700">{item.barcode}</p>
                <p className="mt-1 text-[11px] text-emerald-700">Packed: {formatDateTime(item.packedAt)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Image</th>
                <th className="p-3">Product</th>
                <th className="p-3">Design / Mode</th>
                <th className="p-3">Barcode</th>
                <th className="p-3">Packed date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.barcodeId} className="border-t">
                  <td className="p-2">
                    {item.design.image ? <img src={item.design.image} alt="" className="h-12 w-10 rounded border object-cover" /> : "-"}
                  </td>
                  <td className="p-3">
                    <div>{item.product?.name || "Unknown product"}</div>
                    <div className="text-[10px] text-slate-500">{item.product?.skuBase || "-"}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{item.design.name}</div>
                    <div className="text-[10px] text-slate-500">{item.design.code} - {item.design.mode || "-"}</div>
                  </td>
                  <td className="max-w-56 break-all p-3 font-mono text-[11px]">{item.barcode}</td>
                  <td className="p-3 text-slate-600">{formatDateTime(item.packedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <footer className="flex items-center justify-between border-t pt-4 text-xs">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={loading || page <= 1} onClick={() => loadPackedItems(page - 1)} className="rounded border px-3 py-1.5 disabled:opacity-50">
            Previous
          </button>
          <button disabled={loading || page >= totalPages} onClick={() => loadPackedItems(page + 1)} className="rounded border px-3 py-1.5 disabled:opacity-50">
            Next
          </button>
        </div>
      </footer>
    </section>
  );
}