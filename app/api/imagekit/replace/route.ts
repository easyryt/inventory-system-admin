import ImageKit from "imagekit";
import { NextRequest, NextResponse } from "next/server";

const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT!,
});

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileId = formData.get("fileId") as string;
    const file = formData.get("file") as File;

    if (!fileId || !file) {
      return NextResponse.json(
        { message: "fileId and file are required" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Replace the image in ImageKit (keeps the same fileId/URL)
    const result = await imagekit.replaceFile({
      fileId,
      file: buffer,
      fileName: file.name,
    });

    return NextResponse.json({
      message: "File replaced successfully",
      fileId: result.fileId,
      name: result.name,
    });
  } catch (error: any) {
    console.error("ImageKit replace error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to replace file" },
      { status: 500 }
    );
  }
}