// app/dashboard/products/ProductTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  categoryId: Category;
  attributes: Record<string, string>;
  isActive: boolean;
  createdAt: string;
};

type Props = {
  categories: Category[];
  products: Product[];
};

export default function ProductTable({
  categories,
  products,
}: Props) {
  const router = useRouter();

  // Local table state
  const [items, setItems] = useState<Product[]>(products);

  // Keep local state synchronized with the Server Component
  // after router.refresh().
  useEffect(() => {
    setItems(products);
  }, [products]);

  const [search, setSearch] = useState("");

  // Modal state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [attributes, setAttributes] =
    useState<Record<string, string>>({});

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isEdit = Boolean(editingId);

  // Selected category for the current form
  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) => category._id === categoryId
      ),
    [categories, categoryId]
  );

  // Search/filter products
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return items;
    }

    return items.filter((product) => {
      const productName =
        product.name?.toLowerCase() ?? "";

      const categoryName =
        product.categoryId?.name?.toLowerCase() ?? "";

      return (
        productName.includes(term) ||
        categoryName.includes(term)
      );
    });
  }, [items, search]);

  // Open create modal
  const openCreateModal = () => {
    setEditingId(null);
    setCategoryId("");
    setName("");
    setAttributes({});
    setError("");
    setOpen(true);
  };

  // Open edit modal
  const openEditModal = (product: Product) => {
    setEditingId(product._id);
    setCategoryId(product.categoryId?._id || "");
    setName(product.name || "");
    setAttributes(product.attributes || {});
    setError("");
    setOpen(true);
  };

  // Close modal
  const closeModal = () => {
    if (loading) return;

    setOpen(false);
    setError("");
  };

  // Change dynamic attribute
  const handleChangeAttribute = (
    key: string,
    value: string
  ) => {
    setAttributes((prev) => ({
      ...prev,
      [key]: value,
    }));

    setError("");
  };

  // Change category
  const handleCategoryChange = (id: string) => {
    setCategoryId(id);

    // Reset attributes because category changed
    setAttributes({});

    setError("");
  };

  // Create / Update product
  const handleSave = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (loading) return;

    // Validate category
    if (!categoryId) {
      setError("Category is required");
      return;
    }

    // Validate product name
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }

    // Validate required attributes
    if (selectedCategory) {
      for (const field of selectedCategory.metaFields || []) {
        if (!field.required) continue;

        const value = attributes[field.key];

        if (!value || !value.trim()) {
          setError(
            `Field "${field.label}" is required`
          );
          return;
        }
      }
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        categoryId,
        name: name.trim(),
        attributes,
      };

      const url = isEdit
        ? `/api/products/${editingId}`
        : "/api/products";

      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.message ||
            `Failed to ${isEdit ? "update" : "create"} product`
        );
        setLoading(false);
        return;
      }

      /*
       * IMPORTANT:
       * Do NOT put data.product directly into items here.
       *
       * The POST/PUT response may contain categoryId only as
       * an ObjectId/string, while the table needs:
       *
       * categoryId.name
       * categoryId.metaFields
       *
       * router.refresh() causes the Server Component to fetch
       * the populated product again.
       */

      // Reset form
      setOpen(false);
      setEditingId(null);
      setCategoryId("");
      setName("");
      setAttributes({});
      setError("");
      setLoading(false);

      // Fetch fresh server-side data
      router.refresh();
    } catch (cause) {
      console.error("Save product error:", cause);

      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Please try again."
      );

      setLoading(false);
    }
  };

  // Delete product
  const handleDelete = async (id: string) => {
    if (deletingId) return;

    const confirmed = window.confirm(
      "Delete this product?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);

      const response = await fetch(
        `/api/products/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        window.alert(
          data.message ||
            "Failed to delete product"
        );
        setDeletingId(null);
        return;
      }

      // Remove immediately from UI
      setItems((current) =>
        current.filter(
          (product) => product._id !== id
        )
      );

      // Keep server state synchronized
      router.refresh();
    } catch (cause) {
      console.error(
        "Delete product error:",
        cause
      );

      window.alert(
        cause instanceof Error
          ? cause.message
          : "Something went wrong"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search product / category..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-64"
            />

            {/* Create button */}
            <button
              type="button"
              onClick={openCreateModal}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              New product
            </button>
          </div>
        </div>

        {/* Product table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Name
                </th>

                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Category
                </th>

                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Attributes
                </th>

                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <tr key={product._id}>
                  {/* Name */}
                  <td className="px-3 py-2">
                    {product.name}
                  </td>

                  {/* Category */}
                  <td className="px-3 py-2 text-slate-500">
                    {product.categoryId?.name || "—"}
                  </td>

                  {/* Attributes */}
                  <td className="px-3 py-2 text-slate-500">
                    <div className="flex flex-wrap gap-1">
                      {product.categoryId?.metaFields?.map(
                        (field) => (
                          <span
                            key={field.key}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                          >
                            {field.label}:

                            <span className="ml-1 text-slate-500">
                              {product.attributes?.[
                                field.key
                              ] ?? "—"}
                            </span>
                          </span>
                        )
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="space-x-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(product)
                      }
                      disabled={
                        loading ||
                        deletingId === product._id
                      }
                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(product._id)
                      }
                      disabled={
                        deletingId === product._id ||
                        loading
                      }
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === product._id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}

              {/* Empty state */}
              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    {search.trim()
                      ? "No matching products found."
                      : "No products yet. Create your first one."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create / Edit modal */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            {/* Modal header */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  {isEdit
                    ? "Edit product"
                    : "New product"}
                </h3>

                <p className="text-xs text-slate-500">
                  Choose a category and fill in its
                  attributes.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSave}
              className="max-h-[70vh] space-y-3 overflow-y-auto"
            >
              {/* Category */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Category
                </label>

                <select
                  value={categoryId}
                  onChange={(event) =>
                    handleCategoryChange(
                      event.target.value
                    )
                  }
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">
                    Select category
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category._id}
                      value={category._id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Product name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. iPhone 16 Cover"
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                />
              </div>

              {/* Dynamic attributes */}
              {selectedCategory && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-600">
                      Attributes for{" "}
                      {selectedCategory.name}
                    </label>
                  </div>

                  <div className="space-y-2">
                    {selectedCategory.metaFields.map(
                      (field) => (
                        <div key={field.key}>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            {field.label}

                            {field.required && (
                              <span className="ml-0.5 text-red-500">
                                *
                              </span>
                            )}
                          </label>

                          <input
                            type="text"
                            value={
                              attributes[
                                field.key
                              ] ?? ""
                            }
                            onChange={(event) =>
                              handleChangeAttribute(
                                field.key,
                                event.target.value
                              )
                            }
                            placeholder={field.label}
                            disabled={loading}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                    ? "Save changes"
                    : "Create product"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
