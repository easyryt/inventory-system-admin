"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

type MetaField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
};

type Category = {
  _id: string;
  name: string;
  metaFields: MetaField[];
};

type Product = {
  _id: string;
  name: string;
  categoryId: Category | string;
  attributes: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProductDesign = {
  _id: string;
  productId: string;
  name: string;
  mode: string;
  sku: string;
  designCode: string;
  designUrl?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type GalleryImage = {
  fileId?: string;
  url: string;
  thumbnail?: string;
  name: string;
};

type FormState = {
  productId: string;
  name: string;
  mode: string;
  sku: string;
  designCode: string;
  designUrl: string;
  notes: string;
};

type Props = {
  products: Product[];
  categories: Category[];
  token: string;
};

const API_URL = "http://localhost:5000/api/product-designs";
const IMAGEKIT_AUTH_URL = "/api/imagekit-auth";
const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!;
const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const IMAGEKIT_FOLDER = "/product-designs";
const MAX_FILE_BYTES = 300 * 1024;

const MODES = ["SCREEN_PRINT", "HEAT_TRANSFER", "EMBROIDERY", "DTF", "OTHER"];

const emptyForm: FormState = {
  productId: "",
  name: "",
  mode: "SCREEN_PRINT",
  sku: "",
  designCode: "",
  designUrl: "",
  notes: "",
};

const getCategoryId = (product: Product) =>
  typeof product.categoryId === "string"
    ? product.categoryId
    : (product.categoryId?._id ?? "");

const getCategoryName = (product: Product) =>
  typeof product.categoryId === "string"
    ? ""
    : (product.categoryId?.name ?? "");

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image could not be read."));
    };

    image.src = objectUrl;
  });

async function validateImage(file: File) {
  const allowedTypes = ["image/png", "image/webp", "image/jpeg"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only PNG, WebP, JPG, and JPEG files are supported.");
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `Image is ${(file.size / 1024).toFixed(0)} KB. Maximum file size is 300 KB.`,
    );
  }

  const image = await loadImage(file);

  return {
    file,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

async function uploadToImageKit(
  file: File,
  onProgress: (progress: number) => void,
) {
  const authResponse = await fetch(IMAGEKIT_AUTH_URL);

  if (!authResponse.ok) {
    throw new Error("Image upload authentication failed.");
  }

  const { signature, expire, token } = await authResponse.json();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  formData.append("folder", IMAGEKIT_FOLDER);
  formData.append("useUniqueFileName", "true");
  formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);
  formData.append("signature", signature);
  formData.append("expire", String(expire));
  formData.append("token", token);

  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", IMAGEKIT_UPLOAD_URL);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onerror = () => {
      reject(new Error("Image upload failed. Check your internet connection."));
    };

    request.onload = () => {
      let result: { url?: string; message?: string } = {};

      try {
        result = JSON.parse(request.responseText || "{}");
      } catch {
        reject(new Error("ImageKit returned an invalid response."));
        return;
      }

      if (request.status < 200 || request.status >= 300 || !result.url) {
        reject(new Error(result.message || "ImageKit upload failed."));
        return;
      }

      resolve(result.url);
    };

    request.send(formData);
  });
}

export default function CreateDesignForm({
  products,
  categories,
  token,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [designs, setDesigns] = useState<ProductDesign[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const searchBoxRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryImageInputRef = useRef<HTMLInputElement>(null);

  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const selectedProduct = useMemo(
    () => safeProducts.find((product) => product._id === form.productId),
    [safeProducts, form.productId],
  );

  const matchingProducts = useMemo(() => {
    if (!selectedCategoryId) return [];

    const query = productSearch.trim().toLowerCase();

    return safeProducts
      .filter((product) => getCategoryId(product) === selectedCategoryId)
      .filter((product) => {
        if (!query) return true;

        return [
          product.name,
          getCategoryName(product),
          product._id,
        ].some((value) => value.toLowerCase().includes(query));
      })
      .slice(0, 100);
  }, [safeProducts, productSearch, selectedCategoryId]);

  const change = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setMessage("");
  };

  const loadDesigns = async (productId: string) => {
    if (!productId || !token) {
      setDesigns([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/product/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not load designs.");
      }

      setDesigns(Array.isArray(data.designs) ? data.designs : []);
    } catch (cause) {
      setDesigns([]);
      setError(
        cause instanceof Error ? cause.message : "Could not load designs.",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setForm(emptyForm);
    setProductSearch("");
    setProductPickerOpen(false);
    setActiveProductIndex(0);
    setDesigns([]);
    setEditingId(null);
    setError("");
    setMessage("");
  };

  const selectProduct = (product: Product) => {
    setForm({
      ...emptyForm,
      productId: product._id,
    });

    setSelectedCategoryId(getCategoryId(product));
    setProductSearch(product.name);
    setProductPickerOpen(false);
    setActiveProductIndex(0);
    setEditingId(null);
    setError("");
    setMessage("");

    loadDesigns(product._id);
  };

  const clearProduct = () => {
    setForm(emptyForm);
    setProductSearch("");
    setProductPickerOpen(false);
    setDesigns([]);
    setEditingId(null);

    window.setTimeout(() => {
      searchBoxRef.current?.focus();
    }, 0);
  };

  const onProductSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setProductPickerOpen(true);
      setActiveProductIndex((current) =>
        Math.min(current + 1, Math.max(matchingProducts.length - 1, 0)),
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveProductIndex((current) => Math.max(0, current - 1));
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const product = matchingProducts[activeProductIndex];
      if (product) selectProduct(product);
    }

    if (event.key === "Escape") {
      setProductPickerOpen(false);
    }
  };

  const uploadAndUseImage = async (file: File, closeGallery = false) => {
    setUploading(true);
    setUploadProgress(0);
    setError("");
    setMessage("");

    try {
      const checkedImage = await validateImage(file);

      const imageUrl = await uploadToImageKit(
        checkedImage.file,
        setUploadProgress,
      );

      setForm((current) => ({
        ...current,
        designUrl: imageUrl,
      }));

      if (closeGallery) {
        setGalleryOpen(false);
      }

      setMessage(
        `Image uploaded: ${checkedImage.width} × ${checkedImage.height}px.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    if (file) {
      await uploadAndUseImage(file);
    }
  };

  const openGallery = async () => {
    setGalleryOpen(true);
    setGalleryLoading(true);
    setGalleryError("");

    try {
      const response = await fetch("/api/imagekit/list");

      if (!response.ok) {
        throw new Error("Could not load image gallery.");
      }

      const data = await response.json();

      setGalleryImages(Array.isArray(data.images) ? data.images : []);
    } catch (cause) {
      setGalleryError(
        cause instanceof Error
          ? cause.message
          : "Could not load image gallery.",
      );
    } finally {
      setGalleryLoading(false);
    }
  };

  const selectGalleryImage = (imageUrl: string) => {
    setForm((current) => ({
      ...current,
      designUrl: imageUrl,
    }));

    setGalleryOpen(false);
    setError("");
    setMessage("Image selected from gallery.");
  };

  const uploadGalleryImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (galleryImageInputRef.current) {
      galleryImageInputRef.current.value = "";
    }

    if (file) {
      await uploadAndUseImage(file, true);
    }
  };

  const save = async () => {
    if (!token) {
      setError("No login token found. Please log in again.");
      return;
    }

    if (!form.productId) {
      setError("Please select a product.");
      return;
    }

    if (
      !form.name.trim() ||
      !form.mode ||
      !form.sku.trim() ||
      !form.designCode.trim()
    ) {
      setError("Design name, mode, SKU, and design code are required.");
      return;
    }

    const payload = {
      productId: form.productId,
      name: form.name.trim(),
      mode: form.mode,
      sku: form.sku.trim().toUpperCase(),
      designCode: form.designCode.trim().toUpperCase(),
      designUrl: form.designUrl.trim(),
      notes: form.notes.trim(),
    };

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        editingId ? `${API_URL}/${editingId}` : API_URL,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not save design.");
      }

      setMessage(editingId ? "Design updated." : "Design created.");

      setForm((current) => ({
        ...emptyForm,
        productId: current.productId,
      }));

      setEditingId(null);
      await loadDesigns(form.productId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save design.",
      );
    } finally {
      setSaving(false);
    }
  };

  const editDesign = (design: ProductDesign) => {
    const product = safeProducts.find((item) => item._id === design.productId);

    setEditingId(design._id);

    setForm({
      productId: design.productId,
      name: design.name ?? "",
      mode: design.mode ?? "SCREEN_PRINT",
      sku: design.sku ?? "",
      designCode: design.designCode ?? "",
      designUrl: design.designUrl ?? "",
      notes: design.notes ?? "",
    });

    if (product) {
      setSelectedCategoryId(getCategoryId(product));
      setProductSearch(product.name);
    }

    setError("");
    setMessage("");
  };

  const removeDesign = async (designId: string) => {
    if (!token) return;

    setDeletingId(designId);
    setError("");

    try {
      const response = await fetch(`${API_URL}/${designId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not delete design.");
      }

      setDesigns((current) =>
        current.filter((design) => design._id !== designId),
      );

      setMessage("Design deleted.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete design.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          1. Select category and product
        </h2>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Category
          </span>

          <select
            value={selectedCategoryId}
            onChange={(event) => selectCategory(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Select a category...</option>

            {safeCategories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="relative mt-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Search product
            </span>

            <input
              ref={searchBoxRef}
              type="text"
              value={productSearch}
              disabled={!selectedCategoryId}
              autoComplete="off"
              placeholder={
                selectedCategoryId
                  ? "Type product name or SKU..."
                  : "Select a category first..."
              }
              onFocus={() => {
                if (selectedCategoryId) {
                  setProductPickerOpen(true);
                  setActiveProductIndex(0);
                }
              }}
              onChange={(event) => {
                setProductSearch(event.target.value);
                setProductPickerOpen(true);
                setActiveProductIndex(0);

                if (!event.target.value.trim()) {
                  setForm(emptyForm);
                  setDesigns([]);
                  setEditingId(null);
                }
              }}
              onKeyDown={onProductSearchKeyDown}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>

          {productPickerOpen && selectedCategoryId && (
            <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
              {matchingProducts.length === 0 ? (
                <div className="px-4 py-5 text-center text-sm text-slate-400">
                  No products found in this category.
                </div>
              ) : (
                matchingProducts.map((product, index) => (
                  <button
                    key={product._id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectProduct(product)}
                    className={`block w-full border-b border-slate-100 px-3 py-3 text-left last:border-b-0 ${
                      index === activeProductIndex
                        ? "bg-blue-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-slate-800">
                      {product.name}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                       Category:{" "}
                      {getCategoryName(product) || "—"}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedProduct && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div>
              <p className="text-sm font-medium text-emerald-800">
                {selectedProduct.name}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Category: {getCategoryName(selectedProduct) || "—"} 
              </p>
            </div>

            <button
              type="button"
              onClick={clearProduct}
              className="rounded border border-emerald-300 bg-white px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100"
            >
              Change product
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          2. Design details
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">
                Design name
              </span>
              <input
                value={form.name}
                onChange={(event) => change("name", event.target.value)}
                disabled={!form.productId}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600">Mode</span>
              <select
                value={form.mode}
                onChange={(event) => change("mode", event.target.value)}
                disabled={!form.productId}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              >
                {MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600">SKU</span>

              <input
                value={form.sku}
                onChange={(event) =>
                  change("sku", event.target.value.toUpperCase())
                }
                disabled={!form.productId}
                placeholder="e.g. TS-BUTTERFLY-BLUE"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase disabled:bg-slate-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600">
                Design code
              </span>
              <input
                value={form.designCode}
                onChange={(event) => change("designCode", event.target.value)}
                disabled={!form.productId}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase disabled:bg-slate-100"
              />
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs font-medium text-slate-600">
                Design image
              </span>

              <label
                className={`mt-1 flex items-center justify-center rounded-lg border border-dashed px-4 py-5 text-sm ${
                  uploading || !form.productId
                    ? "cursor-not-allowed border-slate-300 bg-slate-50 text-slate-400"
                    : "cursor-pointer border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg,.jpeg"
                  onChange={chooseImage}
                  disabled={uploading || !form.productId}
                  className="hidden"
                />

                {uploading
                  ? `Uploading ${uploadProgress}%...`
                  : "Upload new image"}
              </label>

              <button
                type="button"
                onClick={openGallery}
                disabled={uploading || !form.productId}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Browse gallery
              </button>

              {uploading && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              <p className="mt-2 text-[11px] text-slate-400">
                PNG, WebP, JPG, or JPEG. Maximum 300 KB.
              </p>

              {form.designUrl && (
                <img
                  src={form.designUrl}
                  alt="Selected design"
                  className="mt-3 h-32 w-32 rounded-lg border object-cover"
                />
              )}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-600">Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => change("notes", event.target.value)}
                disabled={!form.productId}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || uploading || !form.productId}
            className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
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
              onClick={() => {
                setForm((current) => ({
                  ...emptyForm,
                  productId: current.productId,
                }));
                setEditingId(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel edit
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          3. Existing designs
        </h2>

        {!form.productId ? (
          <p className="py-5 text-sm text-slate-400">
            Select a category and product to see its designs.
          </p>
        ) : loading ? (
          <p className="py-5 text-sm text-slate-500">Loading designs...</p>
        ) : designs.length === 0 ? (
          <p className="py-5 text-sm text-slate-400">
            No designs found for this product.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Image</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">SKU</th>
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
                          alt={design.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No image</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{design.name}</td>
                    <td className="px-3 py-2">{design.sku}</td>
                    <td className="px-3 py-2">{design.mode}</td>
                    <td className="px-3 py-2 font-mono">{design.designCode}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editDesign(design)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDesign(design._id)}
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

      {galleryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setGalleryOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  Browse gallery
                </h3>
                <p className="text-xs text-slate-500">
                  Select an existing image for this design.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className="rounded p-1 text-xl text-slate-500 hover:bg-slate-100"
                aria-label="Close gallery"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {galleryLoading && (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading gallery...
                </p>
              )}

              {galleryError && (
                <p className="rounded bg-red-50 p-3 text-sm text-red-700">
                  {galleryError}
                </p>
              )}

              {!galleryLoading &&
                !galleryError &&
                galleryImages.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-400">
                    No images found in gallery.
                  </p>
                )}

              {!galleryLoading && galleryImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {galleryImages.map((image, index) => (
                    <button
                      key={image.fileId ?? `${image.url}-${index}`}
                      type="button"
                      onClick={() => selectGalleryImage(image.url)}
                      className={`rounded-lg border p-2 text-left transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100 ${
                        form.designUrl === image.url
                          ? "border-blue-500 ring-2 ring-blue-200"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex h-28 items-center justify-center overflow-hidden rounded bg-slate-50">
                        <img
                          src={image.thumbnail || image.url}
                          alt={image.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <p className="mt-2 truncate text-xs text-slate-600">
                        {image.name}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-3">
              <span className="text-xs text-slate-500">
                Or upload a new image to select it.
              </span>

              <label
                className={`rounded-lg px-4 py-2 text-xs font-medium text-white ${
                  uploading
                    ? "cursor-not-allowed bg-blue-400"
                    : "cursor-pointer bg-blue-600 hover:bg-blue-700"
                }`}
              >
                <input
                  ref={galleryImageInputRef}
                  type="file"
                  accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg,.jpeg"
                  onChange={uploadGalleryImage}
                  disabled={uploading}
                  className="hidden"
                />
                {uploading ? `Uploading ${uploadProgress}%...` : "Upload image"}
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
