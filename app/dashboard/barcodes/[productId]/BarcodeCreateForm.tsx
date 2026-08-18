"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type ProductDesign = {
  _id: string;
  name: string;
  mode: string;
  designCode: string;
  designUrl?: string | null;
};

type Props = {
  productId: string;
  designs: ProductDesign[];
};

export default function BarcodeCreateForm({
  productId,
  designs,
}: Props) {
  const router = useRouter();

  const [designId, setDesignId] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // Selected design
  // ============================================================
  const selectedDesign = useMemo(() => {
    return designs.find(
      (design) => design._id === designId
    );
  }, [designs, designId]);

  // ============================================================
  // Filter designs
  // Search by:
  // - name
  // - mode
  // - designCode
  // ============================================================
  const filteredDesigns = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return designs;
    }

    return designs.filter((design) => {
      return (
        design.name
          .toLowerCase()
          .includes(query) ||
        design.mode
          .toLowerCase()
          .includes(query) ||
        design.designCode
          .toLowerCase()
          .includes(query)
      );
    });
  }, [designs, search]);

  // ============================================================
  // Close dropdown when clicking outside
  // ============================================================
  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // ============================================================
  // Select design
  // ============================================================
  const handleSelectDesign = (
    design: ProductDesign
  ) => {
    setDesignId(design._id);
    setOpen(false);
    setSearch("");
    setError("");
  };

  // ============================================================
  // Submit
  // ============================================================
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!designId) {
      setError("Select a model/design first.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        "/api/barcodes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId,
            designId,
          }),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.message ||
            "Could not generate barcodes"
        );
      }

      setMessage(
        `${
          data.barcodeCount ||
          data.barcodes?.length ||
          0
        } barcode(s) generated successfully.`
      );

      setDesignId("");
      setSearch("");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate barcodes"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      {/* ========================================================
          HEADER
      ========================================================= */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-800">
          Generate Barcodes
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          Select the model/design. Barcodes are generated
          automatically for its unlabelled PRINTED stock.
        </p>
      </div>

      {/* ========================================================
          ERROR
      ========================================================= */}
      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* ========================================================
          SUCCESS
      ========================================================= */}
      {message && (
        <div className="mb-3 rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        {/* ======================================================
            SEARCHABLE SELECT
        ======================================================= */}
        <div
          ref={dropdownRef}
          className="relative md:col-span-2"
        >
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Model / Design *
          </label>

          {/* ====================================================
              SELECT BUTTON
          ===================================================== */}
          <button
            type="button"
            disabled={designs.length === 0}
            onClick={() => {
              setOpen((current) => !current);
              setSearch("");
              setError("");
            }}
            className={`flex w-full items-center justify-between rounded-md border bg-white p-2 text-left text-sm outline-none transition ${
              open
                ? "border-indigo-500 ring-2 ring-indigo-100"
                : "border-slate-300"
            } ${
              designs.length === 0
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "text-slate-800 hover:border-slate-400"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              {/* Selected image */}
              {selectedDesign?.designUrl ? (
                <img
                  src={selectedDesign.designUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-md border border-slate-200 object-cover"
                />
              ) : (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-[9px] font-semibold text-slate-400">
                  IMG
                </div>
              )}

              {/* Selected text */}
              <span className="min-w-0 truncate">
                {selectedDesign ? (
                  <>
                    {selectedDesign.name} —{" "}
                    {selectedDesign.mode} (
                    {selectedDesign.designCode})
                  </>
                ) : (
                  "Select model/design"
                )}
              </span>
            </div>

            <svg
              className={`ml-2 h-4 w-4 shrink-0 transition-transform ${
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

          {/* ====================================================
              DROPDOWN
          ===================================================== */}
          {open && designs.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              {/* ==================================================
                  SEARCH
              =================================================== */}
              <div className="border-b border-slate-200 p-2">
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setOpen(false);
                      setSearch("");
                    }
                  }}
                  placeholder="Search model, mode or design code..."
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* ==================================================
                  RESULT COUNT
              =================================================== */}
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-[11px] text-slate-500">
                  {filteredDesigns.length} of{" "}
                  {designs.length} model/design
                  {designs.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* ==================================================
                  OPTIONS
              =================================================== */}
              <div className="max-h-80 overflow-y-auto">
                {filteredDesigns.length > 0 ? (
                  filteredDesigns.map((design) => {
                    const isSelected =
                      design._id === designId;

                    return (
                      <button
                        key={design._id}
                        type="button"
                        onClick={() =>
                          handleSelectDesign(
                            design
                          )
                        }
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                          isSelected
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {/* ==================================================
                            DESIGN IMAGE
                        =================================================== */}
                        {design.designUrl ? (
                          <img
                            src={design.designUrl}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-md border border-slate-200 bg-white object-cover"
                          />
                        ) : (
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-slate-100 text-[9px] font-semibold text-slate-400">
                            NO IMAGE
                          </div>
                        )}

                        {/* ==================================================
                            DESIGN INFORMATION
                        =================================================== */}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {design.name}
                          </span>

                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                            {design.mode} ·{" "}
                            {design.designCode}
                          </span>
                        </span>

                        {/* ==================================================
                            SELECTED CHECK
                        =================================================== */}
                        {isSelected && (
                          <svg
                            className="h-4 w-4 shrink-0 text-indigo-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 5.296a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.97 2.97 6.97-6.97a.75.75 0 011.06 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      No model/design found
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Try another search term.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ====================================================
              NO DESIGNS
          ===================================================== */}
          {designs.length === 0 && (
            <p className="mt-1 text-[11px] text-red-600">
              No active model/design exists for this product.
            </p>
          )}
        </div>

        {/* ======================================================
            SUBMIT
        ======================================================= */}
        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={
              loading ||
              designs.length === 0
            }
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading
              ? "Generating..."
              : "Generate Barcodes"}
          </button>
        </div>
      </form>
    </section>
  );
}