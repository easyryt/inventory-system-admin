"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import jsPDF from "jspdf";

// ---------- Types ----------
type LowStockItem = {
  _id: string;
  productId: string;
  productName: string;
  designCode: string;
  designName: string;
  mode: string;
  quantity: number;
  minThreshold: number;
  deficit: number;
  designUrl: string;
  type: "RAW" | "PRINTED";   // included in API response
};

// ---------- Image URL → Base64 converter ----------
const imageUrlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url, { mode: "cors" });
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};






// ---------- PDF Generator (grid lines + product dividers) ----------
// ---------- PDF Generator (grid lines + product dividers) ----------
const generateLowStockPDF = async (items: LowStockItem[]) => {
  const doc = new jsPDF("p", "mm", "a4");

  // Keep the same product together. Object insertion order retains your current list order.
  const grouped: Record<string, LowStockItem[]> = {};
  for (const item of items) {
    const key = item.productName || "-";
    (grouped[key] ||= []).push(item);
  }

  // Use the image helper already present above this function in your file.
  const imageCache: Record<string, string> = {};
  await Promise.all(
    items.map(async (item) => {
      if (!item.designUrl || imageCache[item.designUrl]) return;
      try {
        imageCache[item.designUrl] = await imageUrlToBase64(item.designUrl);
      } catch {
        // A blocked/broken image should not stop the PDF download.
      }
    })
  );

  // Reference-PDF layout: each side is Design | Design Code | Image | Print QTY.
  const pageW = 210;
  const pageH = 297;
  const marginX = 10;
  const top = 11;
  const bottom = 10;
  const blockGap = 5;
  const availableW = pageW - marginX * 2;
  const blockW = (availableW - blockGap) / 2;
  const designW = 22;
  const codeW = 22;
  const imageW = 23;
  const qtyW = blockW - designW - codeW - imageW;
  const headerH = 9;
  const rowH = 30;
  const sectionGap = 3;
  const rightX = marginX + blockW + blockGap;

  let y = top;
  doc.setDrawColor(185);
  doc.setLineWidth(0.2);

  const cell = (x: number, yy: number, width: number, height: number) => {
    doc.rect(x, yy, width, height);
  };

  // -------------------- UPDATED textInCell (centered) --------------------
  const textInCell = (
    value: string,
    x: number,
    yy: number,
    width: number,
    height: number,
    fontSize: number,
    bold = false
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(0);

    const padding = 1.3;
    const lines = doc.splitTextToSize(value?.trim() || "-", width - padding * 2);
    const lineH = fontSize * 0.48;
    const visible = lines.slice(0, Math.max(1, Math.floor((height - 2) / lineH)));

    // Vertical centering
    const blockHeight = visible.length * lineH;
    const startY = yy + (height - blockHeight) / 2 + lineH * 0.8;

    // Horizontal centering for each line
    visible.forEach((line: string, index: number) => {
      const lineWidth = doc.getTextDimensions(line).w;
      const centerX = x + (width - lineWidth) / 2;
      doc.text(line, centerX, startY + index * lineH);
    });
  };
  // ----------------------------------------------------------------------

  const imageInCell = (base64: string | undefined, x: number, yy: number) => {
    if (!base64) return;
    try {
      const info = doc.getImageProperties(base64);
      const maxW = imageW - 3;
      const maxH = rowH - 3;
      const ratio = Math.min(maxW / info.width, maxH / info.height);
      const w = info.width * ratio;
      const h = info.height * ratio;
      doc.addImage(base64, info.fileType, x + (imageW - w) / 2, yy + (rowH - h) / 2, w, h);
    } catch {
      // Keep the printed grid clean even if one image cannot be embedded.
    }
  };

  const header = (x: number, productName: string) => {
    cell(x, y, designW, headerH);
    cell(x + designW, y, codeW, headerH);
    cell(x + designW + codeW, y, imageW, headerH);
    cell(x + designW + codeW + imageW, y, qtyW, headerH);
    // The product name spans visually across the first three header cells,
    // exactly like the supplied sheet; individual vertical grid lines remain.
    textInCell(productName, x, y, designW + codeW + imageW, headerH, 8.5, true);
    textInCell("Print QTY", x + designW + codeW + imageW, y, qtyW, headerH, 8, true);
  };

  const row = (x: number, item?: LowStockItem) => {
    cell(x, y, designW, rowH);
    cell(x + designW, y, codeW, rowH);
    cell(x + designW + codeW, y, imageW, rowH);
    cell(x + designW + codeW + imageW, y, qtyW, rowH);
    if (!item) return;

    // Design name – bold, font size 9
    textInCell(item.designName || item.designCode || "-", x, y, designW, rowH, 9, true);
    // Design code – smaller font (7), normal weight
    textInCell(item.designCode || "-", x + designW, y, codeW, rowH, 7, false);
    imageInCell(imageCache[item.designUrl], x + designW + codeW, y);
    // Quantity – font size 10, normal weight (centered)
    textInCell(String(item.quantity ?? 0), x + designW + codeW + imageW, y, qtyW, rowH, 10, false);
  };

  const nextPage = () => {
    doc.addPage();
    y = top;
    doc.setDrawColor(185);
    doc.setLineWidth(0.2);
  };

  for (const [productName, productItems] of Object.entries(grouped)) {
    const midpoint = Math.ceil(productItems.length / 2);
    const leftItems = productItems.slice(0, midpoint);
    const rightItems = productItems.slice(midpoint);
    const hasRightBlock = rightItems.length > 0;
    const rows = Math.max(leftItems.length, rightItems.length);
    if (y !== top) nextPage();

    const drawProductHeader = () => {
      header(marginX, productName);
      if (hasRightBlock) header(rightX, productName);
      y += headerH;
    };

    drawProductHeader();
    for (let index = 0; index < rows; index += 1) {
      if (y + rowH > pageH - bottom) {
        nextPage();
        drawProductHeader();
      }
      row(marginX, leftItems[index]);
      if (hasRightBlock) row(rightX, rightItems[index]);
      y += rowH;
    }
    y += sectionGap;
  }

  doc.save("low_stock_print_qty.pdf");
};










// ---------- Main Component ----------
export default function LowStockPage() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "RAW" | "PRINTED">("ALL");
  const [sortField, setSortField] = useState<keyof LowStockItem>("deficit");
  const [sortAsc, setSortAsc] = useState(false);

  // Inline threshold editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---------- Fetch data ----------
  useEffect(() => {
    const fetchLowStock = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/inventory/low-stock");
        if (!res.ok) throw new Error("Failed to load low‑stock data");
        const data = await res.json();
        setItems(data.lowStockItems || []);
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };
    fetchLowStock();
  }, []);

  // ---------- Filtered & sorted list ----------
  const filteredItems = useMemo(() => {
    let result = items;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          item.designName?.toLowerCase().includes(q) ||
          item.designCode.toLowerCase().includes(q) ||
          item.mode?.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (typeFilter !== "ALL") {
      result = result.filter((item) => item.type === typeFilter);
    }

    // Sorting
    result = [...result].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [items, search, typeFilter, sortField, sortAsc]);

  // ---------- Selection handlers ----------
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((item) => item._id)));
    }
  };

  // ---------- PDF generation ----------
  const handleGeneratePDF = async () => {
    const selected =
      selectedIds.size > 0
        ? filteredItems.filter((item) => selectedIds.has(item._id))
        : filteredItems;
    if (selected.length === 0) return;
    setGeneratingPDF(true);
    try {
      await generateLowStockPDF(selected);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGeneratingPDF(false);
    }
  };

  // ---------- Threshold editing ----------
  const startEdit = (item: LowStockItem) => {
    setEditingId(item._id);
    setEditValue(String(item.minThreshold));
    setSaveError(null);
    setSuccessId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setSaveError(null);
  };

  const saveThreshold = async (rowId: string) => {
    const parsed = Number(editValue);
    if (isNaN(parsed) || parsed < 0) {
      setSaveError("Must be a non-negative number");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/inventory/threshold/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minThreshold: parsed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update");
      }
      setItems((prev) =>
        prev.map((item) =>
          item._id === rowId
            ? {
                ...item,
                minThreshold: parsed,
                deficit: Math.max(0, parsed - item.quantity),
              }
            : item
        )
      );
      setSuccessId(rowId);
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
      if (successId) setTimeout(() => setSuccessId(null), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowId: string) => {
    if (e.key === "Enter") saveThreshold(rowId);
    if (e.key === "Escape") cancelEdit();
  };

  // ---------- Sort handler ----------
  const handleSort = (field: keyof LowStockItem) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // ---------- Render ----------
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Low‑Stock Items</h1>
          <p className="text-xs text-slate-500">
            Designs / models that have reached their reorder threshold.
          </p>
        </div>
        <Link
          href="/dashboard/inventory"
          className="text-xs font-medium text-blue-700 hover:underline"
        >
          ← Back to Inventory
        </Link>
      </div>

      {/* Filter Bar: Search + Type + PDF button */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        {/* Search */}
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-slate-500">
            Search
          </label>
          <input
            type="text"
            placeholder="Product, design, or mode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Type Filter */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">
            Inventory Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value="RAW">RAW only</option>
            <option value="PRINTED">PRINTED only</option>
          </select>
        </div>

        {/* Clear filters */}
        <button
          onClick={() => {
            setSearch("");
            setTypeFilter("ALL");
          }}
          className="self-end rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
        >
          Clear
        </button>

        {/* Generate PDF */}
        <button
          onClick={handleGeneratePDF}
          disabled={filteredItems.length === 0 || generatingPDF}
          className="self-end rounded-lg bg-green-600 px-4 py-2 text-xs text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          {generatingPDF
            ? "Generating…"
            : `Generate PDF ${selectedIds.size > 0 ? `(${selectedIds.size})` : "(All)"}`}
        </button>
      </div>

      {/* Loading & error states */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">Loading low‑stock data…</p>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredItems.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">
            {search.trim() || typeFilter !== "ALL"
              ? "No items match your filters."
              : "All stock is above threshold — nothing to worry about! 🎉"}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filteredItems.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === filteredItems.length &&
                      filteredItems.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("productName")}>
                  Product {sortField === "productName" && (sortAsc ? "▲" : "▼")}
                </th>
                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("designName")}>
                  Design {sortField === "designName" && (sortAsc ? "▲" : "▼")}
                </th>
                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("mode")}>
                  Mode {sortField === "mode" && (sortAsc ? "▲" : "▼")}
                </th>
                <th className="p-3">Type</th>
                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("quantity")}>
                  Qty {sortField === "quantity" && (sortAsc ? "▲" : "▼")}
                </th>
                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("minThreshold")}>
                  Min Threshold {sortField === "minThreshold" && (sortAsc ? "▲" : "▼")}
                </th>
                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("deficit")}>
                  Deficit {sortField === "deficit" && (sortAsc ? "▲" : "▼")}
                </th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item._id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item._id)}
                      onChange={() => toggleSelect(item._id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-3 font-medium text-slate-700">{item.productName}</td>
                  <td className="p-3 text-slate-600">{item.designName || item.designCode}</td>
                  <td className="p-3 text-slate-500">{item.mode || "-"}</td>
                  <td className="p-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.type === "RAW"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td className="p-3 text-slate-700">{item.quantity}</td>
                  <td className="p-3">
                    {editingId === item._id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, item._id)}
                          onBlur={() => saveThreshold(item._id)}
                          className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          min="0"
                          step="1"
                          autoFocus
                          disabled={saving}
                        />
                        <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600" title="Cancel">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        className="group flex items-center gap-1 rounded px-1 -mx-1 hover:bg-slate-100"
                      >
                        <span>{item.minThreshold}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300 group-hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                    {successId === item._id && <span className="ml-1 text-green-600">✓</span>}
                    {saveError && editingId === item._id && <span className="ml-1 text-red-600 text-[10px]">{saveError}</span>}
                  </td>
                  <td className={`p-3 font-semibold ${item.deficit > 0 ? "text-red-600" : "text-slate-400"}`}>
                    {item.deficit}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/dashboard/inventory?product=${item.productId}`}
                      className="text-blue-600 hover:underline text-[11px]"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}