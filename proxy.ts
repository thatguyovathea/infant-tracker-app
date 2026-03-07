import { NextResponse, type NextRequest } from "next/server"

// Auth protection is handled in individual page components.
// This proxy only refreshes the session cookie.
export async function proxy(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/log/:path*",
    "/family/:path*",
    "/settings/:path*",
  ],
}
