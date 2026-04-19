import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import {
  addQuickAction,
  deleteQuickAction,
  getQuickActions,
  updateQuickAction,
} from "@/lib/quick-actions";

export const dynamic = "force-dynamic";

function requireAuth() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const unauth = requireAuth();
  if (unauth) return unauth;
  const actions = await getQuickActions();
  return NextResponse.json({ actions });
}

export async function POST(request: Request) {
  const unauth = requireAuth();
  if (unauth) return unauth;

  let body: { name?: string; note?: string; href?: string; emoji?: string; tone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { name, note, href, emoji, tone } = body;
  if (!name || !href) {
    return NextResponse.json({ error: "name i href są wymagane" }, { status: 400 });
  }

  try {
    const created = await addQuickAction({
      name: name.slice(0, 40),
      note: (note ?? "").slice(0, 80),
      href,
      emoji: (emoji || "✨").slice(0, 4),
      tone: tone || "from-[color:var(--accent)] to-[color:var(--aqua)]",
    });
    return NextResponse.json({ action: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauth = requireAuth();
  if (unauth) return unauth;

  let body: { id?: string; name?: string; note?: string; href?: string; emoji?: string; tone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id, ...patch } = body;
  if (!id) {
    return NextResponse.json({ error: "id wymagane" }, { status: 400 });
  }

  try {
    const updated = await updateQuickAction(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
    }
    return NextResponse.json({ action: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const unauth = requireAuth();
  if (unauth) return unauth;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id wymagane" }, { status: 400 });
  }

  try {
    const ok = await deleteQuickAction(id);
    if (!ok) {
      return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
