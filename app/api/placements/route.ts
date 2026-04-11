import { NextResponse } from "next/server";
import { getAllPlacements } from "@/lib/db";

export async function GET() {
  try {
    const placements = await getAllPlacements();
    return NextResponse.json({ placements });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
