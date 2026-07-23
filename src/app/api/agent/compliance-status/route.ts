import { NextResponse } from "next/server";
import { getComplianceState } from "@/lib/compliance-store";

export async function GET() {
  return NextResponse.json(getComplianceState());
}
