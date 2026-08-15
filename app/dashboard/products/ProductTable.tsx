// app/dashboard/products/ProductTable.tsx
"use client";

import { useMemo, useState } from "react";

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

export default function ProductTable({ categories, products }: Props) {
  const [items, setItems] = useState<Product[]>(products);

  const [search, setSearch] = useState("");

  // modal state (create + edit share same modal)
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [name, setName] = useState("");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(editingId);

  const selectedCategory = useMemo(
    () => categories.find((c) => c._id === categoryId),
    [categories, categoryId]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((p) => {
      const catName = p.categoryId?.name ?? "";
      return (
        p.name.toLowerCase().includes(term) ||
        catName.toLowerCase().includes(term)
      );
    });
  }, [items, search]);

  // open for create
  const openCreateModal = () => {
    setEditingId(null);
    setCategoryId("");
    setName("");
    setAttributes({});
    setError("");
    setOpen(true);
  };

  // open for edit
  const openEditModal = (prod: Product) => {
    setEditingId(prod._id);
    setCategoryId(prod.categoryId?._id || "");
    setName(prod.name);
    setAttributes(prod.attributes || {});
    setError("");
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
  };

  const handleChangeAttribute = (key: string, value: string) => {
    setAttributes((prev) => ({ ...prev, [key]: value }));
  };

  const handleCategoryChange = (id: string) => {
    setCategoryId(id);
    setAttributes({});
    setError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      setError("Category is required");
      return;
    }
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }

    if (selectedCategory) {
      for (const mf of selectedCategory.metaFields || []) {
        if (mf.required) {
          const val = attributes[mf.key];
          if (!val || !val.trim()) {
            setError(`Field "${mf.label}" is required`);
            return;
          }
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

      const url = isEdit ? `/api/products/${editingId}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to save product");
        setLoading(false);
        return;
      }

      const saved: Product = data.product ?? data;

      setItems((prev) => {
        if (isEdit) {
          return prev.map((p) => (p._id === saved._id ? saved : p));
        }
        return [...prev, saved];
      });

      setOpen(false);
      setLoading(false);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Failed to delete product");
        return;
      }

      setItems((prev) => prev.filter((p) => p._id !== id));
    } catch {
      alert("Something went wrong");
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product / category..."
              className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
            <button
              onClick={openCreateModal}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              New product
            </button>
          </div>
        </div>

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
              {filteredProducts.map((p) => (
                <tr key={p._id}>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {p.categoryId?.name}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    <div className="flex flex-wrap gap-1">
                      {p.categoryId?.metaFields?.map((mf) => (
                        <span
                          key={mf.key}
                          className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200"
                        >
                          {mf.label}:{" "}
                          <span className="ml-1 text-slate-500">
                            {p.attributes?.[mf.key]}
                          </span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={() => openEditModal(p)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p._id)}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    No products yet. Create your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create/Edit product modal */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {isEdit ? "Edit product" : "New product"}
                </h3>
                <p className="text-xs text-slate-500">
                  Choose a category and fill in its attributes.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="space-y-3 max-h-[70vh] overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Product name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. iPhone 16 Cover"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>

              {selectedCategory && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">
                      Attributes for {selectedCategory.name}
                    </label>
                  </div>
                  <div className="space-y-2">
                    {selectedCategory.metaFields.map((mf) => (
                      <div key={mf.key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {mf.label}
                          {mf.required && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={attributes[mf.key] ?? ""}
                          onChange={(e) =>
                            handleChangeAttribute(mf.key, e.target.value)
                          }
                          placeholder={mf.label}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
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