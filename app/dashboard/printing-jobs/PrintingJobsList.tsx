"use client";

import { useCallback, useEffect, useState } from "react";

type CategoryPopulated = {
  _id: string;
  name: string;
};

type PopulatedValue = {
  _id: string;
  name: string;
  skuBase?: string;
  mode?: string;
  designCode?: string;
  categoryId?: CategoryPopulated; // Added for product population
};

type PrintingJob = {
  _id: string;
  productId: PopulatedValue | string;
  designId: PopulatedValue | string;
  designCode: string;
  quantity: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  notes?: string;
  inventoryAdded?: boolean;
  createdAt: string;
};

// Extract human‑readable name from populated or plain ID
const getName = (value: PopulatedValue | string | undefined) => {
  if (!value) return "-";
  return typeof value === "string" ? value : value.name;
};

// Extract mode if design is populated
const getMode = (value: PopulatedValue | string | undefined) => {
  if (!value || typeof value === "string") return "";
  return value.mode || "";
};

// Extract category name from a populated product object
const getCategoryName = (value: PopulatedValue | string | undefined) => {
  if (!value || typeof value === "string") return "-";
  return value.categoryId?.name || "-";
};

const getErrorMessage = async (res: Response, fallback: string) => {
  const data = await res.json().catch(() => ({}));
  return data.message || fallback;
};

export default function PrintingJobsList() {
  const [jobs, setJobs] = useState<PrintingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("PENDING");
  const [editNotes, setEditNotes] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/printing-jobs", {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Could not load printing-job history");
      }

      setJobs(data.printingJobs || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load printing-job history",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();

    const refreshList = () => loadJobs();
    window.addEventListener("printing-jobs:changed", refreshList);

    return () => {
      window.removeEventListener("printing-jobs:changed", refreshList);
    };
  }, [loadJobs]);

  const startEdit = (job: PrintingJob) => {
    setEditingId(job._id);
    setEditStatus(job.status);
    setEditNotes(job.notes || "");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditStatus("PENDING");
    setEditNotes("");
  };

  const saveEdit = async (jobId: string) => {
    try {
      setSavingId(jobId);
      setError("");

      const res = await fetch(`/api/printing-jobs/${jobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: editStatus,
          notes: editNotes,
        }),
      });

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Could not update printing job"),
        );
      }

      cancelEdit();
      await loadJobs();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update printing job",
      );
    } finally {
      setSavingId(null);
    }
  };

  const deleteJob = async (job: PrintingJob) => {
    const confirmed = window.confirm(
      `Delete the printing job for ${getName(job.productId)}?`,
    );

    if (!confirmed) return;

    try {
      setDeletingId(job._id);
      setError("");

      const res = await fetch(`/api/printing-jobs/${job._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Could not delete printing job"),
        );
      }

      await loadJobs();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete printing job",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Added Product To Stock History
          </h2>
          <p className="text-xs text-slate-500">
            View, update, or delete pending printing jobs.
          </p>
        </div>

        <button
          onClick={loadJobs}
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="p-3">Category</th>
              <th className="p-3">Product</th>
              <th className="p-3">Model / Design</th>
              <th className="p-3">Quantity</th>
              <th className="p-3">Status</th>
              <th className="p-3">Notes</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500">
                  Loading history...
                </td>
              </tr>
            )}

            {!loading && jobs.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500">
                  No printing jobs found.
                </td>
              </tr>
            )}

            {!loading &&
              jobs.map((job) => {
                const isEditing = editingId === job._id;
                const isFinalStatus =
                  job.status === "COMPLETED" || job.status === "CANCELLED";

                return (
                  <tr key={job._id} className="border-b border-slate-100">
                    {/* Category column */}
                    <td className="p-3 text-xs text-slate-600">
                      {getCategoryName(job.productId)}
                    </td>

                    <td className="p-3 font-medium text-slate-800">
                      {getName(job.productId)}
                    </td>

                    <td className="p-3">
                      <div>{getName(job.designId) || job.designCode}</div>
                      <div className="text-xs text-slate-500">
                        {getMode(job.designId)}
                        {getMode(job.designId) ? " · " : ""}
                        {job.designCode}
                      </div>
                    </td>

                    <td className="p-3">{job.quantity}</td>

                    <td className="p-3">
                      {isEditing ? (
                        <select
                          value={editStatus}
                          disabled={isFinalStatus}
                          onChange={(event) =>
                            setEditStatus(event.target.value)
                          }
                          className="rounded border border-slate-300 p-1.5 text-xs disabled:bg-slate-100"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      ) : (
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            job.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-700"
                              : job.status === "CANCELLED"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {job.status}
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      {isEditing ? (
                        <input
                          value={editNotes}
                          onChange={(event) => setEditNotes(event.target.value)}
                          className="w-48 rounded border border-slate-300 p-1.5 text-xs"
                          placeholder="Optional notes"
                        />
                      ) : (
                        job.notes || "-"
                      )}
                    </td>

                    <td className="p-3 text-xs text-slate-500">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>

                    <td className="p-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(job._id)}
                            disabled={savingId === job._id}
                            className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:bg-slate-400"
                          >
                            {savingId === job._id ? "Saving..." : "Save"}
                          </button>

                          <button
                            onClick={cancelEdit}
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(job)}
                            className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deleteJob(job)}
                            disabled={
                              deletingId === job._id || job.inventoryAdded
                            }
                            title={
                              job.inventoryAdded
                                ? "Inventory-added jobs cannot be deleted"
                                : "Delete printing job"
                            }
                            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === job._id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
