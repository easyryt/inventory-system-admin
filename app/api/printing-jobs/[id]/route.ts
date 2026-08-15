// app/api/printing-jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = "https://inventory-system-ecew.onrender.com";

type IdParams = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: IdParams }
) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const kind = searchParams.get("kind"); // "designs" or null

    const targetUrl =
      kind === "designs"
        ? `${BACKEND_URL}/api/printing-jobs/designs/${id}`
        : `${BACKEND_URL}/api/printing-jobs/${id}`;

    const res = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("GET /api/printing-jobs/[id] proxy error", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: IdParams }
) {
  try {
    const { id } = await params;
    console.log("API route /api/printing-jobs/[id] PUT, id =", id);

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/api/printing-jobs/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("PUT /api/printing-jobs/[id] proxy error", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: IdParams }
) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const res = await fetch(`${BACKEND_URL}/api/printing-jobs/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("DELETE /api/printing-jobs/[id] proxy error", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}