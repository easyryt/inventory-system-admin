// app/api/barcodes/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = "https://inventory-system-ecew.onrender.com";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // 👈 now a Promise
) {
  try {
    const { id } = await params;   // 👈 unwrap it

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const res = await fetch(
      `${BACKEND_URL}/api/barcodes/${id}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("PATCH /api/barcodes/[id]/status proxy error", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}