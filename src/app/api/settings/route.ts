import { NextResponse } from "next/server";
import { getSettings, saveSettings, AppSettings } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<AppSettings>;
  saveSettings(body);
  return NextResponse.json(getSettings());
}
