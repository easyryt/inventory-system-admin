"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ProductDesign = {
  _id: string;
  name: string;
  mode: string;
  designCode: string;
};

type Props = {
  productId: string;
  designs: ProductDesign[];
};

export default function BarcodeCreateForm({ productId, designs }: Props) {
  const router = useRouter();

  const [designId, setDesignId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!designId) {
      setError("Select a model/design first.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/barcodes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          designId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Could not generate barcodes");
      }

      setMessage(
        `${data.barcodeCount || data.barcodes?.length || 0} barcode(s) generated successfully.`
      );
      setDesignId("");

      // Reload barcode history on the current page.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate barcodes"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-800">
          Generate Barcodes
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Select the model/design. Barcodes are generated automatically for its unlabelled PRINTED stock.
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-3 rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Model / Design *
          </label>

          <select
            value={designId}
            onChange={(event) => setDesignId(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            required
          >
            <option value="">Select model/design</option>

            {designs.map((design) => (
              <option key={design._id} value={design._id}>
                {design.name} — {design.mode} ({design.designCode})
              </option>
            ))}
          </select>
        </div>



        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={loading || designs.length === 0}
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? "Generating..." : "Generate Barcodes"}
          </button>

          {designs.length === 0 && (
            <span className="ml-3 text-xs text-red-600">
              No active model/design exists for this product.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}