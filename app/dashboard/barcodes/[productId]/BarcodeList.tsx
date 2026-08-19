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

  /*
   * Optional fields.
   * These will work if your backend sends them.
   */
  generationBatchId?: string | null;
  generatedAt?: string | null;
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
type SortOrder = "NEWEST" | "OLDEST";

const LABELS_PER_ROW = 4;
const LABEL_SIZE_MM = 25;
const LABEL_GAP_MM = 1;
const ROLL_WIDTH_MM = 104;

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

const getValidDate = (value?: string | null) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

/*
 * Prefer generatedAt when backend provides it.
 * Otherwise use createdAt.
 */
const getBarcodeCreatedDate = (
  barcode: BarcodeRow,
) => {
  return (
    getValidDate(barcode.generatedAt) ??
    getValidDate(barcode.createdAt)
  );
};

const formatDate = (
  value?: string | null,
) => {
  const date = getValidDate(value);

  if (!date) return "—";

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
};

const formatDateTime = (
  value?: string | null,
) => {
  const date = getValidDate(value);

  if (!date) return "—";

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  );
};

/*
 * Example:
 *
 * 2026-08-19
 *
 * Used for date filtering.
 */
const getDateKey = (
  value?: string | null,
) => {
  const date = getValidDate(value);

  if (!date) return "UNKNOWN_DATE";

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/*
 * IMPORTANT:
 *
 * This is the new grouping key.
 *
 * Example:
 *
 * 2026-08-19 16:13:12
 * 2026-08-19 16:02:07
 *
 * These become TWO different sections.
 */
const getDateTimeSectionKey = (
  barcode: BarcodeRow,
) => {
  const date =
    getBarcodeCreatedDate(barcode);

  if (!date) {
    return "UNKNOWN_DATETIME";
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  const hour = String(
    date.getHours(),
  ).padStart(2, "0");

  const minute = String(
    date.getMinutes(),
  ).padStart(2, "0");

  const second = String(
    date.getSeconds(),
  ).padStart(2, "0");

  return (
    `${year}-${month}-${day}` +
    `T${hour}:${minute}:${second}`
  );
};

const formatDateSectionHeading = (
  value: string,
) => {
  if (
    value === "UNKNOWN_DATETIME"
  ) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  );
};

const formatTimeSectionHeading = (
  value: string,
) => {
  if (
    value === "UNKNOWN_DATETIME"
  ) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  );
};

const escapeHtml = (
  value: string,
) =>
  String(value)
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#039;",
    );

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function BarcodeManager({
  designs = [],
}: Props) {
  const router = useRouter();

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [viewMode, setViewMode] =
    useState<ViewMode>("grid");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  const [dateFilter, setDateFilter] =
    useState("ALL");

  const [sortOrder, setSortOrder] =
    useState<SortOrder>("NEWEST");

  const [loadingId, setLoadingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const safeGroups = Array.isArray(
    designs,
  )
    ? designs
    : [];

  const selected =
    safeGroups.find(
      (group) =>
        group._id === selectedId,
    ) ?? null;

  const normalizedSearch =
    search.trim().toLowerCase();

  /* ---------------------------------------------------------------------- */
  /* Model/design filtering                                                 */
  /* ---------------------------------------------------------------------- */

  const shownGroups = useMemo(() => {
    return safeGroups.filter(
      (group) => {
        if (!normalizedSearch) {
          return true;
        }

        return [
          group.productName,
          group.designName,
          group.designCode,
        ].some((value) =>
          value
            ?.toLowerCase()
            .includes(
              normalizedSearch,
            ),
        );
      },
    );
  }, [
    safeGroups,
    normalizedSearch,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Selected barcodes                                                       */
  /* ---------------------------------------------------------------------- */

  const barcodes = useMemo(() => {
    const rows = Array.isArray(
      selected?.rows,
    )
      ? selected.rows
      : [];

    return Array.from(
      new Map(
        rows.map((barcode) => [
          barcode._id,
          barcode,
        ]),
      ).values(),
    );
  }, [selected]);

  /* ---------------------------------------------------------------------- */
  /* Available dates                                                        */
  /* ---------------------------------------------------------------------- */

  const availableDates = useMemo(() => {
    const dates = Array.from(
      new Set(
        barcodes.map(
          (barcode) =>
            getDateKey(
              getBarcodeCreatedDate(
                barcode,
              )?.toISOString(),
            ),
        ),
      ),
    );

    return dates.sort((a, b) => {
      if (a === "UNKNOWN_DATE") {
        return 1;
      }

      if (b === "UNKNOWN_DATE") {
        return -1;
      }

      return b.localeCompare(a);
    });
  }, [barcodes]);

  /* ---------------------------------------------------------------------- */
  /* Filtered barcodes                                                      */
  /* ---------------------------------------------------------------------- */

  const shownBarcodes = useMemo(() => {
    const filtered =
      barcodes.filter(
        (barcode) => {
          const matchesStatus =
            statusFilter === "ALL" ||
            barcode.status ===
              statusFilter;

          const barcodeDate =
            getBarcodeCreatedDate(
              barcode,
            );

          const matchesDate =
            dateFilter === "ALL" ||
            getDateKey(
              barcodeDate?.toISOString(),
            ) === dateFilter;

          const matchesSearch =
            !normalizedSearch ||
            barcode.code
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            barcode.designCode
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          return (
            matchesStatus &&
            matchesDate &&
            matchesSearch
          );
        },
      );

    return [...filtered].sort(
      (a, b) => {
        const dateA =
          getBarcodeCreatedDate(
            a,
          )?.getTime() ?? 0;

        const dateB =
          getBarcodeCreatedDate(
            b,
          )?.getTime() ?? 0;

        if (
          sortOrder ===
          "NEWEST"
        ) {
          return (
            dateB - dateA
          );
        }

        return dateA - dateB;
      },
    );
  }, [
    barcodes,
    statusFilter,
    dateFilter,
    normalizedSearch,
    sortOrder,
  ]);

  /* ---------------------------------------------------------------------- */
  /* GROUP BY DATE + EXACT TIME                                              */
  /* ---------------------------------------------------------------------- */
  /*
   * This is the important part.
   *
   * Example:
   *
   * 04:13:12 PM -> Section 1
   * 04:02:07 PM -> Section 2
   *
   * Same date does NOT merge them.
   */

  const barcodeSections =
    useMemo(() => {
      const map =
        new Map<
          string,
          BarcodeRow[]
        >();

      shownBarcodes.forEach(
        (barcode) => {
          /*
           * If your backend provides generationBatchId,
           * use it as the strongest identifier.
           *
           * This prevents two generation requests that
           * happen in the same second from accidentally
           * being combined.
           */
          const key =
            barcode.generationBatchId
              ? `BATCH:${barcode.generationBatchId}`
              : `TIME:${getDateTimeSectionKey(
                  barcode,
                )}`;

          if (!map.has(key)) {
            map.set(key, []);
          }

          map
            .get(key)!
            .push(barcode);
        },
      );

      const sections =
        Array.from(
          map.entries(),
        ).map(
          ([sectionKey, rows]) => {
            const sortedRows = [
              ...rows,
            ].sort(
              (a, b) => {
                const timeA =
                  getBarcodeCreatedDate(
                    a,
                  )?.getTime() ??
                  0;

                const timeB =
                  getBarcodeCreatedDate(
                    b,
                  )?.getTime() ??
                  0;

                return sortOrder ===
                  "NEWEST"
                  ? timeB - timeA
                  : timeA - timeB;
              },
            );

            const firstBarcode =
              sortedRows[0];

            const sectionDate =
              firstBarcode
                ? getBarcodeCreatedDate(
                    firstBarcode,
                  )
                : null;

            return {
              sectionKey,

              rows: sortedRows,

              date:
                sectionDate,

              isBatch:
                Boolean(
                  firstBarcode
                    ?.generationBatchId,
                ),

              batchId:
                firstBarcode
                  ?.generationBatchId ??
                null,
            };
          },
        );

      return sections.sort(
        (a, b) => {
          const timeA =
            a.date?.getTime() ?? 0;

          const timeB =
            b.date?.getTime() ?? 0;

          if (
            sortOrder ===
            "NEWEST"
          ) {
            return (
              timeB - timeA
            );
          }

          return (
            timeA - timeB
          );
        },
      );
    }, [
      shownBarcodes,
      sortOrder,
    ]);

  /* ---------------------------------------------------------------------- */
  /* Counts                                                                 */
  /* ---------------------------------------------------------------------- */

  const available =
    barcodes.filter(
      (barcode) =>
        barcode.status ===
        "AVAILABLE",
    ).length;

  const used =
    barcodes.length -
    available;

  const filteredAvailable =
    shownBarcodes.filter(
      (barcode) =>
        barcode.status ===
        "AVAILABLE",
    ).length;

  const filteredUsed =
    shownBarcodes.length -
    filteredAvailable;

  /* ---------------------------------------------------------------------- */
  /* Reset filters                                                          */
  /* ---------------------------------------------------------------------- */

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setDateFilter("ALL");
    setSortOrder("NEWEST");
  };

  /* ---------------------------------------------------------------------- */
  /* Update status                                                          */
  /* ---------------------------------------------------------------------- */

  const updateStatus = async (
    barcode: BarcodeRow,
  ) => {
    const status =
      barcode.status ===
      "AVAILABLE"
        ? "USED"
        : "AVAILABLE";

    try {
      setLoadingId(
        barcode._id,
      );

      setError("");

      const response =
        await fetch(
          `/api/barcodes/${barcode._id}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              status,
            }),
          },
        );

      const data =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not update barcode status.",
        );
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

  /* ---------------------------------------------------------------------- */
  /* Print                                                                  */
  /* ---------------------------------------------------------------------- */

  const print = (
    toPrint: BarcodeRow[],
  ) => {
    if (
      !selected ||
      toPrint.length === 0
    ) {
      setError(
        "No barcodes match the selected filter.",
      );

      return;
    }

    try {
      setError("");

      const rows =
        Array.from(
          {
            length:
              Math.ceil(
                toPrint.length /
                  LABELS_PER_ROW,
              ),
          },
          (_, rowIndex) => {
            const start =
              rowIndex *
              LABELS_PER_ROW;

            const labels =
              toPrint
                .slice(
                  start,
                  start +
                    LABELS_PER_ROW,
                )
                .map(
                  (barcode) => {
                    const qr =
                      document.getElementById(
                        `qr-${barcode._id}`,
                      )?.innerHTML;

                    if (!qr) {
                      throw new Error(
                        "QR codes are still loading. Please try again.",
                      );
                    }

                    return `
                      <div class="label">
                        <div class="qr">
                          ${qr}
                        </div>

                        <code>
                          ${escapeHtml(
                            barcode.code,
                          )}
                        </code>
                      </div>
                    `;
                  },
                )
                .join("");

            return `
              <section class="print-row">
                <div class="grid">
                  ${labels}
                </div>
              </section>
            `;
          },
        ).join("");

      const popup =
        window.open(
          "",
          "_blank",
          "width=1100,height=850",
        );

      if (!popup) {
        throw new Error(
          "Popup blocked. Allow popups to print barcode labels.",
        );
      }

      popup.document.write(`
        <!doctype html>

        <html>
          <head>
            <meta charset="UTF-8" />

            <title>
              Four-up 25 mm Barcode Labels
            </title>

            <style>
              @page {
                size:
                  ${ROLL_WIDTH_MM}mm
                  ${LABEL_SIZE_MM}mm;
                margin: 0;
              }

              * {
                box-sizing: border-box;
              }

              html,
              body {
                margin: 0;
                padding: 0;
                background: white;
                font-family: Arial, sans-serif;
              }

              body {
                width:
                  ${ROLL_WIDTH_MM}mm;
              }

              .print-row {
                width:
                  ${ROLL_WIDTH_MM}mm;

                height:
                  ${LABEL_SIZE_MM}mm;

                break-after: page;

                page-break-after:
                  always;
              }

              .print-row:last-child {
                break-after: auto;

                page-break-after:
                  auto;
              }

              .grid {
                display: grid;

                grid-template-columns:
                  repeat(
                    ${LABELS_PER_ROW},
                    ${LABEL_SIZE_MM}mm
                  );

                column-gap:
                  ${LABEL_GAP_MM}mm;
              }

              .label {
                width:
                  ${LABEL_SIZE_MM}mm;

                height:
                  ${LABEL_SIZE_MM}mm;

                padding:
                  0.7mm;

                display: flex;

                flex-direction:
                  column;

                align-items: center;

                justify-content:
                  center;

                overflow:
                  hidden;

                border:
                  0.15mm
                  dashed
                  #d1d5db;
              }

              .qr {
                width: 19mm;
                height: 19mm;

                display: flex;

                align-items: center;

                justify-content:
                  center;
              }

              .qr svg {
                width:
                  18mm !important;

                height:
                  18mm !important;
              }

              .label code {
                width: 100%;

                margin-top:
                  0.4mm;

                overflow:
                  hidden;

                text-align:
                  center;

                text-overflow:
                  ellipsis;

                white-space:
                  nowrap;

                font-family:
                  "Courier New",
                  monospace;

                font-size:
                  3.1pt;

                font-weight:
                  700;
              }

              @media print {
                .label {
                  border: none;
                }
              }
            </style>
          </head>

          <body>
            ${rows}

            <script>
              window.addEventListener(
                "load",
                function () {
                  setTimeout(
                    function () {
                      window.print();
                    },
                    300
                  );
                }
              );
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

  /* ---------------------------------------------------------------------- */
  /* Selected design screen                                                  */
  /* ---------------------------------------------------------------------- */

  if (selected) {
    return (
      <div className="space-y-4">
        {/* Back */}
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);

            resetFilters();
          }}
          className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
        >
          ← All models & designs
        </button>

        {/* Header */}
        <header className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              {selected.designUrl ? (
                <img
                  src={
                    selected.designUrl
                  }
                  alt={
                    selected.designName
                  }
                  className="h-16 w-16 rounded-lg border object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
                  No image
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500">
                  {
                    selected.productName
                  }
                </p>

                <h1 className="text-lg font-semibold text-slate-900">
                  {
                    selected.designName
                  }
                </h1>

                <p className="font-mono text-xs text-slate-600">
                  {
                    selected.designCode
                  }
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Mode:{" "}
                  {selected.mode}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg bg-slate-100 px-3 py-2">
                Total:
                <b className="ml-1">
                  {
                    barcodes.length
                  }
                </b>
              </span>

              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                Available:
                <b className="ml-1">
                  {
                    available
                  }
                </b>
              </span>

              <span className="rounded-lg bg-slate-100 px-3 py-2">
                Used:
                <b className="ml-1">
                  {used}
                </b>
              </span>
            </div>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="font-medium"
            >
              Close
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_180px_220px_160px_auto]">
            {/* Search */}
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search barcode code..."
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-slate-500"
            />

            {/* Status */}
            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as StatusFilter,
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none"
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="AVAILABLE">
                Available only
              </option>

              <option value="USED">
                Used only
              </option>
            </select>

            {/* Date */}
            <select
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(
                  event.target.value,
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none"
            >
              <option value="ALL">
                All creation dates
              </option>

              {availableDates.map(
                (date) => {
                  const readable =
                    date ===
                    "UNKNOWN_DATE"
                      ? "Unknown date"
                      : new Date(
                          `${date}T00:00:00`,
                        ).toLocaleDateString(
                          "en-IN",
                          {
                            weekday:
                              "long",
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          },
                        );

                  return (
                    <option
                      key={date}
                      value={date}
                    >
                      {readable}
                    </option>
                  );
                },
              )}
            </select>

            {/* Sort */}
            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(
                  event.target
                    .value as SortOrder,
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none"
            >
              <option value="NEWEST">
                Newest first
              </option>

              <option value="OLDEST">
                Oldest first
              </option>
            </select>

            {/* Reset */}
            <button
              type="button"
              onClick={
                resetFilters
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Reset
            </button>
          </div>

          {/* Filter summary */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex flex-wrap gap-3">
              <span>
                Showing:
                <b className="ml-1 text-slate-800">
                  {
                    shownBarcodes.length
                  }
                </b>
              </span>

              <span>
                Available:
                <b className="ml-1 text-emerald-700">
                  {
                    filteredAvailable
                  }
                </b>
              </span>

              <span>
                Used:
                <b className="ml-1 text-slate-800">
                  {
                    filteredUsed
                  }
                </b>
              </span>

              <span>
                Sections:
                <b className="ml-1 text-slate-800">
                  {
                    barcodeSections.length
                  }
                </b>
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                print(
                  shownBarcodes,
                )
              }
              className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-900"
            >
              Print filtered (
              {
                shownBarcodes.length
              }
              )
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* DATE + TIME SECTIONS                                             */}
        {/* ---------------------------------------------------------------- */}

        <div className="space-y-5">
          {barcodeSections.map(
            (section) => {
              const sectionAvailable =
                section.rows.filter(
                  (barcode) =>
                    barcode.status ===
                    "AVAILABLE",
                ).length;

              const sectionUsed =
                section.rows.length -
                sectionAvailable;

              const sectionDateText =
                section.date
                  ? section.date.toLocaleDateString(
                      "en-IN",
                      {
                        weekday:
                          "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      },
                    )
                  : "Unknown date";

              const sectionTimeText =
                section.date
                  ? section.date.toLocaleTimeString(
                      "en-IN",
                      {
                        hour: "2-digit",
                        minute:
                          "2-digit",
                        second:
                          "2-digit",
                      },
                    )
                  : "Unknown time";

              return (
                <section
                  key={
                    section.sectionKey
                  }
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  {/* Section header */}
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        {/* Date */}
                        <h2 className="text-sm font-semibold text-slate-900">
                          {
                            sectionDateText
                          }
                        </h2>

                        {/* Exact time */}
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white">
                            {
                              sectionTimeText
                            }
                          </span>

                          {section.isBatch && (
                            <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
                              Generation
                              batch
                            </span>
                          )}
                        </div>

                        {section.batchId && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Batch:{" "}
                            <span className="font-mono">
                              {
                                section.batchId
                              }
                            </span>
                          </p>
                        )}

                        <p className="mt-1 text-[11px] text-slate-500">
                          Barcodes generated at this exact time
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">
                          {
                            section.rows
                              .length
                          }{" "}
                          total
                        </span>

                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                          {
                            sectionAvailable
                          }{" "}
                          available
                        </span>

                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">
                          {
                            sectionUsed
                          }{" "}
                          used
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            print(
                              section.rows,
                            )
                          }
                          className="rounded-full bg-slate-800 px-3 py-1 text-white hover:bg-slate-900"
                        >
                          Print section
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Barcodes */}
                  <div className="p-3">
                    {viewMode ===
                    "grid" ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {section.rows.map(
                          (
                            barcode,
                          ) => (
                            <article
                              key={
                                barcode._id
                              }
                              className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div
                                  id={`qr-${barcode._id}`}
                                  className="rounded border bg-white p-1"
                                >
                                  <QRCodeSVG
                                    value={
                                      barcode.code
                                    }
                                    size={
                                      92
                                    }
                                    level="L"
                                    includeMargin={
                                      false
                                    }
                                  />
                                </div>

                                <span
                                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                                    barcode.status ===
                                    "AVAILABLE"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {
                                    barcode.status
                                  }
                                </span>
                              </div>

                              <code className="mt-2 block break-all text-[11px] font-semibold text-slate-800">
                                {
                                  barcode.code
                                }
                              </code>

                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] text-slate-500">
                                  <span className="font-medium text-slate-600">
                                    Created:
                                  </span>{" "}
                                  {formatDateTime(
                                    (
                                      getBarcodeCreatedDate(
                                        barcode,
                                      ) ??
                                      new Date(
                                        0,
                                      )
                                    ).toISOString(),
                                  )}
                                </p>

                                {barcode.usedAt && (
                                  <p className="text-[10px] text-slate-500">
                                    <span className="font-medium text-slate-600">
                                      Used:
                                    </span>{" "}
                                    {
                                      formatDateTime(
                                        barcode.usedAt,
                                      )
                                    }
                                  </p>
                                )}
                              </div>

                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    print(
                                      [
                                        barcode,
                                      ],
                                    )
                                  }
                                  className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                                >
                                  Print one
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateStatus(
                                      barcode,
                                    )
                                  }
                                  disabled={
                                    loadingId ===
                                    barcode._id
                                  }
                                  className="rounded border border-indigo-300 px-2 py-1 text-[11px] text-indigo-700 disabled:opacity-50"
                                >
                                  {loadingId ===
                                  barcode._id
                                    ? "Updating..."
                                    : barcode.status ===
                                        "AVAILABLE"
                                      ? "Mark used"
                                      : "Mark available"}
                                </button>
                              </div>
                            </article>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-3 py-2">
                                Barcode
                              </th>

                              <th className="px-3 py-2">
                                Status
                              </th>

                              <th className="px-3 py-2">
                                Created
                              </th>

                              <th className="px-3 py-2">
                                Used
                              </th>

                              <th className="px-3 py-2">
                                Actions
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {section.rows.map(
                              (
                                barcode,
                              ) => (
                                <tr
                                  key={
                                    barcode._id
                                  }
                                  className="border-t border-slate-200"
                                >
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                      <div
                                        id={`qr-${barcode._id}`}
                                        className="shrink-0 rounded border bg-white p-1"
                                      >
                                        <QRCodeSVG
                                          value={
                                            barcode.code
                                          }
                                          size={
                                            50
                                          }
                                          level="L"
                                          includeMargin={
                                            false
                                          }
                                        />
                                      </div>

                                      <code className="break-all font-mono text-[11px] font-semibold">
                                        {
                                          barcode.code
                                        }
                                      </code>
                                    </div>
                                  </td>

                                  <td className="px-3 py-3">
                                    <span
                                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                                        barcode.status ===
                                        "AVAILABLE"
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-slate-200 text-slate-700"
                                      }`}
                                    >
                                      {
                                        barcode.status
                                      }
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 whitespace-nowrap text-[11px] text-slate-500">
                                    {formatDateTime(
                                      (
                                        getBarcodeCreatedDate(
                                          barcode,
                                        ) ??
                                        new Date(
                                          0,
                                        )
                                      ).toISOString(),
                                    )}
                                  </td>

                                  <td className="px-3 py-3 whitespace-nowrap text-[11px] text-slate-500">
                                    {barcode.usedAt
                                      ? formatDateTime(
                                          barcode.usedAt,
                                        )
                                      : "—"}
                                  </td>

                                  <td className="px-3 py-3">
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          print(
                                            [
                                              barcode,
                                            ],
                                          )
                                        }
                                        className="rounded border border-slate-300 px-2 py-1 text-[10px]"
                                      >
                                        Print
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateStatus(
                                            barcode,
                                          )
                                        }
                                        disabled={
                                          loadingId ===
                                          barcode._id
                                        }
                                        className="rounded border border-indigo-300 px-2 py-1 text-[10px] text-indigo-700 disabled:opacity-50"
                                      >
                                        {loadingId ===
                                        barcode._id
                                          ? "Updating..."
                                          : barcode.status ===
                                              "AVAILABLE"
                                            ? "Mark used"
                                            : "Available"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              );
            },
          )}
        </div>

        {/* No results */}
        {shownBarcodes.length ===
          0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">
              No barcodes found
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Try changing the search or filters.
            </p>

            <button
              type="button"
              onClick={
                resetFilters
              }
              className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* View mode */}
        <div className="flex justify-end">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() =>
                setViewMode(
                  "grid",
                )
              }
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
              onClick={() =>
                setViewMode(
                  "list",
                )
              }
              className={`rounded px-3 py-1.5 text-xs ${
                viewMode === "list"
                  ? "bg-slate-800 text-white"
                  : "text-slate-600"
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Model/design selection screen                                           */
  /* ---------------------------------------------------------------------- */

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
            onClick={() =>
              setViewMode(
                "grid",
              )
            }
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
            onClick={() =>
              setViewMode(
                "list",
              )
            }
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

      {/* Search */}
      <input
        value={search}
        onChange={(event) =>
          setSearch(
            event.target.value,
          )
        }
        placeholder="Search model, design name, or design code..."
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-slate-500"
      />

      {/* Grid */}
      {viewMode ===
      "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shownGroups.map(
            (group) => {
              const rows =
                Array.isArray(
                  group.rows,
                )
                  ? group.rows
                  : [];

              const free =
                rows.filter(
                  (row) =>
                    row.status ===
                    "AVAILABLE",
                ).length;

              return (
                <button
                  type="button"
                  key={group._id}
                  onClick={() => {
                    setSelectedId(
                      group._id,
                    );

                    resetFilters();
                  }}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-400 hover:shadow"
                >
                  {group.designUrl ? (
                    <img
                      src={
                        group.designUrl
                      }
                      alt={
                        group.designName
                      }
                      className="h-16 w-14 rounded border object-cover"
                    />
                  ) : (
                    <div className="grid h-16 w-14 place-items-center rounded bg-slate-100 text-xs text-slate-400">
                      No image
                    </div>
                  )}

                  <span className="min-w-0">
                    <span className="block text-[11px] text-slate-500">
                      {
                        group.productName
                      }
                    </span>

                    <strong className="block truncate text-sm text-slate-800">
                      {
                        group.designName
                      }
                    </strong>

                    <code className="block truncate text-[11px] text-slate-600">
                      {
                        group.designCode
                      }
                    </code>

                    <span className="mt-2 block text-xs text-emerald-700">
                      {
                        free
                      }{" "}
                      available /{" "}
                      {
                        rows.length
                      }{" "}
                      total
                    </span>
                  </span>
                </button>
              );
            },
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">
                  Model
                </th>

                <th className="p-3">
                  Design
                </th>

                <th className="p-3">
                  Code
                </th>

                <th className="p-3">
                  Barcodes
                </th>

                <th className="p-3" />
              </tr>
            </thead>

            <tbody>
              {shownGroups.map(
                (group) => {
                  const rows =
                    Array.isArray(
                      group.rows,
                    )
                      ? group.rows
                      : [];

                  const free =
                    rows.filter(
                      (row) =>
                        row.status ===
                        "AVAILABLE",
                    ).length;

                  return (
                    <tr
                      key={
                        group._id
                      }
                      className="border-t"
                    >
                      <td className="p-3">
                        {
                          group.productName
                        }
                      </td>

                      <td className="p-3 font-medium">
                        {
                          group.designName
                        }
                      </td>

                      <td className="p-3 font-mono">
                        {
                          group.designCode
                        }
                      </td>

                      <td className="p-3">
                        {
                          free
                        }{" "}
                        available /{" "}
                        {
                          rows.length
                        }
                      </td>

                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(
                              group._id,
                            );

                            resetFilters();
                          }}
                          className="rounded border px-3 py-1 text-xs hover:bg-slate-50"
                        >
                          Open barcodes
                        </button>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}

      {shownGroups.length ===
        0 && (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-400">
            No models or designs found.
          </p>
        </div>
      )}
    </div>
  );
}
