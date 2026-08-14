import ImageKit from "imagekit";
import { NextRequest, NextResponse } from "next/server";

function getImageKit() {
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error("ImageKit environment variables are not configured.");
  }

  return new ImageKit({ publicKey, privateKey, urlEndpoint });
}

export async function DELETE(request: NextRequest) {
  try {
    const imagekit = getImageKit();
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { message: "fileId is required" },
        { status: 400 }
      );
    }

    await imagekit.deleteFile(fileId);

    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error: any) {
    console.error("ImageKit delete error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to delete file" },
      { status: 500 }
    );
  }
}
