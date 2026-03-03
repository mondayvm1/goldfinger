/**
 * Auth middleware — protects dashboard and API routes.
 * Unauthenticated users get redirected to /login.
 */
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/api/scan/:path*",
    "/api/trade/:path*",
    "/api/keys/:path*",
  ],
};
