import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function isSuperAdmin(session: { user?: { role?: string } } | null): boolean {
  return session?.user?.role === "SUPER_ADMIN";
}

const COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false, // must be false so the client can read them for the TenantBanner
};

// GET — returns the currently selected tenant (so the banner can hydrate on SSR)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!isSuperAdmin(session)) return NextResponse.json({ selected: null });

  const tenantId = req.cookies.get("x-tenant-id")?.value;
  if (!tenantId) return NextResponse.json({ selected: null });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, primaryColor: true },
    });
    return NextResponse.json({ selected: tenant ?? null });
  } catch {
    return NextResponse.json({ selected: null });
  }
}

// POST — select a tenant (SUPER_ADMIN enters a tenant's environment)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { tenantId } = body;
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, primaryColor: true },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const res = NextResponse.json({ tenant });
  res.cookies.set("x-tenant-id",    tenant.id, COOKIE_OPTS);
  res.cookies.set("x-tenant-name",  encodeURIComponent(tenant.name), COOKIE_OPTS);
  res.cookies.set("x-tenant-color", encodeURIComponent(tenant.primaryColor ?? "#0284c7"), COOKIE_OPTS);
  return res;
}

// DELETE — exit tenant impersonation
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete("x-tenant-id");
  res.cookies.delete("x-tenant-name");
  res.cookies.delete("x-tenant-color");
  return res;
}
