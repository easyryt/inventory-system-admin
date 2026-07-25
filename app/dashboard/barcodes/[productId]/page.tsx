// app/dashboard/barcodes/[productId]/page.tsx
import { cookies } from "next/headers";
import BarcodeList from "./BarcodeList";

type BarcodeRow = {
  _id: string;
  code: string;
  designCode: string;
  status: "AVAILABLE" | "USED";
  createdAt: string;
  usedAt?: string | null;
};

type Product = {
  _id: string;
  name: string;
};

type BarcodesByDesign = Record<string, BarcodeRow[]>;

async function fetchProductAndBarcodes(productId: string, token: string) {
  const [productRes, barcodesRes] = await Promise.all([
    fetch(`https://inventory-system-ecew.onrender.com/api/products/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
    fetch(`https://inventory-system-ecew.onrender.com/api/barcodes/manage/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  ]);

  let product: Product | null = null;
  let barcodesByDesign: BarcodesByDesign = {};

  if (productRes.ok) {
    product = (await productRes.json()) as Product;
  }

  if (barcodesRes.ok) {
    const data = await barcodesRes.json();
    if (data && typeof data.barcodesByDesign === "object") {
      barcodesByDesign = data.barcodesByDesign as BarcodesByDesign;
    }
  }

  return { product, barcodesByDesign };
}

export default async function ManageBarcodesPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  // ✅ params is a Promise in Next.js 16 — unwrap it once
  const { productId } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Manage barcodes</h1>
        <p className="text-xs text-red-600">
          You must be logged in as ADMIN or PRINTER.
        </p>
      </div>
    );
  }

  const { product, barcodesByDesign } = await fetchProductAndBarcodes(
    productId,
    token
  );

  const title = product?.name ?? `Product ${productId}`;
  const designKeys = Object.keys(barcodesByDesign).sort();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Manage barcodes</h1>
        <p className="text-xs text-slate-500">
          Product: {title} ({productId})
        </p>
      </div>

      {designKeys.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400">
            No barcodes generated yet for this product.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {designKeys.map((design) => {
            const rows = barcodesByDesign[design] || [];
            const availableCount = rows.filter(
              (b) => b.status === "AVAILABLE"
            ).length;
            const usedCount = rows.filter((b) => b.status === "USED").length;

            return (
              <section
                key={design}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">{design}</h2>
                    <p className="text-[11px] text-slate-500">
                      AVAILABLE: {availableCount} · USED: {usedCount}
                    </p>
                  </div>
                </div>

                {rows.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No barcodes for this design yet.
                  </p>
                ) : (
                  <BarcodeList design={design} rows={rows} />
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}