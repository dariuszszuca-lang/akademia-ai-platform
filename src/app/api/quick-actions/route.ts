import { NextResponse } from "next/server";
import { getQuickActions } from "@/lib/quick-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const actions = await getQuickActions();
  return NextResponse.json({ actions });
}
