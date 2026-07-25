"use client";

import { useEffect, useMemo, useState } from "react";

type JobItem = {
  designCode: string;
  quantity: number;
};

type PrintingJob = {
  _id?: string;
  id?: string;
  productId: { _id: string; name: string } | string;
  items: JobItem[];
  totalDemand: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | string;
  notes?: string;
  createdAt: string;
};

type StatusFilter = "ALL" | "PENDING" | "COMPLETED" | "CANCELLED";
type JobStatus = "PENDING" | "COMPLETED" | "CANCELLED";

const getJobId = (job: PrintingJob) => job._id || job.id || "";

const STATUS_META: Record<JobStatus, { label: string; badge: string }> = {
  PENDING: {
    label: "Pending",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  COMPLETED: {
    label: "Completed",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "border-red-200 bg-red-50 text-red-700",
  },
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const statusBadgeClass = (status: string) => {
  const key = status as JobStatus;
  return (
    STATUS_META[key]?.badge || "border-slate-200 bg-slate-50 text-slate-600"
  );
};

const formatDateTime = (value: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

export default function PrintingJobsList() {
  const [jobs, setJobs] = useState<PrintingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [updatingId, setUpdatingId] = useState<string>("");

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showSuccess = (msg: string) =>
    setToast({ type: "success", message: msg });
  const showError = (msg: string) => setToast({ type: "error", message: msg });

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const url = `/api/printing-jobs${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message || "Failed to load printing jobs";
        setError(msg);
        showError(msg);
        return;
      }

      const jobsArr = Array.isArray(data?.jobs)
        ? (data.jobs as PrintingJob[])
        : [];
      setJobs(jobsArr);
    } catch {
      const msg = "Something went wrong while loading printing jobs";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredSummary = useMemo(() => {
    return {
      count: jobs.length,
      filter: statusFilter,
    };
  }, [jobs.length, statusFilter]);

  const handleDelete = async (job: PrintingJob) => {
    const id = getJobId(job);
    if (!id) {
      showError("Missing job id");
      return;
    }

    if (!confirm("Delete this printing job?")) return;

    try {
      setUpdatingId(id);
      const res = await fetch(`/api/printing-jobs/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(data?.message || "Failed to delete job");
        return;
      }

      setJobs((prev) => prev.filter((j) => getJobId(j) !== id));
      showSuccess("Printing job deleted");
    } catch {
      showError("Something went wrong while deleting");
    } finally {
      setUpdatingId("");
    }
  };

  const handleGenerateBarcodes = async (job: PrintingJob, item: JobItem) => {
    const productId =
      typeof job.productId === "string" ? job.productId : job.productId?._id;

    if (!productId) {
      showError("Missing product ID for this printing job");
      return;
    }

    const designCode = item.designCode?.trim().toUpperCase();
    if (!designCode) {
      showError("Missing design code for this item");
      return;
    }

    const quantityInput = window.prompt(
      `How many barcodes to generate for ${designCode}?`,
      String(item.quantity || 1),
    );

    const quantityNum = Number(quantityInput);
    if (!quantityInput || Number.isNaN(quantityNum) || quantityNum <= 0) {
      showError("Quantity must be a positive number");
      return;
    }

    try {
      const res = await fetch("/api/barcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          designCode,
          quantity: quantityNum,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(data?.message || "Failed to generate barcodes");
        return;
      }

      showSuccess(`Barcodes generated for ${designCode} x${quantityNum}`);
    } catch {
      showError("Something went wrong while generating barcodes");
    }
  };

  const handleStatusChange = async (job: PrintingJob, newStatus: JobStatus) => {
    const id = getJobId(job);
    if (!id) {
      showError("Missing job id");
      return;
    }

    if (job.status === newStatus) return;

    try {
      setUpdatingId(id);
      const res = await fetch(`/api/printing-jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(data?.message || "Failed to update status");
        return;
      }

      setJobs((prev) =>
        prev.map((j) => (getJobId(j) === id ? { ...j, status: newStatus } : j)),
      );
      showSuccess("Status updated");
    } catch {
      showError("Something went wrong while updating status");
    } finally {
      setUpdatingId("");
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Printing jobs history
          </h2>
          <p className="text-xs text-slate-500">
            Clean overview of jobs, status updates, and barcode actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-600">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={loadJobs}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
          Showing: {filteredSummary.filter}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
          Total: {filteredSummary.count}
        </span>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
          Loading printing jobs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
          No printing jobs found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="max-h-[34rem] overflow-auto">
            <table className="min-w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Product
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Designs
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Total
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Created
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {jobs.map((job) => {
                  const id = getJobId(job);
                  const productName =
                    typeof job.productId === "string"
                      ? job.productId
                      : job.productId?.name || "-";

                  return (
                    <tr key={id || job.createdAt} className="align-top">
                      <td className="px-3 py-3 text-slate-800">
                        {productName}
                      </td>

                      <td className="px-3 py-3">
                        <div className="space-y-1">
                          {job.items?.length ? (
                            job.items.map((item, idx) => (
                              <div
                                key={`${id}-${item.designCode}-${idx}`}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5"
                              >
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {item.designCode}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Qty: {item.quantity}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleGenerateBarcodes(job, item)
                                  }
                                  className="text-[10px] font-medium text-blue-700 hover:underline"
                                >
                                  Generate Barcodes
                                </button>
                              </div>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              No items
                            </span>
                          )}

                          {job.notes && (
                            <p className="pt-1 text-[10px] text-slate-500">
                              Notes: {job.notes}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-slate-700">
                        {job.totalDemand}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <span
                            className={
                              "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide " +
                              statusBadgeClass(job.status)
                            }
                          >
                            {job.status}
                          </span>

                          <select
                            value={job.status}
                            disabled={!!updatingId}
                            onChange={(e) =>
                              handleStatusChange(
                                job,
                                e.target.value as JobStatus,
                              )
                            }
                            className="w-fit rounded-lg border border-slate-200 px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-100 focus:border-blue-500 disabled:opacity-60"
                          >
                            {Object.keys(STATUS_META).map((s) => (
                              <option key={s} value={s}>
                                {STATUS_META[s as JobStatus].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        {formatDateTime(job.createdAt)}
                      </td>

                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(job)}
                          disabled={!!updatingId || !id}
                          className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}
