"use client";

import { useMemo, useState, useRef, type ChangeEvent } from "react";

// ---------- Types ----------
type MetaField = { key: string; label: string; type: string; required: boolean };
type Category = { _id: string; name: string; metaFields: MetaField[] };
type Product = {
  _id: string;
  name: string;
  categoryId: Category;
  attributes: Record<string, string>;
  skuBase: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type DesignFormState = {
  productId: string;
  name: string;
  mode: string;
  designCode: string;
  designUrl: string;
  notes: string;
};
type ProductDesign = {
  _id: string;
  productId: string;
  name: string;
  mode: string;
  designCode: string;
  designUrl?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type Props = { products: Product[]; token: string };

// ---------- Constants ----------
const API_URL = "https://inventory-system-ecew.onrender.com/api/product-designs";
const IMAGEKIT_AUTH_URL = "/api/imagekit-auth";
const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!;
const MAX_FILE_BYTES = 300 * 1024;
const MODES = ["SCREEN_PRINT", "HEAT_TRANSFER", "EMBROIDERY", "DTF", "OTHER"];
const emptyForm: DesignFormState = {
  productId: "",
  name: "",
  mode: "SCREEN_PRINT",
  designCode: "",
  designUrl: "",
  notes: "",
};

// ---------- Image helpers ----------
const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be read."));
    };
    image.src = url;
  });

type CheckedImage = { file: File; width: number; height: number };

async function validateDesignImage(file: File): Promise<CheckedImage> {
  const acceptedTypes = ["image/png", "image/webp", "image/jpeg"];
  if (!acceptedTypes.includes(file.type))
    throw new Error("Only PNG, WebP, JPG, and JPEG files are supported.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error(
      `Image is ${(file.size / 1024).toFixed(0)} KB. Please select an image under 300 KB.`
    );
  const image = await loadImage(file);
  return { file, width: image.naturalWidth, height: image.naturalHeight };
}

async function uploadToImageKit(
  file: File,
  onProgress: (progress: number) => void
): Promise<string> {
  const authResponse = await fetch(IMAGEKIT_AUTH_URL);
  if (!authResponse.ok) throw new Error("Image upload authentication failed.");
  const { signature, expire, token } = await authResponse.json();
  const body = new FormData();
  body.append("file", file);
  body.append("fileName", file.name);
  body.append("folder", "/product-designs");
  body.append("useUniqueFileName", "true");
  body.append("publicKey", IMAGEKIT_PUBLIC_KEY);
  body.append("signature", signature);
  body.append("expire", String(expire));
  body.append("token", token);

  return await new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "https://upload.imagekit.io/api/v1/files/upload");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () =>
      reject(new Error("Image upload failed. Check your internet connection."));
    request.onload = () => {
      let result: { url?: string; message?: string } = {};
      try {
        result = JSON.parse(request.responseText || "{}");
      } catch {
        reject(new Error("ImageKit returned an invalid response."));
        return;
      }
      if (request.status < 200 || request.status >= 300 || !result.url)
        reject(new Error(result.message || "ImageKit upload failed."));
      else resolve(String(result.url));
    };
    request.send(body);
  });
}

// ---------- Main Component ----------
export default function CreateDesignForm({ products, token }: Props) {
  const [form, setForm] = useState<DesignFormState>(emptyForm);
  const [designs, setDesigns] = useState<ProductDesign[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Gallery modal
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<
    { url: string; thumbnail: string; name: string }[]
  >([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p._id === form.productId),
    [products, form.productId]
  );

  // Helpers
  const change = (key: keyof DesignFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setMessage("");
  };

  const reset = (keepProduct = true) => {
    setForm({
      ...emptyForm,
      productId: keepProduct ? form.productId : "",
    });
    setEditingId(null);
    setError("");
  };

  // Load designs for the selected product
  const loadDesigns = async (productId: string) => {
    if (!productId || !token) {
      setDesigns([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/product/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not load designs.");
      setDesigns(Array.isArray(data.designs) ? data.designs : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load designs.");
      setDesigns([]);
    } finally {
      setLoading(false);
    }
  };

  const chooseProduct = (productId: string) => {
    setForm({ ...emptyForm, productId });
    setEditingId(null);
    setMessage("");
    loadDesigns(productId);
  };

  // Direct upload
  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const checked = await validateDesignImage(file);
      const url = await uploadToImageKit(checked.file, setUploadProgress);
      setForm((prev) => ({ ...prev, designUrl: url }));
      const sizeNote = `${(checked.file.size / 1024).toFixed(0)} KB`;
      const dimensionNote =
        checked.width === 3024 && checked.height === 4032
          ? "Recommended size confirmed: 3024 x 4032."
          : `Uploaded: ${checked.width} x ${checked.height}. Recommended: 3024 x 4032.`;
      setMessage(`Image uploaded (${sizeNote}). ${dimensionNote}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Gallery handlers
  const fetchGalleryImages = async () => {
    setGalleryLoading(true);
    setGalleryError("");
    try {
      const res = await fetch("/api/imagekit/list");
      if (!res.ok) throw new Error("Failed to load gallery.");
      const data = await res.json();
      setGalleryImages(data.images || []);
    } catch (err: any) {
      setGalleryError(err.message);
    } finally {
      setGalleryLoading(false);
    }
  };

  const openGallery = () => {
    setGalleryOpen(true);
    fetchGalleryImages();
  };

  const selectFromGallery = (url: string) => {
    setForm((prev) => ({ ...prev, designUrl: url }));
    setGalleryOpen(false);
    setMessage("Image selected from gallery.");
  };

  const galleryUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const checked = await validateDesignImage(file);
      const url = await uploadToImageKit(checked.file, (progress) =>
        setUploadProgress(progress)
      );
      setForm((prev) => ({ ...prev, designUrl: url }));
      setGalleryOpen(false);
      setMessage("Image uploaded and selected.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
  };

  // Save design
  const save = async () => {
    if (!token) return setError("No token provided. Please log in again.");
    if (!form.productId || !form.name.trim() || !form.mode || !form.designCode.trim())
      return setError("Product, name, mode, and design code are required.");

    const payload = {
      productId: form.productId,
      name: form.name.trim(),
      mode: form.mode,
      designCode: form.designCode.trim().toUpperCase(),
      designUrl: form.designUrl.trim(),
      notes: form.notes.trim(),
    };

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not save design.");
      const saved = data.design || data.productDesign || data;
      setDesigns((prev) =>
        editingId
          ? prev.map((item) => (item._id === editingId ? saved : item))
          : [...prev, saved]
      );
      reset();
      setMessage(editingId ? "Design updated." : "Design created.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save design.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (design: ProductDesign) => {
    setEditingId(design._id);
    setForm({
      productId: design.productId,
      name: design.name || "",
      mode: design.mode || "SCREEN_PRINT",
      designCode: design.designCode || "",
      designUrl: design.designUrl || "",
      notes: design.notes || "",
    });
    setError("");
    setMessage("");
  };

  const remove = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    setError("");
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not delete design.");
      setDesigns((prev) => prev.filter((d) => d._id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete design.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ---------- Product Selection ---------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          1. Select product
        </h2>
        <select
          value={form.productId}
          onChange={(e) => chooseProduct(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a product...</option>
          {products.map((product) => (
            <option key={product._id} value={product._id}>
              {product.name} - {product.categoryId?.name}
            </option>
          ))}
        </select>
        {selectedProduct && (
          <p className="mt-2 text-xs text-slate-500">
            Category: {selectedProduct.categoryId?.name} &nbsp;|&nbsp; SKU:{" "}
            {selectedProduct.skuBase}
          </p>
        )}
      </section>

      {/* ---------- Design Details ---------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          2. Design details
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Left column – text fields */}
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Design name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => change("name", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600">Mode</span>
              <select
                value={form.mode}
                onChange={(e) => change("mode", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600">Design code</span>
              <input
                type="text"
                value={form.designCode}
                onChange={(e) => change("designCode", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          {/* Right column – image upload + notes */}
          <div className="space-y-4">
            {/* Image area */}
            <div>
              <span className="text-xs font-medium text-slate-600">
                Design image
              </span>

              {/* Upload box */}
              <label
                className={`mt-2 flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-4 py-5 text-xs transition ${
                  uploading
                    ? "cursor-not-allowed border-slate-300 bg-slate-50 text-slate-400"
                    : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                <input
                  type="file"
                  accept=".png,.webp,.jpg,.jpeg,image/png,image/webp,image/jpeg"
                  onChange={chooseImage}
                  disabled={uploading}
                  className="sr-only"
                />
                {uploading ? (
                  `Uploading ${uploadProgress}%...`
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Choose image
                  </>
                )}
              </label>

              <button
                type="button"
                onClick={openGallery}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm hover:bg-slate-50"
              >
                📁 Browse gallery
              </button>

              <p className="mt-2 text-[11px] text-slate-400">
                PNG, WebP, JPG up to 300 KB · Recommended 3024 × 4032 px
              </p>

              {/* Progress bar */}
              {uploading && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {/* Preview of current image */}
              {form.designUrl && (
                <div className="mt-3">
                  <img
                    src={form.designUrl}
                    alt="Preview"
                    className="h-32 w-32 rounded-lg border object-cover shadow-sm"
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => change("notes", e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {message}
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || uploading}
            className="rounded-lg bg-slate-800 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update design"
              : "Create design"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              Cancel edit
            </button>
          )}
        </div>
      </section>

      {/* ---------- Existing Designs Table ---------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          3. Designs for selected product
        </h2>
        {loading ? (
          <p className="py-4 text-xs text-slate-500">Loading...</p>
        ) : designs.length === 0 ? (
          <p className="py-4 text-xs text-slate-400">
            No designs found for this product.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Preview</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {designs.map((design) => (
                  <tr key={design._id} className="border-t">
                    <td className="px-3 py-2">
                      {design.designUrl ? (
                        <img
                          src={design.designUrl}
                          alt=""
                          className="h-10 w-10 rounded object-cover shadow-sm"
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2">{design.name}</td>
                    <td className="px-3 py-2">{design.mode}</td>
                    <td className="px-3 py-2 font-mono">{design.designCode}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => edit(design)}
                          className="rounded border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(design._id)}
                          disabled={deletingId === design._id}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === design._id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Gallery Modal (full images, no cropping) ---------- */}
      {galleryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setGalleryOpen(false)}
        >
          <div
            className="relative mx-4 max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Select an image
              </h3>
              <button
                onClick={() => setGalleryOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 130px)" }}>
              {galleryLoading && (
                <p className="py-6 text-center text-sm text-slate-500">Loading images…</p>
              )}
              {galleryError && (
                <p className="py-6 text-center text-sm text-red-500">{galleryError}</p>
              )}
              {!galleryLoading && !galleryError && galleryImages.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">No images in gallery.</p>
              )}

              {/* Grid of full images (object-contain, no crop) */}
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectFromGallery(img.url)}
                    className={`group relative flex flex-col items-center rounded-lg border p-2 transition hover:border-blue-400 ${
                      form.designUrl === img.url
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-slate-200"
                    }`}
                  >
                    {/* Image container – fixed aspect ratio but keeps full image visible */}
                    <div className="mb-1 flex h-32 w-full items-center justify-center overflow-hidden rounded bg-slate-50">
                      <img
                        src={img.thumbnail || img.url}
                        alt={img.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="mt-1 w-full truncate text-center text-[10px] text-slate-500">
                      {img.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer – upload inside modal */}
            <div className="border-t bg-slate-50 px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-600">Or upload a new image</span>
              <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 transition">
                <input
                  type="file"
                  accept="image/png,image/webp,image/jpeg"
                  className="hidden"
                  ref={galleryFileRef}
                  onChange={galleryUpload}
                  disabled={uploading}
                />
                {uploading ? "Uploading..." : "Choose file"}
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}