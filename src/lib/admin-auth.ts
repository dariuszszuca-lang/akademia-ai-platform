import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";
const SESSION_DURATION_DAYS = 7;

function getExpectedPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function getSessionToken() {
  const secret = process.env.ADMIN_SESSION_SECRET || getExpectedPassword();
  if (!secret) return "";
  return Buffer.from(`admin:${secret}`).toString("base64");
}

export function verifyPassword(input: string): boolean {
  const expected = getExpectedPassword();
  if (!expected) return false;
  return input === expected;
}

export function isAuthenticated(): boolean {
  const token = getSessionToken();
  if (!token) return false;
  const cookie = cookies().get(COOKIE_NAME);
  return cookie?.value === token;
}

export function createSessionResponse(redirectTo: string = "/admin") {
  const response = NextResponse.redirect(new URL(redirectTo, "http://placeholder"));
  const token = getSessionToken();
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60;
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
  return response;
}

export function setSessionCookie(response: NextResponse) {
  const token = getSessionToken();
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60;
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function isAdminConfigured(): boolean {
  return Boolean(getExpectedPassword());
}
