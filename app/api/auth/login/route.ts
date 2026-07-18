import { NextResponse } from "next/server";
import {
  authenticateUser,
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

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const errors = validateCredentials(body, false);
  if (Object.keys(errors).length) {
    return NextResponse.json(
      { error: "Check your details.", fields: errors },
      { status: 400 },
    );
  }

  try {
    const result = await authenticateUser(body.email!, body.password!);
    if (!result) {
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    }
    const response = NextResponse.json({ user: result.user });
    response.cookies.set(
      sessionCookie(
        result.sessionToken,
        new URL(request.url).protocol === "https:",
      ),
    );
    return response;
  } catch (error) {
    console.error("Sign in failed", error);
    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 },
    );
  }
}
