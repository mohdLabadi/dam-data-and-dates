import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { signIn } from "@/lib/auth";
import { isDevelopmentEnvironment } from "@/lib/constants";

/** Same-origin relative paths only — blocks open redirects. */
function sanitizeRedirectUrl(raw: string | null): string {
  if (!raw) {
    return "/";
  }

  // Reject absolute / protocol-relative URLs; only allow same-app paths.
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("//") ||
    !raw.startsWith("/")
  ) {
    return "/";
  }

  return raw;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUrl = sanitizeRedirectUrl(searchParams.get("redirectUrl"));

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return signIn("guest", { redirect: true, redirectTo: redirectUrl });
}
