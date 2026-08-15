"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type InventoryProduct = {
  id: string;
  name: string;
  categoryName: string;
  rawQuantity: number;
  printedQuantity: number;
  minThreshold: number;
};

type Props = {
  products: InventoryProduct[];
};

type Notice = {
  productId: string;
  kind: "error" | "success";
  message: string;
};

const isLowStock = (product: InventoryProduct) =>
  product.minThreshold > 0 &&
  product.rawQuantity <= product.minThreshold;

export default function InventoryList({
  products,
}: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] =
    useState(false);

  const [quantities, setQuantities] =
    useState<Record<string, string>>({});

  const [addingProductId, setAddingProductId] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...products]
      .filter((product) => {
        const matchesSearch =
          !query ||
          product.name
            .toLowerCase()
            .includes(query) ||
          product.categoryName
            .toLowerCase()
            .includes(query);

        return (
          matchesSearch &&
          (!showLowStockOnly ||
            isLowStock(product))
        );
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [
    products,
    search,
    showLowStockOnly,
  ]);

  const addRawStock = async (
    event: FormEvent<HTMLFormElement>,
    product: InventoryProduct
  ) => {
    event.preventDefault();

    const quantity = Number(
      quantities[product.id]
    );

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      setNotice({
        productId: product.id,
        kind: "error",
        message:
          "Enter a positive whole-number quantity.",
      });

      return;
    }

    try {
      setAddingProductId(product.id);
      setNotice(null);

      const response = await fetch(
        "/api/inventory/raw",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId: product.id,
            quantity,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not add RAW stock."
        );
      }

      setQuantities((current) => ({
        ...current,
        [product.id]: "",
      }));

      setNotice({
        productId: product.id,
        kind: "success",
        message: `${quantity} RAW units added to ${product.name}.`,
      });

      router.refresh();
    } catch (error) {
      setNotice({
        productId: product.id,
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not add RAW stock.",
      });
    } finally {
      setAddingProductId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-600">
              Inventory by model
            </p>

            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              Phone models
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Add RAW stock here. Open a model
              only when you need its designs,
              labels, or stock details.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/inventory/low-stock"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
            >
              Low-stock report
            </Link>

            <Link
              href="/dashboard/purchase-orders"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Purchase orders
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">
              Search models
            </span>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search model, for example iPhone 11"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(event) =>
                setShowLowStockOnly(
                  event.target.checked
                )
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />

            Needs attention
          </label>
        </div>
      </section>

      {/* Inventory list */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Desktop header */}
        <div className="hidden grid-cols-[minmax(190px,1.3fr)_110px_110px_110px_minmax(250px,1fr)_128px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid">
          <span>Model</span>

          <span className="text-center">
            RAW stock
          </span>

          <span className="text-center">
            Printed
          </span>

          <span className="text-center">
            Total
          </span>

          <span>Add RAW stock</span>

          <span className="text-right">
            Open
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">
              No models found.
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Try a different search or clear
              the attention filter.
            </p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const lowStock =
              isLowStock(product);

            const isAdding =
              addingProductId === product.id;

            const modelNotice =
              notice?.productId === product.id
                ? notice
                : null;

            // RAW + PRINTED = TOTAL
            const totalQuantity =
              Number(product.rawQuantity || 0) +
              Number(product.printedQuantity || 0);

            return (
              <article
                key={product.id}
                className="grid gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(190px,1.3fr)_110px_110px_110px_minmax(250px,1fr)_128px] lg:items-center lg:px-5"
              >
                {/* Model */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-slate-900">
                      {product.name}
                    </h2>

                    {lowStock && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        Low RAW stock
                      </span>
                    )}
                  </div>

                  {product.categoryName &&
                    product.categoryName !== "-" && (
                      <p className="mt-1 text-xs text-slate-500">
                        {product.categoryName}
                      </p>
                    )}
                </div>

                {/* RAW stock */}
                <div className="lg:text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 lg:hidden">
                    RAW stock
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800 lg:mt-0">
                    {product.rawQuantity}
                  </p>

                  {product.minThreshold > 0 && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Min.{" "}
                      {product.minThreshold}
                    </p>
                  )}
                </div>

                {/* Printed */}
                <div className="lg:text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 lg:hidden">
                    Printed stock
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800 lg:mt-0">
                    {product.printedQuantity}
                  </p>
                </div>

                {/* Total */}
                <div className="lg:text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 lg:hidden">
                    Total stock
                  </p>

                  <p className="mt-1 text-base font-bold text-indigo-700 lg:mt-0">
                    {totalQuantity}
                  </p>

                  <p className="mt-0.5 text-[10px] text-slate-400">
                    RAW + Printed
                  </p>
                </div>

                {/* Add RAW stock */}
                <form
                  onSubmit={(event) =>
                    addRawStock(
                      event,
                      product
                    )
                  }
                  className="flex flex-wrap items-start gap-2"
                >
                  <label className="min-w-[132px] flex-1">
                    <span className="sr-only">
                      RAW quantity for{" "}
                      {product.name}
                    </span>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={
                        quantities[
                          product.id
                        ] ?? ""
                      }
                      onChange={(event) =>
                        setQuantities(
                          (current) => ({
                            ...current,
                            [product.id]:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="Quantity"
                      disabled={isAdding}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isAdding}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                  >
                    {isAdding
                      ? "Adding..."
                      : "Add RAW"}
                  </button>

                  {modelNotice && (
                    <p
                      className={`basis-full text-xs ${
                        modelNotice.kind ===
                        "success"
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {modelNotice.message}
                    </p>
                  )}
                </form>

                {/* Open details */}
                <div className="lg:text-right">
                  <Link
                    href={`/dashboard/inventory/${product.id}`}
                    className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    View details
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
