import { NextRequest } from "next/server";

type MinSession = {
  user: { role?: string; tenantId?: string };
};

/**
 * Returns the tenant ID that should be used for the current request.
 *
 * - Regular users: always their own tenantId from the JWT session.
 * - SUPER_ADMIN: the tenantId stored in the `x-tenant-id` cookie (set when
 *   the admin clicks "Entrar" on a tenant), or null if no tenant is selected.
 *
 * Every API route must call this instead of reading `session.user.tenantId`
 * directly, so SUPER_ADMIN can impersonate any tenant.
 */
export function getEffectiveTenantId(req: NextRequest, session: MinSession): string | null {
  if (session.user.role !== "SUPER_ADMIN") {
    return session.user.tenantId ?? null;
  }
  return req.cookies.get("x-tenant-id")?.value ?? null;
}
