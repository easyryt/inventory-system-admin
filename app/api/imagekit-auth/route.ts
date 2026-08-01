// app/api/imagekit-auth/route.ts
import ImageKit from "imagekit";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

    // Check that all required variables are present
    if (!publicKey || !privateKey || !urlEndpoint) {
      console.error("ImageKit credentials missing:", {
        publicKey: !!publicKey,
        privateKey: !!privateKey,
        urlEndpoint: !!urlEndpoint,
      });
      return NextResponse.json(
        { message: "ImageKit credentials not configured" },
        { status: 500 }
      );
    }

    // Initialize ImageKit only when the endpoint is called
    const imagekit = new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint,
    });

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