"use client";

// app/dashboard/product-designs/CreateDesignForm.tsx
import { useMemo, useState, type ChangeEvent } from "react";

type MetaField = { key: string; label: string; type: string; required: boolean };
type Category = { _id: string; name: string; metaFields: MetaField[] };
type Product = { _id: string; name: string; categoryId: Category; attributes: Record<string, string>; skuBase: string; isActive: boolean; createdAt: string; updatedAt: string };
type DesignFormState = { productId: string; name: string; mode: string; designCode: string; designUrl: string; notes: string };
type ProductDesign = { _id: string; productId: string; name: string; mode: string; designCode: string; designUrl?: string; notes?: string; isActive: boolean; createdAt: string; updatedAt: string };
type Props = { products: Product[]; token: string };

const API_URL = "https://inventory-system-ecew.onrender.com/api/product-designs";
const IMAGEKIT_AUTH_URL = "/api/imagekit-auth";
const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!;
const MAX_FILE_BYTES = 300 * 1024;
const MODES = ["SCREEN_PRINT", "HEAT_TRANSFER", "EMBROIDERY", "DTF", "OTHER"];
const emptyForm: DesignFormState = { productId: "", name: "", mode: "SCREEN_PRINT", designCode: "", designUrl: "", notes: "" };

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This image could not be read.")); };
  image.src = url;
});

type CheckedImage = { file: File; width: number; height: number };

/** Strictly accepts only supported images that are already at or below 300 KB. */
async function validateDesignImage(file: File): Promise<CheckedImage> {
  const acceptedTypes = ["image/png", "image/webp", "image/jpeg"];
  if (!acceptedTypes.includes(file.type)) throw new Error("Only PNG, WebP, JPG, and JPEG files are supported.");
  if (file.size > MAX_FILE_BYTES) throw new Error(`Image is ${(file.size / 1024).toFixed(0)} KB. Please select an image under 300 KB.`);
  const image = await loadImage(file);
  return { file, width: image.naturalWidth, height: image.naturalHeight };
}

async function uploadToImageKit(file: File, onProgress: (progress: number) => void): Promise<string> {
  const authResponse = await fetch(IMAGEKIT_AUTH_URL);
  if (!authResponse.ok) throw new Error("Image upload authentication failed.");
  const { signature, expire, token } = await authResponse.json();
  const body = new FormData();
  body.append("file", file);
  body.append("fileName", file.name);
  body.append("folder", "/product-designs");
  body.append("useUniqueFileName", "true");
  body.append("publicKey", IMAGEKIT_PUBLIC_KEY);
  body.append("signature", signature);
  body.append("expire", String(expire));
  body.append("token", token);
  return await new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "https://upload.imagekit.io/api/v1/files/upload");
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error("Image upload failed. Check your internet connection."));
    request.onload = () => {
      let result: { url?: string; message?: string } = {};
      try { result = JSON.parse(request.responseText || "{}"); } catch { reject(new Error("ImageKit returned an invalid response.")); return; }
      if (request.status < 200 || request.status >= 300 || !result.url) reject(new Error(result.message || "ImageKit upload failed."));
      else resolve(String(result.url));
    };
    request.send(body);
  });
}

export default function CreateDesignForm({ products, token }: Props) {
  const [form, setForm] = useState<DesignFormState>(emptyForm);
  const [designs, setDesigns] = useState<ProductDesign[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedProduct = useMemo(() => products.find((product) => product._id === form.productId), [products, form.productId]);
  const change = (key: keyof DesignFormState, value: string) => { setForm((previous) => ({ ...previous, [key]: value })); setError(""); setMessage(""); };
  const reset = (keepProduct = true) => { setForm({ ...emptyForm, productId: keepProduct ? form.productId : "" }); setEditingId(null); setError(""); };

  const loadDesigns = async (productId: string) => {
    if (!productId || !token) { setDesigns([]); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API_URL}/product/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not load designs.");
      setDesigns(Array.isArray(data.designs) ? data.designs : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load designs."); setDesigns([]); }
    finally { setLoading(false); }
  };

  const chooseProduct = (productId: string) => { setForm({ ...emptyForm, productId }); setEditingId(null); setMessage(""); loadDesigns(productId); };
  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const source = event.target.files?.[0];
    event.target.value = "";
    if (!source) return;
    setUploading(true); setError(""); setMessage("");
    try {
      const checked = await validateDesignImage(source);
      const url = await uploadToImageKit(checked.file, setUploadProgress);
      setForm((previous) => ({ ...previous, designUrl: url }));
      const sizeNote = `${(checked.file.size / 1024).toFixed(0)} KB`;
      const dimensionNote = checked.width === 3024 && checked.height === 4032 ? "Recommended size confirmed: 3024 x 4032." : `Uploaded: ${checked.width} x ${checked.height}. Recommended: 3024 x 4032.`;
      setMessage(`Image uploaded (${sizeNote}). ${dimensionNote}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Image upload failed."); }
    finally { setUploading(false); setUploadProgress(0); }
  };

  const save = async () => {
    if (!token) return setError("No token provided. Please log in again.");
    if (!form.productId || !form.name.trim() || !form.mode || !form.designCode.trim()) return setError("Product, name, mode, and design code are required.");
    const payload = { productId: form.productId, name: form.name.trim(), mode: form.mode, designCode: form.designCode.trim().toUpperCase(), designUrl: form.designUrl.trim(), notes: form.notes.trim() };
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not save design.");
      const saved = data.design || data.productDesign || data;
      setDesigns((previous) => editingId ? previous.map((item) => item._id === editingId ? saved : item) : [...previous, saved]);
      reset(); setMessage(editingId ? "Design updated." : "Design created.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save design."); }
    finally { setSaving(false); }
  };

  const edit = (design: ProductDesign) => { setEditingId(design._id); setForm({ productId: design.productId, name: design.name || "", mode: design.mode || "SCREEN_PRINT", designCode: design.designCode || "", designUrl: design.designUrl || "", notes: design.notes || "" }); setError(""); setMessage(""); };
  const remove = async (id: string) => {
    if (!token) return;
    setDeletingId(id); setError("");
    try { const response = await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "Could not delete design."); setDesigns((previous) => previous.filter((design) => design._id !== id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete design."); }
    finally { setDeletingId(null); }
  };

  return <div className="space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-slate-800">1. Select product</h2><select value={form.productId} onChange={(event) => chooseProduct(event.target.value)} className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs"><option value="">Select a product...</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name} - {product.categoryId?.name}</option>)}</select>{selectedProduct && <p className="mt-2 text-xs text-slate-600">Category: {selectedProduct.categoryId?.name} | SKU: {selectedProduct.skuBase}</p>}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-slate-800">2. Design details</h2><div className="mt-3 grid gap-3 md:grid-cols-2"><div className="space-y-3"><label className="block text-xs text-slate-600">Design name<input value={form.name} onChange={(event) => change("name", event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label><label className="block text-xs text-slate-600">Mode<select value={form.mode} onChange={(event) => change("mode", event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1">{MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label><label className="block text-xs text-slate-600">Design code<input value={form.designCode} onChange={(event) => change("designCode", event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono" /></label></div><div className="space-y-3"><div><p className="text-xs font-medium text-slate-700">Design image</p><label className={`mt-2 flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-4 text-xs ${uploading ? "cursor-wait border-slate-300 bg-slate-50 text-slate-400" : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}><input type="file" accept=".png,.webp,.jpg,.jpeg,image/png,image/webp,image/jpeg" onChange={chooseImage} disabled={uploading} className="sr-only" />{uploading ? `Uploading ${uploadProgress}%...` : "Choose image"}</label><p className="mt-2 text-[11px] text-slate-500">PNG, WebP, JPG, or JPEG only. Maximum file size: 300 KB. Recommended: 3024 x 4032 px.</p>{uploading && <div className="mt-2 h-2 overflow-hidden rounded bg-slate-200"><div className="h-full bg-blue-600 transition-all" style={{ width: `${uploadProgress}%` }} /></div>}{form.designUrl && <img src={form.designUrl} alt="Design preview" className="mt-3 h-28 w-24 rounded border object-cover" />}</div><label className="block text-xs text-slate-600">Notes<textarea value={form.notes} onChange={(event) => change("notes", event.target.value)} rows={3} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label></div></div>{error && <p className="mt-3 text-xs text-red-600">{error}</p>}{message && <p className="mt-3 text-xs text-emerald-700">{message}</p>}<div className="mt-3 flex gap-2"><button type="button" onClick={save} disabled={saving || uploading} className="rounded bg-slate-800 px-4 py-1.5 text-xs text-white disabled:opacity-50">{saving ? "Saving..." : editingId ? "Update design" : "Create design"}</button>{editingId && <button type="button" onClick={() => reset()} className="rounded border px-3 py-1.5 text-xs">Cancel edit</button>}</div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-slate-800">3. Designs for selected product</h2>{loading ? <p className="mt-3 text-xs text-slate-500">Loading...</p> : designs.length === 0 ? <p className="mt-3 text-xs text-slate-400">No designs found for this product.</p> : <div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">Preview</th><th className="p-2">Name</th><th className="p-2">Mode</th><th className="p-2">Code</th><th className="p-2">Actions</th></tr></thead><tbody>{designs.map((design) => <tr key={design._id} className="border-t"><td className="p-2">{design.designUrl ? <img src={design.designUrl} alt="" className="h-10 w-8 rounded object-cover" /> : "-"}</td><td className="p-2">{design.name}</td><td className="p-2">{design.mode}</td><td className="p-2 font-mono">{design.designCode}</td><td className="p-2"><div className="flex gap-2"><button type="button" onClick={() => edit(design)} className="rounded border px-2 py-1">Edit</button><button type="button" onClick={() => remove(design._id)} disabled={deletingId === design._id} className="rounded border border-red-300 px-2 py-1 text-red-700">{deletingId === design._id ? "Deleting..." : "Delete"}</button></div></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
