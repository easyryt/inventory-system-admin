"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type InventoryRow = {
  _id: string | null;

  productId: string;

  type: "RAW" | "PRINTED";

  designId?: string | null;

  designCode: string | null;

  designName?: string | null;

  designSku?: string | null;

  mode?: string | null;

  designUrl?: string | null;

  quantity: number;

  minThreshold: number;

  isActive?: boolean;

  activeBarcodeCount?: number;

  totalBarcodes?: number;

  availableBarcodes?: number;

  usedBarcodes?: number;

  hasInventory?: boolean;
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

// ============================================================
// Helpers
// ============================================================

const getQuantity = (row: InventoryRow) =>
  Number(row.quantity || 0);

const getLabels = (row: InventoryRow) =>
  Number(row.totalBarcodes || 0);

const getAvailable = (row: InventoryRow) =>
  Number(row.availableBarcodes || 0);

const getThreshold = (row: InventoryRow) =>
  Number(row.minThreshold || 0);

const total = (rows: InventoryRow[]) =>
  rows.reduce(
    (sum, row) => sum + getQuantity(row),
    0
  );

const isLowStock = (row: InventoryRow) => {
  const threshold = getThreshold(row);
  const quantity = getQuantity(row);

  return (
    threshold > 0 &&
    quantity <= threshold
  );
};

// ============================================================
// A row can be edited ONLY when it has actual stock/labels.
//
// This means:
// Stock 0
// Labels 0
// Available 0
// => DISPLAY ONLY
//
// No input.
// No Edit button.
// ============================================================
const canEditThreshold = (
  row: InventoryRow
) => {
  if (!row._id) {
    return false;
  }

  const quantity = getQuantity(row);
  const labels = getLabels(row);
  const available = getAvailable(row);

  return (
    quantity > 0 ||
    labels > 0 ||
    available > 0
  );
};

// ============================================================
// Stable unique React key
// ============================================================
const getRowKey = (
  row: InventoryRow,
  index: number
) => {
  if (row._id) {
    return `inventory-${row._id}`;
  }

  if (row.designId) {
    return `design-${row.designId}`;
  }

  if (row.designCode) {
    return `design-code-${row.productId}-${row.designCode}`;
  }

  return `row-${row.productId}-${row.type}-${index}`;
};

export default function InventoryDetail({
  product,
  rows,
  supplier,
}: Props) {
  const router = useRouter();

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [thresholdValue, setThresholdValue] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [imageUrl, setImageUrl] =
    useState<string | null>(null);

  // ==========================================================
  // RAW rows
  //
  // Usually hidden from the list by the backend.
  // Still kept here so RAW stock summary works if a RAW row
  // is returned.
  // ==========================================================
  const rawRows = useMemo(
    () =>
      rows.filter(
        (row) => row.type === "RAW"
      ),
    [rows]
  );

  // ==========================================================
  // ALL PRINTED / DESIGN rows
  // ==========================================================
  const printedRows = useMemo(
    () =>
      rows.filter(
        (row) => row.type === "PRINTED"
      ),
    [rows]
  );

  // ==========================================================
  // Total models
  //
  // Count every unique design.
  //
  // This works even when the inventory document doesn't exist
  // yet and the backend sends _id = null.
  // ==========================================================
  const totalModels = useMemo(() => {
    const uniqueDesigns = new Set<string>();

    printedRows.forEach((row) => {
      if (row.designId) {
        uniqueDesigns.add(
          `id:${row.designId}`
        );
        return;
      }

      if (row.designCode) {
        uniqueDesigns.add(
          `code:${row.productId}:${row.designCode}`
        );
      }
    });

    return uniqueDesigns.size;
  }, [printedRows]);

  // ==========================================================
  // Printed stock
  // ==========================================================
  const printedStock = useMemo(
    () => total(printedRows),
    [printedRows]
  );

  // ==========================================================
  // Total barcode labels
  // ==========================================================
  const totalBarcodes = useMemo(
    () =>
      printedRows.reduce(
        (sum, row) =>
          sum + getLabels(row),
        0
      ),
    [printedRows]
  );

  // ==========================================================
  // Available barcode labels
  // ==========================================================
  const availableBarcodes = useMemo(
    () =>
      printedRows.reduce(
        (sum, row) =>
          sum + getAvailable(row),
        0
      ),
    [printedRows]
  );

  // ==========================================================
  // Low stock count
  // ==========================================================
  const lowStockRows = useMemo(
    () =>
      printedRows.filter(
        isLowStock
      ).length,
    [printedRows]
  );

  // ==========================================================
  // Start editing
  // ==========================================================
  const startEditing = (
    row: InventoryRow
  ) => {
    if (!canEditThreshold(row)) {
      return;
    }

    if (!row._id) {
      return;
    }

    setEditingId(row._id);

    setThresholdValue(
      String(
        getThreshold(row)
      )
    );

    setError(null);
  };

  // ==========================================================
  // Save threshold
  // ==========================================================
  const saveThreshold = async (
    rowId: string
  ) => {
    const minThreshold =
      Number(thresholdValue);

    if (
      !Number.isSafeInteger(
        minThreshold
      ) ||
      minThreshold < 0
    ) {
      setError(
        "Threshold must be a non-negative whole number."
      );

      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `/api/inventory/threshold/${rowId}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            minThreshold,
          }),
        }
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not update the threshold."
        );
      }

      setEditingId(null);
      setThresholdValue("");

      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the threshold."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // Render
  // ==========================================================
  return (
    <div className="space-y-5">

      {/* ======================================================
          TOP ACTIONS
      ======================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/inventory"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <span aria-hidden="true">
            ←
          </span>

          All models
        </Link>

        <Link
          href={`/dashboard/barcodes/${product.id}`}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
        >
          Manage barcodes
        </Link>
      </div>

      {/* ======================================================
          PRODUCT HEADER
      ======================================================= */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-600">
              Model inventory
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {product.name}
            </h1>

            {product.categoryName &&
              product.categoryName !== "-" && (
                <p className="mt-1 text-sm text-slate-500">
                  {product.categoryName}
                </p>
              )}
          </div>

          {supplier?.supplierName && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="font-medium text-slate-700">
                Last supplier
              </p>

              <p className="mt-0.5">
                {supplier.supplierName}
              </p>

              <p className="mt-1 text-[11px]">
                {supplier.status}
              </p>
            </div>
          )}
        </div>

        {/* ====================================================
            SUMMARY CARDS

            IMPORTANT:
            5 cards => lg:grid-cols-5
        ===================================================== */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">

          {/* TOTAL MODELS */}
          <div className="rounded-xl bg-violet-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-violet-800">
              Total models
            </p>

            <p className="mt-1 text-xl font-semibold text-violet-950">
              {totalModels}
            </p>

            <p className="mt-0.5 text-[10px] text-violet-600">
              Created designs
            </p>
          </div>

          {/* RAW STOCK */}
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800">
              RAW stock
            </p>

            <p className="mt-1 text-xl font-semibold text-amber-950">
              {total(rawRows)}
            </p>
          </div>

          {/* PRINTED STOCK */}
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800">
              Printed stock
            </p>

            <p className="mt-1 text-xl font-semibold text-emerald-950">
              {printedStock}
            </p>
          </div>

          {/* AVAILABLE LABELS */}
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-blue-800">
              Labels ready
            </p>

            <p className="mt-1 text-xl font-semibold text-blue-950">
              {availableBarcodes}
            </p>

            <p className="mt-0.5 text-[10px] text-blue-600">
              of {totalBarcodes} labels
            </p>
          </div>

          {/* NEEDS ATTENTION */}
          <div
            className={`rounded-xl p-3 ${
              lowStockRows
                ? "bg-rose-50"
                : "bg-slate-50"
            }`}
          >
            <p
              className={`text-[11px] font-medium uppercase tracking-wide ${
                lowStockRows
                  ? "text-rose-800"
                  : "text-slate-600"
              }`}
            >
              Needs attention
            </p>

            <p
              className={`mt-1 text-xl font-semibold ${
                lowStockRows
                  ? "text-rose-950"
                  : "text-slate-900"
              }`}
            >
              {lowStockRows}
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================
          ERROR
      ======================================================= */}
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* ======================================================
          STOCK RECORDS
      ======================================================= */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Stock records
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              All created designs are shown. Designs without
              printed stock display zero values.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
              {totalModels} models
            </span>

            <span className="text-xs text-slate-500">
              {totalBarcodes} labels created
            </span>
          </div>
        </div>

        {/* ====================================================
            NO DESIGNS
        ===================================================== */}
        {printedRows.length === 0 ? (
          <div className="px-5 py-12 text-center">

            <p className="text-sm font-medium text-slate-700">
              No models found.
            </p>

            <p className="mt-1 text-xs text-slate-500">
              This product does not have any active designs.
            </p>

          </div>
        ) : (
          <div className="space-y-2 p-3 sm:p-4">

            {printedRows.map(
              (row, index) => {
                const lowStock =
                  isLowStock(row);

                const isEditing =
                  editingId === row._id;

                const rowCanEdit =
                  canEditThreshold(row);

                const quantity =
                  getQuantity(row);

                const labels =
                  getLabels(row);

                const available =
                  getAvailable(row);

                const threshold =
                  getThreshold(row);

                return (
                  <article
                    key={getRowKey(
                      row,
                      index
                    )}
                    className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition ${
                      lowStock
                        ? "border-rose-200 bg-rose-50/60"
                        : "border-slate-200 bg-white hover:bg-slate-50/50"
                    }`}
                  >
                    {/* ==================================================
                        DESIGN IMAGE + INFO
                    =================================================== */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">

                      {/* IMAGE */}
                      {row.designUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setImageUrl(
                              row.designUrl ??
                                null
                            )
                          }
                          className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
                          aria-label={`Preview ${
                            row.designName ||
                            row.designCode ||
                            "design"
                          }`}
                        >
                          <img
                            src={
                              row.designUrl
                            }
                            alt={
                              row.designName ||
                              "Design"
                            }
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-slate-100 px-1 text-center text-[10px] font-semibold text-slate-500">
                          NO IMAGE
                        </span>
                      )}

                      {/* DESIGN DETAILS */}
                      <div className="min-w-0">

                        <p className="truncate text-sm font-semibold text-slate-900">
                          {row.designName ||
                            row.designCode ||
                            "Printed design"}
                        </p>

                        <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                          {row.designCode ||
                            "No design code"}

                          {row.mode
                            ? ` · ${row.mode}`
                            : ""}
                        </p>

                        <p className="truncate font-mono text-[11px] font-semibold text-indigo-600">
                          SKU:{" "}
                          {row.designSku ||
                            "No SKU"}
                        </p>
                      </div>
                    </div>

                    {/* ==================================================
                        STOCK DATA
                    =================================================== */}
                    <div className="grid shrink-0 grid-cols-3 gap-2">

                      {/* STOCK */}
                      <div className="min-w-[64px] rounded-md bg-slate-50 px-2 py-1.5 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          Stock
                        </p>

                        <p className="text-sm font-semibold text-slate-900">
                          {quantity}
                        </p>
                      </div>

                      {/* LABELS */}
                      <div className="min-w-[64px] rounded-md bg-slate-50 px-2 py-1.5 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          Labels
                        </p>

                        <p className="text-sm font-semibold text-slate-900">
                          {labels}
                        </p>
                      </div>

                      {/* AVAILABLE */}
                      <div className="min-w-[64px] rounded-md bg-slate-50 px-2 py-1.5 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          Available
                        </p>

                        <p className="text-sm font-semibold text-slate-900">
                          {available}
                        </p>
                      </div>
                    </div>

                    {/* ==================================================
                        THRESHOLD
                    =================================================== */}
                    <div className="min-w-[105px] shrink-0">

                      {/* ----------------------------------------------
                          EMPTY / ZERO STOCK

                          Stock = 0
                          Labels = 0
                          Available = 0

                          => SHOW DATA ONLY
                          => NO INPUT
                          => NO EDIT BUTTON
                      ----------------------------------------------- */}
                      {!rowCanEdit ? (
                        <div className="rounded-md bg-slate-50 px-3 py-1.5 text-center">

                          <p className="text-[10px] uppercase tracking-wide text-slate-400">
                            Threshold
                          </p>

                          <p className="text-sm font-semibold text-slate-700">
                            {threshold}
                          </p>

                        </div>
                      ) : isEditing &&
                        row._id ? (

                        /* --------------------------------------------
                           EDIT MODE
                        --------------------------------------------- */
                        <div className="flex items-center gap-2">

                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={
                              thresholdValue
                            }
                            onChange={(event) =>
                              setThresholdValue(
                                event.target
                                  .value
                              )
                            }
                            className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            autoFocus
                            disabled={saving}
                          />

                          <button
                            type="button"
                            onClick={() =>
                              saveThreshold(
                                row._id as string
                              )
                            }
                            disabled={saving}
                            className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {saving
                              ? "Saving..."
                              : "Save"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(
                                null
                              );

                              setThresholdValue(
                                ""
                              );

                              setError(null);
                            }}
                            disabled={
                              saving
                            }
                            className="text-xs font-medium text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>

                        </div>
                      ) : (

                        /* --------------------------------------------
                           NORMAL EXISTING INVENTORY
                        --------------------------------------------- */
                        <button
                          type="button"
                          onClick={() =>
                            startEditing(
                              row
                            )
                          }
                          className={`rounded-md px-2 py-1 text-sm hover:bg-slate-100 ${
                            lowStock
                              ? "font-semibold text-rose-700"
                              : "text-slate-700"
                          }`}
                          title="Edit minimum threshold"
                        >
                          {threshold}

                          <span className="text-xs text-slate-400">
                            {" "}
                            Edit
                          </span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>

      {/* ======================================================
          IMAGE PREVIEW
      ======================================================= */}
      {imageUrl && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"
          onClick={() =>
            setImageUrl(null)
          }
        >
          <div
            className="relative max-h-full max-w-3xl rounded-xl bg-white p-3 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              onClick={() =>
                setImageUrl(null)
              }
              className="absolute -right-3 -top-3 grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-bold text-slate-700 shadow"
              aria-label="Close image preview"
            >
              ×
            </button>

            <img
              src={imageUrl}
              alt="Design preview"
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}