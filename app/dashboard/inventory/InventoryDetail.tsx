"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type InventoryRow = {
  _id: string;
  productId: string;
  type: "RAW" | "PRINTED";
  designCode: string | null;
  designName?: string | null;
  mode?: string | null;
  designUrl?: string | null;
  quantity: number;
  minThreshold: number;
  isActive: boolean;
  totalBarcodes?: number;
  availableBarcodes?: number;
  usedBarcodes?: number;
};

export type InventoryDetailProduct = {
  id: string;
  name: string;
  categoryName: string;
};

type SupplierInfo = {
  supplierName: string;
  notes: string;
  purchaseOrderId: string;
  status: "CREATED" | "PARTIAL" | "VERIFIED";
};

type Props = {
  product: InventoryDetailProduct;
  rows: InventoryRow[];
  supplier?: SupplierInfo;
};

const total = (rows: InventoryRow[]) =>
  rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

const isLowStock = (row: InventoryRow) =>
  row.minThreshold > 0 && row.quantity <= row.minThreshold;

export default function InventoryDetail({ product, rows, supplier }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [thresholdValue, setThresholdValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const rawRows = useMemo(() => rows.filter((row) => row.type === "RAW"), [rows]);
  const printedRows = useMemo(
    () => rows.filter((row) => row.type === "PRINTED"),
    [rows],
  );
  const totalBarcodes = useMemo(
    () => printedRows.reduce((sum, row) => sum + Number(row.totalBarcodes || 0), 0),
    [printedRows],
  );
  const availableBarcodes = useMemo(
    () =>
      printedRows.reduce(
        (sum, row) => sum + Number(row.availableBarcodes || 0),
        0,
      ),
    [printedRows],
  );
  const lowStockRows = rows.filter(isLowStock).length;

  const startEditing = (row: InventoryRow) => {
    setEditingId(row._id);
    setThresholdValue(String(row.minThreshold ?? 0));
    setError(null);
  };

  const saveThreshold = async (rowId: string) => {
    const minThreshold = Number(thresholdValue);
    if (!Number.isSafeInteger(minThreshold) || minThreshold < 0) {
      setError("Threshold must be a non-negative whole number.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/inventory/threshold/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minThreshold }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not update the threshold.");
      }

      setEditingId(null);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update the threshold.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/inventory"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <span aria-hidden="true">←</span>
          All models
        </Link>

        <Link
          href={`/dashboard/barcodes/${product.id}`}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          Manage barcodes
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-600">
              Model inventory
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {product.name}
            </h1>
            {product.categoryName && product.categoryName !== "-" && (
              <p className="mt-1 text-sm text-slate-500">{product.categoryName}</p>
            )}
          </div>

          {supplier?.supplierName && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="font-medium text-slate-700">Last supplier</p>
              <p className="mt-0.5">{supplier.supplierName}</p>
              <p className="mt-1 text-[11px]">{supplier.status}</p>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800">
              RAW stock
            </p>
            <p className="mt-1 text-xl font-semibold text-amber-950">{total(rawRows)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800">
              Printed stock
            </p>
            <p className="mt-1 text-xl font-semibold text-emerald-950">{total(printedRows)}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-blue-800">
              Labels ready
            </p>
            <p className="mt-1 text-xl font-semibold text-blue-950">{availableBarcodes}</p>
          </div>
          <div className={`rounded-xl p-3 ${lowStockRows ? "bg-rose-50" : "bg-slate-50"}`}>
            <p className={`text-[11px] font-medium uppercase tracking-wide ${lowStockRows ? "text-rose-800" : "text-slate-600"}`}>
              Needs attention
            </p>
            <p className={`mt-1 text-xl font-semibold ${lowStockRows ? "text-rose-950" : "text-slate-900"}`}>
              {lowStockRows}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Stock records</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Edit minimum thresholds here. Design-level stock is shown separately from RAW model stock.
            </p>
          </div>
          <span className="text-xs text-slate-500">{totalBarcodes} barcode labels created</span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No stock records yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Go back to add the first RAW stock entry for this model.
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-3 sm:p-4">
                {rows.map((row) => {
                  const lowStock = isLowStock(row);
                  const isEditing = editingId === row._id;

                  return (
                    <article
                      key={row._id}
                      className={`flex flex-wrap gap-3 rounded-xl border p-3 ${lowStock ? "border-rose-200 bg-rose-50/60" : "border-slate-200 bg-white"}`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                          {row.type === "PRINTED" && row.designUrl ? (
                            <button
                              type="button"
                              onClick={() => setImageUrl(row.designUrl ?? null)}
                              className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
                              aria-label={`Preview ${row.designName || row.designCode || "design"}`}
                            >
                              <img
                                src={row.designUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ) : (
                            <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-lg px-1 text-center text-[10px] font-semibold ${row.type === "RAW" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                              {row.type}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {row.type === "RAW"
                                ? "Model RAW stock"
                                : row.designName || row.designCode || "Printed design"}
                            </p>
                            {row.type === "PRINTED" && (
                              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                                {row.designCode || "No design code"}
                                {row.mode ? ` · ${row.mode}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      <div className="grid shrink-0 grid-cols-3 gap-2">
                        <div className="rounded-md bg-slate-50 px-2 py-1.5 text-center">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Stock</p>
                          <p className="text-sm font-semibold text-slate-900">{row.quantity}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5 text-center">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Labels</p>
                          <p className="text-sm font-semibold text-slate-900">{row.totalBarcodes ?? 0}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5 text-center">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Available</p>
                          <p className="text-sm font-semibold text-slate-900">{row.availableBarcodes ?? 0}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              value={thresholdValue}
                              onChange={(event) => setThresholdValue(event.target.value)}
                              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                              autoFocus
                              disabled={saving}
                            />
                            <button
                              type="button"
                              onClick={() => saveThreshold(row._id)}
                              disabled={saving}
                              className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setError(null);
                              }}
                              disabled={saving}
                              className="text-xs font-medium text-slate-500 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(row)}
                            className={`rounded-md px-2 py-1 text-sm hover:bg-slate-100 ${lowStock ? "font-semibold text-rose-700" : "text-slate-700"}`}
                            title="Edit minimum threshold"
                          >
                            {row.minThreshold} <span className="text-xs text-slate-400">Edit</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
          </div>
        )}
      </section>

      {imageUrl && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"
          onClick={() => setImageUrl(null)}
        >
          <div
            className="relative max-h-full max-w-3xl rounded-xl bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="absolute -right-3 -top-3 grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-bold text-slate-700 shadow"
              aria-label="Close image preview"
            >
              ×
            </button>
            <img src={imageUrl} alt="Design preview" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
