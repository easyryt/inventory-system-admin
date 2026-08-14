"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BarcodeRow = {
  _id: string;
  code: string;
  designCode: string;
  status: "AVAILABLE" | "USED";
  createdAt: string;
  usedAt?: string | null;
};

export type BarcodeDesignGroup = {
  _id: string;
  productName: string;
  designName: string;
  mode: string;
  designCode: string;
  designUrl?: string;
  rows: BarcodeRow[];
};

type Props = {
  designs?: BarcodeDesignGroup[] | null;
};

type StatusFilter = "ALL" | "AVAILABLE" | "USED";
type ViewMode = "grid" | "list";

// The TE244 supports a 104 mm printable width. Four 25 mm labels plus three
// 1 mm gutters fit on a 104 mm wide roll (103 mm total).
const LABELS_PER_ROW = 4;
const LABEL_SIZE_MM = 25;
const LABEL_GAP_MM = 1;
const ROLL_WIDTH_MM = 104;

const formatDate = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const escapeHtml = (value: string) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default function BarcodeManager({ designs = [] }: Props) {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const safeGroups = Array.isArray(designs) ? designs : [];

  const selected = safeGroups.find((group) => group._id === selectedId) ?? null;

  const normalizedSearch = search.trim().toLowerCase();

  const shownGroups = useMemo(() => {
    return safeGroups.filter((group) => {
      if (!normalizedSearch) return true;

      return [
        group.productName,
        group.designName,
        group.designCode,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
    });
  }, [safeGroups, normalizedSearch]);

  const barcodes = useMemo(() => {
    const rows = Array.isArray(selected?.rows) ? selected.rows : [];

    return Array.from(
      new Map(rows.map((barcode) => [barcode._id, barcode])).values(),
    );
  }, [selected]);

  const shownBarcodes = useMemo(() => {
    return barcodes.filter((barcode) => {
      const matchesStatus =
        statusFilter === "ALL" || barcode.status === statusFilter;

      const matchesSearch =
        !normalizedSearch ||
        barcode.code.toLowerCase().includes(normalizedSearch) ||
        barcode.designCode.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [barcodes, statusFilter, normalizedSearch]);

  const available = barcodes.filter(
    (barcode) => barcode.status === "AVAILABLE",
  ).length;

  const used = barcodes.length - available;

  const updateStatus = async (barcode: BarcodeRow) => {
    const status = barcode.status === "AVAILABLE" ? "USED" : "AVAILABLE";

    try {
      setLoadingId(barcode._id);
      setError("");

      const response = await fetch(`/api/barcodes/${barcode._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not update barcode status.");
      }

      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update barcode status.",
      );
    } finally {
      setLoadingId(null);
    }
  };

  const print = (toPrint: BarcodeRow[]) => {
    if (!selected || toPrint.length === 0) {
      setError("No barcodes match the selected filter.");
      return;
    }

    try {
      setError("");

      const rows = Array.from(
        { length: Math.ceil(toPrint.length / LABELS_PER_ROW) },
        (_, rowIndex) => {
          const start = rowIndex * LABELS_PER_ROW;
          const labels = toPrint
            .slice(start, start + LABELS_PER_ROW)
            .map((barcode) => {
              const qr = document.getElementById(`qr-${barcode._id}`)?.innerHTML;

              if (!qr) {
                throw new Error("QR codes are still loading. Please try again.");
              }

              return `
                <div class="label">
                  <div class="qr">${qr}</div>
                  <code>${escapeHtml(barcode.code)}</code>
                </div>
              `;
            })
            .join("");

          return `<section class="print-row"><div class="grid">${labels}</div></section>`;
        },
      ).join("");

      const popup = window.open("", "_blank", "width=1100,height=850");

      if (!popup) {
        throw new Error("Popup blocked. Allow popups to print barcode labels.");
      }

      popup.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Four-up 25 mm Barcode Labels</title>
            <style>
              @page { size: ${ROLL_WIDTH_MM}mm ${LABEL_SIZE_MM}mm; margin: 0; }
              * { box-sizing: border-box; }
              html, body { margin: 0; padding: 0; background: white; font-family: Arial, sans-serif; }
              body { width: ${ROLL_WIDTH_MM}mm; }
              .print-row {
                width: ${ROLL_WIDTH_MM}mm;
                height: ${LABEL_SIZE_MM}mm;
                break-after: page;
                page-break-after: always;
              }
              .print-row:last-child { break-after: auto; page-break-after: auto; }
              .grid {
                display: grid;
                grid-template-columns: repeat(${LABELS_PER_ROW}, ${LABEL_SIZE_MM}mm);
                column-gap: ${LABEL_GAP_MM}mm;
              }
              .label {
                width: ${LABEL_SIZE_MM}mm;
                height: ${LABEL_SIZE_MM}mm;
                padding: 0.7mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                border: 0.15mm dashed #d1d5db;
              }
              .qr {
                width: 19mm;
                height: 19mm;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .qr svg {
                width: 18mm !important;
                height: 18mm !important;
              }
              .label code {
                width: 100%;
                margin-top: 0.4mm;
                overflow: hidden;
                text-align: center;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-family: "Courier New", monospace;
                font-size: 3.1pt;
                font-weight: 700;
              }
              @media print { .label { border: none; } }
            </style>
          </head>
          <body>
            ${rows}
            <script>
              window.addEventListener("load", function () {
                setTimeout(function () { window.print(); }, 300);
              });
            </script>
          </body>
        </html>
      `);

      popup.document.close();
      popup.focus();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not prepare barcode labels.",
      );
    }
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setSearch("");
            setStatusFilter("ALL");
          }}
          className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
        >
          ← All models & designs
        </button>

        <header className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              {selected.designUrl && (
                <img
                  src={selected.designUrl}
                  alt={selected.designName}
                  className="h-16 w-16 rounded-lg border object-cover"
                />
              )}

              <div>
                <p className="text-xs text-slate-500">{selected.productName}</p>
                <h1 className="text-lg font-semibold">{selected.designName}</h1>
                <p className="font-mono text-xs text-slate-600">
                  {selected.designCode}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Mode: {selected.mode}
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-xs">
              <span>Total: <b>{barcodes.length}</b></span>
              <span className="text-emerald-700">
                Available: <b>{available}</b>
              </span>
              <span>Used: <b>{used}</b></span>
            </div>
          </div>
        </header>

        {error && (
          <p className="rounded bg-red-50 p-3 text-xs text-red-700">{error}</p>
        )}

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_160px_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search barcode code..."
            className="rounded border border-slate-300 bg-white px-3 py-2 text-xs"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-xs"
          >
            <option value="ALL">All statuses</option>
            <option value="AVAILABLE">Available only</option>
            <option value="USED">Used only</option>
          </select>

          <button
            type="button"
            onClick={() => print(shownBarcodes)}
            className="rounded bg-slate-800 px-4 py-2 text-xs font-medium text-white"
          >
            Print filtered ({shownBarcodes.length})
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shownBarcodes.map((barcode) => (
            <article
              key={barcode._id}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  id={`qr-${barcode._id}`}
                  className="rounded border bg-white p-1"
                >
                  <QRCodeSVG
                    value={barcode.code}
                    size={92}
                    level="L"
                    includeMargin={false}
                  />
                </div>

                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    barcode.status === "AVAILABLE"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {barcode.status}
                </span>
              </div>

              <code className="mt-2 block break-all text-[11px]">
                {barcode.code}
              </code>

              <p className="mt-1 text-[10px] text-slate-500">
                Created {formatDate(barcode.createdAt)}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => print([barcode])}
                  className="rounded border px-2 py-1 text-[11px]"
                >
                  Print one
                </button>

                <button
                  type="button"
                  onClick={() => updateStatus(barcode)}
                  disabled={loadingId === barcode._id}
                  className="rounded border border-indigo-300 px-2 py-1 text-[11px] text-indigo-700 disabled:opacity-50"
                >
                  {loadingId === barcode._id
                    ? "Updating..."
                    : barcode.status === "AVAILABLE"
                      ? "Mark used"
                      : "Mark available"}
                </button>
              </div>
            </article>
          ))}
        </div>

        {shownBarcodes.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            No barcodes match this filter.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Barcode manager
          </h1>
          <p className="text-xs text-slate-500">
            Select a model/design to manage its barcodes.
          </p>
        </div>

        <div className="flex rounded-lg border bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded px-3 py-1.5 text-xs ${
              viewMode === "grid"
                ? "bg-slate-800 text-white"
                : "text-slate-600"
            }`}
          >
            Grid
          </button>

          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded px-3 py-1.5 text-xs ${
              viewMode === "list"
                ? "bg-slate-800 text-white"
                : "text-slate-600"
            }`}
          >
            List
          </button>
        </div>
      </header>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search model, design name, or design code..."
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
      />

      {viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shownGroups.map((group) => {
            const rows = Array.isArray(group.rows) ? group.rows : [];
            const free = rows.filter(
              (row) => row.status === "AVAILABLE",
            ).length;

            return (
              <button
                type="button"
                key={group._id}
                onClick={() => {
                  setSelectedId(group._id);
                  setSearch("");
                }}
                className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-400"
              >
                {group.designUrl ? (
                  <img
                    src={group.designUrl}
                    alt={group.designName}
                    className="h-16 w-14 rounded border object-cover"
                  />
                ) : (
                  <div className="grid h-16 w-14 place-items-center rounded bg-slate-100 text-xs text-slate-400">
                    No image
                  </div>
                )}

                <span className="min-w-0">
                  <span className="block text-[11px] text-slate-500">
                    {group.productName}
                  </span>
                  <strong className="block truncate text-sm text-slate-800">
                    {group.designName}
                  </strong>
                  <code className="block truncate text-[11px] text-slate-600">
                    {group.designCode}
                  </code>
                  <span className="mt-2 block text-xs text-emerald-700">
                    {free} available / {rows.length} total
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Model</th>
                <th className="p-3">Design</th>
                <th className="p-3">Code</th>
                <th className="p-3">Barcodes</th>
                <th className="p-3" />
              </tr>
            </thead>

            <tbody>
              {shownGroups.map((group) => {
                const rows = Array.isArray(group.rows) ? group.rows : [];
                const free = rows.filter(
                  (row) => row.status === "AVAILABLE",
                ).length;

                return (
                  <tr key={group._id} className="border-t">
                    <td className="p-3">{group.productName}</td>
                    <td className="p-3 font-medium">{group.designName}</td>
                    <td className="p-3 font-mono">{group.designCode}</td>
                    <td className="p-3">
                      {free} available / {rows.length}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(group._id);
                          setSearch("");
                        }}
                        className="rounded border px-3 py-1 text-xs"
                      >
                        Open barcodes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {shownGroups.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">
          No models or designs found.
        </p>
      )}
    </div>
  );
}
