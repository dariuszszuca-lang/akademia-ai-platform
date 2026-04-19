import { NextResponse } from "next/server";
import { getEffectiveModules, getEffectiveResources } from "@/lib/module-overrides";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [modules, resources] = await Promise.all([
    getEffectiveModules(),
    getEffectiveResources(),
  ]);

  return NextResponse.json(
    { modules, resources },
    {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    },
  );
}
