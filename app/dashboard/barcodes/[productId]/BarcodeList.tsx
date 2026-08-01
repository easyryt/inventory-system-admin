"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BarcodeRow = { _id: string; code: string; designCode: string; status: "AVAILABLE" | "USED"; createdAt: string; usedAt?: string | null };
export type BarcodeDesignGroup = { _id: string; productName: string; designName: string; mode: string; designCode: string; designUrl?: string; rows: BarcodeRow[] };
type Props = {
  /** Pass every model/design with its barcode rows. */
  designs?: BarcodeDesignGroup[];
  /** Backward-compatible props for your existing one-design page. */
  design?: string;
  rows?: BarcodeRow[];
};
type StatusFilter = "ALL" | "AVAILABLE" | "USED";
type ViewMode = "grid" | "list";
const LABELS_PER_PAGE = 162;

const formatDate = (value: string) => { const date = new Date(value); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; };
const escapeHtml = (value: string) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export default function BarcodeList({ designs, design, rows }: Props) {
  const router = useRouter();
  const groups = useMemo<BarcodeDesignGroup[]>(() => designs?.length ? designs : design ? [{ _id: design, productName: design, designName: design, mode: "-", designCode: design, rows: rows ?? [] }] : [], [designs, design, rows]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const selected = groups.find((group) => group._id === selectedId) ?? null;
  const designSearch = search.trim().toLowerCase();
  const shownGroups = groups.filter((group) => !designSearch || [group.productName, group.designName, group.designCode].some((value) => value.toLowerCase().includes(designSearch)));
  // The API can return the same barcode more than once. Keep the last copy
  // for each database id so cards and React keys are always unique.
  const barcodes = Array.from(
    new Map((selected?.rows ?? []).map((barcode) => [barcode._id, barcode])).values(),
  );
  const shownBarcodes = barcodes.filter((barcode) => (statusFilter === "ALL" || barcode.status === statusFilter) && (!designSearch || barcode.code.toLowerCase().includes(designSearch) || barcode.designCode.toLowerCase().includes(designSearch)));
  const available = barcodes.filter((barcode) => barcode.status === "AVAILABLE").length;
  const used = barcodes.length - available;

  const updateStatus = async (barcode: BarcodeRow) => {
    const status = barcode.status === "AVAILABLE" ? "USED" : "AVAILABLE";
    setLoadingId(barcode._id); setError("");
    try {
      const response = await fetch(`/api/barcodes/${barcode._id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update barcode status.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update barcode status."); }
    finally { setLoadingId(null); }
  };

  const print = (toPrint: BarcodeRow[]) => {
    if (!selected || toPrint.length === 0) return setError("No barcodes match the selected filter.");
    try {
      const labels = toPrint.map((barcode) => {
        const qr = document.getElementById(`qr-${barcode._id}`)?.innerHTML;
        if (!qr) throw new Error("QR codes are still loading. Please try again.");
        return `<div class="label"><b>${escapeHtml(selected.designName)}</b><div>${qr}</div><code>${escapeHtml(barcode.code)}</code></div>`;
      });
      const pages = Array.from({ length: Math.ceil(labels.length / LABELS_PER_PAGE) }, (_, index) => `<section class="page"><div class="grid">${labels.slice(index * LABELS_PER_PAGE, (index + 1) * LABELS_PER_PAGE).join("")}</div><small>Page ${index + 1}</small></section>`).join("");
      const popup = window.open("", "_blank", "width=1100,height=850");
      if (!popup) throw new Error("Popup blocked. Allow popups to print barcode labels.");
      popup.document.write(`<!doctype html><html><head><title>Barcode Labels</title><style>@page{size:A4 portrait;margin:4mm}*{box-sizing:border-box}body{margin:0;font-family:Arial}.page{width:202mm;min-height:289mm;page-break-after:always;position:relative}.page:last-child{page-break-after:auto}.grid{display:grid;grid-template-columns:repeat(9,22mm);grid-auto-rows:15.5mm;gap:.4mm}.label{border:.15mm dashed #ccc;padding:.3mm;text-align:center;overflow:hidden;font-size:4.2pt}.label b,.label code{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.label svg{width:11.5mm!important;height:11.5mm!important}.label code{font-size:3.3pt}.page small{position:absolute;right:0;bottom:-3mm;font-size:5pt}</style></head><body>${pages}<script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
      popup.document.close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare barcode labels."); }
  };

  if (selected) return <div className="space-y-4">
    <button type="button" onClick={() => { setSelectedId(null); setSearch(""); setStatusFilter("ALL"); }} className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">← All models & designs</button>
    <header className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3">{selected.designUrl && <img src={selected.designUrl} alt="" className="h-16 w-16 rounded-lg border object-cover" />}<div><p className="text-xs text-slate-500">{selected.productName}</p><h1 className="text-lg font-semibold text-slate-900">{selected.designName}</h1><p className="font-mono text-xs text-slate-600">{selected.designCode}</p><p className="mt-1 text-xs text-slate-500">Mode: {selected.mode}</p></div></div><div className="flex gap-3 text-xs"><span>Total: <b>{barcodes.length}</b></span><span className="text-emerald-700">Available: <b>{available}</b></span><span>Used: <b>{used}</b></span></div></div></header>
    {error && <p className="rounded bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_160px_auto]"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search barcode code..." className="rounded border border-slate-300 bg-white px-3 py-2 text-xs" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded border border-slate-300 bg-white px-3 py-2 text-xs"><option value="ALL">All statuses</option><option value="AVAILABLE">Available only</option><option value="USED">Used only</option></select><button type="button" onClick={() => print(shownBarcodes)} className="rounded bg-slate-800 px-4 py-2 text-xs font-medium text-white">Print filtered ({shownBarcodes.length})</button></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shownBarcodes.map((barcode) => <article key={barcode._id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-2"><div id={`qr-${barcode._id}`} className="rounded border bg-white p-1"><QRCodeSVG value={barcode.code} size={92} level="L" includeMargin={false} /></div><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${barcode.status === "AVAILABLE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{barcode.status}</span></div><code className="mt-2 block break-all text-[11px]">{barcode.code}</code><p className="mt-1 text-[10px] text-slate-500">Created {formatDate(barcode.createdAt)}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => print([barcode])} className="rounded border px-2 py-1 text-[11px]">Print one</button><button type="button" onClick={() => updateStatus(barcode)} disabled={loadingId === barcode._id} className="rounded border border-indigo-300 px-2 py-1 text-[11px] text-indigo-700 disabled:opacity-50">{loadingId === barcode._id ? "Updating..." : barcode.status === "AVAILABLE" ? "Mark used" : "Mark available"}</button></div></article>)}</div>
    {shownBarcodes.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No barcodes match this filter.</p>}
  </div>;

  return <div className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-lg font-semibold text-slate-900">Barcode manager</h1><p className="text-xs text-slate-500">Select a model/design to manage all of its barcodes.</p></div><div className="flex rounded-lg border bg-white p-1"><button type="button" onClick={() => setViewMode("grid")} className={`rounded px-3 py-1.5 text-xs ${viewMode === "grid" ? "bg-slate-800 text-white" : "text-slate-600"}`}>Grid</button><button type="button" onClick={() => setViewMode("list")} className={`rounded px-3 py-1.5 text-xs ${viewMode === "list" ? "bg-slate-800 text-white" : "text-slate-600"}`}>List</button></div></header>
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search model, design name, or design code..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
    {viewMode === "grid" ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shownGroups.map((group) => { const free = group.rows.filter((row) => row.status === "AVAILABLE").length; return <button type="button" key={group._id} onClick={() => { setSelectedId(group._id); setSearch(""); }} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-400 hover:ring-2 hover:ring-blue-100">{group.designUrl ? <img src={group.designUrl} alt="" className="h-16 w-14 rounded border object-cover" /> : <div className="grid h-16 w-14 place-items-center rounded bg-slate-100 text-xs text-slate-400">No image</div>}<span className="min-w-0"><span className="block text-[11px] text-slate-500">{group.productName}</span><strong className="block truncate text-sm text-slate-800">{group.designName}</strong><code className="block truncate text-[11px] text-slate-600">{group.designCode}</code><span className="mt-2 block text-xs text-emerald-700">{free} available / {group.rows.length} total</span></span></button>; })}</div> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Model</th><th className="p-3">Design</th><th className="p-3">Code</th><th className="p-3">Barcodes</th><th className="p-3"></th></tr></thead><tbody>{shownGroups.map((group) => <tr key={group._id} className="border-t"><td className="p-3">{group.productName}</td><td className="p-3 font-medium">{group.designName}</td><td className="p-3 font-mono">{group.designCode}</td><td className="p-3">{group.rows.filter((row) => row.status === "AVAILABLE").length} available / {group.rows.length}</td><td className="p-3"><button type="button" onClick={() => { setSelectedId(group._id); setSearch(""); }} className="rounded border px-3 py-1 text-xs">Open barcodes</button></td></tr>)}</tbody></table></div>}
    {shownGroups.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No models or designs found.</p>}
  </div>;
}
