"use client";

import { useEffect, useMemo, useState } from "react";

type ProductForPo = {
  id: string;
  name: string;
  categoryName: string;
  rawQuantity: number;
};

type PurchaseOrderStatus = "PENDING" | "CREATED" | "VERIFIED" | "PARTIAL";

type PoItem = {
  productId: string;
  name: string;
  currentRaw: number;
  orderedQty: string;
};

type CreatedPoItem = {
  productId: string;
  orderedQty: number;
  receivedQty?: number;
  productName?: string;
};

type CreatedPO = {
  _id: string;
  supplierName: string;
  notes?: string;
  items: CreatedPoItem[];
  status?: PurchaseOrderStatus;
  textSummary?: string;
  createdAt?: string;
  purchaseDate?: string;
};

type VerifyItem = {
  productId: string;
  productName: string;
  orderedQty: number;
  receivedQty: string;
};

type Props = {
  products: ProductForPo[];
};

type ToastState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type ListPOItem = {
  _id: string;
  supplierName: string;
  notes?: string;
  items: CreatedPoItem[];
  status: PurchaseOrderStatus;
  textSummary?: string;
  createdAt?: string;
  purchaseDate?: string;
};

const STATUS_OPTIONS: PurchaseOrderStatus[] = [
  "PENDING",
  "CREATED",
  "VERIFIED",
  "PARTIAL",
];

const todayDate = () => new Date().toISOString().slice(0, 10);

const formatDate = (date?: string) => {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB");
};

export default function PurchaseOrderPage({ products }: Props) {
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<PurchaseOrderStatus>("PENDING");
  const [purchaseDate, setPurchaseDate] = useState(todayDate());
  const [items, setItems] = useState<PoItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQty, setSelectedQty] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [createdPO, setCreatedPO] = useState<CreatedPO | null>(null);
  const [verifyItems, setVerifyItems] = useState<VerifyItem[]>([]);
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [purchaseOrders, setPurchaseOrders] = useState<ListPOItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingDateId, setUpdatingDateId] = useState<string | null>(null);

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

  const showSuccess = (message: string) => setToast({ type: "success", message });
  const showError = (message: string) => setToast({ type: "error", message });

  const resetVerifyState = () => {
    setCreatedPO(null);
    setVerifyItems([]);
    setVerifyError("");
  };

  const fetchPurchaseOrders = async () => {
    try {
      setListLoading(true);
      setListError("");

      const res = await fetch("/api/purchase-orders", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message || "Failed to load purchase orders";
        setListError(msg);
        showError(msg);
        return;
      }

      setPurchaseOrders((data?.purchaseOrders || []) as ListPOItem[]);
    } catch {
      const msg = "Something went wrong while loading purchase orders";
      setListError(msg);
      showError(msg);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const addLine = () => {
    setCreateError("");
    setVerifyError("");
    resetVerifyState();

    if (!selectedProductId) {
      const msg = "Select a product";
      setCreateError(msg);
      showError("Select a product before adding to the list");
      return;
    }

    const qtyNum = Number(selectedQty);
    if (Number.isNaN(qtyNum) || qtyNum <= 0) {
      const msg = "Quantity must be greater than 0";
      setCreateError(msg);
      showError("Order quantity must be greater than 0");
      return;
    }

    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) {
      const msg = "Product not found";
      setCreateError(msg);
      showError("Selected product not found");
      return;
    }

    const existsIndex = items.findIndex((i) => i.productId === selectedProductId);
    if (existsIndex >= 0) {
      setItems((prev) =>
        prev.map((i, idx) =>
          idx === existsIndex
            ? { ...i, orderedQty: String(Number(i.orderedQty) + qtyNum) }
            : i
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          currentRaw: prod.rawQuantity,
          orderedQty: String(qtyNum),
        },
      ]);
    }

    setSelectedProductId("");
    setSelectedQty("");
  };

  const removeLine = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    resetVerifyState();
  };

  const handleCreatePo = async () => {
    setCreateError("");
    setVerifyError("");
    resetVerifyState();

    if (!supplierName.trim()) {
      const msg = "Supplier name is required";
      setCreateError(msg);
      showError(msg);
      return;
    }

    if (items.length === 0) {
      const msg = "Add at least one product to the purchase order";
      setCreateError(msg);
      showError(msg);
      return;
    }

    const payload = {
      supplierName: supplierName.trim(),
      notes: notes.trim() || undefined,
      status,
      purchaseDate,
      items: items.map((i) => ({
        productId: i.productId,
        orderedQty: Number(i.orderedQty),
      })),
    };

    try {
      setCreating(true);

      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message || "Failed to create purchase order";
        setCreateError(msg);
        showError(msg);
        return;
      }

      const po: CreatedPO = data.purchaseOrder ?? data;
      setCreatedPO(po);

      const vItems: VerifyItem[] = (po.items || []).map((it) => {
        const fallbackProduct = products.find((p) => p.id === String(it.productId));
        const productName = it.productName || fallbackProduct?.name || "Unknown product";

        return {
          productId: String(it.productId),
          productName,
          orderedQty: it.orderedQty,
          receivedQty: String(it.orderedQty),
        };
      });

      setVerifyItems(vItems);
      showSuccess("Purchase order created successfully");
      await fetchPurchaseOrders();
    } catch {
      const msg = "Something went wrong while creating the PO";
      setCreateError(msg);
      showError(msg);
    } finally {
      setCreating(false);
    }
  };

  const changeReceivedQty = (productId: string, value: string) => {
    setVerifyItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, receivedQty: value } : it))
    );
  };

  const handleVerifyPo = async () => {
    if (!createdPO) return;

    setVerifyError("");

    const payload = {
      items: verifyItems.map((it) => ({
        productId: it.productId,
        receivedQty: Number(it.receivedQty),
      })),
    };

    for (const i of payload.items) {
      if (Number.isNaN(i.receivedQty) || i.receivedQty < 0) {
        const msg = "Received quantities must be 0 or more";
        setVerifyError(msg);
        showError(msg);
        return;
      }
    }

    try {
      setVerifying(true);

      const res = await fetch(`/api/purchase-orders/${createdPO._id}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message || "Failed to verify purchase order";
        setVerifyError(msg);
        showError(msg);
        return;
      }

      showSuccess("Purchase order verified and inventory updated");
      setCreatedPO(data.purchaseOrder ?? createdPO);
      await fetchPurchaseOrders();
    } catch {
      const msg = "Something went wrong while verifying the PO";
      setVerifyError(msg);
      showError(msg);
    } finally {
      setVerifying(false);
    }
  };

  const updatePurchaseOrderStatus = async (poId: string, newStatus: PurchaseOrderStatus) => {
    try {
      setUpdatingStatusId(poId);
      setListError("");

      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message || "Failed to update status";
        showError(msg);
        setListError(msg);
        return;
      }

      showSuccess("Purchase order status updated");
      await fetchPurchaseOrders();

      if (createdPO?._id === poId) {
        setCreatedPO((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }
    } catch {
      const msg = "Something went wrong while updating status";
      showError(msg);
      setListError(msg);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const updatePurchaseOrderDate = async (poId: string, newDate: string) => {
    try {
      setUpdatingDateId(poId);
      setListError("");

      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purchaseDate: newDate }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message || "Failed to update purchase date";
        showError(msg);
        setListError(msg);
        return;
      }

      showSuccess("Purchase date updated");
      await fetchPurchaseOrders();

      if (createdPO?._id === poId) {
        setCreatedPO((prev) => (prev ? { ...prev, purchaseDate: newDate } : prev));
      }
    } catch {
      const msg = "Something went wrong while updating purchase date";
      showError(msg);
      setListError(msg);
    } finally {
      setUpdatingDateId(null);
    }
  };

  const draftSummary = useMemo(() => {
    if (items.length === 0) return "";
    return items.map((i) => `${i.name} - ${i.orderedQty}pcs`).join(", ");
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

  const openWhatsApp = () => {
    if (!draftSummary) {
      showError("Add at least one product first");
      return;
    }

    const message = encodeURIComponent(draftSummary);
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const selectedStatusLabel = useMemo(() => status, [status]);

  return (
    <section className="relative rounded-2xl border border-slate-200 bg-white p-4 space-y-5">
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

      <div className="flex flex-col gap-1 pr-24">
        <h2 className="text-sm font-semibold">Purchase Orders</h2>
        <p className="text-xs text-slate-500">
          Create a purchase order, set purchase date and status, verify received stock, and update later.
        </p>
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600">
          Live RAW stock snapshot
        </div>
        <div className="max-h-40 overflow-y-auto">
          <table className="min-w-full text-[11px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Product</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Category</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">RAW qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-1.5">{p.name}</td>
                  <td className="px-3 py-1.5 text-slate-500">{p.categoryName}</td>
                  <td className="px-3 py-1.5">{p.rawQuantity}</td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-slate-100 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-700">Draft Text Generation</h3>
            <p className="text-[11px] text-slate-500">
              Click Create to generate a clean vendor text summary.
            </p>
          </div>
          <button
            type="button"
            onClick={copyDraftSummary}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Copy
          </button>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {draftSummary || "iPhone 16 - 350pcs, iPhone 11 - 50pcs"}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyDraftSummary}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Create
          </button>
          <button
            type="button"
            onClick={openWhatsApp}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Send on WhatsApp
          </button>
        </div>

        {copiedSummary && (
          <p className="text-[11px] text-emerald-700">Summary copied to clipboard.</p>
        )}
      </div>

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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>

          <div className="w-full sm:w-40">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Current create status: <span className="font-medium text-slate-700">{selectedStatusLabel}</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={addLine}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
          >
            Add to list
          </button>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <h3 className="text-[11px] font-medium text-slate-600 mb-2">
            Purchase order items
          </h3>

          {items.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              No items yet. Add products above.
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto">
              <table className="min-w-full text-[11px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">
                      Product
                    </th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">
                      Current RAW
                    </th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">
                      Ordered qty
                    </th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((i) => (
                    <tr key={i.productId}>
                      <td className="px-3 py-1.5">{i.name}</td>
                      <td className="px-3 py-1.5">{i.currentRaw}</td>
                      <td className="px-3 py-1.5">{i.orderedQty}</td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(i.productId)}
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
            {creating ? "Creating PO..." : "Create Purchase Order"}
          </button>
        </div>
      </div>

      {createdPO && (
        <div className="border border-emerald-100 rounded-xl p-3 space-y-3 bg-emerald-50/40">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-emerald-800">
                Verify received stock
              </h3>
              <p className="text-[11px] text-emerald-800">
                <span className="font-medium">Supplier:</span> {createdPO.supplierName}
              </p>
              {createdPO.notes && (
                <p className="text-[11px] text-emerald-800">
                  <span className="font-medium">Notes:</span> {createdPO.notes}
                </p>
              )}
              <p className="text-[11px] text-emerald-800">
                <span className="font-medium">Status:</span>{" "}
                {createdPO.status || "PENDING"}
              </p>
              <p className="text-[11px] text-emerald-800">
                <span className="font-medium">Purchase date:</span>{" "}
                {formatDate(createdPO.purchaseDate)}
              </p>
              <p className="text-[11px] text-emerald-700">
                PO ID: <span className="font-mono">{createdPO._id}</span>
              </p>
            </div>
          </div>

          <div className="border border-emerald-100 rounded-lg overflow-hidden bg-white">
            <table className="min-w-full text-[11px]">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-3 py-2 text-left text-emerald-700 font-medium">
                    Product
                  </th>
                  <th className="px-3 py-2 text-left text-emerald-700 font-medium">
                    Ordered
                  </th>
                  <th className="px-3 py-2 text-left text-emerald-700 font-medium">
                    Received
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verifyItems.map((it) => (
                  <tr key={it.productId}>
                    <td className="px-3 py-1.5">{it.productName}</td>
                    <td className="px-3 py-1.5">{it.orderedQty}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={it.receivedQty}
                        onChange={(e) =>
                          changeReceivedQty(it.productId, e.target.value)
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-100 focus:border-blue-500"
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

          <div className="flex justify-end">
            <button
              type="button"
              disabled={verifying}
              onClick={handleVerifyPo}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {verifying ? "Verifying..." : "Verify & Update RAW"}
            </button>
          </div>
        </div>
      )}

      <div className="border border-slate-100 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
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
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Supplier</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Notes</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Date</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Items</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Status</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {purchaseOrders.map((po) => (
                  <tr key={po._id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{po.supplierName}</td>
                    <td className="px-3 py-2 text-slate-600">{po.notes || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <input
                        type="date"
                        value={po.purchaseDate ? po.purchaseDate.slice(0, 10) : ""}
                        onChange={(e) => updatePurchaseOrderDate(po._id, e.target.value)}
                        disabled={updatingDateId === po._id}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-100 focus:border-blue-500 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="space-y-1">
                        {(po.items || []).map((it) => {
                          const fallback = products.find((p) => p.id === String(it.productId));
                          const name = it.productName || fallback?.name || "Unknown";
                          return (
                            <div key={String(it.productId)}>
                              {name} - {it.orderedQty} pcs
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-1 text-[10px] font-medium " +
                          (po.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-700"
                            : po.status === "PARTIAL"
                            ? "bg-amber-100 text-amber-700"
                            : po.status === "CREATED"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700")
                        }
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={po.status}
                        disabled={updatingStatusId === po._id}
                        onChange={(e) =>
                          updatePurchaseOrderStatus(
                            po._id,
                            e.target.value as PurchaseOrderStatus
                          )
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-100 focus:border-blue-500 disabled:opacity-60"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}