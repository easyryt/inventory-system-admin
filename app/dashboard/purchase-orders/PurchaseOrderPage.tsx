"use client";

import { useEffect, useMemo, useState } from "react";

// ----- Types -----
type Product = {
  id: string;
  name: string;
  categoryName: string;
  rawQuantity: number;
};

type Design = {
  _id: string;
  name: string;
  mode?: string;
  designCode: string;
  designUrl?: string;
  notes?: string;
};

type PurchaseOrderStatus = "PENDING" | "VERIFIED";

type PoItem = {
  productId: string;
  productName: string;
  designId: string;
  designCode: string;
  designName: string;
  orderedQty: string;
};

type ListPOItem = {
  _id: string;
  supplierName: string;
  notes?: string;
  items: {
    productId: string | { _id: string; name: string };
    designId: string;
    designCode: string;
    orderedQty: number;
    receivedQty?: number;
    productName?: string;
    designName?: string;
  }[];
  status: PurchaseOrderStatus;
  textSummary?: string;
  createdAt?: string;
  purchaseDate?: string;
};

type VerifyItem = {
  productId: string;
  designId: string;
  designCode: string;
  productName: string;
  designName: string;
  orderedQty: number;
  receivedQty: string;
};

type ToastState = { type: "success" | "error"; message: string } | null;

const todayDate = () => new Date().toISOString().slice(0, 10);

type Props = {
  products: Product[];
};

// Helper to safely get product ID as string
const getProductId = (productId: string | { _id: string; name?: string }): string => {
  if (typeof productId === 'object' && productId !== null) {
    return productId._id || String(productId);
  }
  return String(productId);
};

// Helper to safely get product name
const getProductName = (productId: string | { _id: string; name?: string }): string => {
  if (typeof productId === 'object' && productId !== null) {
    return productId.name || 'Unknown product';
  }
  return 'Unknown product';
};

// Helper to format date as DD-MM-YYYY
const formatDateForWhatsApp = (date: Date) => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
};

export default function PurchaseOrderPage({ products }: Props) {
  // ---------- Create PO state ----------
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayDate());
  const [items, setItems] = useState<PoItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const [selectedQty, setSelectedQty] = useState("");
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // ---------- List state ----------
  const [purchaseOrders, setPurchaseOrders] = useState<ListPOItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  // ---------- Selection state ----------
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // ---------- Verify modal state ----------
  const [selectedVerifyOrder, setSelectedVerifyOrder] = useState<ListPOItem | null>(null);
  const [verifyItems, setVerifyItems] = useState<VerifyItem[]>([]);
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // ---------- Toast ----------
  const [toast, setToast] = useState<ToastState>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!copiedSummary) return;
    const t = setTimeout(() => setCopiedSummary(false), 2000);
    return () => clearTimeout(t);
  }, [copiedSummary]);

  const showSuccess = (msg: string) => setToast({ type: "success", message: msg });
  const showError = (msg: string) => setToast({ type: "error", message: msg });

  // ---------- Fetch designs ----------
  useEffect(() => {
    if (!selectedProductId) {
      setDesigns([]);
      setSelectedDesignId("");
      return;
    }

    const fetchDesigns = async () => {
      setLoadingDesigns(true);
      try {
        const res = await fetch(`/api/product-designs/product/${selectedProductId}`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setDesigns(data.designs || []);
          if (data.designs?.length > 0) {
            setSelectedDesignId(data.designs[0]._id);
          }
        } else {
          setDesigns([]);
        }
      } catch {
        setDesigns([]);
      } finally {
        setLoadingDesigns(false);
      }
    };

    fetchDesigns();
  }, [selectedProductId]);

  // ---------- Fetch orders ----------
  const fetchPurchaseOrders = async () => {
    try {
      setListLoading(true);
      setListError("");
      const res = await fetch("/api/purchase-orders", {
        credentials: "include",
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || "Failed to load orders";
        setListError(msg);
        showError(msg);
        return;
      }
      setPurchaseOrders(data.purchaseOrders || []);
      // Clear selection after refresh
      setSelectedOrderIds(new Set());
    } catch {
      const msg = "Something went wrong loading orders";
      setListError(msg);
      showError(msg);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  // ---------- Add/remove lines ----------
  const addLine = () => {
    setCreateError("");
    if (!selectedProductId) {
      setCreateError("Select a product");
      showError("Select a product");
      return;
    }
    if (!selectedDesignId) {
      setCreateError("Select a design/model");
      showError("Select a design");
      return;
    }
    const qtyNum = Number(selectedQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setCreateError("Quantity must be > 0");
      showError("Quantity must be > 0");
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) {
      setCreateError("Product not found");
      showError("Product not found");
      return;
    }
    const design = designs.find((d) => d._id === selectedDesignId);
    if (!design) {
      setCreateError("Design not found");
      showError("Design not found");
      return;
    }

    const exists = items.find(
      (i) => i.productId === selectedProductId && i.designId === selectedDesignId
    );
    if (exists) {
      setItems((prev) =>
        prev.map((i) =>
          i.productId === selectedProductId && i.designId === selectedDesignId
            ? { ...i, orderedQty: String(Number(i.orderedQty) + qtyNum) }
            : i
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          designId: design._id,
          designCode: design.designCode,
          designName: design.name,
          orderedQty: String(qtyNum),
        },
      ]);
    }

    setSelectedProductId("");
    setSelectedDesignId("");
    setSelectedQty("");
  };

  const removeLine = (productId: string, designId: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.productId === productId && i.designId === designId))
    );
  };

  // ---------- Create PO ----------
  const handleCreatePo = async () => {
    setCreateError("");
    if (!supplierName.trim()) {
      const msg = "Supplier name is required";
      setCreateError(msg);
      showError(msg);
      return;
    }
    if (items.length === 0) {
      const msg = "Add at least one product/design";
      setCreateError(msg);
      showError(msg);
      return;
    }

    const payload = {
      supplierName: supplierName.trim(),
      notes: notes.trim() || undefined,
      purchaseDate,
      items: items.map((i) => ({
        productId: i.productId,
        designId: i.designId,
        designCode: i.designCode,
        orderedQty: Number(i.orderedQty),
      })),
    };

    try {
      setCreating(true);
      const res = await fetch("/api/purchase-orders", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || "Failed to create PO";
        setCreateError(msg);
        showError(msg);
        return;
      }
      showSuccess("Purchase order created");
      setSupplierName("");
      setNotes("");
      setPurchaseDate(todayDate());
      setItems([]);
      await fetchPurchaseOrders();
    } catch {
      const msg = "Something went wrong while creating PO";
      setCreateError(msg);
      showError(msg);
    } finally {
      setCreating(false);
    }
  };

  // ---------- Verify modal ----------
  const openVerifyModal = (order: ListPOItem) => {
    setSelectedVerifyOrder(order);
    const vItems: VerifyItem[] = (order.items || []).map((it) => {
      const productId = getProductId(it.productId);
      const productName = getProductName(it.productId);

      return {
        productId,
        designId: String(it.designId),
        designCode: it.designCode,
        productName: it.productName || productName,
        designName: it.designName || 'Unknown design',
        orderedQty: it.orderedQty,
        receivedQty: String(it.orderedQty),
      };
    });
    setVerifyItems(vItems);
    setVerifyError("");
  };

  const closeVerifyModal = () => {
    setSelectedVerifyOrder(null);
    setVerifyItems([]);
    setVerifyError("");
  };

  // ---------- Verify PO ----------
  const handleVerify = async () => {
    if (!selectedVerifyOrder) return;
    setVerifyError("");

    for (const it of verifyItems) {
      const qty = Number(it.receivedQty);
      if (isNaN(qty) || qty < 0) {
        setVerifyError("All received quantities must be 0 or more");
        showError("Invalid quantity");
        return;
      }
    }

    const payload = {
      items: verifyItems.map((it) => ({
        productId: it.productId,
        designCode: it.designCode,
        receivedQty: Number(it.receivedQty),
      })),
    };

    try {
      setVerifying(true);
      const res = await fetch(`/api/purchase-orders/${selectedVerifyOrder._id}/verify`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || "Verification failed";
        setVerifyError(msg);
        showError(msg);
        return;
      }
      showSuccess("Order verified & design-specific raw stock updated");
      closeVerifyModal();
      await fetchPurchaseOrders();
      window.location.reload();
    } catch {
      const msg = "Something went wrong during verification";
      setVerifyError(msg);
      showError(msg);
    } finally {
      setVerifying(false);
    }
  };

  // ---------- Update date ----------
  const updatePurchaseOrderDate = async (poId: string, newDate: string) => {
    try {
      setListError("");
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseDate: newDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || "Failed to update date";
        showError(msg);
        return;
      }
      showSuccess("Purchase date updated");
      await fetchPurchaseOrders();
    } catch {
      showError("Something went wrong updating date");
    }
  };

  // ---------- Draft summary for creation form ----------
  const draftSummary = useMemo(() => {
    if (items.length === 0) return "";
    return items
      .map((i) => `${i.productName} - ${i.designName} (${i.designCode}) - ${i.orderedQty}pcs`)
      .join(", ");
  }, [items]);

  const copyDraftSummary = async () => {
    if (!draftSummary) {
      showError("Add at least one product first");
      return;
    }
    try {
      await navigator.clipboard.writeText(draftSummary);
      setCopiedSummary(true);
      showSuccess("Summary copied");
    } catch {
      showError("Clipboard copy failed");
    }
  };

  // ---------- WhatsApp for creation draft ----------
  const openWhatsAppDraft = () => {
    if (!draftSummary) {
      showError("Add at least one product first");
      return;
    }
    const message = encodeURIComponent(draftSummary);
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  };

  // ---------- WhatsApp for selected orders ----------
  const generateWhatsAppMessageFromSelectedOrders = () => {
    if (selectedOrderIds.size === 0) {
      showError("Select at least one order");
      return null;
    }

    // Aggregate quantities by product name
    const productTotals: Record<string, number> = {};

    for (const order of purchaseOrders) {
      if (!selectedOrderIds.has(order._id)) continue;

      for (const item of order.items) {
        const productName = getProductName(item.productId);
        const qty = item.orderedQty || 0;
        if (productName && qty > 0) {
          productTotals[productName] = (productTotals[productName] || 0) + qty;
        }
      }
    }

    // Build message
    const dateLine = formatDateForWhatsApp(new Date());
    const productLines = Object.entries(productTotals)
      .sort((a, b) => a[0].localeCompare(b[0])) // alphabetical
      .map(([name, total]) => `${name} = ${total}`)
      .join('\n');

    return `${dateLine}\n${productLines}`;
  };

  const openWhatsAppSelected = () => {
    const message = generateWhatsAppMessageFromSelectedOrders();
    if (!message) return;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
  };

  // Toggle selection for an order
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedOrderIds.size === purchaseOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(purchaseOrders.map((o) => o._id)));
    }
  };

  // ---------- Render ----------
  return (
    <section className="relative rounded-2xl border border-slate-200 bg-white p-4 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="absolute right-4 top-4 z-10">
          <div
            className={`rounded-xl px-3 py-2 text-xs shadow-sm border ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 pr-24">
        <h2 className="text-sm font-semibold">Purchase Orders</h2>
        <p className="text-xs text-slate-500">
          Create PENDING orders with product+design, then verify to update RAW stock per design.
        </p>
      </div>

      {/* Create PO form */}
      <div className="border border-slate-100 rounded-xl p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Supplier name
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Sadar Bazar Vendor"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. urgent restock"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Purchase date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Design/Model
            </label>
            <select
              value={selectedDesignId}
              onChange={(e) => setSelectedDesignId(e.target.value)}
              disabled={!selectedProductId || loadingDesigns}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              <option value="">
                {loadingDesigns ? "Loading..." : "Select design"}
              </option>
              {designs.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.designCode})
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-32">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Order qty
            </label>
            <input
              type="number"
              min={1}
              value={selectedQty}
              onChange={(e) => setSelectedQty(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            type="button"
            onClick={addLine}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
          >
            Add
          </button>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <h3 className="text-[11px] font-medium text-slate-600 mb-2">Items</h3>
          {items.length === 0 ? (
            <p className="text-[11px] text-slate-400">No items added.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto">
              <table className="min-w-full text-[11px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Product</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Design</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Ordered</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((i) => (
                    <tr key={`${i.productId}-${i.designId}`}>
                      <td className="px-3 py-1.5">{i.productName}</td>
                      <td className="px-3 py-1.5">
                        {i.designName} ({i.designCode})
                      </td>
                      <td className="px-3 py-1.5">{i.orderedQty}</td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(i.productId, i.designId)}
                          className="text-[11px] text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {createError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {createError}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            disabled={creating}
            onClick={handleCreatePo}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create PO"}
          </button>
        </div>
      </div>

      {/* List of all purchase orders with selection */}
      <div className="border border-slate-100 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">All Purchase Orders</h3>
            <button
              type="button"
              onClick={fetchPurchaseOrders}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              disabled={listLoading}
            >
              {listLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openWhatsAppSelected}
              disabled={selectedOrderIds.size === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send WhatsApp ({selectedOrderIds.size})
            </button>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {selectedOrderIds.size === purchaseOrders.length ? "Deselect All" : "Select All"}
            </button>
          </div>
        </div>

        {listError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {listError}
          </p>
        )}

        {purchaseOrders.length === 0 && !listLoading ? (
          <p className="text-xs text-slate-400">No purchase orders found.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.size === purchaseOrders.length && purchaseOrders.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Supplier</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Notes</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Date</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Items</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Status</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {purchaseOrders.map((po) => (
                  <tr key={po._id}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(po._id)}
                        onChange={() => toggleSelectOrder(po._id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{po.supplierName}</td>
                    <td className="px-3 py-2 text-slate-600">{po.notes || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <input
                        type="date"
                        value={po.purchaseDate ? po.purchaseDate.slice(0, 10) : ""}
                        onChange={(e) => updatePurchaseOrderDate(po._id, e.target.value)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-100"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="space-y-1">
                        {(po.items || []).map((it) => {
                          const pName = getProductName(it.productId);
                          const dName = it.designName || it.designCode || "Unknown design";
                          return (
                            <div key={`${String(it.productId)}-${String(it.designId)}`}>
                              {pName} – {dName} – {it.orderedQty} pcs
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${
                          po.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {po.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => openVerifyModal(po)}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-500"
                        >
                          Verify
                        </button>
                      )}
                      {po.status === "VERIFIED" && (
                        <span className="text-[11px] text-slate-400">✅ Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verify Modal */}
      {selectedVerifyOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  Verify Order – {selectedVerifyOrder.supplierName}
                </h3>
                <p className="text-xs text-slate-500">
                  Enter received quantities for each product+design.
                </p>
              </div>
              <button
                type="button"
                onClick={closeVerifyModal}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <table className="min-w-full text-[11px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Product</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Design</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Ordered</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {verifyItems.map((it) => (
                    <tr key={`${it.productId}-${it.designId}`}>
                      <td className="px-3 py-1.5">{it.productName}</td>
                      <td className="px-3 py-1.5">{it.designName} ({it.designCode})</td>
                      <td className="px-3 py-1.5">{it.orderedQty}</td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={it.receivedQty}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setVerifyItems((prev) =>
                              prev.map((v) =>
                                v.productId === it.productId && v.designId === it.designId
                                  ? { ...v, receivedQty: newVal }
                                  : v
                              )
                            );
                          }}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {verifyError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {verifyError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeVerifyModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={verifying}
                onClick={handleVerify}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {verifying ? "Verifying..." : "Confirm Verify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}