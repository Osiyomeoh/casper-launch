import { NextResponse } from "next/server";
import { getAgentState } from "@/lib/agent-store";

export async function GET() {
  return NextResponse.json(getAgentState());
}
