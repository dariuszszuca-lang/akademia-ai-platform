import { kv } from "@vercel/kv";
import { defaultQuickActions, type QuickAction } from "@/data/quick-actions";

const KV_KEY = "quick-actions:list";

function isKvConfigured() {
  return Boolean(
    process.env.KV_REST_API_URL &&
      (process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN),
  );
}

export async function getQuickActions(): Promise<QuickAction[]> {
  if (!isKvConfigured()) return defaultQuickActions;
  try {
    const stored = await kv.get<QuickAction[]>(KV_KEY);
    if (stored && Array.isArray(stored)) return stored;
    return defaultQuickActions;
  } catch (error) {
    console.error("[quick-actions] KV read failed:", error);
    return defaultQuickActions;
  }
}

export async function saveQuickActions(list: QuickAction[]): Promise<void> {
  if (!isKvConfigured()) {
    throw new Error("KV storage is not configured");
  }
  await kv.set(KV_KEY, list);
}

export async function addQuickAction(action: Omit<QuickAction, "id">): Promise<QuickAction> {
  const list = await getQuickActions();
  const newAction: QuickAction = {
    ...action,
    id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  await saveQuickActions([...list, newAction]);
  return newAction;
}

export async function updateQuickAction(
  id: string,
  patch: Partial<Omit<QuickAction, "id">>,
): Promise<QuickAction | null> {
  const list = await getQuickActions();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const updated = { ...list[idx], ...patch };
  const next = [...list];
  next[idx] = updated;
  await saveQuickActions(next);
  return updated;
}

export async function deleteQuickAction(id: string): Promise<boolean> {
  const list = await getQuickActions();
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  await saveQuickActions(next);
  return true;
}
