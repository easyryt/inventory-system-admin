"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";

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
const FOLDER = "/product-designs"; // change if needed

export default function ImageKitImagesPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Upload states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Fetch all images ----
  const fetchImages = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/imagekit/list");
      if (!res.ok) throw new Error("Failed to load images");
      const data = await res.json();
      setImages(data.images);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // ---- Manual upload using XHR (same as CreateDesignForm) ----
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setUploadError(null);
    setUploadSuccess(false);
    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. Get authentication parameters
      const authRes = await fetch(IMAGEKIT_AUTH_URL);
      if (!authRes.ok) throw new Error("Image upload authentication failed.");
      const { signature, expire, token } = await authRes.json();

      // 2. Build FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", file.name);
      formData.append("folder", FOLDER);
      formData.append("useUniqueFileName", "true");
      formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);
      formData.append("signature", signature);
      formData.append("expire", String(expire));
      formData.append("token", token);

      // 3. Upload via XHR (with progress)
      await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", IMAGEKIT_UPLOAD_URL);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));

        xhr.onload = () => {
          let result: { url?: string; message?: string } = {};
          try {
            result = JSON.parse(xhr.responseText || "{}");
          } catch {
            reject(new Error("ImageKit returned an invalid response."));
            return;
          }
          if (xhr.status < 200 || xhr.status >= 300 || !result.url) {
            reject(new Error(result.message || "Upload failed."));
          } else {
            resolve(result.url);
          }
        };

        xhr.send(formData);
      });

      // 4. Success
      setUploadSuccess(true);
      fetchImages(); // refresh list
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Clear input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---- Delete ----
  const handleDelete = async (fileId: string) => {
    try {
      const res = await fetch("/api/imagekit/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Delete failed");
      }
      setImages((prev) => prev.filter((img) => img.fileId !== fileId));
      setDeleteId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ---- Copy URL ----
  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("URL copied!");
    } catch {
      alert("Failed to copy");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">ImageKit Images</h1>
        <div className="text-center py-12 text-slate-500">Loading images...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">ImageKit Images</h1>

        <div className="flex items-center gap-3">
          {uploadSuccess && (
            <span className="text-sm text-green-600 font-medium">✓ Uploaded successfully</span>
          )}

          {/* Upload button */}
          <label
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white cursor-pointer transition ${
              uploading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg,image/jpg"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
              ref={fileInputRef}
            />
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading {uploadProgress}%
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Upload Image
              </>
            )}
          </label>
        </div>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div className="h-2 overflow-hidden rounded bg-slate-200">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Error messages */}
      {(error || uploadError) && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700 text-sm">
          {error || uploadError}
          {error && (
            <button
              onClick={() => { setError(null); fetchImages(); }}
              className="ml-4 underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && images.length === 0 && !error && (
        <div className="text-center py-12 text-slate-400">
          No images uploaded yet. Click &quot;Upload Image&quot; to add one.
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {images.map((img) => (
            <div
              key={img.fileId}
              className="group relative rounded-xl border border-slate-200 bg-white p-2 shadow-sm hover:shadow-md transition"
            >
              {/* Thumbnail */}
              <div
                className="aspect-square overflow-hidden rounded-lg bg-slate-100 cursor-pointer"
                onClick={() => setSelectedImage(img.url)}
              >
                <img
                  src={img.thumbnail}
                  alt={img.name}
                  className="h-full w-full object-cover hover:scale-105 transition-transform"
                />
              </div>

              {/* Info */}
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-slate-700 truncate" title={img.name}>
                  {img.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {img.width}x{img.height} · {formatSize(img.size)}
                </p>
              </div>

              {/* Hover actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                {/* Copy URL */}
                <button
                  onClick={() => copyToClipboard(img.url)}
                  className="rounded-md bg-white p-1 shadow text-slate-500 hover:text-blue-600"
                  title="Copy URL"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>

                {/* Delete */}
                <button
                  onClick={() => setDeleteId(img.fileId)}
                  className="rounded-md bg-white p-1 shadow text-slate-500 hover:text-red-600"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Delete Image</h3>
            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes the image from ImageKit. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] rounded-lg bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow hover:bg-slate-100"
              onClick={() => setSelectedImage(null)}
            >
              ✕
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