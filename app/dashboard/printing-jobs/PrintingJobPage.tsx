"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Category = {
  _id: string;
  name: string;
};

type Product = {
  _id: string;
  name: string;
  skuBase: string;
  categoryId: {
    _id: string;
  };
};

type ProductDesign = {
  _id: string;
  name: string;
  mode: string;
  designCode: string;
};

type Props = {
  categories: Category[];
  products: Product[];
};

const getErrorMessage = async (
  res: Response,
  fallback: string,
) => {
  const data = await res.json().catch(() => ({}));
  return data.message || fallback;
};

/* -------------------------------------------------------------------------- */
/* Searchable Select                                                          */
/* -------------------------------------------------------------------------- */

type SearchableOption = {
  value: string;
  label: string;
  searchText?: string;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
};

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Search...",
  disabled = false,
  required = false,
  loading = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef =
    useRef<HTMLInputElement>(null);

  const selectedOption = options.find(
    (option) => option.value === value,
  );

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return options;
    }

    return options.filter((option) =>
      `${option.label} ${option.searchText || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [options, search]);

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent,
    ) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  useEffect(() => {
    if (open && !disabled) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [open, disabled]);

  const handleSelect = (
    option: SearchableOption,
  ) => {
    onChange(option.value);
    setOpen(false);
    setSearch("");
  };

  const displayText = loading
    ? "Loading..."
    : selectedOption?.label || placeholder;

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      {/* Hidden required field so form validation still works */}
      {required && (
        <input
          tabIndex={-1}
          value={value}
          onChange={() => {}}
          required
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          aria-hidden="true"
        />
      )}

      {/* Main select button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;

          setOpen((previous) => !previous);

          if (open) {
            setSearch("");
          }
        }}
        className={`flex w-full items-center justify-between rounded-md border border-slate-300 bg-white p-2.5 text-left text-sm ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400"
            : "text-slate-800 hover:border-slate-400"
        }`}
      >
        <span
          className={
            selectedOption
              ? "truncate text-slate-800"
              : "truncate text-slate-400"
          }
        >
          {displayText}
        </span>

        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          {/* Search */}
          <div className="border-b border-slate-200 bg-white p-2">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.5 3a5.5 5.5 0 103.446 9.79l3.632 3.632a.75.75 0 101.06-1.06l-3.631-3.632A5.5 5.5 0 008.5 3zM4.5 8.5a4 4 0 118 0 4 4 0 01-8 0z"
                  clipRule="evenodd"
                />
              </svg>

              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Escape"
                  ) {
                    setOpen(false);
                    setSearch("");
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded border border-slate-300 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(
                (option) => {
                  const isSelected =
                    option.value === value;

                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() =>
                        handleSelect(option)
                      }
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {option.label}
                      </span>

                      {isSelected && (
                        <svg
                          className="ml-2 h-4 w-4 shrink-0 text-indigo-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.408 0l-3.75-3.75a1 1 0 011.408-1.42l3.046 3.047 6.546-6.547a1 1 0 011.408 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  );
                },
              )
            ) : (
              <div className="px-3 py-8 text-center text-sm text-slate-400">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function PrintingJobPage({
  categories,
  products,
}: Props) {
  const [categoryId, setCategoryId] =
    useState("");

  const [productId, setProductId] =
    useState("");

  const [designId, setDesignId] =
    useState("");

  const [quantity, setQuantity] =
    useState("");

  const [status, setStatus] =
    useState("PENDING");

  const [notes, setNotes] =
    useState("");

  const [designs, setDesigns] =
    useState<ProductDesign[]>([]);

  const [loadingDesigns, setLoadingDesigns] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* ---------------------------------------------------------------------- */
  /* Products filtered by category                                          */
  /* ---------------------------------------------------------------------- */

  const filteredProducts =
    products.filter(
      (product) =>
        product.categoryId?._id ===
        categoryId,
    );

  /* ---------------------------------------------------------------------- */
  /* Searchable category options                                            */
  /* ---------------------------------------------------------------------- */

  const categoryOptions =
    useMemo<SearchableOption[]>(
      () =>
        categories.map((category) => ({
          value: category._id,
          label: category.name,
        })),
      [categories],
    );

  /* ---------------------------------------------------------------------- */
  /* Searchable product options                                             */
  /* ---------------------------------------------------------------------- */

  const productOptions =
    useMemo<SearchableOption[]>(
      () =>
        filteredProducts.map(
          (product) => ({
            value: product._id,
            label: product.skuBase
              ? `${product.name} (${product.skuBase})`
              : product.name,
            searchText: [
              product.name,
              product.skuBase,
            ]
              .filter(Boolean)
              .join(" "),
          }),
        ),
      [filteredProducts],
    );

  /* ---------------------------------------------------------------------- */
  /* Searchable design options                                              */
  /* ---------------------------------------------------------------------- */

  const designOptions =
    useMemo<SearchableOption[]>(
      () =>
        designs.map((design) => ({
          value: design._id,
          label: `${design.name} — ${design.mode} (${design.designCode})`,
          searchText: [
            design.name,
            design.mode,
            design.designCode,
          ]
            .filter(Boolean)
            .join(" "),
        })),
      [designs],
    );

  /* ---------------------------------------------------------------------- */
  /* Load designs when product changes                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const loadDesigns = async () => {
      setDesignId("");
      setDesigns([]);
      setError("");

      if (!productId) return;

      try {
        setLoadingDesigns(true);

        const res = await fetch(
          `/api/printing-jobs/${productId}?kind=designs`,
          {
            cache: "no-store",
          },
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.message ||
              "Could not load model/design list",
          );
        }

        setDesigns(
          data.designs || [],
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load model/design list",
        );
      } finally {
        setLoadingDesigns(false);
      }
    };

    loadDesigns();
  }, [productId]);

  /* ---------------------------------------------------------------------- */
  /* Category change                                                        */
  /* ---------------------------------------------------------------------- */

  const handleCategoryChange = (
    newCategoryId: string,
  ) => {
    setCategoryId(
      newCategoryId,
    );

    setProductId("");

    setDesignId("");

    setDesigns([]);
  };

  /* ---------------------------------------------------------------------- */
  /* Submit                                                                 */
  /* ---------------------------------------------------------------------- */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !categoryId ||
      !productId ||
      !designId ||
      !quantity
    ) {
      setError(
        "Please select category, product, model/design and quantity.",
      );

      return;
    }

    if (Number(quantity) < 1) {
      setError(
        "Quantity must be at least 1.",
      );

      return;
    }

    try {
      setSaving(true);

      const res =
        await fetch(
          "/api/printing-jobs",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              categoryId,
              productId,
              designId,
              quantity:
                Number(quantity),
              status,
              notes,
            }),
          },
        );

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(
            res,
            "Could not Add Product To Stock",
          ),
        );
      }

      setSuccess(
        status === "COMPLETED"
          ? "Printing completed and stock added to inventory."
          : "Printing job created successfully.",
      );

      setCategoryId("");
      setProductId("");
      setDesignId("");
      setQuantity("");
      setStatus("PENDING");
      setNotes("");
      setDesigns([]);

      window.dispatchEvent(
        new Event(
          "printing-jobs:changed",
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not Add Product To Stock",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* UI                                                                     */
  /* ---------------------------------------------------------------------- */

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-base font-semibold text-slate-800">
        Add Product To Stock
      </h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {/* ---------------------------------------------------------------- */}
        {/* Category                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Category *
          </label>

          <SearchableSelect
            value={categoryId}
            onChange={
              handleCategoryChange
            }
            options={
              categoryOptions
            }
            placeholder="Select category"
            searchPlaceholder="Search category..."
            required
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Product                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Product *
          </label>

          <SearchableSelect
            value={productId}
            onChange={(value) =>
              setProductId(value)
            }
            options={
              productOptions
            }
            disabled={
              !categoryId
            }
            placeholder={
              !categoryId
                ? "Select category first"
                : "Select product"
            }
            searchPlaceholder="Search product or SKU..."
            required
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Model / Design                                                    */}
        {/* ---------------------------------------------------------------- */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Model / Design *
          </label>

          <SearchableSelect
            value={designId}
            onChange={(value) =>
              setDesignId(value)
            }
            options={
              designOptions
            }
            disabled={
              !productId ||
              loadingDesigns
            }
            loading={
              loadingDesigns
            }
            placeholder={
              !productId
                ? "Select product first"
                : loadingDesigns
                  ? "Loading designs..."
                  : "Select model/design"
            }
            searchPlaceholder="Search model, mode or design code..."
            required
          />

          {productId &&
            !loadingDesigns &&
            designs.length === 0 && (
              <p className="mt-1 text-xs text-red-600">
                No active model/design
                found for this product.
              </p>
            )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Quantity                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Quantity *
          </label>

          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) =>
              setQuantity(
                e.target.value,
              )
            }
            placeholder="Enter quantity"
            className="w-full rounded-md border border-slate-300 p-2.5 text-sm"
            required
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Status                                                            */}
        {/* ---------------------------------------------------------------- */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Initial Status *
          </label>

          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value,
              )
            }
            className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm"
          >
            <option value="PENDING">
              Pending
            </option>

            <option value="COMPLETED">
              Completed
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Notes                                                             */}
        {/* ---------------------------------------------------------------- */}

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Notes{" "}
            <span className="font-normal text-slate-400">
              (optional)
            </span>
          </label>

          <textarea
            rows={3}
            value={notes}
            onChange={(e) =>
              setNotes(
                e.target.value,
              )
            }
            placeholder="Example: Blue ink required"
            className="w-full rounded-md border border-slate-300 p-2.5 text-sm"
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Submit                                                            */}
        {/* ---------------------------------------------------------------- */}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={
              saving ||
              !designId
            }
            className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving
              ? "Saving..."
              : "Add Product to Stock"}
          </button>
        </div>
      </form>
    </section>
  );
}

