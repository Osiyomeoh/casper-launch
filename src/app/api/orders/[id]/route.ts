import { NextResponse } from "next/server";
import { updateOrderStatus } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = await req.json() as { status: "filled" | "cancelled" };
    if (!["filled", "cancelled"].includes(status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    await updateOrderStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
