// app/dashboard/inventory/InventoryList.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type InventoryRow = {
  _id: string;
  productId: string;
  type: "RAW" | "PRINTED";
  designCode: string | null;
  quantity: number;
  minThreshold: number;
  isActive: boolean;
  barcodes?: string[];
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

type SupplierByProduct = Record<string, SupplierInfo>;

type Props = {
  products: Product[];
  inventoriesByProduct: Record<string, InventoryRow[]>;
  supplierByProduct: SupplierByProduct;
};

export default function InventoryList({
  products = [],
  inventoriesByProduct = {},
  supplierByProduct = {},
}: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "RAW" | "PRINTED">(
    "ALL"
  );
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];

    const q = search.trim().toLowerCase();

    return products.filter((p) => {
      const inv = inventoriesByProduct[p.id] || [];

      // search by product name, id, supplier name, notes
      if (q) {
        const supplier = supplierByProduct[p.id];
        const supplierText = supplier
          ? `${supplier.supplierName} ${supplier.notes}`.toLowerCase()
          : "";
        const match =
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          supplierText.includes(q);
        if (!match) return false;
      }

      // type filter
      if (typeFilter !== "ALL") {
        const hasType = inv.some((row) => row.type === typeFilter);
        if (!hasType) return false;
      }

      // low stock filter: RAW qty <= minThreshold (and > 0)
      if (lowStockOnly) {
        const rawRows = inv.filter((row) => row.type === "RAW");
        const low = rawRows.some(
          (row) => row.quantity > 0 && row.quantity <= row.minThreshold
        );
        if (!low) return false;
      }

      return true;
    });
  }, [products, inventoriesByProduct, supplierByProduct, search, typeFilter, lowStockOnly]);

  if (!products || products.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-400">
          No products found. Create a product first.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* search + filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Search (product, ID, supplier, notes)
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. iPhone, ABC Supplier, urgent"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "ALL" | "RAW" | "PRINTED")
              }
              className="rounded-lg border border-slate-200 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            >
              <option value="ALL">All</option>
              <option value="RAW">RAW only</option>
              <option value="PRINTED">PRINTED only</option>
            </select>
          </div>
          <div className="mt-5 flex items-center gap-1">
            <input
              id="low-stock-only"
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="low-stock-only"
              className="text-[11px] text-slate-600"
            >
              Low stock only
            </label>
          </div>
        </div>
      </div>

      {filteredProducts.map((product) => {
        const inventory = inventoriesByProduct[product.id] || [];
        const hasInventory = inventory.length > 0;

        const rawTotal = inventory
          .filter((row) => row.type === "RAW")
          .reduce((sum, row) => sum + row.quantity, 0);

        const printedTotal = inventory
          .filter((row) => row.type === "PRINTED")
          .reduce((sum, row) => sum + row.quantity, 0);

        const totalBarcodes = inventory.reduce((sum, row) => {
          if (Array.isArray(row.barcodes)) {
            return sum + row.barcodes.length;
          }
          return sum;
        }, 0);

        const remainingToLabel =
          printedTotal - totalBarcodes > 0
            ? printedTotal - totalBarcodes
            : 0;

        const supplier = supplierByProduct[product.id];

        return (
          <section
            key={product.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">{product.name}</h2>
                <p className="text-[11px] text-slate-500">
                  Product ID: {product.id}
                </p>
                {supplier && (
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <p>
                      <span className="font-semibold">Supplier:</span>{" "}
                      {supplier.supplierName || "—"}
                    </p>
                    {supplier.notes && (
                      <p>
                        <span className="font-semibold">Notes:</span>{" "}
                        {supplier.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Link
                href={`/dashboard/barcodes/${product.id}`}
                className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
              >
                Manage barcodes
              </Link>
            </div>

            {/* summary row */}
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
              <div className="rounded-full bg-slate-50 px-3 py-1">
                <span className="font-semibold">RAW:</span> {rawTotal}
              </div>
              <div className="rounded-full bg-slate-50 px-3 py-1">
                <span className="font-semibold">PRINTED:</span>{" "}
                {printedTotal}
              </div>
              <div className="rounded-full bg-slate-50 px-3 py-1">
                <span className="font-semibold">Remaining to label:</span>{" "}
                {remainingToLabel}
              </div>
              <div className="rounded-full bg-slate-50 px-3 py-1">
                <span className="font-semibold">Total barcodes:</span>{" "}
                {totalBarcodes}
              </div>
            </div>

            {!hasInventory ? (
              <p className="text-xs text-slate-400">
                No inventory records yet for this product.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">
                        Design
                      </th>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">
                        Quantity
                      </th>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">
                        Min threshold
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventory
                      .filter((row) =>
                        typeFilter === "ALL" ? true : row.type === typeFilter
                      )
                      .map((row) => (
                        <tr key={row._id}>
                          <td className="px-3 py-1.5 align-top">
                            <span
                              className={
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide " +
                                (row.type === "RAW"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700")
                              }
                            >
                              {row.type}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 align-top">
                            {row.designCode ?? (
                              <span className="text-[10px] text-slate-400">
                                N/A
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 align-top">
                            {row.quantity}
                          </td>
                          <td className="px-3 py-1.5 align-top">
                            {row.minThreshold}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}