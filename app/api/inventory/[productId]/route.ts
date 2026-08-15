import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = " http://localhost:5000";

type Params = Promise<{ productId: string }>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { productId } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const res = await fetch(
      `${BACKEND_URL}/api/inventory/design/${productId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("GET /api/inventory/[productId] proxy error:", err);

    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}