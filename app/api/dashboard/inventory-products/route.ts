import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = "http://localhost:5000";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    console.log("Next dashboard token:", token); // <--- add this

    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized (no token)" },
        { status: 401 }
      );
    }

    const res = await fetch(
      `${BACKEND_URL}/api/dashboard/inventory-products`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("Next dashboard inventory API error", err);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}