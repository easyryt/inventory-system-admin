import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = " https://inventory-system-ecew.onrender.com";

// POST /api/product-designs
export async function POST(req: NextRequest) {
  try {
      const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;
        if (!token) {
          return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
    
    const body = await req.json();

    const res = await fetch(`${BACKEND_URL}/api/product-designs`, {
      method: "POST",
     headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("POST /api/product-designs error:", error);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 },
    );
  }
}