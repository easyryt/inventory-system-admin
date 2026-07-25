"use client";

import { useState } from "react";

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

type Props = {
  categories: Category[];
};

const fieldTypes = ["string", "number", "boolean"] as const;

export default function CategoryTable({ categories }: Props) {
  const [items, setItems] = useState<Category[]>(
    Array.isArray(categories) ? categories : []
  );
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [metaFields, setMetaFields] = useState<MetaField[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(editingId);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setMetaFields([]);
    setError("");
    setOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat._id);
    setName(cat.name);
    setMetaFields(cat.metaFields || []);
    setError("");
    setOpen(true);
  };

  const addMetaField = () => {
    setMetaFields((prev) => [
      ...prev,
      { key: "", label: "", type: "string", required: false },
    ]);
  };

  const updateMetaField = (
    index: number,
    field: keyof MetaField,
    value: string | boolean
  ) => {
    setMetaFields((prev) =>
      prev.map((mf, i) => (i === index ? { ...mf, [field]: value } : mf))
    );
  };

  const removeMetaField = (index: number) => {
    setMetaFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    for (const mf of metaFields) {
      if (!mf.key.trim() || !mf.label.trim()) {
        setError("All meta fields must have key and label");
        return;
      }
      if (/\s/.test(mf.key)) {
        setError(`Key "${mf.key}" cannot contain spaces`);
        return;
      }
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        name: name.trim(),
        metaFields,
      };

      const url = isEdit
        ? `/api/categories/${editingId}`
        : "/api/categories";

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
        setError(data.message || "Failed to save category");
        setLoading(false);
        return;
      }

      const saved: Category = data.category ?? data;

      setItems((prev) => {
        if (isEdit) {
          return prev.map((c) => (c._id === saved._id ? saved : c));
        } else {
          return [...prev, saved];
        }
      });

      setOpen(false);
      setLoading(false);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;

    try{
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        // optionally read error json
        alert("Failed to delete category");
        return;
      }

      setItems((prev) => prev.filter((c) => c._id !== id));
    } catch {
      alert("Something went wrong");
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Category list</h2>
            <p className="text-xs text-slate-500">
              Each category can have its own dynamic attributes (meta fields).
            </p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            New category
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Meta fields
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c._id}>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {c.metaFields && c.metaFields.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.metaFields.map((mf) => (
                          <span
                            key={mf.key}
                            className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200"
                          >
                            {mf.label}
                            <span className="ml-1 text-[10px] text-slate-400">
                              ({mf.type}
                              {mf.required ? ", req" : ""})
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        No meta fields
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c._id)}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    No categories yet. Create your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal for create/edit (re-use same form) */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {isEdit ? "Edit category" : "New category"}
                </h3>
                <p className="text-xs text-slate-500">
                  Define a category and its dynamic meta fields.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
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
                  Category name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mobile Covers, Charms"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">
                    Meta fields
                  </label>
                  <button
                    type="button"
                    onClick={addMetaField}
                    className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                  >
                    + Add field
                  </button>
                </div>

                <div className="space-y-2 mt-1">
                  {metaFields.map((mf, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row gap-2 items-start sm:items-center border border-slate-100 rounded-lg p-2"
                    >
                      <input
                        type="text"
                        value={mf.key}
                        onChange={(e) =>
                          updateMetaField(index, "key", e.target.value)
                        }
                        placeholder="key (e.g. brand)"
                        className="w-full sm:w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                      />
                      <input
                        type="text"
                        value={mf.label}
                        onChange={(e) =>
                          updateMetaField(index, "label", e.target.value)
                        }
                        placeholder="Label (e.g. Brand)"
                        className="w-full sm:flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                      />
                      <select
                        value={mf.type}
                        onChange={(e) =>
                          updateMetaField(index, "type", e.target.value)
                        }
                        className="w-full sm:w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                      >
                        {fieldTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={mf.required}
                          onChange={(e) =>
                            updateMetaField(
                              index,
                              "required",
                              e.target.checked
                            )
                          }
                          className="h-3 w-3"
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={() => removeMetaField(index)}
                        className="text-[11px] text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

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
                  : "Create category"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}