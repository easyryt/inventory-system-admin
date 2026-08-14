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

export async function PUT(request: NextRequest) {
  try {
    const imagekit = getImageKit();
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

    const existingFile = await imagekit.getFileDetails(fileId);
    const lastSlash = existingFile.filePath.lastIndexOf("/");
    const folder = existingFile.filePath.slice(0, lastSlash) || "/";

    // Upload over the existing path so the public URL remains unchanged.
    const result = await imagekit.upload({
      file: buffer,
      fileName: existingFile.name,
      folder,
      useUniqueFileName: false,
      overwriteFile: true,
    });

    return NextResponse.json({
      message: "File replaced successfully",
      fileId: result.fileId,
      name: result.name,
      url: result.url,
    });
  } catch (error: any) {
    console.error("ImageKit replace error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to replace file" },
      { status: 500 }
    );
  }
}
