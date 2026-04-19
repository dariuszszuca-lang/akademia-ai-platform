import { kv } from "@vercel/kv";

export type PostCategory = "Wygrana" | "Pytanie" | "Materiał" | "Ogłoszenie" | "Dyskusja";

export type CommunityPost = {
  id: string;
  category: PostCategory;
  author: string;
  authorEmail: string;
  authorSub: string;
  title: string;
  body: string;
  createdAt: string;
};

const KV_KEY = "community:posts";

function isKvConfigured() {
  return Boolean(
    process.env.KV_REST_API_URL &&
      (process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN),
  );
}

export async function getPosts(): Promise<CommunityPost[]> {
  if (!isKvConfigured()) return [];
  try {
    const list = (await kv.get<CommunityPost[]>(KV_KEY)) ?? [];
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.error("[community-posts] KV read failed:", error);
    return [];
  }
}

export async function createPost(
  input: Omit<CommunityPost, "id" | "createdAt">,
): Promise<CommunityPost> {
  if (!isKvConfigured()) {
    throw new Error("KV storage is not configured");
  }

  const post: CommunityPost = {
    ...input,
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  const existing = (await kv.get<CommunityPost[]>(KV_KEY)) ?? [];
  await kv.set(KV_KEY, [post, ...existing].slice(0, 500));
  return post;
}

export async function deletePost(id: string): Promise<boolean> {
  if (!isKvConfigured()) {
    throw new Error("KV storage is not configured");
  }
  const existing = (await kv.get<CommunityPost[]>(KV_KEY)) ?? [];
  const next = existing.filter((p) => p.id !== id);
  if (next.length === existing.length) return false;
  await kv.set(KV_KEY, next);
  return true;
}

export const categoryColors: Record<PostCategory, string> = {
  Wygrana: "var(--accent)",
  Pytanie: "var(--muted-gold)",
  Materiał: "var(--rose)",
  Ogłoszenie: "var(--copper)",
  Dyskusja: "var(--plum)",
};
