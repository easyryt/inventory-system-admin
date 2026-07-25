// app/dashboard/barcodes/[productId]/BarcodeList.tsx
"use client";

import { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

type BarcodeRow = {
  _id: string;
  code: string;
  designCode: string;
  status: "AVAILABLE" | "USED";
  createdAt: string;
  usedAt?: string | null;
};

function StatusBadge({ status }: { status: "AVAILABLE" | "USED" }) {
  const isAvailable = status === "AVAILABLE";
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide " +
        (isAvailable
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500")
      }
    >
      {status}
    </span>
  );
}

export default function BarcodeList({
  design,
  rows,
}: {
  design: string;
  rows: BarcodeRow[];
}) {
  const [barcodes, setBarcodes] = useState<BarcodeRow[]>(rows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Keep refs to the on‑screen canvases (for preview), not used for printing
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const toggleStatus = async (row: BarcodeRow) => {
    setError("");
    const nextStatus = row.status === "AVAILABLE" ? "USED" : "AVAILABLE";

    try {
      setBusyId(row._id);
      const res = await fetch(`/api/barcodes/${row._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          (data as any).message ||
            "Failed to update barcode status. Please try again."
        );
        setBusyId(null);
        return;
      }

      setBarcodes((prev) =>
        prev.map((b) =>
          b._id === row._id ? { ...b, status: nextStatus } : b
        )
      );
      setBusyId(null);
    } catch (err) {
      console.error("Update barcode status error", err);
      setError("Something went wrong while updating status.");
      setBusyId(null);
    }
  };

  const handlePrint = (row: BarcodeRow) => {
    // Open a new window and draw a fresh QR there
    const printWindow = window.open("", "_blank", "width=400,height=400");
    if (!printWindow) return;

    // Basic HTML skeleton
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR</title>
          <style>
            @page { margin: 8mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .label {
              text-align: center;
            }
            .label canvas {
              display: block;
              margin: 0 auto;
            }
            .label p {
              font-size: 10px;
              margin-top: 4px;
              max-width: 260px;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <canvas id="qr-canvas" width="200" height="200"></canvas>
            <p id="qr-text"></p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    // When the new window finishes loading, draw the QR and print
    printWindow.onload = () => {
      try {
        const canvas = printWindow.document.getElementById(
          "qr-canvas"
        ) as HTMLCanvasElement | null;

        const textEl = printWindow.document.getElementById(
          "qr-text"
        ) as HTMLParagraphElement | null;

        if (!canvas) {
          console.error("Print window canvas not found");
          return;
        }

        if (textEl) {
          textEl.textContent = row.code;
        }

        // Use qrcode.react's internal QR generation by creating
        // a temporary off-screen QRCanvas in this window via Image
        // Simpler: use an existing data URL from current app

        // We reuse an existing QR by turning our visible canvas into a dataURL
        const srcCanvas = canvasRefs.current[row._id];
        if (!srcCanvas) {
          console.error("Source QR canvas not found");
          return;
        }

        const dataUrl = srcCanvas.toDataURL("image/png");
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Center image
          const size = Math.min(canvas.width, canvas.height) * 0.9;
          const x = (canvas.width - size) / 2;
          const y = (canvas.height - size) / 2;
          ctx.drawImage(img, x, y, size, size);

          // After drawing, trigger print
          printWindow.focus();
          printWindow.print();
          // Optionally close automatically
          printWindow.close();
        };
        img.src = dataUrl;
      } catch (e) {
        console.error("Print QR error", e);
      }
    };
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
          {error}
        </p>
      )}
      <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl">
        <table className="min-w-full text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-slate-500 font-medium">
                QR code
              </th>
              <th className="px-3 py-2 text-left text-slate-500 font-medium">
                Status
              </th>
              <th className="px-3 py-2 text-left text-slate-500 font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {barcodes.map((b) => (
              <tr key={b._id}>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <QRCodeCanvas
                      value={b.code}
                      size={72}
                      level="M"
                      includeMargin={true}
                      ref={(node) => {
                        // qrcode.react renders a <canvas>; node is that canvas
                        canvasRefs.current[b._id] = node;
                      }}
                    />
                    <div className="text-[9px] text-slate-500 break-all max-w-[140px]">
                      {b.code}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <StatusBadge status={b.status} />
                </td>
                <td className="px-3 py-1.5 space-y-1">
                  <button
                    type="button"
                    disabled={busyId === b._id}
                    onClick={() => toggleStatus(b)}
                    className="block text-[10px] text-blue-700 hover:underline disabled:opacity-60"
                  >
                    {b.status === "AVAILABLE"
                      ? "Mark as used"
                      : "Mark as available"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint(b)}
                    className="block text-[10px] text-slate-700 hover:underline"
                  >
                    Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}