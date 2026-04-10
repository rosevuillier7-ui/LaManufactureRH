import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHash } from "crypto";

const COOKIE_NAME = "dashboard_auth";

function getExpectedToken() {
  const password = process.env.DASHBOARD_PASSWORD ?? "";
  return createHash("sha256").update(password).digest("hex");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth APIs
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/youtube/auth")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token !== getExpectedToken()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
