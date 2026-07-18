import { NextResponse } from "next/server";
import {
  createUser,
  requestHasValidOrigin,
  sessionCookie,
  validateCredentials,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4_096) {
    return NextResponse.json(
      { error: "Request is too large." },
      { status: 413 },
    );
  }

  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const errors = validateCredentials(body, true);
  if (Object.keys(errors).length) {
    return NextResponse.json(
      { error: "Check your details.", fields: errors },
      { status: 400 },
    );
  }

  try {
    const result = await createUser({
      name: body.name!,
      email: body.email!,
      password: body.password!,
    });
    const response = NextResponse.json({ user: result.user }, { status: 201 });
    response.cookies.set(
      sessionCookie(
        result.sessionToken,
        new URL(request.url).protocol === "https:",
      ),
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }
    console.error("Account creation failed", error);
    return NextResponse.json(
      { error: "Unable to create your account right now." },
      { status: 500 },
    );
  }
}
