import { cookies } from "next/headers";
import BarcodeCreateForm from "./BarcodeCreateForm";
import BarcodeManager, {
  type BarcodeDesignGroup,
} from "./BarcodeList";

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

type ProductResponse = Product | { product?: Product };

type BarcodesByDesign = Record<string, BarcodeRow[]>;

const API = "https://inventory-system-ecew.onrender.com/api";

const json = async <T,>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      (data as { message?: string }).message ??
        "Could not load barcode data."
    );
  }

  return data as T;
};

function isWrappedProduct(
  value: ProductResponse
): value is { product?: Product } {
  return (
    typeof value === "object" &&
    value !== null &&
    "product" in value
  );
}

async function fetchPageData(productId: string, token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const [productResult, designsResult, barcodesResult] =
    await Promise.allSettled([
      fetch(`${API}/products/${productId}`, {
        headers,
        cache: "no-store",
      }).then(json<ProductResponse>),

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
        }>
      ),
    ]);

  let product: Product | null = null;

  if (productResult.status === "fulfilled") {
    const data = productResult.value;

    if (isWrappedProduct(data)) {
      product = data.product ?? null;
    } else {
      product = data;
    }
  }

  const designs =
    designsResult.status === "fulfilled"
      ? (designsResult.value.designs ?? [])
      : [];

  const barcodeData =
    barcodesResult.status === "fulfilled"
      ? barcodesResult.value
      : {};

  const byDesign: BarcodesByDesign =
    barcodeData.barcodesByDesign ?? {};

  for (const barcode of barcodeData.barcodes ?? []) {
    (byDesign[barcode.designCode] ??= []).push(barcode);
  }

  return {
    product,
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

  const { product, designs, byDesign } =
    await fetchPageData(productId, token);

  const productName =
    product?.name ?? `Product ${productId}`;

  const barcodeGroups: BarcodeDesignGroup[] = designs.map(
    (design) => ({
      _id: design._id,
      productName,
      designName: design.name || design.designCode,
      mode: design.mode || "-",
      designCode: design.designCode,
      designUrl: design.designUrl,
      rows: byDesign[design.designCode] ?? [],
    })
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">
          Manage Barcodes
        </h1>

        <p className="text-xs text-slate-500">
          Product: {productName}
        </p>
      </div>

      <BarcodeCreateForm
        productId={productId}
        designs={designs}
      />

      <BarcodeManager
        designs={barcodeGroups}
      />
    </div>
  );
}