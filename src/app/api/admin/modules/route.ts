import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import {
  getEffectiveAgents,
  getEffectiveModules,
  getEffectiveResources,
  setOverride,
  kvStatus,
} from "@/lib/module-overrides";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [modules, resources, agents] = await Promise.all([
    getEffectiveModules(),
    getEffectiveResources(),
    getEffectiveAgents(),
  ]);

  return NextResponse.json({
    modules,
    resources,
    agents,
    kv: kvStatus(),
  });
}

export async function PATCH(request: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id, enabled } = body;
  if (!id || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Missing id or enabled" }, { status: 400 });
  }

  try {
    await setOverride(id, { enabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
