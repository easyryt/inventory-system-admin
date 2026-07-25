"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TodayBarcode = {
  id: string;
  code: string;
  designCode: string;
  usedAt: string;
};

type BarcodeReportRow = {
  productId: string;
  productName: string;
  skuBase: string;
  categoryId: string | null;
  generatedTotal: number;
  scannedToday: number;
  totalScanned: number;
  remaining: number;
  todayScannedBarcodes: TodayBarcode[];
};

type ApiResponse = {
  date: string;
  scanDate: string;
  start: string;
  end: string;
  count: number;
  report: BarcodeReportRow[];
};

function useDebouncedValue<T>(value: T, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function BarcodeReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<BarcodeReportRow[]>([]);
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 500);

  const loadReport = useCallback(async (productId?: string) => {
    try {
      setLoading(true);
      setError("");

      const url = productId
        ? `/api/barcodes?productId=${encodeURIComponent(productId)}`
        : `/api/barcodes`;

      const res = await fetch(url, { cache: "no-store" });
      const data: ApiResponse | { message?: string } = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error("message" in data && data.message ? data.message : "Failed to load report");
      }

      const report = "report" in data && Array.isArray(data.report) ? data.report : [];
      setRows(report);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(debouncedSearch.trim() || undefined);
  }, [debouncedSearch, loadReport]);

  const summary = useMemo(() => {
    const scannedToday = rows.reduce((sum, row) => sum + row.scannedToday, 0);
    const remaining = rows.reduce((sum, row) => sum + row.remaining, 0);
    return {
      products: rows.length,
      scannedToday,
      remaining,
    };
  }, [rows]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900">Barcode scan report</h1>
          <p className="text-xs text-slate-500">
            Products scanned today and remaining barcode counts.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by productId"
            className="w-full sm:w-72 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => loadReport(debouncedSearch.trim() || undefined)}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
          Products: {summary.products}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
          Scanned today: {summary.scannedToday}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
          Remaining: {summary.remaining}
        </span>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
          Loading report...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
          No scanned products found today.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="max-h-[34rem] overflow-auto">
            <table className="min-w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Product</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">SKU</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Generated</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Scanned Today</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Remaining</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Today Barcodes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.productId} className="align-top">
                    <td className="px-3 py-3 text-slate-800">{row.productName}</td>
                    <td className="px-3 py-3 text-slate-600">{row.skuBase}</td>
                    <td className="px-3 py-3">{row.generatedTotal}</td>
                    <td className="px-3 py-3 font-medium text-emerald-700">{row.scannedToday}</td>
                    <td className="px-3 py-3 font-medium text-slate-700">{row.remaining}</td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        {row.todayScannedBarcodes.length > 0 ? (
                          row.todayScannedBarcodes.map((b) => (
                            <div
                              key={b.id}
                              className="rounded-lg border border-slate-100 px-2 py-1"
                            >
                              <div className="font-medium text-slate-800">{b.designCode}</div>
                              <div className="break-all text-[10px] text-slate-500">{b.code}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(b.usedAt).toLocaleString()}
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400">No scans today</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}