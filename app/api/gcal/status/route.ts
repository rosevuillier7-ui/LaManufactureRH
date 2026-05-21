import { NextResponse } from "next/server";
import { getAccountsStatus } from "@/lib/gcal";

export async function GET() {
  const accounts = await getAccountsStatus();
  // `connected` (top-level) = the default account (flaubert), kept for the
  // podcast page which still calls this endpoint without an account.
  const flaubert = accounts.find((a) => a.key === "flaubert");
  return NextResponse.json({
    connected: !!flaubert?.connected,
    accounts,
  });
}
