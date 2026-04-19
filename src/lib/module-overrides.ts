import { kv } from "@vercel/kv";
import { modules, type Course } from "@/data/modules";
import { resources } from "@/data/resources";

export type ModuleOverride = { enabled: boolean };

const KV_KEY_PREFIX = "module-override:";

function isKvConfigured() {
  return Boolean(
    process.env.KV_REST_API_URL &&
      (process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN),
  );
}

export async function getOverrides(): Promise<Record<string, ModuleOverride>> {
  if (!isKvConfigured()) return {};

  try {
    const allIds = [...modules, ...resources].map((item) => item.id);
    const keys = allIds.map((id) => `${KV_KEY_PREFIX}${id}`);
    const values = await kv.mget<Array<ModuleOverride | null>>(...keys);

    const result: Record<string, ModuleOverride> = {};
    allIds.forEach((id, index) => {
      const value = values[index];
      if (value) result[id] = value;
    });
    return result;
  } catch (error) {
    console.error("[module-overrides] KV read failed, using defaults:", error);
    return {};
  }
}

export async function setOverride(id: string, override: ModuleOverride): Promise<void> {
  if (!isKvConfigured()) {
    throw new Error("KV storage is not configured");
  }
  await kv.set(`${KV_KEY_PREFIX}${id}`, override);
}

export function applyOverrides<T extends Course>(
  items: T[],
  overrides: Record<string, ModuleOverride>,
): T[] {
  return items.map((item) => {
    const override = overrides[item.id];
    if (!override) return item;
    return { ...item, enabled: override.enabled };
  });
}

export async function getEffectiveModules(): Promise<Course[]> {
  const overrides = await getOverrides();
  return applyOverrides(modules, overrides);
}

export async function getEffectiveResources(): Promise<Course[]> {
  const overrides = await getOverrides();
  return applyOverrides(resources, overrides);
}

export function kvStatus() {
  return {
    configured: isKvConfigured(),
  };
}
