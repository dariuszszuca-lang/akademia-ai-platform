import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ admin: isAuthenticated() });
}
