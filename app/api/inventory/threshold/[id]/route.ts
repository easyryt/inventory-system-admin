import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = " http://localhost:5000";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // <-- params is a Promise
) {
  try {
    // ✅ Await the Promise to get the id
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { minThreshold } = await req.json();

    const threshold = Number(minThreshold);
    if (minThreshold === undefined || isNaN(threshold) || threshold < 0) {
      return NextResponse.json(
        { message: "minThreshold must be a non-negative number" },
        { status: 400 }
      );
    }

    // Now the URL is correct
    const res = await fetch(`${BACKEND_URL}/api/inventory/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ minThreshold: threshold }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("PATCH /api/inventory/threshold/[id] proxy error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}