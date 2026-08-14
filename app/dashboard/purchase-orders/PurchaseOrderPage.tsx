"use client";

import { useEffect, useState } from "react";

export type ProductForPurchaseOrder = {
  id: string;
  name: string;
  categoryName: string;
  rawQuantity: number;
};

type ProductReference = string | { _id: string; name?: string };

type PurchaseOrderItem = {
  productId: ProductReference;
  orderedQty: number;
  receivedQty?: number;
};

export type ListPurchaseOrder = {
  _id: string;
  supplierName: string;
  notes?: string;
  items: PurchaseOrderItem[];
  status: "PENDING" | "VERIFIED";
  textSummary?: string;
  createdAt?: string;
  purchaseDate?: string;
};

type DraftItem = {
  productId: string;
  productName: string;
  orderedQty: number;
};

type VerifyItem = DraftItem & {
  receivedQty: string;
};

type ToastKind = "success" | "error";
type Toast = { kind: ToastKind; message: string } | null;

type Props = {
  products: ProductForPurchaseOrder[];
  initialPurchaseOrders: ListPurchaseOrder[];
};

const today = () => new Date().toISOString().slice(0, 10);

const getProductId = (value: ProductReference) =>
  typeof value === "string" ? value : value._id;

const getProductName = (
  value: ProductReference,
  products: ProductForPurchaseOrder[],
) => {
  if (typeof value !== "string") return value.name || "Unknown product";
  return products.find((product) => product.id === value)?.name || "Unknown product";
};

const formatOrderDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const formatWhatsAppDate = (date = new Date()) =>
  `${String(date.getDate()).padStart(2, "0")}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}-${date.getFullYear()}`;

export default function PurchaseOrderPage({
  products,
  initialPurchaseOrders,
}: Props) {
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [purchaseOrders, setPurchaseOrders] = useState(initialPurchaseOrders);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const [verifyOrder, setVerifyOrder] = useState<ListPurchaseOrder | null>(null);
  const [verifyItems, setVerifyItems] = useState<VerifyItem[]>([]);
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = (kind: ToastKind, message: string) =>
    setToast({ kind, message });

  const loadPurchaseOrders = async () => {
    try {
      setLoadingOrders(true);
      setOrdersError("");

      const response = await fetch("/api/purchase-orders", {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not load purchase orders.");
      }

      setPurchaseOrders(Array.isArray(data.purchaseOrders) ? data.purchaseOrders : []);
      setSelectedOrderIds(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load purchase orders.";
      setOrdersError(message);
      showToast("error", message);
    } finally {
      setLoadingOrders(false);
    }
  };

  const addProductLine = () => {
    setCreateError("");
    const quantity = Number(selectedQuantity);
    const product = products.find((item) => item.id === selectedProductId);

    if (!product) {
      setCreateError("Select a product first.");
      return;
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setCreateError("Quantity must be a positive whole number.");
      return;
    }

    setDraftItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (!existing) {
        return [...current, { productId: product.id, productName: product.name, orderedQty: quantity }];
      }

      return current.map((item) =>
        item.productId === product.id
          ? { ...item, orderedQty: item.orderedQty + quantity }
          : item,
      );
    });
    setSelectedProductId("");
    setSelectedQuantity("");
  };

  const removeDraftItem = (productId: string) =>
    setDraftItems((current) => current.filter((item) => item.productId !== productId));

  const createPurchaseOrder = async () => {
    setCreateError("");

    if (!supplierName.trim()) {
      setCreateError("Supplier name is required.");
      return;
    }
    if (draftItems.length === 0) {
      setCreateError("Add at least one product and quantity.");
      return;
    }

    try {
      setCreating(true);
      const response = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplierName.trim(),
          notes: notes.trim(),
          purchaseDate,
          items: draftItems.map((item) => ({
            productId: item.productId,
            orderedQty: item.orderedQty,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not create the purchase order.");
      }

      setSupplierName("");
      setNotes("");
      setPurchaseDate(today());
      setDraftItems([]);
      showToast("success", "Purchase order created.");
      await loadPurchaseOrders();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create the purchase order.";
      setCreateError(message);
      showToast("error", message);
    } finally {
      setCreating(false);
    }
  };

  const groupedItems = (order: ListPurchaseOrder): DraftItem[] => {
    const grouped = new Map<string, DraftItem>();

    for (const item of order.items || []) {
      const productId = getProductId(item.productId);
      const existing = grouped.get(productId);
      const orderedQty = Number(item.orderedQty || 0);

      grouped.set(productId, {
        productId,
        productName: getProductName(item.productId, products),
        orderedQty: (existing?.orderedQty || 0) + orderedQty,
      });
    }

    return [...grouped.values()];
  };

  const openVerify = (order: ListPurchaseOrder) => {
    setVerifyOrder(order);
    setVerifyItems(
      groupedItems(order).map((item) => ({
        ...item,
        receivedQty: String(item.orderedQty),
      })),
    );
    setVerifyError("");
  };

  const closeVerify = () => {
    if (verifying) return;
    setVerifyOrder(null);
    setVerifyItems([]);
    setVerifyError("");
  };

  const verifyPurchaseOrder = async () => {
    if (!verifyOrder) return;

    for (const item of verifyItems) {
      const quantity = Number(item.receivedQty);
      if (!Number.isSafeInteger(quantity) || quantity < 0) {
        setVerifyError("Each received quantity must be a whole number of 0 or more.");
        return;
      }
    }

    try {
      setVerifying(true);
      setVerifyError("");

      const response = await fetch(`/api/purchase-orders/${verifyOrder._id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: verifyItems.map((item) => ({
            productId: item.productId,
            receivedQty: Number(item.receivedQty),
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not verify this purchase order.");
      }

      closeVerify();
      showToast("success", "Order verified. RAW stock has been added by product.");
      await loadPurchaseOrders();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not verify this purchase order.";
      setVerifyError(message);
      showToast("error", message);
    } finally {
      setVerifying(false);
    }
  };

  const updatePurchaseOrderDate = async (orderId: string, newPurchaseDate: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseDate: newPurchaseDate }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not update the purchase date.");
      }

      showToast("success", "Purchase date updated.");
      await loadPurchaseOrders();
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Could not update the purchase date.",
      );
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleAllOrders = () => {
    setSelectedOrderIds((current) =>
      current.size === purchaseOrders.length
        ? new Set()
        : new Set(purchaseOrders.map((order) => order._id)),
    );
  };

  const buildSelectedOrderSummary = () => {
    const quantities = new Map<string, number>();

    for (const order of purchaseOrders) {
      if (!selectedOrderIds.has(order._id)) continue;
      for (const item of groupedItems(order)) {
        quantities.set(item.productName, (quantities.get(item.productName) || 0) + item.orderedQty);
      }
    }

    return [...quantities.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([name, quantity]) => `${name} = ${quantity}`)
      .join("\n");
  };

  const sendSelectedToWhatsApp = () => {
    const selectedOrderSummary = buildSelectedOrderSummary();
    if (!selectedOrderSummary) {
      showToast("error", "Select at least one purchase order first.");
      return;
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${formatWhatsAppDate()}\n${selectedOrderSummary}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <section className="relative space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {toast && (
        <div
          role="status"
          className={`fixed right-5 top-5 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-600">
          Product-only purchasing
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Purchase orders</h2>
        <p className="mt-1 text-sm text-slate-500">
          Select a phone model and quantity. When verified, the received quantity is added to that model&apos;s RAW stock.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_170px]">
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-700">Supplier name *</span>
            <input
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              placeholder="e.g. Sadar Bazar Vendor"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-700">Notes</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional note"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-700">Purchase date</span>
            <input
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-[1fr_160px_auto] md:items-end">
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-700">Product *</span>
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-700">Order quantity *</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={selectedQuantity}
              onChange={(event) => setSelectedQuantity(event.target.value)}
              placeholder="e.g. 100"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <button
            type="button"
            onClick={addProductLine}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add product
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_120px_auto] gap-3 bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Product</span><span>Quantity</span><span />
          </div>
          {draftItems.length === 0 ? (
            <p className="px-3 py-5 text-sm text-slate-500">Choose a product and add its quantity.</p>
          ) : (
            draftItems.map((item) => (
              <div key={item.productId} className="grid grid-cols-[1fr_120px_auto] items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{item.productName}</span>
                <span className="text-slate-700">{item.orderedQty}</span>
                <button type="button" onClick={() => removeDraftItem(item.productId)} className="text-xs font-medium text-rose-600 hover:underline">Remove</button>
              </div>
            ))
          )}
        </div>

        {createError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</p>}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={createPurchaseOrder}
            disabled={creating}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {creating ? "Creating..." : "Create purchase order"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h3 className="font-semibold text-slate-900">All purchase orders</h3>
            <p className="mt-0.5 text-xs text-slate-500">Verify an order after stock has arrived.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadPurchaseOrders} disabled={loadingOrders} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {loadingOrders ? "Loading..." : "Refresh"}
            </button>
            <button type="button" onClick={sendSelectedToWhatsApp} disabled={selectedOrderIds.size === 0} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              Send WhatsApp ({selectedOrderIds.size})
            </button>
          </div>
        </div>

        {ordersError && <p className="m-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{ordersError}</p>}

        {purchaseOrders.length === 0 && !loadingOrders ? (
          <p className="p-8 text-center text-sm text-slate-500">No purchase orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[830px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3"><input type="checkbox" checked={purchaseOrders.length > 0 && selectedOrderIds.size === purchaseOrders.length} onChange={toggleAllOrders} aria-label="Select all purchase orders" /></th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((order) => (
                  <tr key={order._id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedOrderIds.has(order._id)} onChange={() => toggleOrderSelection(order._id)} aria-label={`Select order from ${order.supplierName}`} /></td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{order.supplierName}</p>{order.notes && <p className="mt-1 text-xs text-slate-500">{order.notes}</p>}</td>
                    <td className="px-4 py-3"><input type="date" value={formatOrderDate(order.purchaseDate)} onChange={(event) => updatePurchaseOrderDate(order._id, event.target.value)} disabled={order.status !== "PENDING"} className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:border-transparent disabled:bg-transparent" /></td>
                    <td className="px-4 py-3"><div className="space-y-1.5">{groupedItems(order).map((item) => <p key={item.productId} className="text-sm text-slate-700"><span className="font-medium">{item.productName}</span><span className="text-slate-500"> · {item.orderedQty} pcs</span></p>)}</div></td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${order.status === "VERIFIED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{order.status}</span></td>
                    <td className="px-4 py-3 text-right">{order.status === "PENDING" ? <button type="button" onClick={() => openVerify(order)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">Verify</button> : <span className="text-xs text-slate-400">RAW added</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {verifyOrder && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onClick={closeVerify}>
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-600">Verify arrival</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{verifyOrder.supplierName}</h3>
                <p className="mt-1 text-sm text-slate-500">Enter what was received. This will be added to each product&apos;s RAW stock.</p>
              </div>
              <button type="button" onClick={closeVerify} disabled={verifying} className="rounded-md p-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close verification">×</button>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[1fr_100px_110px] gap-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span>Product</span><span>Ordered</span><span>Received</span></div>
              {verifyItems.map((item) => (
                <div key={item.productId} className="grid grid-cols-[1fr_100px_110px] items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-sm">
                  <span className="font-medium text-slate-800">{item.productName}</span>
                  <span className="text-slate-600">{item.orderedQty}</span>
                  <input type="number" min="0" step="1" inputMode="numeric" value={item.receivedQty} onChange={(event) => setVerifyItems((current) => current.map((currentItem) => currentItem.productId === item.productId ? { ...currentItem, receivedQty: event.target.value } : currentItem))} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                </div>
              ))}
            </div>

            {verifyError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{verifyError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeVerify} disabled={verifying} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={verifyPurchaseOrder} disabled={verifying} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300">{verifying ? "Verifying..." : "Confirm and add RAW stock"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
