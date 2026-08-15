// app/api/product-designs/product/[productId]/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = "https://inventory-system-ecew.onrender.com";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const token = req.cookies.get("token")?.value;
    const authHeader = token ? `Bearer ${token}` : null;

    const res = await fetch(
      `${BACKEND_URL}/api/product-designs/product/${productId}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(authHeader && { Authorization: authHeader }),
        },
        cache: "no-store",
      }
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("GET /api/product-designs/product/:productId error:", error);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}