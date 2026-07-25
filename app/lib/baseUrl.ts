// lib/baseUrl.ts
export function getBaseUrl() {
  // On the client, relative URLs are fine
  if (typeof window !== "undefined") return "";

  // On the server, need absolute URL
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return `https://${vercel}`;
  }

  // Local dev fallback
  return "http://localhost:3000";
}