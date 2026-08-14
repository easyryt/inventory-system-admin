import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || " https://inventory-system-24ly.onrender.com";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const maybeParams = context.params as any;
    const params =
      typeof maybeParams?.then === "function" ? await maybeParams : maybeParams;

    const { id } = params;
    const body = await req.json();

    const res = await fetch(`${BACKEND_URL}/api/purchase-orders/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("Route PATCH /api/purchase-orders/[id] error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}