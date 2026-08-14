import ImageKit from "imagekit";
import { NextResponse } from "next/server";

// ⚠️  These environment variables must be set in your .env.local
function getImageKit() {
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error("ImageKit environment variables are not configured.");
  }

  return new ImageKit({ publicKey, privateKey, urlEndpoint });
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const imagekit = getImageKit();
    const authParams = imagekit.getAuthenticationParameters();
    return NextResponse.json(authParams);
  } catch (error) {
    console.error("ImageKit auth error:", error);
    return NextResponse.json(
      { message: "Failed to generate authentication parameters" },
      { status: 500 }
    );
  }
}
