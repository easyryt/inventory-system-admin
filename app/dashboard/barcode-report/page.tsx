// app/dashboard/barcode-report/page.tsx
import { cookies } from "next/headers";
import PackedItemsPage from "./PackedItemsPage";

export default async function BarcodeReportPage() {
  // Read the token from the cookie on the server
  const token = (await cookies()).get("token")?.value;

  if (!token) {
    return (
      <p className="text-xs text-red-600">
        You must be logged in as ADMIN or PRINTER.
      </p>
    );
  }

  // Pass the token to the client component
  return <PackedItemsPage token={token} />;
}