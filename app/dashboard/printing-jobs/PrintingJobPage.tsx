"use client";

import { FormEvent, useEffect, useState } from "react";

type Category = {
  _id: string;
  name: string;
};

type Product = {
  _id: string;
  name: string;
  skuBase: string;
  categoryId: {
    _id: string;
  };
};

type ProductDesign = {
  _id: string;
  name: string;
  mode: string;
  designCode: string;
};

// 1. FIXED: Props now include categories
type Props = {
  categories: Category[];
  products: Product[];
};

const getErrorMessage = async (res: Response, fallback: string) => {
  const data = await res.json().catch(() => ({}));
  return data.message || fallback;
};

export default function PrintingJobPage({ categories, products }: Props) {
  const [categoryId, setCategoryId] = useState("");
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

  // Products filtered by selected category
  const filteredProducts = products.filter(
    (product) => product.categoryId?._id === categoryId,
  );

  // 2. FIXED: Load designs when productId changes (not categoryId)
  useEffect(() => {
    const loadDesigns = async () => {
      // Reset design selection and list whenever product changes
      setDesignId("");
      setDesigns([]);
      setError("");

      if (!productId) return;

      try {
        setLoadingDesigns(true);
        const res = await fetch(
          `/api/printing-jobs/${productId}?kind=designs`,
          { cache: "no-store" },
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
            : "Could not load model/design list",
        );
      } finally {
        setLoadingDesigns(false);
      }
    };

    loadDesigns();
  }, [productId]); // <-- correct dependency

  // 3. FIXED: Reset product when category changes
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategoryId = e.target.value;
    setCategoryId(newCategoryId);
    setProductId(""); // clear product so it forces a fresh selection
    setDesignId("");
    setDesigns([]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!categoryId || !productId || !designId || !quantity) {
      setError("Please select category, product, model/design and quantity.");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          productId,
          designId,
          quantity: Number(quantity),
          status,
          notes,
        }),
      });

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Could not Add Product To Stock"),
        );
      }

      setSuccess(
        status === "COMPLETED"
          ? "Printing completed and stock added to inventory."
          : "Printing job created successfully.",
      );
      setCategoryId("");
      setProductId("");
      setDesignId("");
      setQuantity("");
      setStatus("PENDING");
      setNotes("");
      setDesigns([]);

      window.dispatchEvent(new Event("printing-jobs:changed"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not Add Product To Stock",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-base font-semibold text-slate-800">
        Add Product To Stock
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
        {/* Category */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Category *
          </label>
          <select
            value={categoryId}
            onChange={handleCategoryChange}
            className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm"
            required
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Product */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Product *
          </label>
          <select
            value={productId}
            disabled={!categoryId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm disabled:bg-slate-100"
            required
          >
            <option value="">
              {!categoryId ? "Select category first" : "Select product"}
            </option>
            {filteredProducts.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name}
                {product.skuBase ? ` (${product.skuBase})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Model / Design */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Model / Design *
          </label>
          <select
            value={designId}
            disabled={!productId || loadingDesigns}
            onChange={(e) => setDesignId(e.target.value)}
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

        {/* Quantity */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Quantity *
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            className="w-full rounded-md border border-slate-300 p-2.5 text-sm"
            required
          />
        </div>

        {/* Status */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Initial Status *
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm"
          >
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: Blue ink required"
            className="w-full rounded-md border border-slate-300 p-2.5 text-sm"
          />
        </div>

        {/* Submit */}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving || !designId}
            className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Saving..." : "Add Product to Stock"}
          </button>
        </div>
      </form>
    </section>
  );
}