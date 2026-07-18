import { NextResponse } from "next/server";
import {
  deleteSession,
  requestHasValidOrigin,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  try {
    await deleteSession(token ? decodeURIComponent(token) : undefined);
  } catch (error) {
    console.error("Session cleanup failed", error);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
