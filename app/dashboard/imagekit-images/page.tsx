"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";

type ImageItem = {
  fileId: string;
  name: string;
  url: string;
  thumbnail: string;
  height: number;
  width: number;
  size: number;
  createdAt: string;
};

const IMAGEKIT_AUTH_URL = "/api/imagekit-auth";
const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!;
const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const FOLDER = "/product-designs";

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 30;

export default function ImageKitImagesPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCompleted, setUploadCompleted] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch("/api/imagekit/list");

      if (!response.ok) {
        throw new Error("Failed to load images.");
      }

      const data = await response.json();

      setImages(Array.isArray(data.images) ? data.images : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load images.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const uploadOneFile = async (
    file: File,
    fileIndex: number,
    totalFiles: number,
  ) => {
    const authResponse = await fetch(IMAGEKIT_AUTH_URL);

    if (!authResponse.ok) {
      throw new Error("Image upload authentication failed.");
    }

    const { signature, expire, token } = await authResponse.json();

    const formData = new FormData();

    formData.append("file", file);
    formData.append("fileName", file.name);
    formData.append("folder", FOLDER);
    formData.append("useUniqueFileName", "true");
    formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);
    formData.append("signature", signature);
    formData.append("expire", String(expire));
    formData.append("token", token);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", IMAGEKIT_UPLOAD_URL);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;

        const currentFileProgress = event.loaded / event.total;
        const overallProgress =
          ((fileIndex + currentFileProgress) / totalFiles) * 100;

        setUploadProgress(Math.round(overallProgress));
      };

      xhr.onerror = () => {
        reject(new Error(`Failed to upload "${file.name}".`));
      };

      xhr.onload = () => {
        let result: {
          url?: string;
          message?: string;
        } = {};

        try {
          result = JSON.parse(xhr.responseText || "{}");
        } catch {
          reject(
            new Error(`ImageKit returned an invalid response for "${file.name}".`),
          );
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300 || !result.url) {
          reject(new Error(result.message || `Failed to upload "${file.name}".`));
          return;
        }

        resolve();
      };

      xhr.send(formData);
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) return;

    if (selectedFiles.length > MAX_FILES_PER_UPLOAD) {
      setUploadError(
        `You can upload a maximum of ${MAX_FILES_PER_UPLOAD} images at one time.`,
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    const invalidFiles = selectedFiles.filter(
      (file) => !ALLOWED_IMAGE_TYPES.includes(file.type),
    );

    if (invalidFiles.length > 0) {
      setUploadError("Only PNG, JPG, JPEG, and WEBP images can be uploaded.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    const oversizedFiles = selectedFiles.filter(
      (file) => file.size > MAX_FILE_SIZE,
    );

    if (oversizedFiles.length > 0) {
      setUploadError("Each image must be smaller than 10 MB.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    try {
      setUploadError(null);
      setUploadSuccess(false);
      setUploading(true);
      setUploadProgress(0);
      setUploadCompleted(0);
      setUploadTotal(selectedFiles.length);

      const failedFiles: string[] = [];

      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];

        try {
          await uploadOneFile(file, index, selectedFiles.length);
        } catch {
          failedFiles.push(file.name);
        } finally {
          setUploadCompleted(index + 1);
        }
      }

      setUploadProgress(100);

      const uploadedCount = selectedFiles.length - failedFiles.length;

      if (failedFiles.length > 0) {
        setUploadError(
          `${uploadedCount} of ${selectedFiles.length} images uploaded. Failed: ${failedFiles.join(", ")}`,
        );
      } else {
        setUploadSuccess(true);
      }

      await fetchImages();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Could not upload images.",
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      const response = await fetch("/api/imagekit/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Delete failed.");
      }

      setImages((currentImages) =>
        currentImages.filter((image) => image.fileId !== fileId),
      );

      setDeleteId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete image.");
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Image URL copied.");
    } catch {
      alert("Failed to copy image URL.");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">
          ImageKit Images
        </h1>

        <div className="py-12 text-center text-slate-500">
          Loading images...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ImageKit Images</h1>
          <p className="mt-1 text-sm text-slate-500">
            Select multiple images to upload them together.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {uploadSuccess && (
            <span className="text-sm font-medium text-green-600">
              ✓ Images uploaded successfully
            </span>
          )}

          <label
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
              uploading
                ? "cursor-not-allowed bg-blue-400"
                : "cursor-pointer bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />

            {uploading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>

                Uploading {uploadCompleted}/{uploadTotal}
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>

                Upload Images
              </>
            )}
          </label>
        </div>
      </div>

      {uploading && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded bg-slate-200">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>

          <p className="text-right text-xs text-slate-500">{uploadProgress}%</p>
        </div>
      )}

      {(error || uploadError) && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error || uploadError}

          {error && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                fetchImages();
              }}
              className="ml-4 underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {images.length === 0 && !error && (
        <div className="py-12 text-center text-slate-400">
          No images uploaded yet. Click “Upload Images” to add images.
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {images.map((image) => (
            <div
              key={image.fileId}
              className="group relative rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => setSelectedImage(image.url)}
                className="aspect-square w-full overflow-hidden rounded-lg bg-slate-100"
              >
                <img
                  src={image.thumbnail || image.url}
                  alt={image.name}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </button>

              <div className="mt-2 space-y-1">
                <p
                  className="truncate text-xs font-medium text-slate-700"
                  title={image.name}
                >
                  {image.name}
                </p>

                <p className="text-[10px] text-slate-400">
                  {image.width} × {image.height} · {formatSize(image.size)}
                </p>
              </div>

              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => copyToClipboard(image.url)}
                  className="rounded-md bg-white p-1 text-slate-500 shadow hover:text-blue-600"
                  title="Copy URL"
                >
                  Copy
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteId(image.fileId)}
                  className="rounded-md bg-white p-1 text-slate-500 shadow hover:text-red-600"
                  title="Delete image"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">
              Delete Image
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes the image from ImageKit. This cannot be
              undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] rounded-lg bg-white p-2 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow hover:bg-slate-100"
              onClick={() => setSelectedImage(null)}
            >
              ×
            </button>

            <img
              src={selectedImage}
              alt="Preview"
              className="max-h-[85vh] max-w-full rounded object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}