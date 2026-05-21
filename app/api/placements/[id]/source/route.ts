import { NextRequest, NextResponse } from "next/server";
import { updatePlacementSource } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { source } = body as { source?: string };

  try {
    await updatePlacementSource(id, source ?? "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[placements/source] PATCH error:", err);
    return NextResponse.json({ error: "Erreur lors de la sauvegarde" }, { status: 500 });
  }
}
