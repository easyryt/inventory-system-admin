"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  _id: string;
  name: string;
  categoryId: {
    _id: string;
    name: string;
  };
  skuBase: string;
};

type PrintingItem = {
  designCode: string;
  quantity: string;
};

type Props = {
  products: Product[];
};

const emptyRow = (): PrintingItem => ({ designCode: "", quantity: "" });

const STATUS_OPTIONS = [
  { value: "PENDING", label: "PENDING" },
  { value: "COMPLETED", label: "COMPLETED" },
  { value: "CANCELLED", label: "CANCELLED" },
] as const;

export default function PrintingJobPage({ products }: Props) {
  const [productId, setProductId] = useState("");
  const [items, setItems] = useState<PrintingItem[]>([emptyRow()]);
  const [status, setStatus] =
    useState<(typeof STATUS_OPTIONS)[number]["value"]>("COMPLETED");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showSuccess = (msg: string) => setToast({ type: "success", message: msg });
  const showError = (msg: string) => setToast({ type: "error", message: msg });

  const selectedProduct = useMemo(
    () => products.find((p) => p._id === productId),
    [products, productId]
  );

  const updateItem = (index: number, field: keyof PrintingItem, value: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  const addRow = () => setItems((prev) => [...prev, emptyRow()]);

  const removeRow = (index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [emptyRow()];
    });
  };

  const resetForm = () => {
    setProductId("");
    setItems([emptyRow()]);
    setStatus("COMPLETED");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!productId) {
      const msg = "Select a product for the printing job";
      setError(msg);
      showError(msg);
      return;
    }

    const cleaned = items
      .map((it) => ({
        designCode: it.designCode.trim().toUpperCase(),
        quantity: Number(it.quantity),
      }))
      .filter((it) => it.designCode && !Number.isNaN(it.quantity) && it.quantity > 0);

    if (cleaned.length === 0) {
      const msg = "Add at least one design with a positive quantity";
      setError(msg);
      showError(msg);
      return;
    }

    const payload: {
      productId: string;
      items: { designCode: string; quantity: number }[];
      status: "PENDING" | "COMPLETED" | "CANCELLED";
      notes?: string;
    } = {
      productId,
      items: cleaned,
      status,
    };

    if (notes.trim()) payload.notes = notes.trim();

    try {
      setSubmitting(true);

      const res = await fetch("/api/printing-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message || "Failed to create printing job";
        setError(msg);
        showError(msg);
        return;
      }

      setSuccess("Printing job created successfully.");
      showSuccess("Printing job created.");
      resetForm();
    } catch (err) {
      console.error("Create printing job error", err);
      const msg = "Something went wrong while creating the printing job";
      setError(msg);
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      {toast && (
        <div className="absolute right-4 top-4 z-10">
          <div
            className={
              "rounded-xl px-3 py-2 text-xs shadow-sm border " +
              (toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700")
            }
          >
            {toast.message}
          </div>
        </div>
      )}

      <header className="flex flex-col gap-1 pr-24">
        <h2 className="text-sm font-semibold text-slate-900">New printing job</h2>
        <p className="text-xs text-slate-500">
          Pick a product, add design codes, and set quantities. RAW stock will be deducted automatically.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-slate-100 p-3 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Product
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.categoryId?.name})
                  </option>
                ))}
              </select>

              {selectedProduct && (
                <p className="mt-1 text-[11px] text-slate-500">
                  SKU base: {selectedProduct.skuBase}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Initial status
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "PENDING" | "COMPLETED" | "CANCELLED")
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                You can change this later from the jobs list.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              placeholder="Any special instructions or comments for this job"
            />
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-medium text-slate-600">
                Designs in this job
              </h3>
              <button
                type="button"
                onClick={addRow}
                className="text-[11px] font-medium text-blue-700 hover:underline"
              >
                + Add design
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border border-slate-100 p-2 md:grid-cols-[1fr_120px_auto]"
                >
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Design code
                    </label>
                    <input
                      type="text"
                      value={it.designCode}
                      onChange={(e) => updateItem(index, "designCode", e.target.value)}
                      placeholder="e.g. BUTTERFLY"
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] uppercase focus:outline-none focus:ring-1 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Qty
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-[11px] font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {success}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {submitting ? "Creating printing job..." : "Create printing job"}
          </button>
        </div>
      </form>
    </section>
  );
}