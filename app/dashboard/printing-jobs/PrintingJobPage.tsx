"use client";

import { FormEvent, useEffect, useState } from "react";

type Product = {
  _id: string;
  name: string;
  skuBase: string;
};

type ProductDesign = {
  _id: string;
  name: string;
  mode: string;
  designCode: string;
};

type Props = {
  products: Product[];
};

const getErrorMessage = async (res: Response, fallback: string) => {
  const data = await res.json().catch(() => ({}));
  return data.message || fallback;
};

export default function PrintingJobPage({ products }: Props) {
  const [productId, setProductId] = useState("");
  const [designId, setDesignId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [notes, setNotes] = useState("");

  const [designs, setDesigns] = useState<ProductDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadDesigns = async () => {
      setDesignId("");
      setDesigns([]);
      setError("");

      if (!productId) return;

      try {
        setLoadingDesigns(true);

        const res = await fetch(
          `/api/printing-jobs/${productId}?kind=designs`,
          { cache: "no-store" }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.message || "Could not load model/design list");
        }

        setDesigns(data.designs || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load model/design list"
        );
      } finally {
        setLoadingDesigns(false);
      }
    };

    loadDesigns();
  }, [productId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!productId || !designId || !quantity) {
      setError("Please select product, model/design, and quantity.");
      return;
    }

    if (Number(quantity) < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/printing-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          designId,
          quantity: Number(quantity),
          status,
          notes,
        }),
      });

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Could not create printing job")
        );
      }

      setSuccess(
        status === "COMPLETED"
          ? "Printing completed and stock added to inventory."
          : "Printing job created successfully."
      );

      setProductId("");
      setDesignId("");
      setQuantity("");
      setStatus("PENDING");
      setNotes("");
      setDesigns([]);

      window.dispatchEvent(new Event("printing-jobs:changed"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create printing job"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-base font-semibold text-slate-800">
        Create Printing Job
      </h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Product *
          </label>

          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm"
            required
          >
            <option value="">Select product</option>

            {products.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name}
                {product.skuBase ? ` (${product.skuBase})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Model / Design *
          </label>

          <select
            value={designId}
            disabled={!productId || loadingDesigns}
            onChange={(event) => setDesignId(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm disabled:bg-slate-100"
            required
          >
            <option value="">
              {!productId
                ? "Select product first"
                : loadingDesigns
                  ? "Loading designs..."
                  : "Select model/design"}
            </option>

            {designs.map((design) => (
              <option key={design._id} value={design._id}>
                {design.name} — {design.mode} ({design.designCode})
              </option>
            ))}
          </select>

          {productId && !loadingDesigns && designs.length === 0 && (
            <p className="mt-1 text-xs text-red-600">
              No active model/design found for this product.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Quantity *
          </label>

          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Enter quantity"
            className="w-full rounded-md border border-slate-300 p-2.5 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Initial Status *
          </label>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm"
          >
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>

          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Example: Blue ink required"
            className="w-full rounded-md border border-slate-300 p-2.5 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving || !designId}
            className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Saving..." : "Create Printing Job"}
          </button>
        </div>
      </form>
    </section>
  );
}