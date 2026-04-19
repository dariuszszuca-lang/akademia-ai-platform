import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import {
  createPost,
  deletePost,
  getPosts,
  type PostCategory,
} from "@/lib/community-posts";

export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES: PostCategory[] = [
  "Wygrana",
  "Pytanie",
  "Materiał",
  "Ogłoszenie",
  "Dyskusja",
];

export async function GET() {
  const posts = await getPosts();
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  let body: {
    category?: string;
    title?: string;
    body?: string;
    authorEmail?: string;
    authorName?: string;
    authorSub?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { category, title, body: content, authorEmail, authorName, authorSub } = body;

  if (!category || !ALLOWED_CATEGORIES.includes(category as PostCategory)) {
    return NextResponse.json(
      { error: "Nieprawidłowa kategoria" },
      { status: 400 },
    );
  }

  if (!title || typeof title !== "string" || title.trim().length < 3) {
    return NextResponse.json(
      { error: "Tytuł musi mieć co najmniej 3 znaki" },
      { status: 400 },
    );
  }

  if (!content || typeof content !== "string" || content.trim().length < 5) {
    return NextResponse.json(
      { error: "Treść musi mieć co najmniej 5 znaków" },
      { status: 400 },
    );
  }

  if (!authorEmail || !authorName || !authorSub) {
    return NextResponse.json(
      { error: "Brak danych autora. Zaloguj się ponownie." },
      { status: 401 },
    );
  }

  try {
    const post = await createPost({
      category: category as PostCategory,
      author: authorName,
      authorEmail,
      authorSub,
      title: title.trim().slice(0, 200),
      body: content.trim().slice(0, 5000),
    });
    return NextResponse.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const ok = await deletePost(id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
