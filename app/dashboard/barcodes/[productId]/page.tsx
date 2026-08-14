import { cookies } from "next/headers";
import BackButton from "./BackButton";
import BarcodeCreateForm from "./BarcodeCreateForm";
import BarcodeManager, { type BarcodeDesignGroup } from "./BarcodeList";

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

type ProductDesign = {
  _id: string;
  name: string;
  mode: string;
  designCode: string;
  designUrl?: string;
};

type BarcodesByDesign = Record<string, BarcodeRow[]>;
type ProductResponse = { product?: Product };

// Removed the unwanted space before http.
const API = "https://inventory-system-24ly.onrender.com/api";

const json = async <T,>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      (data as { message?: string }).message ||
        "Could not load barcode data.",
    );
  }

  return data as T;
};

const unwrapProduct = (
  data: Product | ProductResponse | null,
): Product | null => {
  if (!data) {
    return null;
  }

  return "name" in data ? data : data.product ?? null;
};

async function fetchPageData(productId: string, token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const [productResult, designsResult, barcodesResult] =
    await Promise.allSettled([
      fetch(`${API}/products/${productId}`, {
        headers,
        cache: "no-store",
      }).then(json<ProductResponse | Product>),

      fetch(`${API}/printing-jobs/designs/${productId}`, {
        headers,
        cache: "no-store",
      }).then(json<{ designs?: ProductDesign[] }>),

      fetch(`${API}/barcodes/manage/${productId}`, {
        headers,
        cache: "no-store",
      }).then(
        json<{
          barcodesByDesign?: BarcodesByDesign;
          barcodes?: BarcodeRow[];
        }>,
      ),
    ]);

  const productData =
    productResult.status === "fulfilled" ? productResult.value : null;

  const designsData =
    designsResult.status === "fulfilled" ? designsResult.value : {};

  const barcodeData =
    barcodesResult.status === "fulfilled" ? barcodesResult.value : {};

  const product = unwrapProduct(productData);

  const designs = Array.isArray(designsData.designs)
    ? designsData.designs
    : [];

  // The backend provides both `barcodesByDesign` and a flat `barcodes` list.
  // Do not merge them: they contain the same records and merging doubles
  // the counts shown on collapsed design cards.
  const byDesign: BarcodesByDesign = {
    ...(barcodeData.barcodesByDesign ?? {}),
  };

  // Compatibility with an older response that only returns the flat list.
  if (Object.keys(byDesign).length === 0) {
    for (const barcode of barcodeData.barcodes ?? []) {
      if (!byDesign[barcode.designCode]) {
        byDesign[barcode.designCode] = [];
      }
      byDesign[barcode.designCode].push(barcode);
    }
  }
  return {
    product: product ?? null,
    designs,
    byDesign,
  };
}

export default async function ManageBarcodesPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  const token = (await cookies()).get("token")?.value;

  if (!token) {
    return (
      <p className="text-xs text-red-600">
        You must be logged in as ADMIN or PRINTER.
      </p>
    );
  }

  const { product, designs, byDesign } = await fetchPageData(productId, token);

  const productName = product?.name ?? `Product ${productId}`;

  const barcodeGroups: BarcodeDesignGroup[] = designs.map((design) => ({
    _id: design._id,
    productName,
    designName: design.name || design.designCode,
    mode: design.mode || "-",
    designCode: design.designCode,
    designUrl: design.designUrl,
    rows: Array.isArray(byDesign[design.designCode])
      ? byDesign[design.designCode]
      : [],
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <BackButton />
        <div>
          <h1 className="text-lg font-semibold">Manage Barcodes</h1>
          <p className="text-xs text-slate-500">
            Product: {productName}
          </p>
        </div>
      </div>

      <BarcodeCreateForm productId={productId} designs={designs} />

      <BarcodeManager designs={barcodeGroups} />
    </div>
  );
}
